/* eslint-disable @typescript-eslint/explicit-function-return-type */
import path from "node:path";
import process from "node:process";
import type { ClientOptions } from "discord.js";
import { Client } from "discord.js";
import got from "got";
import { Soundcloud } from "soundcloud.ts";
import * as config from "../config/index.js";
import type { GuildData } from "../typings/index.js";
import { importURLToString } from "../utils/functions/importURLToString.js";
import { SpotifyUtil } from "../utils/handlers/SpotifyUtil.js";
import { ClientUtils } from "../utils/structures/ClientUtils.js";
import { CommandManager } from "../utils/structures/CommandManager.js";
import { DebugLogManager } from "../utils/structures/DebugLogManager.js";
import { EventsLoader } from "../utils/structures/EventsLoader.js";
import { JSONDataManager } from "../utils/structures/JSONDataManager.js";
import { Logger } from "../utils/structures/Logger.js";
import { ModerationLogs } from "../utils/structures/ModerationLogs.js";

export class KinshiTunes extends Client {
    public startTimestamp = 0;
    public readonly config = config;
    public readonly commands = new CommandManager(
        this,
        path.resolve(importURLToString(import.meta.url), "..", "commands")
    );
    public readonly events = new EventsLoader(this, path.resolve(importURLToString(import.meta.url), "..", "events"));
    public readonly data = new JSONDataManager<Record<string, GuildData>>(path.resolve(process.cwd(), "data.json"));
    public readonly logger = new Logger({ prod: this.config.isProd });
    public readonly debugLog = new DebugLogManager(this.config.debugMode, this.config.isProd);
    public readonly modlogs = new ModerationLogs(this);
    public readonly spotify = new SpotifyUtil(this);
    public readonly utils = new ClientUtils(this);
    public readonly soundcloud = new Soundcloud();
    public readonly request = got.extend({
        hooks: {
            beforeError: [
                error => {
                    this.debugLog.logData("error", "GOT_REQUEST", [
                        ["URL", error.options.url?.toString() ?? "[???]"],
                        ["Code", error.code],
                        ["Response", error.response?.rawBody.toString("ascii") ?? "[???]"]
                    ]);

                    return error;
                }
            ],
            beforeRequest: [
                options => {
                    this.debugLog.logData("info", "GOT_REQUEST", [
                        ["URL", options.url?.toString() ?? "[???]"],
                        ["Method", options.method],
                        ["Encoding", options.encoding ?? "UTF-8"],
                        ["Agent", options.agent.http ? "HTTP" : "HTTPS"]
                    ]);
                }
            ]
        }
    });

    public constructor(opt: ClientOptions) {
        super(opt);
    }

    public build: () => Promise<this> = async () => {
        this.startTimestamp = Date.now();
        this.events.load();
        await this.login();
        return this;
    };
}
