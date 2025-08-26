import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { inVC, sameVC, validVC } from "../../utils/decorators/MusicUtil.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof LeaveCommand>({
    aliases: ["leave", "l", "quit", "q"],
    description: i18n.__("commands.music.leave.description"),
    name: "leave",
    slash: {
        options: []
    },
    usage: "{prefix}leave"
})
export class LeaveCommand extends BaseCommand {
    @inVC
    @validVC
    @sameVC
    public execute(ctx: CommandContext): void {
        ctx.guild?.queue?.destroy();

        ctx.reply({
            embeds: [createEmbed("success", `👋 **|** ${i18n.__("commands.music.leave.leftMessage")}`)]
        }).catch((error: unknown) => this.client.logger.error("LEAVE_CMD_ERR:", error));
    }
}
