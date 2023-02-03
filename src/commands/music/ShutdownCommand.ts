import { CommandContext } from "../../structures/CommandContext";
import { createEmbed } from "../../utils/functions/createEmbed";
import { BaseCommand } from "../../structures/BaseCommand";
import { Command } from "../../utils/decorators/Command";
import i18n from "../../config";

@Command({
    aliases: ["shutdown"],
    description: i18n.__("commands.music.shutdown.description"),
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
                embeds: [createEmbed("error", `❌ **|** ${i18n.__("commands.music.shutdown.errorMessage")}`)]
            }).catch(e => this.client.logger.error("SHUTDOWN_CMD_ERR:", e));
            return;
        }

        ctx.guild?.queue?.destroy();

        ctx.reply({
            embeds: [createEmbed("success", `👋 **|** ${i18n.__("commands.music.shutdown.leftMessage")}`)]
        }).catch(e => this.client.logger.error("SHUTDOWN_CMD_ERR:", e));

        setTimeout(() => {
            process.kill(process.pid, "SIGINT");
        }, 2000);
    }
}
