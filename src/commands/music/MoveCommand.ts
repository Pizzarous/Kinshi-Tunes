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

        // Get the song to move
        const songToMove = songs[sourceIndex];

        // Store all songs to reindex them properly
        const allSongs = [...songs];

        // Remove the song from its current position in our array
        allSongs.splice(sourceIndex, 1);

        // Insert the song at the destination position
        allSongs.splice(destinationIndex, 0, songToMove);

        // Clear the current queue (except the currently playing song)
        const currentlyPlaying = allSongs.shift(); // Remove the first song

        // Delete all songs from the queue except currently playing
        ctx.guild!.queue!.songs.forEach((song, key) => {
            if (song.index !== currentlyPlaying?.index) {
                ctx.guild!.queue!.songs.delete(key);
            }
        });

        // Add all songs back with proper indexes
        allSongs.forEach((song, idx) => {
            song.index = currentlyPlaying!.index + idx + 1;
            ctx.guild!.queue!.songs.set(song.key, song);
        });

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
