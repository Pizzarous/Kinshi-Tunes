/* eslint-disable @typescript-eslint/naming-convention */
import { CommandContext } from "../structures/CommandContext.js";
import { ServerQueue } from "../structures/ServerQueue.js";
import { KinshiTunes } from "../structures/KinshiTunes.ts";
import {
    ApplicationCommandOptionData,
    ApplicationCommandType,
    ClientEvents,
    ClientPresenceStatus,
    Client as OClient,
    Collection,
    GuildMember,
    Guild,
    EmbedBuilder
} from "discord.js";

export type MessageInteractionAction = "editReply" | "followUp" | "reply";

export interface QueryData {
    sourceType?: "query" | "soundcloud" | "spotify" | "unknown" | "youtube";
    type?: "playlist" | "track" | "unknown";
    isURL: boolean;
}

export interface BasicYoutubeVideoInfo {
    thumbnails?: { url: string; width: number; height: number }[];
    duration: number;
    title: string;
    url: string;
    id: string;
}

export interface SearchTrackResult {
    type?: "results" | "selection";
    items: Song[];
}

export interface PaginationPayload {
    edit: (index: number, embed: EmbedBuilder, page: string) => unknown;
    embed: EmbedBuilder;
    content?: string;
    pages: string[];
    author: string;
}

export interface LoggerOptions {
    prod: boolean;
}

export interface SlashOption {
    options?: ApplicationCommandOptionData[];
    type?: ApplicationCommandType;
    defaultPermission?: boolean;
    description?: string;
    name?: string;
}

export type EnvActivityTypes = "Competing" | "Listening" | "Playing" | "Watching";

export interface PresenceData {
    activities: { name: string; type: EnvActivityTypes }[];
    status: ClientPresenceStatus[];
    interval: number;
}

export interface Event {
    readonly name: keyof ClientEvents;
    execute: (...args: unknown) => void;
}

export interface CommandComponent {
    execute: (context: CommandContext) => unknown;
    meta: {
        readonly category?: string;
        readonly path?: string;
        contextChat?: string;
        contextUser?: string;
        description?: string;
        slash?: SlashOption;
        aliases?: string[];
        cooldown?: number;
        disable?: boolean;
        devOnly?: boolean;
        usage?: string;
        name: string;
    };
}

export interface CategoryMeta {
    cmds: Collection<string, CommandComponent>;
    hide: boolean;
    name: string;
}

declare module "discord.js" {
    export interface Client extends OClient {
        commands: KinshiTunes["commands"];
        request: KinshiTunes["request"];
        config: KinshiTunes["config"];
        logger: KinshiTunes["logger"];
        events: KinshiTunes["events"];

        build: () => Promise<this>;
    }

    export interface Guild {
        queue?: ServerQueue;
        client: KinshiTunes;
    }
}

export interface Song {
    thumbnail: string;
    duration: number;
    title: string;
    url: string;
    id: string;
}

export interface QueueSong {
    requester: GuildMember;
    index: number;
    song: Song;
    key: string;
}

export type LoopMode = "OFF" | "QUEUE" | "SONG";

export interface SpotifyAccessTokenAPIResult {
    accessTokenExpirationTimestampMs: number;
    accessToken?: string;
    isAnonymous: boolean;
    clientId: string;
}

export interface ExternalUrls {
    spotify: string;
}

export interface ArtistsEntity {
    external_urls: ExternalUrls;
    href: string;
    name: string;
    type: string;
    uri: string;
    id: string;
}

export interface SpotifyArtist {
    name: string;
}

interface SpotifyData<T> {
    name: string;
    tracks: {
        items: T[];
        previous: string | null;
        next: string | null;
    };
}

export type SpotifyAlbum = SpotifyData<SpotifyTrack>;

export type SpotifyPlaylist = SpotifyData<{ track: SpotifyTrack }>;

export interface SpotifyTrack {
    artists: ArtistsEntity[];
    duration_ms: number;
    external_ids?: {
        isrc: string;
    };
    external_urls: {
        spotify: string;
    };
    name: string;
    id: string;
}

export interface SpotifyArtist {
    tracks: SpotifyTrack[];
}

export interface GuildData {
    dj?: {
        enable: boolean;
        role: string | null;
    };
    infractions: Record<
        string,
        {
            on: number;
            reason: string | null;
        }[]
    >;
    modLog?: {
        enable: boolean;
        channel: string | null;
    };
    mute?: string | null;
}

export type NonAbstractConstructor<Result = unknown> = new (...args: unknown[]) => Result;
export type Constructor<Result = unknown> =
    | NonAbstractConstructor<Result>
    | (abstract new (...args: unknown[]) => Result);

export type MethodDecorator<Target, Result> = (
    target: Target,
    propertyKey: string,
    descriptor: PropertyDescriptor
) => Result;
export type ClassDecorator<Target extends Constructor, Result = unknown> = (target: Target) => Result;
export type Promisable<Output> = Output | Promise<Output>;
export type FunctionType<Args extends unknown[] = unknown[], Result = unknown> = (...args: Args) => Result;

export interface RegisterCmdOptions {
    onRegistered: (guild: Guild) => Promisable<unknown>;
    onError: (guild: Guild | null, error: Error) => Promisable<unknown>;
}
