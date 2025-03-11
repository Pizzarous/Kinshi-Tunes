import { ApplicationCommandOptionType, VoiceChannel } from "discord.js";
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { haveQueue, inVC, sameVC } from "../../utils/decorators/MusicUtil.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof MoveCommand>({
    aliases: ["m"],
    description: i18n.__("commands.music.move.description"),
    name: "move",
    slash: {
        options: [
            {
                description: i18n.__("commands.music.move.slashSourceDescription"),
                name: "source",
                required: true,
                type: ApplicationCommandOptionType.Integer
            },
            {
                description: i18n.__("commands.music.move.slashDestinationDescription"),
                name: "destination",
                required: true,
                type: ApplicationCommandOptionType.Integer
            }
        ]
    },
    usage: "{prefix}move <source> <destination>"
})
export class MoveCommand extends BaseCommand {
    @inVC
    @haveQueue
    @sameVC
    public async execute(ctx: CommandContext): Promise<void> {
        // Check for DJ role permissions if more than 2 users in VC
        const djRole = await this.client.utils.fetchDJRole(ctx.guild!);
        if (
            this.client.data.data?.[ctx.guild!.id]?.dj?.enable &&
            (this.client.channels.cache.get(ctx.guild?.queue?.connection?.joinConfig.channelId ?? "") as VoiceChannel)
                .members.size > 2 &&
            !ctx.member?.roles.cache.has(djRole?.id ?? "") &&
            !ctx.member?.permissions.has("ManageGuild")
        ) {
            void ctx.reply({
                embeds: [createEmbed("error", i18n.__("commands.music.move.noPermission"), true)]
            });
            return;
        }

        // Get source and destination positions
        const source = ctx.options?.getInteger("source") ?? parseInt(ctx.args[0]);
        const destination = ctx.options?.getInteger("destination") ?? parseInt(ctx.args[1]);

        // Validate input
        if (isNaN(source) || isNaN(destination)) {
            void ctx.reply({
                embeds: [createEmbed("error", i18n.__("commands.music.move.invalidInput"), true)]
            });
            return;
        }

        // Get all songs in the queue sorted by index
        const songs = [...ctx.guild!.queue!.songs.sortByIndex().values()];

        // Adjust positions to be 0-based for array indexing
        const sourceIndex = source - 1;
        const destinationIndex = destination - 1;

        // Check if positions are valid
        if (sourceIndex < 0 || sourceIndex >= songs.length) {
            void ctx.reply({
                embeds: [
                    createEmbed("error", i18n.__mf("commands.music.move.invalidSource", { length: songs.length }), true)
                ]
            });
            return;
        }

        if (destinationIndex < 0 || destinationIndex >= songs.length) {
            void ctx.reply({
                embeds: [
                    createEmbed(
                        "error",
                        i18n.__mf("commands.music.move.invalidDestination", { length: songs.length }),
                        true
                    )
                ]
            });
            return;
        }

        // Check if trying to move currently playing song (index 0)
        if (sourceIndex === 0 || destinationIndex === 0) {
            void ctx.reply({
                embeds: [createEmbed("error", i18n.__("commands.music.move.cantMoveNowPlaying"), true)]
            });
            return;
        }

        // Move the song
        const songToMove = songs[sourceIndex];

        // Remove song from its original position
        ctx.guild!.queue!.songs.delete(songToMove.key);

        // Recalculate indices for all songs based on the move operation
        const updatedSongs = [...ctx.guild!.queue!.songs.sortByIndex().values()];

        // Re-add the song to the queue with its new index
        let newIndex;
        if (sourceIndex < destinationIndex) {
            // Moving forward in the queue
            newIndex = updatedSongs[destinationIndex - 1]?.index + 1 || 0;
        } else {
            // Moving backward in the queue
            newIndex = updatedSongs[destinationIndex]?.index || 0;
        }

        // Update the song's index
        songToMove.index = newIndex;

        // Add back to queue
        ctx.guild!.queue!.songs.set(songToMove.key, songToMove);

        // Success message
        void ctx.reply({
            embeds: [
                createEmbed(
                    "success",
                    i18n.__mf("commands.music.move.moveSuccess", {
                        song: songToMove.song.title,
                        source: source,
                        destination: destination
                    })
                ).setThumbnail(songToMove.song.thumbnail)
            ]
        });
    }
}
