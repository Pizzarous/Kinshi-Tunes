import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { haveQueue, inVC, sameVC } from "../../utils/decorators/MusicUtil.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof ShuffleCommand>({
    description: i18n.__("commands.music.shuffle.description"),
    name: "shuffle",
    slash: {
        options: []
    },
    usage: "{prefix}shuffle"
})
export class ShuffleCommand extends BaseCommand {
    @inVC
    @haveQueue
    @sameVC
    public execute(ctx: CommandContext): void {
        ctx.guild!.queue!.shuffleQueue();

        void ctx.reply({
            embeds: [createEmbed("success", `🔀 **|** ${i18n.__("commands.music.shuffle.shuffled")}`)]
        });
    }
}
