/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { URL } from "node:url";
import type { SearchResult, Video, VideoCompact } from "youtubei";
import { Playlist } from "youtubei";
import type { KinshiTunes } from "../../../structures/KinshiTunes.js";
import type { SearchTrackResult, Song, SpotifyTrack } from "../../../typings/index.js";
import { getInfo } from "../YTDLUtil.js";
import { youtube } from "../YouTubeUtil.js";
import { checkQuery } from "./checkQuery.js";

export async function searchTrack(
    client: KinshiTunes,
    query: string,
    source: "soundcloud" | "youtube" | undefined = "youtube"
): Promise<SearchTrackResult> {
    const result: SearchTrackResult = {
        items: []
    };

    const queryData = checkQuery(query);
    if (queryData.isURL) {
        const url = new URL(query);
        result.type = "results";

        switch (queryData.sourceType) {
            case "soundcloud": {
                let scUrl = url;
                if (["www.soundcloud.app.goo.gl", "soundcloud.app.goo.gl"].includes(url.hostname)) {
                    const req = await client.request.get(url.toString());
                    scUrl = new URL(req.url);

                    for (const key of scUrl.searchParams.keys()) {
                        scUrl.searchParams.delete(key);
                    }
                }

                const newQueryData = checkQuery(scUrl.toString());
                switch (newQueryData.type) {
                    case "track": {
                        const track = await client.soundcloud.tracks.getV2(scUrl.toString());

                        result.items = [
                            {
                                duration: track.full_duration,
                                id: track.id.toString(),
                                thumbnail: track.artwork_url,
                                title: track.title,
                                url: track.permalink_url
                            }
                        ];
                        break;
                    }

                    case "playlist": {
                        const playlist = await client.soundcloud.playlists.getV2(scUrl.toString());
                        const tracks = await Promise.all(
                            playlist.tracks.map(
                                (track): Song => ({
                                    duration: track.full_duration,
                                    id: track.id.toString(),
                                    thumbnail: track.artwork_url,
                                    title: track.title,
                                    url: track.permalink_url
                                })
                            )
                        );

                        result.items = tracks;
                        break;
                    }

                    default:
                        break;
                }

                break;
            }

            case "youtube": {
                switch (queryData.type) {
                    case "track": {
                        const videoId = /youtu\.be/gu.test(url.hostname)
                            ? url.pathname.replace("/", "")
                            : (url.searchParams.get("v") ?? "");

                        client.debugLog.logData("info", "SEARCH_TRACK", `Getting YouTube video info for: ${videoId}`);

                        try {
                            const track = await youtube.getVideo(videoId);

                            if (track) {
                                result.items = [
                                    {
                                        duration: track.isLiveContent ? 0 : (track as Video).duration,
                                        id: track.id,
                                        thumbnail: track.thumbnails.sort(
                                            (a, b) => b.height * b.width - a.height * a.width
                                        )[0].url,
                                        title: track.title,
                                        url: `https://youtube.com/watch?v=${track.id}`
                                    }
                                ];
                                client.debugLog.logData(
                                    "info",
                                    "SEARCH_TRACK",
                                    `Successfully retrieved track: ${track.title}`
                                );
                            } else {
                                client.debugLog.logData(
                                    "warning",
                                    "SEARCH_TRACK",
                                    `No track found for video ID: ${videoId}`
                                );
                            }
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            client.debugLog.logData(
                                "error",
                                "SEARCH_TRACK",
                                `Failed to get YouTube video ${videoId}: ${errorMessage}`
                            );

                            // YouTube might be blocking, try using yt-dlp as fallback
                            try {
                                client.debugLog.logData(
                                    "info",
                                    "SEARCH_TRACK",
                                    `Falling back to yt-dlp for video: ${videoId}`
                                );
                                const info = await getInfo(url.toString());
                                result.items = [
                                    {
                                        duration: info?.duration ?? 0,
                                        id: info?.id ?? videoId,
                                        thumbnail:
                                            info?.thumbnails?.sort((a, b) => b.height * b.width - a.height * a.width)[0]
                                                .url ?? "",
                                        title: info?.title ?? "Unknown Song",
                                        url: url.toString()
                                    }
                                ];
                                client.debugLog.logData(
                                    "info",
                                    "SEARCH_TRACK",
                                    `Fallback successful for: ${info?.title}`
                                );
                            } catch (fallbackError) {
                                const fallbackMessage =
                                    fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                                client.debugLog.logData(
                                    "error",
                                    "SEARCH_TRACK",
                                    `Both YouTube API and yt-dlp failed for ${videoId}: ${fallbackMessage}`
                                );
                            }
                        }
                        break;
                    }

                    case "playlist": {
                        const list = url.searchParams.get("list") ?? "";
                        const playlist = await youtube.getPlaylist(list);
                        const songIndex = url.searchParams.get("index");
                        let temp = null;

                        if (playlist) {
                            const tracks = await Promise.all(
                                (playlist instanceof Playlist ? playlist.videos.items : playlist.videos).map(
                                    (track): Song => ({
                                        duration: track.duration ?? 0,
                                        id: track.id,
                                        thumbnail: track.thumbnails.sort(
                                            (a, b) => b.height * b.width - a.height * a.width
                                        )[0].url,
                                        title: track.title,
                                        url: `https://youtube.com/watch?v=${track.id}`
                                    })
                                )
                            );

                            if ((songIndex?.length ?? 0) > 0)
                                temp =
                                    Number.parseInt(songIndex ?? "", 10) < 101
                                        ? tracks.splice(Number.parseInt(songIndex ?? "", 10) - 1, 1)[0]
                                        : null;
                            if (temp) tracks.unshift(temp);

                            result.items = tracks;
                        }
                        break;
                    }

                    default:
                        break;
                }

                break;
            }

            case "spotify": {
                function sortVideos(track: SpotifyTrack, videos: SearchResult<"video">): VideoCompact[] {
                    return videos.items.sort((a, b) => {
                        let aValue = 0;
                        let bValue = 0;
                        const aDurationDiff = (a.duration ?? 0) > 0 ? (a.duration ?? 0) - track.duration_ms : null;
                        const bDurationDiff = (b.duration ?? 0) > 0 ? (b.duration ?? 0) - track.duration_ms : null;

                        if (a.title.toLowerCase().includes(track.name.toLowerCase())) aValue--;
                        if (track.artists.some(x => a.channel?.name.toLowerCase().includes(x.name))) aValue--;
                        if (a.channel?.name.endsWith("- Topic") === true) aValue -= 2;
                        if (aDurationDiff === null ? false : aDurationDiff <= 5_000 && aDurationDiff >= -5_000)
                            aValue -= 2;

                        if (b.title.toLowerCase().includes(track.name.toLowerCase())) bValue++;
                        if (track.artists.some(x => b.channel?.name.toLowerCase().includes(x.name))) bValue++;
                        if (b.channel?.name.endsWith(" - Topic") === true) bValue += 2;
                        if (bDurationDiff === null ? false : bDurationDiff <= 5_000 && bDurationDiff >= -5_000)
                            bValue += 2;

                        return aValue + bValue;
                    });
                }

                switch (queryData.type) {
                    case "track": {
                        const songData = (await client.spotify.resolveTracks(
                            url.toString()
                        )) as unknown as SpotifyTrack;
                        let response = await youtube.search(
                            songData.external_ids?.isrc ?? `${songData.artists[0].name} - ${songData.name}`,
                            {
                                type: "video"
                            }
                        );
                        if (response.items.length === 0) {
                            response = await youtube.search(`${songData.artists[0].name} - ${songData.name}`, {
                                type: "video"
                            });
                        }
                        const track = sortVideos(songData, response);
                        if (track.length > 0) {
                            result.items = [
                                {
                                    duration: track[0].duration ?? 0,
                                    id: track[0].id,
                                    thumbnail: track[0].thumbnails.sort(
                                        (a, b) => b.height * b.width - a.height * a.width
                                    )[0].url,
                                    title: track[0].title,
                                    url: `https://youtube.com/watch?v=${track[0].id}`
                                }
                            ];
                        }
                        break;
                    }

                    case "playlist": {
                        const songs = (await client.spotify.resolveTracks(url.toString())) as unknown as {
                            track: SpotifyTrack;
                        }[];
                        await Promise.all(
                            songs.map(async (x): Promise<void> => {
                                let response = await youtube.search(
                                    x.track.external_ids?.isrc ??
                                        `${x.track.artists.map(y => y.name).join(", ")}${x.track.name}`,
                                    { type: "video" }
                                );
                                if (response.items.length === 0) {
                                    response = await youtube.search(
                                        `${x.track.artists.map(y => y.name).join(", ")}${x.track.name}`,
                                        { type: "video" }
                                    );
                                }
                                const track = sortVideos(x.track, response);
                                if (track.length > 0) {
                                    result.items.push({
                                        duration: track[0].duration ?? 0,
                                        id: track[0].id,
                                        thumbnail: track[0].thumbnails.sort(
                                            (a, b) => b.height * b.width - a.height * a.width
                                        )[0].url,
                                        title: track[0].title,
                                        url: `https://youtube.com/watch?v=${track[0].id}`
                                    });
                                }
                            })
                        );
                        break;
                    }

                    default:
                        break;
                }

                break;
            }

            default: {
                const info = await getInfo(url.toString()).catch(() => void 0);

                result.items = [
                    {
                        duration: info?.duration ?? 0,
                        id: info?.id ?? "",
                        thumbnail:
                            info?.thumbnails?.sort((a, b) => b.height * b.width - a.height * a.width)[0].url ?? "",
                        title: info?.title ?? "Unknown Song",
                        url: info?.url ?? url.toString()
                    }
                ];
                break;
            }
        }
    } else {
        result.type = "selection";

        if (source === "soundcloud") {
            const searchRes = await client.soundcloud.tracks.searchV2({
                q: query
            });
            const tracks = await Promise.all(
                searchRes.collection.map(
                    (track): Song => ({
                        duration: track.full_duration,
                        id: track.id.toString(),
                        thumbnail: track.artwork_url,
                        title: track.title,
                        url: track.permalink_url
                    })
                )
            );

            result.items = tracks;
        } else {
            // Check if it is a youtube link as a string
            const queryContainsYoutubeUrl =
                /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))[\w-]{10,12}/iu.test(
                    query
                );
            const cleanQuery = query.split(query.includes("youtu.be") ? /[&?]/u : "&")[0];

            client.debugLog.logData(
                "info",
                "SEARCH_TRACK",
                `Searching YouTube for: "${queryContainsYoutubeUrl ? cleanQuery : query}"`
            );

            let searchRes;
            try {
                searchRes = await youtube.search(queryContainsYoutubeUrl ? cleanQuery : query, { type: "video" });
                client.debugLog.logData(
                    "info",
                    "SEARCH_TRACK",
                    `YouTube search returned ${searchRes.items.length} results`
                );
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                client.debugLog.logData("error", "SEARCH_TRACK", `YouTube search failed: ${errorMessage}`);
                throw error;
            }

            const tracks = await Promise.all(
                searchRes.items.map(
                    (track): Song => ({
                        duration: track.duration ?? 0,
                        id: track.id,
                        thumbnail: track.thumbnails.sort((a, b) => b.height * b.width - a.height * a.width)[0].url,
                        title: track.title,
                        url: `https://youtube.com/watch?v=${track.id}`
                    })
                )
            );

            result.items = tracks;
        }
    }

    return result;
}
