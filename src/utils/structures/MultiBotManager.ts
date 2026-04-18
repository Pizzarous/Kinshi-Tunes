import type { Guild, Snowflake } from "discord.js";
import { discordTokens, isMultiBot } from "../../config/env.js";
import type { KinshiTunes } from "../../structures/KinshiTunes.js";

export interface BotInstance {
    client: KinshiTunes;
    tokenIndex: number;
    botId: Snowflake;
    isPrimary: boolean;
}

export class MultiBotManager {
    private readonly bots: Map<number, BotInstance> = new Map();
    private primaryBot: BotInstance | null = null;
    private static instance: MultiBotManager | null = null;

    public static getInstance(): MultiBotManager {
        MultiBotManager.instance ??= new MultiBotManager();
        return MultiBotManager.instance;
    }

    public registerBot(client: KinshiTunes, tokenIndex: number, botId: Snowflake): void {
        const isPrimary = tokenIndex === 0;
        const instance: BotInstance = { client, tokenIndex, botId, isPrimary };
        this.bots.set(tokenIndex, instance);
        if (isPrimary) {
            this.primaryBot = instance;
        }
    }

    public getBots(): BotInstance[] {
        return Array.from(this.bots.values());
    }

    public getPrimaryBot(): KinshiTunes | null {
        return this.primaryBot?.client ?? null;
    }

    public getBotByIndex(index: number): BotInstance | null {
        return this.bots.get(index) ?? null;
    }

    public getBotById(botId: Snowflake): BotInstance | null {
        for (const bot of this.bots.values()) {
            if (bot.botId === botId) return bot;
        }
        return null;
    }

    public getBotByClient(client: KinshiTunes): BotInstance | null {
        for (const bot of this.bots.values()) {
            if (bot.client === client) return bot;
        }
        return null;
    }

    /**
     * Returns all bot instances that are members of the given guild, sorted by tokenIndex.
     */
    public getBotsInGuild(guild: Guild): BotInstance[] {
        const botsInGuild: BotInstance[] = [];
        for (let i = 0; i < discordTokens.length; i++) {
            const bot = this.bots.get(i);
            if (bot?.client.guilds.cache.has(guild.id)) {
                botsInGuild.push(bot);
            }
        }
        return botsInGuild.sort((a, b) => a.tokenIndex - b.tokenIndex);
    }

    /**
     * Selects the best bot to handle a given voice channel.
     * Priority:
     *   1. Bot that already has an active queue for that VC
     *   2. Bot currently in that VC
     *   3. A free bot (primary preferred, then lowest index)
     *   4. null — all bots busy; request ignored
     */
    public getBotForVoiceChannel(guild: Guild, voiceChannelId: Snowflake): KinshiTunes | null {
        if (!isMultiBot) return guild.client as KinshiTunes;

        const botsInGuild = this.getBotsInGuild(guild);
        if (botsInGuild.length === 0) return null;

        const botsInVoice = new Map<KinshiTunes, Snowflake | null>();
        const botsWithQueues = new Map<KinshiTunes, Snowflake | null>();

        for (const bot of botsInGuild) {
            const botGuild = bot.client.guilds.cache.get(guild.id);
            if (!botGuild) continue;

            const currentVC = botGuild.members.me?.voice.channelId ?? null;
            const queueVC = botGuild.queue?.connection?.joinConfig.channelId ?? null;
            botsInVoice.set(bot.client, currentVC);
            botsWithQueues.set(bot.client, queueVC);
        }

        // 1. Bot with active queue for this VC
        for (const bot of botsInGuild) {
            if (botsWithQueues.get(bot.client) === voiceChannelId) {
                return bot.client;
            }
        }

        // 2. Bot physically in this VC
        for (const bot of botsInGuild) {
            if (botsInVoice.get(bot.client) === voiceChannelId) {
                return bot.client;
            }
        }

        // 3. Free bot — no VC and no queue.
        // Selection is deterministic within the same routing event (hash of guild + VC IDs +
        // current minute) so every bot instance independently arrives at the same answer,
        // but the winner rotates each time a fresh queue is started.
        const freeBots = botsInGuild.filter(bot => !botsInVoice.get(bot.client) && !botsWithQueues.get(bot.client));

        if (freeBots.length > 0) {
            const minute = Math.floor(Date.now() / 60_000).toString();
            const seed = MultiBotManager.hashStr(guild.id + voiceChannelId + minute);
            return freeBots[seed % freeBots.length]!.client;
        }

        return null;
    }

