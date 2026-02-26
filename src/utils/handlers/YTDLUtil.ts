import { type Buffer } from "node:buffer";
import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import { clearTimeout, setTimeout } from "node:timers";
import ytdl, { exec } from "../../../yt-dlp-utils/index.js";
import { streamStrategy } from "../../config/index.js";
import type { KinshiTunes } from "../../structures/KinshiTunes.js";
import type { BasicYoutubeVideoInfo } from "../../typings/index.js";
import { checkQuery } from "./GeneralUtil.js";

type Unpromisify<T> = T extends Promise<infer U> ? U : T;

const { stream: pldlStream, video_basic_info } = await import("../../../play-dl-importer/index.js")
    .then(x => x.default)
    .catch(() => ({ stream: null, video_basic_info: null }));

const MAX_TRANSIENT_RETRIES = 5;
const MAX_BACKOFF_DELAY_MS = 10_000;
const STREAM_VALIDATION_DELAY_MS = 200;

function isTransientError(errorMessage: string): boolean {
    const transientPatterns = [
        "connection reset",
        "connection timed out",
        "temporarily unavailable",
        "network is unreachable",
        "unable to download",
        "http error 503",
        "http error 502",
        "http error 500",
        "http error 504",
        "read timed out",
        "operation timed out",
        "incomplete read",
        "premature eof",
        "broken pipe",
        "connection aborted",
        "remote end closed",
        "transfer closed"
    ];
    const lowerError = errorMessage.toLowerCase();
    return transientPatterns.some(pattern => lowerError.includes(pattern));
}

export async function getStream(client: KinshiTunes, url: string): Promise<Readable> {
    if (streamStrategy === "play-dl") {
        const isSoundcloudUrl = checkQuery(url);
        if (isSoundcloudUrl.sourceType === "soundcloud") {
            return client.soundcloud.util.streamTrack(url) as unknown as Readable;
        }
        const rawPlayDlStream = await pldlStream?.(url, { discordPlayerCompatibility: true });
        return rawPlayDlStream?.stream as unknown as Readable;
    }

    if (client.audioCache.isCached(url) && !client.audioCache.isInProgress(url)) {
        client.logger.debug(`[YTDLUtil] Serving from cache: ${url.substring(0, 50)}...`);
        const cachedStream = createReadStream(client.audioCache.getCachePath(url));
        cachedStream.on("error", () => {
            client.audioCache.invalidateCache(url);
        });
        return cachedStream;
    }

    const rawStream = await attemptStreamWithRetry(client, url, 0);

    if (!client.audioCache.isInProgress(url)) {
        return client.audioCache.cacheStream(url, rawStream);
    }

    return rawStream;
}

