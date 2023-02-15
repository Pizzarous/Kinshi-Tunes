import { inVC, sameVC, validVC } from "../../utils/decorators/MusicUtil";
import { CommandContext } from "../../structures/CommandContext";
import { createEmbed } from "../../utils/functions/createEmbed";
import { BaseCommand } from "../../structures/BaseCommand";
import { Command } from "../../utils/decorators/Command";
import i18n from "../../config";

@Command({
    aliases: ["clear", "clean", "qnt"],
    description: i18n.__("commands.music.clearQueue.description"),
    name: "clearqueue",
    slash: {
        options: []
    },
    usage: "{prefix}clear"
})
export class ClearQueueCommand extends BaseCommand {
    @inVC
    @validVC
    @sameVC
    public execute(ctx: CommandContext): void {
        ctx.guild?.queue?.clear(ctx.member!);
        ctx.reply({
            embeds: [createEmbed("success", `🗑️ **|** ${i18n.__("commands.music.clearQueue.clearedMessage")}`)]
        }).catch(e => this.client.logger.error("CLEARQUEUE_CMD_ERR:", e));
    }
}