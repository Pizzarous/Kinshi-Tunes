import process from "node:process";
import { setTimeout } from "node:timers";
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof RestartCommand>({
    aliases: ["restart", "reboot", "reset"],
    description: i18n.__("commands.developers.restart.description"),
    name: "restart",
    slash: {
        options: []
    },
    usage: "{prefix}restart"
})
export class RestartCommand extends BaseCommand {
    public execute(ctx: CommandContext): void {
        const isAdmin = Boolean(process.env.ADMIN) && ctx.author.id === process.env.ADMIN;
        const isDev = this.client.config.devs.includes(ctx.author.id);
        if (!isAdmin && !isDev) {
            ctx.reply({
                embeds: [createEmbed("error", `❌ **|** ${i18n.__("commands.developers.restart.errorMessage")}`)]
            }).catch(error => this.client.logger.error("RESTART_CMD_ERR:", error));
            return;
        }

        ctx.guild?.queue?.destroy();

        ctx.reply({
            embeds: [createEmbed("success", `👋 **|** ${i18n.__("commands.developers.restart.leftMessage")}`)]
        }).catch(error => this.client.logger.error("RESTART_CMD_ERR:", error));

        setTimeout(() => {
            process.exit(0);
        }, 2_000);
    }
}
