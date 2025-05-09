/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
import type { DiscordGatewayAdapterCreator } from "@discordjs/voice";
import { joinVoiceChannel } from "@discordjs/voice";
import type { Message, StageChannel, TextChannel, VoiceChannel } from "discord.js";
import { escapeMarkdown } from "discord.js";
import i18n from "../../../config/index.js";
import type { CommandContext } from "../../../structures/CommandContext.js";
import type { KinshiTunes } from "../../../structures/KinshiTunes.js";
import { ServerQueue } from "../../../structures/ServerQueue.js";
import type { Song } from "../../../typings/index.js";
import { chunk } from "../../functions/chunk.js";
import { createEmbed } from "../../functions/createEmbed.js";
import { parseHTMLElements } from "../../functions/parseHTMLElements.js";
import { ButtonPagination } from "../../structures/ButtonPagination.js";
import { play } from "./play.js";

export async function handleVideos(
    client: KinshiTunes,
    ctx: CommandContext,
    toQueue: Song[],
    voiceChannel: StageChannel | VoiceChannel
): Promise<Message | undefined> {
    const wasIdle = ctx.guild?.queue?.idle;

    async function sendPagination(): Promise<void> {
        for (const song of toQueue) {
            ctx.guild?.queue?.songs.addSong(song, ctx.member as unknown as NonNullable<typeof ctx.member>);
        }

        const opening = i18n.__mf("utils.generalHandler.handleVideoInitial", { length: toQueue.length });
        const pages = await Promise.all(
            chunk(toQueue, 10).map(async (vals, i) => {
                const texts = await Promise.all(
                    vals.map(
                        (song, index) => `${i * 10 + (index + 1)}.) ${escapeMarkdown(parseHTMLElements(song.title))}`
                    )
                );

                return texts.join("\n");
            })
        );
        const embed = createEmbed("info", opening);
        const msg = await ctx.reply({ embeds: [embed] }, true);

        return new ButtonPagination(msg, {
            author: ctx.author.id,
            edit: (i, emb, page) => {
                emb.setDescription(`\`\`\`\n${page}\`\`\``)
                    .setAuthor({
                        name: opening
                    })
                    .setFooter({
                        text: `• ${i18n.__mf("reusable.pageFooter", { actual: i + 1, total: pages.length })}`
                    });
            },
            embed,
            pages
        }).start();
    }

    if (ctx.guild?.queue) {
        await sendPagination();

        if (wasIdle === true) {
            void play(ctx.guild, undefined, wasIdle);
        }

        return;
    }

    (ctx.guild as unknown as NonNullable<typeof ctx.guild>).queue = new ServerQueue(ctx.channel as TextChannel);
    await sendPagination();

    client.debugLog.logData("info", "HANDLE_VIDEOS", `Created a server queue for ${ctx.guild?.name}(${ctx.guild?.id})`);

    try {
        const connection = joinVoiceChannel({
            adapterCreator: ctx.guild?.voiceAdapterCreator as DiscordGatewayAdapterCreator,
            channelId: voiceChannel.id,
            guildId: ctx.guild?.id ?? "",
            selfDeaf: true
        }).on("debug", message => {
            client.logger.debug(message);
        });

        (ctx.guild?.queue as unknown as NonNullable<NonNullable<typeof ctx.guild>["queue"]>).connection = connection;

        client.debugLog.logData(
            "info",
            "HANDLE_VIDEOS",
            `Connected to ${voiceChannel.name}(${voiceChannel.id}) in guild ${ctx.guild?.name}(${ctx.guild?.id})`
        );
    } catch (error) {
        ctx.guild?.queue?.songs.clear();
        delete ctx.guild?.queue;

        client.debugLog.logData(
            "error",
            "HANDLE_VIDEOS",
            `Error occured while connecting to ${ctx.guild?.name}(${ctx.guild?.id}). Reason: ${
                (error as Error).message
            }`
        );

        client.logger.error("PLAY_CMD_ERR:", error);
        await ctx.channel
            ?.send({
                embeds: [
                    createEmbed(
                        "error",
                        i18n.__mf("utils.generalHandler.errorJoining", { message: `\`${(error as Error).message}\`` }),
                        true
                    )
                ]
            })
            .catch((error_: unknown) => {
                client.logger.error("PLAY_CMD_ERR:", error_);
            });
        return;
    }

    void play(ctx.guild as unknown as NonNullable<typeof ctx.guild>);
}
