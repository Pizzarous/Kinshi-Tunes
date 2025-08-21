/* eslint-disable promise/prefer-await-to-callbacks */
/* eslint-disable promise/prefer-await-to-then */
import process from "node:process";
import { setTimeout } from "node:timers";
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof ShutdownCommand>({
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
        if (Boolean(process.env.ADMIN_ID) || ctx.author.id !== process.env.ADMIN_ID) {
            ctx.reply({
                embeds: [createEmbed("error", `❌ **|** ${i18n.__("commands.general.shutdown.errorMessage")}`)]
            }).catch((error: unknown) => this.client.logger.error("SHUTDOWN_CMD_ERR:", error));
            return;
        }

        ctx.guild?.queue?.destroy();

        ctx.reply({
            embeds: [createEmbed("success", `👋 **|** ${i18n.__("commands.general.shutdown.leftMessage")}`)]
        }).catch((error: unknown) => this.client.logger.error("SHUTDOWN_CMD_ERR:", error));

        setTimeout(() => {
            process.kill(process.pid, "SIGINT");
        }, 2_000);
    }
}
