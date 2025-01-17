import { embedColor, noEmoji, yesEmoji } from "../../config/index.js";
import { ColorResolvable, EmbedBuilder } from "discord.js";

type HexColorsType = "error" | "info" | "success" | "warn";
const hexColors: Record<HexColorsType, string> = {
    error: "Red",
    info: embedColor,
    success: "Green",
    warn: "Yellow"
};

export function createEmbed(type: HexColorsType, message?: string, emoji = false): EmbedBuilder {
    const embed = new EmbedBuilder().setColor(hexColors[type] as ColorResolvable);

    if (message) embed.setDescription(message);
    if (type === "error" && emoji) embed.setDescription(`${noEmoji} **|** ${message!}`);
    if (type === "success" && emoji) embed.setDescription(`${yesEmoji} **|** ${message!}`);
    return embed;
}
