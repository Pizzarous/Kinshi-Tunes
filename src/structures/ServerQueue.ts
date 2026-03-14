/* eslint-disable @typescript-eslint/no-floating-promises */
import { clearInterval, clearTimeout, setInterval } from "node:timers";
import type { Readable } from "node:stream";
import type {
    AudioPlayer,
    AudioPlayerPlayingState,
    AudioPlayerState,
    AudioResource,
    VoiceConnection
} from "@discordjs/voice";
import { AudioPlayerStatus, createAudioPlayer } from "@discordjs/voice";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import type { Snowflake, TextChannel } from "discord.js";
import prism from "prism-media";
import i18n from "../config/index.js";
import type { LoopMode, QueueSong } from "../typings/index.js";
import { createEmbed } from "../utils/functions/createEmbed.js";
import { createProgressBar } from "../utils/functions/createProgressBar.js";
import type { filterArgs } from "../utils/functions/ffmpegArgs.js";
import { normalizeTime } from "../utils/functions/normalizeTime.js";
import { play } from "../utils/handlers/GeneralUtil.js";
import { SongManager } from "../utils/structures/SongManager.js";
import { CommandContext } from "./CommandContext.js";
import type { KinshiTunes } from "./KinshiTunes.js";

const nonEnum = { enumerable: false };

export class ServerQueue {
    public stayInVC = this.client.config.stayInVCAfterFinished;
    public readonly player: AudioPlayer = createAudioPlayer();
    public connection: VoiceConnection | null = null;
    public dcTimeout: NodeJS.Timeout | null = null;
    public timeout: NodeJS.Timeout | null = null;
    public readonly songs: SongManager;
    public loopMode: LoopMode = "OFF";
    public filters: Partial<Record<keyof typeof filterArgs, boolean>> = {};
    public destroyTimeoutId: NodeJS.Timeout | null = null;
    public currentStream: prism.FFmpeg | null = null;
    public currentPlaybackStream: Readable | null = null;

    private _volume = this.client.config.defaultVolume;
    private _lastVSUpdateMsg: Snowflake | null = null;
    private _lastMusicMsg: Snowflake | null = null;
    private _skipVoters: Snowflake[] = [];

    public constructor(public readonly textChannel: TextChannel) {
        Object.defineProperties(this, {
            _skipVoters: nonEnum,
            _lastMusicMsg: nonEnum,
            _lastVSUpdateMsg: nonEnum,
            _volume: nonEnum
        });

        this.songs = new SongManager(this.client, this.textChannel.guild);

        this.player
            .on("stateChange", async (oldState, newState) => {
                if (newState.status === AudioPlayerStatus.Playing && oldState.status !== AudioPlayerStatus.Paused) {
                    newState.resource.volume?.setVolumeLogarithmic(this.volume / 100);

                    const currentSong = (this.player.state as AudioPlayerPlayingState).resource.metadata as QueueSong;
                    this.sendStartPlayingMsg(currentSong);
                    this.handleIdleState();
                    this.preCacheNextSong(currentSong);
                } else if (newState.status === AudioPlayerStatus.Idle) {
                    const song = (oldState as AudioPlayerPlayingState).resource.metadata as QueueSong;
                    if (!this.destroyTimeoutId) {
                        this.client.logger.info(
                            `${this.client.shard ? `[Shard #${this.client.shard.ids[0]}]` : ""} Track: "${
                                song.song.title
                            }" on ${this.textChannel.guild.name} has ended.`
                        );
                        this.skipVoters = [];
                        if (this.loopMode === "OFF") {
                            this.songs.delete(song.key);
                        }

                        const nextS =
                            this.loopMode === "SONG"
                                ? song.key
                                : (this.songs
                                      .sortByIndex()
                                      .filter(x => x.index > song.index)
                                      .first()?.key ??
                                  (this.loopMode === "QUEUE" ? (this.songs.sortByIndex().first()?.key ?? "") : ""));

                        await this.textChannel
                            .send({
                                embeds: [
                                    createEmbed(
                                        "info",
                                        `⏹ **|** ${i18n.__mf("utils.generalHandler.stopPlaying", {
                                            song: `[${song.song.title}](${song.song.url})`
                                        })}`
                                    ).setThumbnail(song.song.thumbnail)
                                ]
                            })
                            .then(ms => (this.lastMusicMsg = ms.id))
                            .catch((error: unknown) => this.client.logger.error("PLAY_ERR:", error))
                            .finally(async () => {
                                play(this.textChannel.guild, nextS).catch(async (error: unknown) => {
                                    await this.textChannel
                                        .send({
                                            embeds: [
                                                createEmbed(
                                                    "error",
                                                    i18n.__mf("utils.generalHandler.errorPlaying", {
                                                        message: `\`${error as string}\``
                                                    }),
                                                    true
                                                )
                                            ]
                                        })
                                        .catch((error_: unknown) => this.client.logger.error("PLAY_ERR:", error_));
                                    this.connection?.disconnect();
                                    this.client.logger.error("PLAY_ERR:", error);
                                });
                            });
                    }
                }
            })
            .on("error", err => {
                (async () => {
                    await this.textChannel
                        .send({
                            embeds: [
                                createEmbed(
                                    "error",
                                    i18n.__mf("utils.generalHandler.errorPlaying", { message: `\`${err.message}\`` }),
                                    true
                                )
                            ]
                        })
                        .catch((error: unknown) => this.client.logger.error("PLAY_CMD_ERR:", error));
                })();
                this.destroy();
                this.client.logger.error("PLAY_ERR:", err);
            })
            .on("debug", message => {
                this.client.logger.debug(message);
            });
    }

