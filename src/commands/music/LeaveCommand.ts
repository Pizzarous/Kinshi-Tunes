import { inVC, sameVC, validVC } from "../../utils/decorators/MusicUtil";
import { CommandContext } from "../../structures/CommandContext";
import { createEmbed } from "../../utils/functions/createEmbed";
import { BaseCommand } from "../../structures/BaseCommand";
import { Command } from "../../utils/decorators/Command";
import i18n from "../../config";

@Command({
    aliases: ["leave"],
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
        ctx.guild?.leave();

        ctx.reply({
            embeds: [createEmbed("success", `👋 **|** ${i18n.__("commands.music.leave.leftMessage")}`)]
        }).catch(e => this.client.logger.error("LEAVE_CMD_ERR:", e));
    }
}