async function attemptStreamWithRetry(client: KinshiTunes, url: string, retryCount: number): Promise<Readable> {
    return new Promise<Readable>((resolve, reject) => {
        const proc = exec(
            url,
            {
                output: "-",
                quiet: true,
                format: "bestaudio",
                limitRate: "300K",
                jsRuntimes: "node"
            },
            { stdio: ["ignore", "pipe", "pipe"] }
        );

        if (!proc.stdout) {
            reject(new Error("Error obtaining stdout from process."));
            return;
        }

        let stderrData = "";
        let hasHandledError = false;
        let hasResolved = false;
        let validationTimeout: NodeJS.Timeout | null = null;

        const handleTransientError = (errorMessage: string): void => {
            if (hasHandledError || !isTransientError(errorMessage)) return;
            hasHandledError = true;
            if (validationTimeout) {
                clearTimeout(validationTimeout);
                validationTimeout = null;
            }
            proc.kill("SIGKILL");
            if (retryCount < MAX_TRANSIENT_RETRIES) {
                client.logger.debug(
                    `[YTDLUtil] Transient error, retrying (${retryCount + 1}/${MAX_TRANSIENT_RETRIES}): ${url.substring(0, 50)}...`
                );
                const backoffDelay = Math.min(1000 * 2 ** retryCount, MAX_BACKOFF_DELAY_MS);
                setTimeout(() => {
                    attemptStreamWithRetry(client, url, retryCount + 1)
                        .then(resolve)
                        .catch(reject);
                }, backoffDelay);
            } else {
                reject(new Error(`Transient error after ${MAX_TRANSIENT_RETRIES} retries: ${errorMessage}`));
            }
        };

        if (proc.stderr) {
            proc.stderr.on("data", (chunk: Buffer) => {
                stderrData += chunk.toString();
                handleTransientError(stderrData);
            });
            proc.stderr.on("end", () => {
                if (stderrData.trim()) {
                    client.logger.warn(
                        `[YTDLUtil] yt-dlp stderr for ${url.substring(0, 50)}...: ${stderrData.substring(0, 500)}`
                    );
                }
            });
        }

        proc.once("error", err => {
            proc.kill("SIGKILL");
            if (validationTimeout) {
                clearTimeout(validationTimeout);
                validationTimeout = null;
            }
            if (!hasHandledError) {
                hasHandledError = true;
                reject(err);
            }
        });

        proc.stdout.once("error", err => {
            proc.kill("SIGKILL");
            if (validationTimeout) {
                clearTimeout(validationTimeout);
                validationTimeout = null;
            }
            if (!hasHandledError) {
                hasHandledError = true;
                reject(err);
            }
        });

        proc.once("close", code => {
            if (!hasResolved && !hasHandledError) {
                if (validationTimeout) {
                    clearTimeout(validationTimeout);
                    validationTimeout = null;
                }
                if (code !== 0) {
                    hasHandledError = true;
                    const errorMsg = stderrData.trim() || `Process exited with code ${code}`;
                    if (isTransientError(errorMsg) && retryCount < MAX_TRANSIENT_RETRIES) {
                        const backoffDelay = Math.min(1000 * 2 ** retryCount, MAX_BACKOFF_DELAY_MS);
                        setTimeout(() => {
                            attemptStreamWithRetry(client, url, retryCount + 1)
                                .then(resolve)
                                .catch(reject);
                        }, backoffDelay);
                    } else {
                        reject(new Error(`yt-dlp exited with code ${code}: ${stderrData}`));
                    }
                }
            }
        });

        proc.stdout.once("end", () => {
            proc.kill("SIGKILL");
        });

        void proc.once("spawn", () => {
            if (hasHandledError) return;
            validationTimeout = setTimeout(() => {
                validationTimeout = null;
                if (hasHandledError) return;
                hasResolved = true;
                resolve(proc.stdout as unknown as Readable);
            }, STREAM_VALIDATION_DELAY_MS);
        });
    });
}

export async function getInfo(url: string, client?: KinshiTunes): Promise<BasicYoutubeVideoInfo> {
    if (streamStrategy === "play-dl") {
        const rawPlayDlVideoInfo = (await video_basic_info?.(url)) as unknown as Unpromisify<
            ReturnType<NonNullable<typeof video_basic_info>>
        >;
        return {
            duration: rawPlayDlVideoInfo.video_details.durationInSec * 1_000,
            id: rawPlayDlVideoInfo.video_details.id ?? "",
            thumbnails: rawPlayDlVideoInfo.video_details.thumbnails,
            title: rawPlayDlVideoInfo.video_details.title ?? "",
            url: rawPlayDlVideoInfo.video_details.url
        };
    }
    return attemptGetInfoWithRetry(url, client, 0);
}

async function attemptGetInfoWithRetry(
    url: string,
    client: KinshiTunes | undefined,
    retryCount: number
): Promise<BasicYoutubeVideoInfo> {
    try {
        return await ytdl(url, { dumpJson: true, jsRuntimes: "node" });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (isTransientError(errorMessage) && retryCount < MAX_TRANSIENT_RETRIES) {
            client?.logger.warn(
                `[YTDLUtil] Transient error in getInfo, retrying (${retryCount + 1}/${MAX_TRANSIENT_RETRIES}): ${url.substring(0, 50)}...`
            );
            const backoffDelay = Math.min(1000 * 2 ** retryCount, MAX_BACKOFF_DELAY_MS);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            return attemptGetInfoWithRetry(url, client, retryCount + 1);
        }
        throw error;
    }
}

export function shouldRequeueOnError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return (
        isTransientError(errorMessage) || errorMessage.includes("socket hang up") || errorMessage.includes("econnreset")
    );
}
