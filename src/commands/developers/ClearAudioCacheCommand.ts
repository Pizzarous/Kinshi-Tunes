import process from "node:process";
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof ClearAudioCacheCommand>({
    aliases: ["clearcache", "cacheclear"],
    cooldown: 0,
    description: i18n.__("commands.developers.clearAudioCache.description"),
    name: "clearaudiocache",
    slash: {
        options: []
    },
    usage: i18n.__("commands.developers.clearAudioCache.usage")
})
export class ClearAudioCacheCommand extends BaseCommand {
    public async execute(ctx: CommandContext): Promise<void> {
        const isAdmin = Boolean(process.env.ADMIN_ID) && ctx.author.id === process.env.ADMIN_ID;

        if (!isAdmin) {
            await ctx
                .send({
                    embeds: [createEmbed("error", `❌ **|** ${i18n.__("commands.general.hostaction.errorMessage")}`)]
                })
                .catch((error: unknown) => this.client.logger.error("CLEAR_AUDIO_CACHE_ERR:", error));
            return;
        }

        const stats = this.client.audioCache.getStats();
        const sizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);

        this.client.audioCache.clearCache();

        await ctx
            .send({
                embeds: [
                    createEmbed(
                        "success",
                        i18n.__mf("commands.developers.clearAudioCache.success", {
                            files: stats.files,
                            size: sizeMB
                        })
                    )
                ]
            })
            .catch((error: unknown) => this.client.logger.error("CLEAR_AUDIO_CACHE_ERR:", error));
    }
}
