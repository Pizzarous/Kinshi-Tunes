import type { Readable } from "node:stream";
import ytdl, { exec } from "../../../yt-dlp-utils/index.js";
import { streamStrategy } from "../../config/index.js";
import type { KinshiTunes } from "../../structures/KinshiTunes.js";
import type { BasicYoutubeVideoInfo } from "../../typings/index.js";
import { checkQuery } from "./GeneralUtil.js";

type Unpromisify<T> = T extends Promise<infer U> ? U : T;

const { stream: pldlStream, video_basic_info } = await import("../../../play-dl-importer/index.js")
    .then(x => x.default)
    .catch(() => ({ stream: null, video_basic_info: null }));

export async function getStream(client: KinshiTunes, url: string, retryCount = 0): Promise<Readable> {
    const maxRetries = 3;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

    try {
        if (streamStrategy === "play-dl") {
            const isSoundcloudUrl = checkQuery(url);
            if (isSoundcloudUrl.sourceType === "soundcloud") {
                client.debugLog.logData("info", "YTDL_UTIL", `Getting SoundCloud stream for: ${url}`);
                return client.soundcloud.util.streamTrack(url) as unknown as Readable;
            }

            client.debugLog.logData(
                "info",
                "YTDL_UTIL",
                `Getting play-dl stream for: ${url} (attempt ${retryCount + 1}/${maxRetries + 1})`
            );
            const rawPlayDlStream = await pldlStream?.(url, { discordPlayerCompatibility: true });

            if (!rawPlayDlStream?.stream) {
                throw new Error("play-dl returned null stream");
            }

            return rawPlayDlStream.stream as unknown as Readable;
        }

        client.debugLog.logData(
            "info",
            "YTDL_UTIL",
            `Getting yt-dlp stream for: ${url} (attempt ${retryCount + 1}/${maxRetries + 1})`
        );

        return new Promise<Readable>((resolve, reject) => {
            const proc = exec(
                url,
                {
                    output: "-",
                    quiet: true,
                    format: "bestaudio",
                    limitRate: "300K"
                },
                { stdio: ["ignore", "pipe", "ignore"] }
            );

            if (!proc.stdout) {
                const error = new Error("Error obtaining stdout from yt-dlp process");
                client.debugLog.logData("error", "YTDL_UTIL", `Failed to get stdout: ${error.message} for ${url}`);
                reject(error);
                return;
            }

            let hasResolved = false;
            const timeout = setTimeout(() => {
                if (!hasResolved) {
                    hasResolved = true;
                    proc.kill("SIGKILL");
                    const error = new Error("yt-dlp stream timeout after 30 seconds");
                    client.debugLog.logData("error", "YTDL_UTIL", `Stream timeout: ${error.message} for ${url}`);
                    reject(error);
                }
            }, 30000);

            proc.once("error", err => {
                if (!hasResolved) {
                    hasResolved = true;
                    clearTimeout(timeout);
                    proc.kill("SIGKILL");
                    client.debugLog.logData("error", "YTDL_UTIL", `yt-dlp process error: ${err.message} for ${url}`);
                    reject(err);
                }
            });

            proc.stdout.once("error", err => {
                if (!hasResolved) {
                    hasResolved = true;
                    clearTimeout(timeout);
                    proc.kill("SIGKILL");
                    client.debugLog.logData("error", "YTDL_UTIL", `yt-dlp stdout error: ${err.message} for ${url}`);
                    reject(err);
                }
            });

            proc.stdout.once("end", () => {
                clearTimeout(timeout);
                proc.kill("SIGKILL");
            });

            void proc.once("spawn", () => {
                if (!hasResolved) {
                    hasResolved = true;
                    clearTimeout(timeout);
                    client.debugLog.logData("info", "YTDL_UTIL", `Successfully spawned yt-dlp process for ${url}`);
                    resolve(proc.stdout as unknown as Readable);
                }
            });
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        client.debugLog.logData(
            "error",
            "YTDL_UTIL",
            `Stream error (attempt ${retryCount + 1}): ${errorMessage} for ${url}`
        );

        if (retryCount < maxRetries) {
            client.debugLog.logData("info", "YTDL_UTIL", `Retrying stream in ${retryDelay}ms for ${url}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return getStream(client, url, retryCount + 1);
        }

        client.debugLog.logData(
            "error",
            "YTDL_UTIL",
            `Failed to get stream after ${maxRetries + 1} attempts for ${url}`
        );
        throw new Error(`Failed to get audio stream after ${maxRetries + 1} attempts: ${errorMessage}`);
    }
}

export async function getInfo(url: string): Promise<BasicYoutubeVideoInfo> {
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
    return ytdl(url, {
        dumpJson: true
    });
}
