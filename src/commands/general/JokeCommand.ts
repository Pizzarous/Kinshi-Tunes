import { CommandContext } from "../../structures/CommandContext";
import { createEmbed } from "../../utils/functions/createEmbed";
import { BaseCommand } from "../../structures/BaseCommand";
import { Command } from "../../utils/decorators/Command";
import i18n from "../../config";
import axios from "axios";

interface JokeApiResponse {
    category: string;
    type: string;
    joke: string;
    setup: string;
    delivery: string;
}

@Command({
    aliases: ["joke", "yoke"],
    description: i18n.__("commands.general.joke.description"),
    name: "joke",
    slash: {
        options: []
    },
    usage: "{prefix}joke"
})
export class JokeCommand extends BaseCommand {

    public async execute(ctx: CommandContext): Promise<void> {
        const response = await axios.get<JokeApiResponse>("https://v2.jokeapi.dev/joke/Any");
        const joke = response.data.type === "twopart" ? `${response.data.setup}\n\n${response.data.delivery}` : response.data.joke;

        ctx.reply({
            embeds: [createEmbed("info", `**${joke}**`)]
        }).catch(e => {
            this.client.logger.error("JOKE_CMD_ERR:", e)
        });
    }
}
