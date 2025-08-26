import process from "node:process";
import { setTimeout } from "node:timers";
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof RestartCommand>({
    aliases: ["restart", "reboot", "reset"],
    description: i18n.__("commands.general.restart.description"),
    name: "restart",
    slash: {
        options: []
    },
    usage: "{prefix}restart"
})
export class RestartCommand extends BaseCommand {
    public execute(ctx: CommandContext): void {
        if (!process.env.ADMIN_ID || ctx.author.id !== process.env.ADMIN_ID) {
            ctx.reply({
                embeds: [createEmbed("error", `❌ **|** ${i18n.__("commands.general.restart.errorMessage")}`)]
            }).catch(error => this.client.logger.error("RESTART_CMD_ERR:", error));
            return;
        }

        ctx.guild?.queue?.destroy();

        ctx.reply({
            embeds: [createEmbed("success", `👋 **|** ${i18n.__("commands.general.restart.leftMessage")}`)]
        }).catch(error => this.client.logger.error("RESTART_CMD_ERR:", error));

        setTimeout(() => {
            process.exit(0);
        }, 2_000);
    }
}
