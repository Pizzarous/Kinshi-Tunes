import { type Buffer } from "node:buffer";
import { type ChildProcess, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
    createReadStream,
    createWriteStream,
    existsSync,
    mkdirSync,
    readdirSync,
    type ReadStream,
    renameSync,
    rmSync,
    statSync
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { PassThrough, type Readable } from "node:stream";
import { clearInterval, setInterval, setTimeout } from "node:timers";
import { exec } from "../../../yt-dlp-utils/index.js";
import type { KinshiTunes } from "../../structures/KinshiTunes.js";

function killProcessTree(proc: ChildProcess): void {
    if (!proc.pid) return;
    try {
        if (process.platform === "win32") {
            execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
        } else {
            proc.kill("SIGKILL");
        }
    } catch {}
}

const PRE_CACHE_AHEAD_COUNT = 5;
const MAX_CACHE_SIZE_MB = 2000;
const MAX_CACHE_FILES = 200;
const PRE_CACHE_RETRY_COUNT = 2;
const QUEUE_PROCESSING_DELAY_MS = 50;
const MAX_PRE_CACHE_RETRIES = 2;
const MAX_CONCURRENT_PRECACHE = 2;

export class AudioCacheManager {
    public readonly cacheDir: string;
    private readonly instanceId = randomUUID().slice(0, 8);
    private readonly cachedFiles = new Map<string, { path: string; lastAccess: number }>();
    private readonly inProgressFiles = new Set<string>();
    private readonly inProgressProcs = new Map<
        string,
        { proc?: ChildProcess; stream?: Readable; writeStreamPath?: string; guildId: string }
    >();
    private readonly failedUrls = new Map<string, { count: number; lastAttempt: number }>();
    private readonly preCacheQueue: { url: string; guildId: string }[] = [];
    private isProcessingQueue = false;

    public constructor(public readonly client: KinshiTunes) {
        this.cacheDir = path.resolve(process.cwd(), "cache", "audio");
        this.ensureCacheDir();
        this.loadExistingCache();
    }

    private ensureCacheDir(): void {
        if (!existsSync(this.cacheDir)) {
            mkdirSync(this.cacheDir, { recursive: true });
            this.client.logger.debug("[AudioCacheManager] Cache directory created.");
        }
    }

    private loadExistingCache(): void {
        try {
            const files = readdirSync(this.cacheDir);

            // Clean up any leftover .part files from previous crashes (including from this instance)
            const partFiles = files.filter(f => f.endsWith(".opus.part"));
            for (const file of partFiles) {
                try {
                    rmSync(path.join(this.cacheDir, file), { force: true });
                } catch {}
            }

            const opusFiles = files.filter(f => /^[a-f0-9]{32}\.opus$/.test(f));
            for (const file of opusFiles) {
                const filePath = path.join(this.cacheDir, file);
                try {
                    const stats = statSync(filePath);
                    if (stats.size >= 1024) {
                        const key = file.replace(".opus", "");
                        this.cachedFiles.set(key, { path: filePath, lastAccess: stats.mtimeMs });
                    } else {
                        rmSync(filePath, { force: true });
                    }
                } catch {}
            }
            if (this.cachedFiles.size > 0) {
                this.client.logger.info(`[AudioCacheManager] Loaded ${this.cachedFiles.size} cached files from disk.`);
            }
        } catch {}
    }

    public getCacheKey(url: string): string {
        return createHash("md5").update(url).digest("hex");
    }

    public getCachePath(url: string): string {
        const key = this.getCacheKey(url);
        return path.join(this.cacheDir, `${key}.opus`);
    }

    private getPartPath(key: string): string {
        return path.join(this.cacheDir, `${key}.${this.instanceId}.opus.part`);
    }

    public invalidateCache(url: string): void {
        const key = this.getCacheKey(url);
        const entry = this.cachedFiles.get(key);
        if (entry) {
            try {
                rmSync(entry.path, { force: true });
            } catch {}
            this.cachedFiles.delete(key);
            this.client.logger.warn(`[AudioCacheManager] Invalidated bad cache for: ${url.substring(0, 50)}...`);
        }
    }

    public isCached(url: string): boolean {
        const key = this.getCacheKey(url);
        const cachePath = this.getCachePath(url);

        if (this.inProgressFiles.has(key)) {
            return false;
        }

        if (this.cachedFiles.has(key) && existsSync(cachePath)) {
            return true;
        }

        return false;
    }

    public isInProgress(url: string): boolean {
        const key = this.getCacheKey(url);
        return this.inProgressFiles.has(key);
    }

    public getFromCache(url: string): ReadStream | null {
        if (!this.isCached(url)) {
            return null;
        }

        const cachePath = this.getCachePath(url);
        const key = this.getCacheKey(url);

        try {
            if (!existsSync(cachePath)) {
                this.client.logger.warn(
                    `[AudioCacheManager] Cached file missing for ${url.substring(0, 50)}..., removing from cache`
                );
                this.cachedFiles.delete(key);
                return null;
            }

            const stats = statSync(cachePath);
            if (stats.size < 1024) {
                this.client.logger.warn(
                    `[AudioCacheManager] Cached file too small (${stats.size} bytes) for ${url.substring(0, 50)}..., removing invalid cache`
                );
                this.cachedFiles.delete(key);
                rmSync(cachePath, { force: true });
                return null;
            }
        } catch (error) {
            this.client.logger.error(
                `[AudioCacheManager] Error validating cache for ${url.substring(0, 50)}...:`,
                error
            );
            this.cachedFiles.delete(key);
            return null;
        }

        const cacheEntry = this.cachedFiles.get(key);
        if (cacheEntry) {
            cacheEntry.lastAccess = Date.now();
        }

        this.client.logger.debug(`[AudioCacheManager] Cache hit for: ${url.substring(0, 50)}...`);
        return createReadStream(cachePath);
    }

    public cacheStream(url: string, sourceStream: Readable, proc: ChildProcess, guildId: string): Readable {
        const cachePath = this.getCachePath(url);
        const key = this.getCacheKey(url);
        const partPath = this.getPartPath(key);

        this.inProgressFiles.add(key);
        this.inProgressProcs.set(key, { proc, stream: sourceStream, writeStreamPath: partPath, guildId });

        const playbackStream = new PassThrough();
        const cachePassThrough = new PassThrough();
        const writeStream = createWriteStream(partPath);

        let sourceEndedNaturally = false;
        sourceStream.on("end", () => {
            sourceEndedNaturally = true;
            this.client.logger.debug(
                `[AudioCacheManager] Live-cache source ended naturally: ${url.substring(0, 50)}...`
            );
        });

        sourceStream.on("close", () => {
            if (!sourceEndedNaturally) {
                this.client.logger.debug(
                    `[AudioCacheManager] Live-cache source closed early (skipped/stopped): ${url.substring(0, 50)}...`
                );
                // pipe() only calls cachePassThrough.end() on 'end', not 'close'
                // so if source is destroyed, writeStream hangs open forever — force-end it
                cachePassThrough.end();
            }
        });

        sourceStream.pipe(playbackStream);
        sourceStream.pipe(cachePassThrough);
        cachePassThrough.pipe(writeStream);

        // When playbackStream is destroyed (FFmpeg cleaned up on skip/stop),
        // destroy the source stream to cancel the yt-dlp download.
        // The 'close' handler above will then call cachePassThrough.end()
        // which triggers writeStream finish → .part file deleted.
        // For natural end, sourceStream is already done by the time playbackStream closes, so destroy() is a no-op.
        playbackStream.on("close", () => {
            if (!sourceEndedNaturally) {
                killProcessTree(proc);
                sourceStream.destroy();
            }
        });

        writeStream.on("error", error => {
            this.client.logger.error("[AudioCacheManager] Error writing cache file:", error);
            this.inProgressFiles.delete(key);
            this.cachedFiles.delete(key);
            this.inProgressProcs.delete(key);
            try {
                rmSync(partPath, { force: true });
            } catch {}
        });

        writeStream.on("finish", () => {
            this.inProgressFiles.delete(key);
            this.inProgressProcs.delete(key);

            if (!sourceEndedNaturally) {
                this.client.logger.debug(
                    `[AudioCacheManager] Stream interrupted for ${url.substring(0, 50)}..., discarding partial cache`
                );
                try {
                    rmSync(partPath, { force: true });
                } catch {}
                return;
            }

            try {
                const stats = statSync(partPath);
                if (stats.size < 1024) {
                    this.client.logger.warn(
                        `[AudioCacheManager] Cached file too small (${stats.size} bytes) for ${url.substring(0, 50)}..., discarding`
                    );
                    rmSync(partPath, { force: true });
                    return;
                }
                if (existsSync(cachePath)) {
                    rmSync(partPath, { force: true });
                } else {
                    renameSync(partPath, cachePath);
                }
            } catch {
                this.client.logger.warn(
                    `[AudioCacheManager] Could not finalize cached file for ${url.substring(0, 50)}..., discarding`
                );
                try {
                    rmSync(partPath, { force: true });
                } catch {}
                return;
            }

            this.cachedFiles.set(key, { path: cachePath, lastAccess: Date.now() });
            this.client.logger.info(`[AudioCacheManager] Cached audio for: ${url.substring(0, 50)}...`);
            this.failedUrls.delete(key);
            void this.cleanupOldCache();
        });

        sourceStream.on("error", error => {
            this.client.logger.error("[AudioCacheManager] Source stream error:", error);
            playbackStream.destroy(error);
            this.inProgressFiles.delete(key);
            this.cachedFiles.delete(key);
            this.inProgressProcs.delete(key);
            try {
                rmSync(partPath, { force: true });
            } catch {}
        });

        return playbackStream;
    }

    public async preCacheUrl(url: string, priority = false, guildId = ""): Promise<boolean> {
        if (this.isCached(url)) {
            return true;
        }

        const key = this.getCacheKey(url);
        if (this.inProgressFiles.has(key)) {
            return true;
        }

        const failedInfo = this.failedUrls.get(key);
        if (failedInfo && failedInfo.count >= PRE_CACHE_RETRY_COUNT) {
            const timeSinceLastAttempt = Date.now() - failedInfo.lastAttempt;
            if (timeSinceLastAttempt < 60_000) {
                return false;
            }
            this.failedUrls.delete(key);
        }

        if (priority) {
            const index = this.preCacheQueue.findIndex(e => e.url === url);
            if (index > 0) {
                this.preCacheQueue.splice(index, 1);
            }
            if (index !== 0) {
                this.preCacheQueue.unshift({ url, guildId });
            }
        } else if (!this.preCacheQueue.some(e => e.url === url)) {
            this.preCacheQueue.push({ url, guildId });
        }

        void this.processQueue();
        return true;
    }

    public async preCacheMultiple(urls: string[], guildId = ""): Promise<void> {
        for (const url of urls.slice(0, PRE_CACHE_AHEAD_COUNT)) {
            if (url && !this.isCached(url) && !this.isInProgress(url)) {
                await this.preCacheUrl(url, false, guildId);
            }
        }
    }

    public async waitForCache(url: string, timeoutMs = 300_000): Promise<boolean> {
        const key = this.getCacheKey(url);

        if (this.isCached(url) && !this.isInProgress(url)) {
            return true;
        }

        if (!this.isInProgress(url) && !this.isCached(url)) {
            this.client.logger.info(
                `[AudioCacheManager] Cache not found for ${url.substring(0, 50)}..., starting high-priority cache`
            );
            await this.preCacheUrl(url, true);
        }

        const startTime = Date.now();
        const pollInterval = 200;

        return new Promise<boolean>(resolve => {
            const checkCache = setInterval(() => {
                if (this.isCached(url) && !this.inProgressFiles.has(key)) {
                    clearInterval(checkCache);
                    resolve(true);
                    return;
                }

                if (Date.now() - startTime >= timeoutMs) {
                    clearInterval(checkCache);
                    resolve(false);
                    return;
                }

                const failedInfo = this.failedUrls.get(key);
                if (failedInfo && failedInfo.count >= PRE_CACHE_RETRY_COUNT) {
                    clearInterval(checkCache);
                    resolve(false);
                    return;
                }
            }, pollInterval);
        });
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.preCacheQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.preCacheQueue.length > 0) {
            const batch: { url: string; guildId: string }[] = [];
            while (batch.length < MAX_CONCURRENT_PRECACHE && this.preCacheQueue.length > 0) {
                const entry = this.preCacheQueue.shift();
                if (entry && !this.isCached(entry.url) && !this.isInProgress(entry.url)) {
                    batch.push(entry);
                }
            }

            if (batch.length > 0) {
                await Promise.all(batch.map(({ url, guildId }) => this.doPreCache(url, 0, guildId)));
            }

            if (this.preCacheQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, QUEUE_PROCESSING_DELAY_MS));
            }
        }

        this.isProcessingQueue = false;
    }

    private async doPreCache(url: string, retryCount = 0, guildId = ""): Promise<void> {
        const key = this.getCacheKey(url);

        try {
            const cachePath = this.getCachePath(url);
            const partPath = this.getPartPath(key);
            this.inProgressFiles.add(key);

            const proc = exec(
                url,
                { output: "-", quiet: true, format: "bestaudio", jsRuntimes: "node" },
                { stdio: ["ignore", "pipe", "pipe"] }
            );

            this.inProgressProcs.set(key, { proc, writeStreamPath: partPath, guildId });

            if (!proc.stdout) {
                this.inProgressFiles.delete(key);
                this.markFailed(key);
                return;
            }

            let stderrData = "";

            if (proc.stderr) {
                proc.stderr.on("data", (chunk: Buffer) => {
                    stderrData += chunk.toString();
                });

                proc.stderr.on("end", () => {
                    if (stderrData.trim()) {
                        this.client.logger.warn(
                            `[AudioCacheManager] yt-dlp stderr for ${url.substring(0, 50)}...: ${stderrData.substring(0, 500)}`
                        );
                    }
                });
            }

            const writeStream = createWriteStream(partPath);
            proc.stdout.pipe(writeStream);

            await new Promise<void>(resolve => {
                let writeDone = false;
                let procExitCode: number | null = null;

                const tryFinalize = (): void => {
                    if (!writeDone || procExitCode === null) return;

                    this.inProgressFiles.delete(key);
                    this.inProgressProcs.delete(key);

                    if (procExitCode !== 0) {
                        this.client.logger.debug(
                            `[AudioCacheManager] yt-dlp exited with code ${procExitCode} for ${url.substring(0, 50)}..., discarding`
                        );
                        try {
                            rmSync(partPath, { force: true });
                        } catch {}
                        if (retryCount < MAX_PRE_CACHE_RETRIES) {
                            setTimeout(
                                () => void this.doPreCache(url, retryCount + 1, guildId),
                                1000 * (retryCount + 1)
                            );
                        } else {
                            this.markFailed(key);
                        }
                        resolve();
                        return;
                    }

                    try {
                        const stats = statSync(partPath);
                        if (stats.size >= 1024) {
                            if (existsSync(cachePath)) {
                                rmSync(partPath, { force: true });
                            } else {
                                renameSync(partPath, cachePath);
                            }
                            this.cachedFiles.set(key, { path: cachePath, lastAccess: Date.now() });
                            this.failedUrls.delete(key);
                            this.client.logger.info(
                                `[AudioCacheManager] Pre-cached audio for: ${url.substring(0, 50)}...`
                            );
                        } else {
                            rmSync(partPath, { force: true });
                            if (retryCount < MAX_PRE_CACHE_RETRIES) {
                                setTimeout(
                                    () => void this.doPreCache(url, retryCount + 1, guildId),
                                    1000 * (retryCount + 1)
                                );
                            } else {
                                this.markFailed(key);
                            }
                        }
                    } catch {
                        this.markFailed(key);
                        try {
                            rmSync(partPath, { force: true });
                        } catch {}
                    }

                    resolve();
                };

                writeStream.on("finish", () => {
                    writeDone = true;
                    tryFinalize();
                });

                proc.on("close", code => {
                    procExitCode = code ?? 1;
                    if (procExitCode !== 0) {
                        this.client.logger.debug(
                            `[AudioCacheManager] Pre-cache yt-dlp exited with code ${procExitCode}: ${url.substring(0, 50)}...`
                        );
                    }
                    tryFinalize();
                });

                writeStream.on("error", () => {
                    this.inProgressFiles.delete(key);
                    this.inProgressProcs.delete(key);
                    this.markFailed(key);
                    try {
                        rmSync(partPath, { force: true });
                    } catch {}
                    resolve();
                });

                proc.on("error", () => {
                    this.inProgressFiles.delete(key);
                    this.inProgressProcs.delete(key);
                    this.markFailed(key);
                    try {
                        rmSync(partPath, { force: true });
                    } catch {}
                    resolve();
                });
            });

            void this.cleanupOldCache();
        } catch (error) {
            this.inProgressFiles.delete(key);
            this.markFailed(key);
            this.client.logger.debug(`[AudioCacheManager] Failed to pre-cache: ${(error as Error).message}`);
        }
    }

    private markFailed(key: string): void {
        const existing = this.failedUrls.get(key);
        this.failedUrls.set(key, {
            count: (existing?.count ?? 0) + 1,
            lastAttempt: Date.now()
        });
    }

    private async cleanupOldCache(): Promise<void> {
        const stats = this.getStats();

        if (stats.files > MAX_CACHE_FILES || stats.totalSize > MAX_CACHE_SIZE_MB * 1024 * 1024) {
            const sortedEntries = [...this.cachedFiles.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);

            let currentSize = stats.totalSize;
            let currentFiles = stats.files;

            for (const [key, entry] of sortedEntries) {
                if (currentFiles <= MAX_CACHE_FILES / 2 && currentSize <= (MAX_CACHE_SIZE_MB / 2) * 1024 * 1024) {
                    break;
                }

                try {
                    if (existsSync(entry.path)) {
                        const fileStats = statSync(entry.path);
                        rmSync(entry.path, { force: true });
                        currentSize -= fileStats.size;
                        currentFiles--;
                    }
                    this.cachedFiles.delete(key);
                } catch {}
            }

            this.client.logger.info(
                `[AudioCacheManager] Cleaned up cache: ${stats.files - currentFiles} files removed`
            );
        }
    }

    public clearCache(): void {
        this.cachedFiles.clear();
        this.inProgressFiles.clear();
        this.failedUrls.clear();
        this.preCacheQueue.length = 0;

        if (existsSync(this.cacheDir)) {
            rmSync(this.cacheDir, { recursive: true, force: true });
            this.ensureCacheDir();
            this.client.logger.info("[AudioCacheManager] Cache cleared.");
        }
    }

    public cleanupPartFiles(guildId: string): void {
        // Kill in-progress downloads belonging to this guild only
        for (const [key, procInfo] of this.inProgressProcs) {
            if (procInfo.guildId !== guildId) continue;
            if (procInfo.proc) killProcessTree(procInfo.proc);
            try {
                if (procInfo.stream && typeof procInfo.stream.destroy === "function") {
                    procInfo.stream.destroy();
                }
                if (procInfo.writeStreamPath && existsSync(procInfo.writeStreamPath)) {
                    rmSync(procInfo.writeStreamPath, { force: true });
                }
            } catch {}
            this.inProgressProcs.delete(key);
            this.inProgressFiles.delete(key);
        }

        // Remove queued pre-cache entries for this guild
        for (let i = this.preCacheQueue.length - 1; i >= 0; i--) {
            if (this.preCacheQueue[i]!.guildId === guildId) {
                this.preCacheQueue.splice(i, 1);
            }
        }
    }

    public clearCacheForUrls(urls: string[]): void {
        let removedCount = 0;
        for (const url of urls) {
            const key = this.getCacheKey(url);

            // Only cancel in-progress downloads — leave completed cache entries intact
            const procInfo = this.inProgressProcs.get(key);
            if (procInfo) {
                try {
                    if (procInfo.proc) killProcessTree(procInfo.proc);
                    if (procInfo.stream && typeof procInfo.stream.destroy === "function") {
                        procInfo.stream.destroy();
                    }
                    if (procInfo.writeStreamPath && existsSync(procInfo.writeStreamPath)) {
                        rmSync(procInfo.writeStreamPath, { force: true });
                        removedCount++;
                    }
                } catch {}
                this.inProgressProcs.delete(key);
                this.inProgressFiles.delete(key);
            }

            const queueIndex = this.preCacheQueue.findIndex(e => e.url === url);
            if (queueIndex !== -1) {
                this.preCacheQueue.splice(queueIndex, 1);
            }
        }

        if (removedCount > 0) {
            this.client.logger.info(
                `[AudioCacheManager] Cleared cache for ${removedCount} songs from destroyed queue.`
            );
        }
    }

    public getStats(): { files: number; totalSize: number; inProgress: number; failed: number; queued: number } {
        let totalSize = 0;
        let files = 0;

        for (const [key, entry] of this.cachedFiles) {
            if (existsSync(entry.path)) {
                const stats = statSync(entry.path);
                totalSize += stats.size;
                files++;
            } else {
                this.cachedFiles.delete(key);
            }
        }

        return {
            files,
            totalSize,
            inProgress: this.inProgressFiles.size,
            failed: this.failedUrls.size,
            queued: this.preCacheQueue.length
        };
    }
}