    /**
     * Whether this client should respond to general (non-music) commands in a guild.
     * In multi-bot mode only the "responsible" bot responds (primary unless another is in VC).
     */
    public shouldRespond(client: KinshiTunes, guild: Guild): boolean {
        if (!isMultiBot) return true;

        const thisBot = this.getBotByClient(client);
        if (!thisBot) return true;

        if (!client.guilds.cache.get(guild.id)?.members.cache.has(thisBot.botId)) return false;

        const responsibleBot = this.getResponsibleBot(guild);
        if (!responsibleBot) return true;
        return responsibleBot === client;
    }

    /**
     * Whether this client should respond to a music command from a user in a given voice channel.
     * Returns "respond" to handle, "busy" to reply with a busy message, or "ignore" to silently skip.
     */
    public shouldRespondToMusicCommand(
        client: KinshiTunes,
        guild: Guild,
        userVoiceChannelId: Snowflake | null
    ): "respond" | "ignore" | "busy" {
        if (!isMultiBot) return "respond";

        if (!userVoiceChannelId) {
            return this.shouldRespond(client, guild) ? "respond" : "ignore";
        }

        const thisBotGuild = client.guilds.cache.get(guild.id);
        if (!thisBotGuild) return "ignore";

        const thisBotVC = thisBotGuild.members.me?.voice.channelId ?? null;
        const thisBotQueueVC = thisBotGuild.queue?.connection?.joinConfig.channelId ?? null;
        const actualVC = thisBotVC ?? thisBotQueueVC;
        const isInChannel = actualVC === userVoiceChannelId;
        const isFree = !actualVC;

        if (isInChannel) {
            const responsible = this.getBotForVoiceChannel(thisBotGuild, userVoiceChannelId);
            if (!responsible) return "respond";
            return responsible.user?.id === client.user?.id ? "respond" : "ignore";
        }

        if (isFree) {
            const responsible = this.getBotForVoiceChannel(thisBotGuild, userVoiceChannelId);
            return responsible?.user?.id === client.user?.id ? "respond" : "ignore";
        }

        const responsible = this.getBotForVoiceChannel(thisBotGuild, userVoiceChannelId);
        if (!responsible) {
            // All bots are busy — only the primary bot sends the message to avoid duplicates
            const thisBot = this.getBotByClient(client);
            return thisBot?.isPrimary ? "busy" : "ignore";
        }
        return "ignore";
    }

    /**
     * Whether this client should handle a voice state change for a given voice channel.
     */
    public shouldRespondToVoice(client: KinshiTunes, guild: Guild, voiceChannelId: Snowflake): boolean {
        if (!isMultiBot) return true;

        const thisBot = this.getBotByClient(client);
        if (!thisBot) return true;

        const clientGuild = client.guilds.cache.get(guild.id);
        if (!clientGuild) return false;
        if (!clientGuild.members.cache.has(thisBot.botId)) return false;

        const responsible = this.getBotForVoiceChannel(clientGuild, voiceChannelId);
        if (!responsible) return false;
        return responsible === client;
    }

    public static isEnabled(): boolean {
        return isMultiBot;
    }

    /** Returns the bot responsible for general interactions in a guild (primary by default, unless a secondary has an active queue). */
    private getResponsibleBot(guild: Guild): KinshiTunes | null {
        const botsInGuild = this.getBotsInGuild(guild);
        if (botsInGuild.length === 0) return null;

        // Bot with an active queue is responsible
        for (const bot of botsInGuild) {
            const botGuild = bot.client.guilds.cache.get(guild.id);
            if (botGuild?.queue) return bot.client as KinshiTunes;
        }

        // Fall back to primary
        return botsInGuild.find(b => b.isPrimary)?.client ?? botsInGuild[0]!.client;
    }

    /** Simple deterministic hash of a string to a non-negative integer. */
    private static hashStr(s: string): number {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
        }
        return h;
    }
}
