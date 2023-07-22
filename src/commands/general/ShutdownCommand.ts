import { CommandContext } from "../../structures/CommandContext.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { Command } from "../../utils/decorators/Command.js";
import i18n from "../../config/index.js";

@Command({
    aliases: ["shutdown", "bye", "terminate", "exit"],
    description: i18n.__("commands.general.shutdown.description"),
    name: "shutdown",
    slash: {
        options: []
    },
    usage: "{prefix}shutdown"
})
export class ShutdownCommand extends BaseCommand {
    public execute(ctx: CommandContext): void {
        if ((!process.env.ADMIN_ID) || ctx.author.id !== process.env.ADMIN_ID) {
            ctx.reply({
                embeds: [createEmbed("error", `❌ **|** ${i18n.__("commands.general.shutdown.errorMessage")}`)]
            }).catch(e => this.client.logger.error("SHUTDOWN_CMD_ERR:", e));
            return;
        }

        ctx.guild?.queue?.destroy();

        ctx.reply({
            embeds: [createEmbed("success", `👋 **|** ${i18n.__("commands.general.shutdown.leftMessage")}`)]
        }).catch(e => this.client.logger.error("SHUTDOWN_CMD_ERR:", e));

        setTimeout(() => {
            process.kill(process.pid, "SIGINT");
        }, 2000);
    }
}
