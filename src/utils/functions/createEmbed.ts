/* eslint-disable @typescript-eslint/naming-convention */
import type { ColorResolvable } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { embedColor, noEmoji, yesEmoji } from "../../config/index.js";

type hexColorsType = "error" | "info" | "success" | "warn";
const hexColors: Record<hexColorsType, string> = {
    error: "Red",
    info: embedColor,
    success: "Green",
    warn: "Yellow"
};

export function createEmbed(type: hexColorsType, message?: string, emoji = false): EmbedBuilder {
    const embed = new EmbedBuilder().setColor(hexColors[type] as ColorResolvable);

    if ((message?.length ?? 0) > 0) embed.setDescription(message ?? null);
    if (type === "error" && emoji) embed.setDescription(`${noEmoji} **|** ${message}`);
    if (type === "success" && emoji) embed.setDescription(`${yesEmoji} **|** ${message}`);
    return embed;
}