    public handleIdleState(): void {
        if (this.destroyTimeoutId) {
            clearTimeout(this.destroyTimeoutId);
            this.destroyTimeoutId = null;
        }
    }

    public setFilter(filter: keyof typeof filterArgs, state: boolean): void {
        const before = this.filters[filter];
        this.filters[filter] = state;

        if (before !== state && this.player.state.status === AudioPlayerStatus.Playing) {
            this.playing = false;
            void play(
                this.textChannel.guild,
                (this.player.state.resource as AudioResource<QueueSong>).metadata.key,
                true
            );
        }
    }

    public shuffleQueue(): void {
        const currentKey =
            this.player.state.status !== AudioPlayerStatus.Idle
                ? ((this.player.state as AudioPlayerPlayingState).resource.metadata as QueueSong).key
                : null;
        this.songs.shuffleIndices(currentKey ?? "");
    }

    public clear(): void {
        const currentKey =
            this.player.state.status !== AudioPlayerStatus.Idle
                ? ((this.player.state as AudioPlayerPlayingState).resource.metadata as QueueSong).key
                : null;

        const removedUrls: string[] = [];

        this.songs.forEach(song => {
            if (song.key !== currentKey) {
                removedUrls.push(song.song.url);
                this.songs.delete(song.key);
            }
        });

        if (removedUrls.length > 0) {
            this.client.audioCache.clearCacheForUrls(removedUrls);
        }
    }

    public stop(): void {
        // Clean up current stream when stopping
        this.cleanupCurrentStream();
        this.client.audioCache.cleanupPartFiles(this.textChannel.guild.id);
        this.songs.clear();
        this.player.stop(true);
    }

    public destroy(): void {
        this.stop();
        this.connection?.disconnect();
        clearTimeout(this.timeout ?? undefined);
        clearTimeout(this.dcTimeout ?? undefined);
        delete this.textChannel.guild.queue;
    }

    public get volume(): number {
        return this._volume;
    }

    public set volume(newVol: number) {
        this._volume = newVol;
        (
            this.player.state as AudioPlayerPlayingState & { resource: AudioResource | undefined }
        ).resource.volume?.setVolumeLogarithmic(this._volume / 100);
    }

    public get skipVoters(): Snowflake[] {
        return this._skipVoters;
    }

    public set skipVoters(value: Snowflake[]) {
        this._skipVoters = value;
    }

    public get lastMusicMsg(): Snowflake | null {
        return this._lastMusicMsg;
    }

    public set lastMusicMsg(value: Snowflake | null) {
        if (this._lastMusicMsg !== null) {
            (async () => {
                await this.textChannel.messages
                    .fetch(this._lastMusicMsg ?? "")
                    .then(msg => {
                        void msg.delete();
                        return 0;
                    })
                    .catch((error: unknown) =>
                        this.textChannel.client.logger.error("DELETE_LAST_MUSIC_MESSAGE_ERR:", error)
                    );
            })();
        }
        this._lastMusicMsg = value;
    }

    public get lastVSUpdateMsg(): Snowflake | null {
        return this._lastVSUpdateMsg;
    }

    public set lastVSUpdateMsg(value: Snowflake | null) {
        if (this._lastVSUpdateMsg !== null) {
            (async () => {
                await this.textChannel.messages
                    .fetch(this._lastVSUpdateMsg ?? "")
                    .then(msg => {
                        void msg.delete();
                        return 0;
                    })
                    .catch((error: unknown) =>
                        this.textChannel.client.logger.error("DELETE_LAST_VS_UPDATE_MESSAGE_ERR:", error)
                    );
            })();
        }
        this._lastVSUpdateMsg = value;
    }

    public get playing(): boolean {
        return this.player.state.status === AudioPlayerStatus.Playing;
    }

    public set playing(value: boolean) {
        if (value) {
            this.player.unpause();
        } else {
            this.player.pause();
        }
    }

    public get idle(): boolean {
        return this.player.state.status === AudioPlayerStatus.Idle && this.songs.size === 0;
    }

    public get client(): KinshiTunes {
        return this.textChannel.client as KinshiTunes;
    }

    public cleanupCurrentStream(): void {
        if (this.currentPlaybackStream) {
            this.currentPlaybackStream.destroy();
            this.currentPlaybackStream = null;
        }
        if (this.currentStream) {
            this.currentStream.destroy();
            this.currentStream = null;
        }
    }

