import type {
    ApplicationCommandOptionData,
    ApplicationCommandType,
    ClientEvents,
    ClientPresenceStatus,
    Collection,
    EmbedBuilder,
    GuildMember,
    Client as OClient,
    Guild as OG
} from "discord.js";
import type { CommandContext } from "../structures/CommandContext.js";
import type { KinshiTunes } from "../structures/KinshiTunes.js";
import type { ServerQueue } from "../structures/ServerQueue.js";

export type MessageInteractionAction = "editReply" | "followUp" | "reply";

export type QueryData = {
    sourceType?: "query" | "soundcloud" | "spotify" | "unknown" | "youtube";
    type?: "playlist" | "track" | "unknown";
    isURL: boolean;
};

export type BasicYoutubeVideoInfo = {
    thumbnails?: { url: string; width: number; height: number }[];
    duration: number;
    title: string;
    url: string;
    id: string;
};

export type SearchTrackResult = {
    type?: "results" | "selection";
    items: Song[];
};

export type PaginationPayload = {
    edit(index: number, embed: EmbedBuilder, page: string): unknown;
    embed: EmbedBuilder;
    content?: string;
    pages: string[];
    author: string;
};

export type LoggerOptions = {
    prod: boolean;
};

export type SlashOption = {
    options?: ApplicationCommandOptionData[];
    type?: ApplicationCommandType;
    defaultPermission?: boolean;
    description?: string;
    name?: string;
};

export type EnvActivityTypes = "Competing" | "Listening" | "Playing" | "Watching";

export type PresenceData = {
    activities: { name: string; type: EnvActivityTypes }[];
    status: ClientPresenceStatus[];
    interval: number;
};

export type Event = {
    readonly name: keyof ClientEvents;
    execute(...args: any): void;
};

export type CommandComponent = {
    execute(context: CommandContext): any;
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
};

export type CategoryMeta = {
    cmds: Collection<string, CommandComponent>;
    hide: boolean;
    name: string;
};

declare module "discord.js" {
    export interface Client extends OClient {
        commands: KinshiTunes["commands"];
        request: KinshiTunes["request"];
        config: KinshiTunes["config"];
        logger: KinshiTunes["logger"];
        events: KinshiTunes["events"];

        build(): Promise<this>;
    }

    export interface Guild extends OG {
        queue?: ServerQueue;
        client: KinshiTunes;
    }
}

export type Song = {
    thumbnail: string;
    duration: number;
    title: string;
    url: string;
    id: string;
};

export type QueueSong = {
    requester: GuildMember;
    index: number;
    song: Song;
    key: string;
};

export type LoopMode = "OFF" | "QUEUE" | "SONG";

export type SpotifyAccessTokenAPIResult = {
    accessTokenExpirationTimestampMs: number;
    accessToken?: string;
    isAnonymous: boolean;
    clientId: string;
};

export type ExternalUrls = {
    spotify: string;
};

export type ArtistsEntity = {
    external_urls: ExternalUrls;
    href: string;
    name: string;
    type: string;
    uri: string;
    id: string;
};

export type SpotifyArtist = {
    name: string;
    tracks: SpotifyTrack[];
};

type SpotifyData<T> = {
    name: string;
    tracks: {
        items: T[];
        previous: string | null;
        next: string | null;
    };
};

export type SpotifyAlbum = SpotifyData<SpotifyTrack>;

export type SpotifyPlaylist = SpotifyData<{ track: SpotifyTrack }>;

export type SpotifyTrack = {
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
};

export type GuildData = {
    dj?: {
        enable: boolean;
        role: string | null;
    };
};

export type NonAbstractConstructor<Result = unknown> = new (...args: any[]) => Result;
export type Constructor<Result = unknown> = NonAbstractConstructor<Result> | (abstract new (...args: any[]) => Result);

export type MethodDecorator<Target, Result> = (
    target: Target,
    propertyKey: string,
    descriptor: PropertyDescriptor
) => Result;
export type ClassDecorator<Target extends Constructor, Result = unknown> = (target: Target) => Result;
export type Promisable<Output> = Output | Promise<Output>;
export type FunctionType<Args extends any[] = any[], Result = any> = (...args: Args) => Result;

export type RegisterCmdOptions = {
    onRegistered(guild: OG): Promisable<any>;
    onError(guild: OG | null, error: Error): Promisable<any>;
};
