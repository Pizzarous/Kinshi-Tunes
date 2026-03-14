import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { haveQueue, inVC, sameVC } from "../../utils/decorators/MusicUtil.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof ResumeCommand>({
    description: i18n.__("commands.music.resume.description"),
    name: "resume",
    slash: {
        options: []
    },
    usage: "{prefix}resume"
})
export class ResumeCommand extends BaseCommand {
    @inVC
    @haveQueue
    @sameVC
    public async execute(ctx: CommandContext): Promise<void> {
        if (ctx.guild?.queue?.playing === true) {
            await ctx.reply({
                embeds: [createEmbed("warn", i18n.__("commands.music.resume.alreadyResume"))]
            });
            return;
        }
        (ctx.guild?.queue as unknown as NonNullable<NonNullable<typeof ctx.guild>["queue"]>).playing = true;

        const msg = await ctx.reply({
            embeds: [createEmbed("success", `▶ **|** ${i18n.__("commands.music.resume.resumeMessage")}`)]
        });
        setTimeout(() => msg.delete().catch(() => undefined), 5_000);
    }
}