    private preCacheNextSong(currentSong: QueueSong): void {
        if (this.loopMode === "SONG") return;

        const PRE_CACHE_AHEAD = 3;
        const songsToCache: string[] = [];

        const sorted = this.songs.sortByIndex();
        const next = [...sorted.filter(s => s.index > currentSong.index && s.song.duration > 0).values()].slice(
            0,
            PRE_CACHE_AHEAD
        );
        for (const s of next) {
            songsToCache.push(s.song.url);
        }

        if (songsToCache.length < PRE_CACHE_AHEAD && this.loopMode === "QUEUE") {
            const remaining = PRE_CACHE_AHEAD - songsToCache.length;
            const fromStart = [
                ...sorted.filter(s => s.song.duration > 0 && !songsToCache.includes(s.song.url)).values()
            ].slice(0, remaining);
            for (const s of fromStart) {
                songsToCache.push(s.song.url);
            }
        }

        if (songsToCache.length > 0) {
            void this.client.audioCache.preCacheMultiple(songsToCache, this.textChannel.guild.id);
        }
    }

    private sendStartPlayingMsg(currentSong: QueueSong): void {
        const song = currentSong.song;
        const initialSongKey = currentSong.key;

        this.client.logger.info(
            `${this.client.shard ? `[Shard #${this.client.shard.ids[0]}]` : ""} Track: "${song.title}" on ${
                this.textChannel.guild.name
            } has started.`
        );

        const getEmbed = () => {
            const res = (this.player.state as (AudioPlayerState & { resource: AudioResource | undefined }) | undefined)
                ?.resource;
            const qSong = (res?.metadata as QueueSong | undefined)?.song;

            const embed = createEmbed("info", `${this.playing ? "▶" : "⏸"} **|** `).setThumbnail(
                qSong?.thumbnail ?? song.thumbnail
            );

            const curr = Math.trunc((res?.playbackDuration ?? 0) / 1_000);
            embed.data.description += qSong
                ? `**[${qSong.title}](${qSong.url})**\n` +
                  `${normalizeTime(curr)} ${createProgressBar(curr, qSong.duration)} ${normalizeTime(qSong.duration)}`
                : i18n.__("commands.music.nowplaying.emptyQueue");

            return embed;
        };

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId("TOGGLE_STATE_BUTTON")
                .setLabel("Pause/Play")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("⏯️"),
            new ButtonBuilder()
                .setCustomId("SKIP_BUTTON")
                .setLabel("Skip")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("⏭"),
            new ButtonBuilder().setCustomId("STOP_BUTTON").setLabel("Stop").setStyle(ButtonStyle.Danger).setEmoji("⏹"),
            new ButtonBuilder()
                .setCustomId("SHOW_QUEUE_BUTTON")
                .setLabel("Queue")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("#️⃣")
        );

        (async () => {
            await this.textChannel.send({
                embeds: [
                    createEmbed(
                        "info",
                        `▶ **|** ${i18n.__mf("utils.generalHandler.startPlaying", {
                            song: `[${song.title}](${song.url})`
                        })}`
                    ).setThumbnail(song.thumbnail)
                ]
            });
        })();

        (async () => {
            const ms = await this.textChannel
                .send({ embeds: [getEmbed()], components: [buttons] })
                .catch((error: unknown) => {
                    this.client.logger.error("PLAY_ERR:", error);
                    return null;
                });

            if (!ms) return;
            this.lastMusicMsg = ms.id;

            const interval = setInterval(() => {
                void ms.edit({ embeds: [getEmbed()], components: [buttons] }).catch(() => undefined);
            }, 10_000);

            const collector = ms.createMessageComponentCollector({
                componentType: ComponentType.Button
            });

            const onStateChange = (_oldState: AudioPlayerState, newState: AudioPlayerState): void => {
                if (newState.status === AudioPlayerStatus.Idle) {
                    collector.stop("songEnd");
                    return;
                }
                if (newState.status === AudioPlayerStatus.Playing) {
                    const newKey = (
                        (newState as AudioPlayerState & { resource: AudioResource }).resource.metadata as
                            | QueueSong
                            | undefined
                    )?.key;
                    if (newKey !== initialSongKey) collector.stop("songEnd");
                }
            };
            this.player.on("stateChange", onStateChange);

            collector
                .on("collect", async i => {
                    const newCtx = new CommandContext(i);
                    let cmdName = "";

                    switch (i.customId) {
                        case "TOGGLE_STATE_BUTTON": {
                            cmdName = this.playing ? "pause" : "resume";
                            break;
                        }
                        case "SKIP_BUTTON": {
                            cmdName = "skip";
                            break;
                        }
                        case "SHOW_QUEUE_BUTTON": {
                            cmdName = "queue";
                            break;
                        }
                        case "STOP_BUTTON": {
                            cmdName = "stop";
                            break;
                        }
                        default:
                            break;
                    }

                    await this.client.commands.get(cmdName)?.execute(newCtx);
                    void ms.edit({ embeds: [getEmbed()] }).catch(() => undefined);
                })
                .on("end", () => {
                    clearInterval(interval);
                    this.player.off("stateChange", onStateChange);
                    const embed = getEmbed().setFooter({
                        text: i18n.__("commands.music.nowplaying.disableButton")
                    });
                    void ms.edit({ embeds: [embed], components: [] }).catch(() => undefined);
                });
        })();
    }
}
