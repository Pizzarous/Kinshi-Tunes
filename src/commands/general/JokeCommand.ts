/* eslint-disable promise/prefer-await-to-then */
/* eslint-disable promise/prefer-await-to-callbacks */
import axios from "axios";
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

type IJokeApiResponse = {
    category: string;
    type: string;
    joke: string;
    setup: string;
    delivery: string;
};

@Command<typeof JokeCommand>({
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
        try {
            const response = await axios.get<IJokeApiResponse>("https://v2.jokeapi.dev/joke/Any");
            const joke =
                response.data.type === "twopart"
                    ? `${response.data.setup}\n\n${response.data.delivery}`
                    : response.data.joke;

            ctx.reply({
                embeds: [createEmbed("info", `**${joke}**`)]
            }).catch((error: unknown) => {
                this.client.logger.error("JOKE_CMD_ERR:", error);
            });
        } catch (error) {
            this.client.logger.error("JOKE_CMD_ERR:", error);
        }
    }
}
