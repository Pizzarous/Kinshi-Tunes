import { ChannelType, Message, User } from "discord.js";
import i18n from "../config/index.js";
import { isMultiBot } from "../config/env.js";
import { BaseEvent } from "../structures/BaseEvent.js";
import { Event } from "../utils/decorators/Event.js";
import { createEmbed } from "../utils/functions/createEmbed.js";

// Music commands that require voice-channel-aware routing in multi-bot mode
const MUSIC_COMMANDS = [
    "play",
    "p",
    "add",
    "search",
    "skip",
    "stop",
    "pause",
    "resume",
    "queue",
    "nowplaying",
    "np",
    "volume",
    "shuffle",
    "repeat",
    "filter",
    "move",
    "remove",
    "skipto",
    "clearqueue",
    "leave",
    "stayinqueue",
    "dj"
];

@Event<typeof MessageCreateEvent>("messageCreate")
export class MessageCreateEvent extends BaseEvent {
    public async execute(message: Message): Promise<void> {
        this.client.debugLog.logData("info", "MESSAGE_CREATE", [
            ["ID", message.id],
            ["Guild", message.guild ? `${message.guild.name}(${message.guild.id})` : "DM"],
            [
                "Channel",
                message.channel.type === ChannelType.DM ? "DM" : `${message.channel.name}(${message.channel.id})`
            ],
            ["Author", `${message.author.tag}(${message.author.id})`]
        ]);

        if (message.author.bot || message.channel.type === ChannelType.DM || !this.client.commands.isReady) return;

        if (this.getUserFromMention(message.content)?.id === this.client.user?.id) {
            await message
                .reply({
                    embeds: [
                        createEmbed(
                            "info",
                            `👋 **|** ${i18n.__mf("events.createMessage", {
                                author: message.author.toString(),
                                prefix: `\`${this.client.config.mainPrefix}\``
                            })}`
                        )
                    ]
                })
                .catch((error: unknown) => this.client.logger.error("PROMISE_ERR:", error));
        }

        const pref = [...this.client.config.altPrefixes, this.client.config.mainPrefix].find(pr => {
            if (pr === "{mention}") {
                const userMention = /<@(!)?\d*?>/u.exec(message.content);
                if (userMention?.index !== 0) return false;

                const user = this.getUserFromMention(userMention[0]);

                return user?.id === this.client.user?.id;
            }

            return message.content.startsWith(pr);
        });

        if ((pref?.length ?? 0) > 0) {
            if (isMultiBot && message.guild) {
                const thisBotGuild = this.client.guilds.cache.get(message.guild.id);
                if (!thisBotGuild) return;

                const cmdContent = message.content.slice(pref!.length).trim();
                const cmdName = cmdContent.split(/ +/u)[0]?.toLowerCase() ?? "";
                const isMusicCmd = MUSIC_COMMANDS.includes(cmdName);

                if (isMusicCmd) {
                    let member = thisBotGuild.members.cache.get(message.author.id);
                    member ??= (await thisBotGuild.members.fetch(message.author.id).catch(() => null)) ?? undefined;
                    const userVoiceChannelId = member?.voice.channelId ?? null;

                    if (userVoiceChannelId) {
                        const shouldRespond = this.client.multiBotManager.shouldRespondToMusicCommand(
                            this.client,
                            thisBotGuild,
                            userVoiceChannelId
                        );
                        if (shouldRespond === "busy") {
                            void message.reply({
                                embeds: [createEmbed("error", `⚠️ **|** ${i18n.__("utils.multiBotManager.botBusy")}`)]
                            });
                            return;
                        }
                        if (shouldRespond !== "respond") return;
                    } else if (!this.client.multiBotManager.shouldRespond(this.client, thisBotGuild)) {
                        return;
                    }
                } else if (!this.client.multiBotManager.shouldRespond(this.client, thisBotGuild)) {
                    return;
                }
            }

            this.client.commands.handle(message, pref as unknown as string);
        }
    }

    private getUserFromMention(mention: string): User | undefined {
        const matches = /^<@!?(\d+)>$/u.exec(mention);
        if (!matches) return undefined;

        const id = matches[1];
        return this.client.users.cache.get(id);
    }
}
