import { inVC, sameVC, validVC, haveQueue } from "../../utils/decorators/MusicUtil.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { Command } from "../../utils/decorators/Command.js";
import i18n from "../../config/index.js";

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
    @haveQueue
    public execute(ctx: CommandContext): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        ctx.guild?.queue?.clear(ctx.member!);
        ctx.reply({
            embeds: [createEmbed("success", `🗑️ **|** ${i18n.__("commands.music.clearQueue.clearedMessage")}`)]
        }).catch(e => this.client.logger.error("CLEARQUEUE_CMD_ERR:", e));
    }
}
