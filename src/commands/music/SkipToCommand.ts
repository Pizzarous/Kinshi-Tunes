/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AudioPlayerPlayingState } from "@discordjs/voice";
import { ApplicationCommandOptionType, VoiceChannel } from "discord.js";
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { QueueSong } from "../../typings/index.js";
import { Command } from "../../utils/decorators/Command.js";
import { haveQueue, inVC, sameVC } from "../../utils/decorators/MusicUtil.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";
import { play } from "../../utils/handlers/GeneralUtil.js";

@Command<typeof SkipToCommand>({
    aliases: ["st"],
    description: i18n.__("commands.music.skipTo.description"),
    name: "skipto",
    slash: {
        options: [
            {
                description: i18n.__("commands.music.skipTo.slashFirstDescription"),
                name: "first",
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                description: i18n.__("commands.music.skipTo.slashLastDescription"),
                name: "last",
                type: ApplicationCommandOptionType.Subcommand
            },
            {
                description: i18n.__("commands.music.skipTo.slashSpecificDescription"),
                name: "specific",
                options: [
                    {
                        description: i18n.__("commands.music.skipTo.slashPositionDescription"),
                        name: "position",
                        required: true,
                        type: ApplicationCommandOptionType.Number
                    }
                ],
                type: ApplicationCommandOptionType.Subcommand
            }
        ]
    },
    usage: i18n.__mf("commands.music.skipTo.usage", { options: "first | last" })
})
export class SkipToCommand extends BaseCommand {
    @inVC
    @haveQueue
    @sameVC
    public async execute(ctx: CommandContext): Promise<void> {
        const djRole = await this.client.utils.fetchDJRole(ctx.guild as unknown as NonNullable<typeof ctx.guild>);
        if (
            this.client.data.data?.[ctx.guild?.id ?? ""]?.dj?.enable === true &&
            (this.client.channels.cache.get(ctx.guild?.queue?.connection?.joinConfig.channelId ?? "") as VoiceChannel)
                .members.size > 2 &&
            ctx.member?.roles.cache.has(djRole?.id ?? "") !== true &&
            ctx.member?.permissions.has("ManageGuild") !== true
        ) {
            await ctx.reply({
                embeds: [createEmbed("error", i18n.__("commands.music.skipTo.noPermission"), true)]
            });
            return;
        }

        const targetType =
            (ctx.args[0] as string | undefined) ??
            ctx.options?.getSubcommand() ??
            ctx.options?.getNumber("position") ??
            Number.NaN;
        if (targetType === "" || targetType === 0 || Number.isNaN(targetType)) {
            await ctx.reply({
                embeds: [
                    createEmbed(
                        "warn",
                        i18n.__mf("reusable.invalidUsage", {
                            prefix: `${this.client.config.mainPrefix}help`,
                            name: this.meta.name
                        })
                    )
                ]
            });
            return;
        }

        const songs = [...(ctx.guild?.queue?.songs.sortByIndex().values() as unknown as QueueSong[])];
        if (
            !["first", "last"].includes(String(targetType).toLowerCase()) &&
            !Number.isNaN(Number(targetType)) &&
            songs[Number(targetType) - 1] === undefined
        ) {
            await ctx.reply({
                embeds: [createEmbed("error", i18n.__("commands.music.skipTo.noSongPosition"), true)]
            });
            return;
        }

        let song: QueueSong;
        if (String(targetType).toLowerCase() === "first") {
            song = songs[0];
        } else if (String(targetType).toLowerCase() === "last") {
            song = songs.at(-1) as unknown as QueueSong;
        } else {
            song = songs[Number(targetType) - 1];
        }

        if (
            song.key ===
            ((ctx.guild?.queue?.player.state as AudioPlayerPlayingState).resource.metadata as QueueSong).key
        ) {
            await ctx.reply({
                embeds: [createEmbed("error", i18n.__("commands.music.skipTo.cantPlay"), true)]
            });
            return;
        }

        void play(ctx.guild as unknown as NonNullable<typeof ctx.guild>, song.key);

        await ctx.reply({
            embeds: [
                createEmbed(
                    "success",
                    `⏭ **|** ${i18n.__mf("commands.music.skipTo.skipMessage", {
                        song: `[${song.song.title}](${song.song.url})`
                    })}`
                ).setThumbnail(song.song.thumbnail)
            ]
        });
    }
}
