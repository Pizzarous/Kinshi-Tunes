/* eslint-disable promise/prefer-await-to-then */
/* eslint-disable promise/prefer-await-to-callbacks */
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { haveQueue, inVC, sameVC, validVC } from "../../utils/decorators/MusicUtil.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof ClearQueueCommand>({
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
        ctx.guild?.queue?.clear();

        ctx.reply({
            embeds: [createEmbed("success", `🗑️ **|** ${i18n.__("commands.music.clearQueue.clearedMessage")}`)]
        }).catch((error: unknown) => this.client.logger.error("CLEARQUEUE_CMD_ERR:", error));
    }
}
