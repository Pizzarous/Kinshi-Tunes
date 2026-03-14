import { AudioPlayerState, AudioResource } from "@discordjs/voice";
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { QueueSong } from "../../typings/index.js";
import { Command } from "../../utils/decorators/Command.js";
import { inVC, sameVC, validVC } from "../../utils/decorators/MusicUtil.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof StopCommand>({
    aliases: [],
    description: i18n.__("commands.music.stop.description"),
    name: "stop",
    slash: {
        options: []
    },
    usage: "{prefix}stop"
})
export class StopCommand extends BaseCommand {
    @inVC
    @validVC
    @sameVC
    public async execute(ctx: CommandContext): Promise<void> {
        const np = (
            ctx.guild?.queue?.player.state as (AudioPlayerState & { resource: AudioResource | undefined }) | undefined
        )?.resource?.metadata as QueueSong | undefined;

        ctx.guild?.queue?.stop();
        (ctx.guild?.queue as unknown as NonNullable<NonNullable<typeof ctx.guild>["queue"]>).lastMusicMsg = null;

        const description = np?.song
            ? `⏹ **|** ${i18n.__("commands.music.stop.stoppedMessage")} **[${np.song.title}](${np.song.url})**`
            : `⏹ **|** ${i18n.__("commands.music.stop.stoppedMessage")}`;

        await ctx
            .reply({
                embeds: [createEmbed("success", description)]
            })
            .catch((error: unknown) => this.client.logger.error("STOP_CMD_ERR:", error));
    }
}
