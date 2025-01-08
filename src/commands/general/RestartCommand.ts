import { CommandContext } from "../../structures/CommandContext.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { Command } from "../../utils/decorators/Command.js";
import i18n from "../../config/index.js";

@Command({
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
            }).catch(e => this.client.logger.error("RESTART_CMD_ERR:", e));
            return;
        }

        ctx.guild?.queue?.destroy();

        ctx.reply({
            embeds: [createEmbed("success", `👋 **|** ${i18n.__("commands.general.restart.leftMessage")}`)]
        }).catch(e => this.client.logger.error("RESTART_CMD_ERR:", e));

        setTimeout(() => {
            process.exit(0);
        }, 2000);
    }
}
