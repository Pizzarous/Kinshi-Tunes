/* eslint-disable unicorn/prefer-string-slice */
/* eslint-disable node/prefer-global/url */
/* eslint-disable typescript/no-inferrable-types */
/* eslint-disable require-unicode-regexp */
/* eslint-disable unicorn/better-regex */
/* eslint-disable unicorn/prefer-string-replace-all */
/* eslint-disable typescript/strict-boolean-expressions */
/* eslint-disable node/no-sync */
/* eslint-disable consistent-return */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApplicationCommandOptionType, AttachmentBuilder, Message } from "discord.js";
import ffmpegStatic from "ffmpeg-static";
import { youtubeDl } from "youtube-dl-exec";
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

const currentFilename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilename);

@Command<typeof DownloadCommand>({
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
        let mp3FilePath: string;

        try {
            // Extract video metadata to get the title
            console.log("Extracting video metadata using youtube-dl");
            const metadata = await youtubeDl(url, {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true
            });

            const title =
                typeof metadata === "object" && metadata !== null && "fulltitle" in metadata
                    ? ((metadata as { fulltitle?: string }).fulltitle ?? "audio")
                    : "audio";

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
                fs.mkdirSync(tempDir, { recursive: true });
            }

            mp3FilePath = path.join(tempDir, `${sanitizedTitle}.mp3`);

            // Download and convert to MP3 directly using youtube-dl
            console.log("Downloading and converting to MP3 using youtube-dl");
            await youtubeDl(url, {
                extractAudio: true,
                audioFormat: "mp3",
                audioQuality: 192, // Good quality MP3
                output: path.join(tempDir, `${sanitizedTitle}.%(ext)s`),
                ffmpegLocation: String(ffmpegStatic),
                noCheckCertificates: true,
                noWarnings: true,
                restrictFilenames: true, // Helps avoid filename issues
                addHeader: [
                    "referer:youtube.com",
                    "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                ]
            });

            console.log("Download and conversion successful");

            // Check if the file was created
            if (!fs.existsSync(mp3FilePath)) {
                throw new Error(`MP3 file not found at ${mp3FilePath}`);
            }

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

            // Clean up the file after sending
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
            // Ensure the temp directory is cleaned up
            if (tempDir && fs.existsSync(tempDir)) {
                try {
                    const files = fs.readdirSync(tempDir);
                    for (const file of files) {
                        const filePath = path.join(tempDir, file);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    }
                    // Only remove directory if it's empty
                    if (fs.readdirSync(tempDir).length === 0) {
                        fs.rmdirSync(tempDir);
                    }
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
            .replace(/[^\w\s.-]/g, "") // Keep only word characters, spaces, dots, and hyphens
            .trim()
            .substring(0, 80); // Shorter length to avoid issues

        // Check if the sanitized title is empty
        if (!sanitizedTitle) sanitizedTitle = "audio";

        return sanitizedTitle;
    }
}
