import { CommandContext } from "../../structures/CommandContext.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { Command } from "../../utils/decorators/Command.js";
import i18n from "../../config/index.js";
import { ApplicationCommandOptionType, Message, AttachmentBuilder } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ytDlp from "yt-dlp-exec";

ffmpeg.setFfmpegPath(ffmpegStatic);

const currentFilename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilename);

@Command({
    aliases: ["d", "download"],
    description: i18n.__("commands.music.download.description"),
    name: "download",
    slash: {
        description: i18n.__("commands.music.download.description"),
        options: [
            {
                description: i18n.__("commands.music.download.slashUrlDescription"),
                name: "url",
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    usage: i18n.__("commands.music.download.usage")
})
export class DownloadCommand extends BaseCommand {
    public async execute(ctx: CommandContext): Promise<Message | undefined> {
        if (ctx.isInteraction() && !ctx.deferred) {
            await ctx.deferReply();
        }

        let url = ctx.args.join(" ") || ctx.options?.getString("url");
        console.log("Original URL provided:", url);

        if (!url) {
            console.error("No URL provided");
            return ctx.isInteraction()
                ? ctx.followUp({
                      embeds: [createEmbed("warn", i18n.__("commands.music.download.noUrlProvided"))]
                  })
                : ctx.reply({
                      embeds: [createEmbed("warn", i18n.__("commands.music.download.noUrlProvided"))]
                  });
        }

        // Clean the URL to remove playlist parameters
        url = DownloadCommand.cleanUrl(url);
        console.log("Cleaned URL:", url);

        let tempDir: string = "";
        let tempFilePath: string;
        let mp3FilePath: string;

        try {
            // Extract video metadata to get the title
            console.log("Extracting video metadata using yt-dlp");
            const metadata = await ytDlp(url, {
                dumpSingleJson: true
            });
            const title = metadata.title || "audio";
            console.log("Video title:", title);

            // Sanitize the title to create valid file names
            const sanitizedTitle = DownloadCommand.sanitizeFileName(title);
            console.log("Sanitized title:", sanitizedTitle);

            // Send a message indicating the download attempt
            await (ctx.isInteraction()
                ? ctx.followUp({
                      content: i18n.__("commands.music.download.downloading", { title: sanitizedTitle })
                  })
                : ctx.reply({
                      content: i18n.__("commands.music.download.downloading", { title: sanitizedTitle })
                  }));

            // Create temp directory if it doesn't exist
            tempDir = path.join(currentDir, "temp");
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir);
            }

            tempFilePath = path.join(tempDir, `${sanitizedTitle}.webm`);
            mp3FilePath = path.join(tempDir, `${sanitizedTitle}.mp3`);

            // Download the audio using yt-dlp
            console.log("Attempting to download audio using yt-dlp");
            await ytDlp(url, {
                output: tempFilePath,
                format: "bestaudio",
                ffmpegLocation: ffmpegStatic
            });
            console.log("Download successful");

            // Convert the file to MP3 using ffmpeg
            await new Promise<void>((resolve, reject) => {
                ffmpeg(tempFilePath)
                    .toFormat("mp3")
                    .on("end", () => {
                        console.log("Conversion to MP3 successful");
                        resolve();
                    })
                    .on("error", (err: Error) => {
                        console.error("Error converting to MP3:", err);
                        reject(err);
                    })
                    .save(mp3FilePath);
            });

            // Send the MP3 file as an attachment
            const attachment = new AttachmentBuilder(mp3FilePath);
            await (ctx.isInteraction()
                ? ctx.followUp({
                      content: i18n.__("commands.music.download.downloadCompleted"),
                      files: [attachment]
                  })
                : ctx.reply({
                      content: i18n.__("commands.music.download.downloadCompleted"),
                      files: [attachment]
                  }));

            // Clean up the files after sending
            fs.unlinkSync(tempFilePath);
            fs.unlinkSync(mp3FilePath);
            console.log("Temporary files deleted");
        } catch (error) {
            console.error("Error downloading or processing the file:", error);

            await (ctx.isInteraction()
                ? ctx.followUp({
                      embeds: [createEmbed("error", i18n.__("commands.music.download.downloadFailed"))]
                  })
                : ctx.reply({
                      embeds: [createEmbed("error", i18n.__("commands.music.download.downloadFailed"))]
                  }));
            return;
        } finally {
            // Ensure the temp directory is deleted, if it was created
            if (tempDir && fs.existsSync(tempDir)) {
                try {
                    const files = fs.readdirSync(tempDir);
                    for (const file of files) {
                        const filePath = path.join(tempDir, file);
                        fs.unlinkSync(filePath); // Delete each file inside the temp directory
                    }
                    fs.rmdirSync(tempDir); // Delete the temp directory itself
                } catch (cleanupError) {
                    console.error("Error cleaning up temp folder:", cleanupError);
                }
            }
        }
    }

    // Function to clean URL by removing the &list and other playlist-related parameters
    private static cleanUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.delete("list");
            urlObj.searchParams.delete("index");
            urlObj.searchParams.delete("start_radio");
            urlObj.searchParams.delete("t");

            return urlObj.toString();
        } catch (error) {
            console.error("Error cleaning URL:", error);
            return url; // Return the original URL if cleaning fails
        }
    }

    private static sanitizeFileName(fileName: string): string {
        let sanitizedTitle = fileName
            .replace(/[<>:"/\\|?*]+/g, "") // Remove invalid characters
            .trim();

        // Check if the sanitized title is empty
        if (!sanitizedTitle) sanitizedTitle = "audio";

        return sanitizedTitle;
    }
}
