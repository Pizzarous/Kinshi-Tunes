import { exec } from "child_process";
import { ApplicationCommandOptionType } from "discord.js";
import i18n from "../../config/index.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof HostActionCommand>({
    aliases: ["hostaction"],
    description: i18n.__("commands.general.hostaction.description"),
    name: "hostaction",
    slash: {
        options: [
            {
                name: "action",
                description: "Specifies the action to perform (restart, shutdown, or cancel)",
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    {
                        name: "Restart",
                        value: "restart"
                    },
                    {
                        name: "Shutdown",
                        value: "shutdown"
                    },
                    {
                        name: "Cancel",
                        value: "cancel"
                    }
                ]
            }
        ]
    },
    usage: "{prefix}hostaction <restart|shutdown|cancel>"
})
export class HostActionCommand extends BaseCommand {
    public execute(ctx: CommandContext): void {
        const isAdmin = process.env.ADMIN_ID && ctx.author.id === process.env.ADMIN_ID;
        const action = ctx.isInteraction() ? ctx.options?.getString("action") : ctx.args[0];

        if (!isAdmin) {
            ctx.reply({
                embeds: [createEmbed("error", `❌ **|** ${i18n.__("commands.general.hostaction.errorMessage")}`)]
            }).catch(e => this.client.logger.error("HostAction_CMD_ERR:", e));
            return;
        }

        if (!action || (action !== "restart" && action !== "shutdown" && action !== "cancel")) {
            console.log(action);
            ctx.reply({
                embeds: [createEmbed("error", `❌ **|** ${i18n.__("commands.general.hostaction.invalidAction")}`)]
            }).catch(e => this.client.logger.error("HostAction_CMD_ERR:", e));
            return;
        }

        ctx.guild?.queue?.destroy();

        const timeout = 15;

        let successMessageKey;
        switch (action) {
            case "restart":
            case "shutdown":
                successMessageKey = "leftMessage";
                break;
            case "cancel":
                successMessageKey = "cancelMessage";
                break;
        }

        ctx.reply({
            embeds: [createEmbed("success", `👋 **|** ${i18n.__(`commands.general.hostaction.${successMessageKey}`)}`)]
        }).catch(e => this.client.logger.error("HostAction_CMD_ERR:", e));

        let cmd;
        switch (action) {
            case "restart":
                cmd = `shutdown /r /t ${timeout}`;
                break;
            case "shutdown":
                cmd = `shutdown /s /t ${timeout}`;
                break;
            case "cancel":
                cmd = "shutdown /a";
                break;
        }

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Failed to perform host action (${action}): `, error);
                return;
            }

            if (stdout) console.log(`stdout: ${stdout}`);

            if (stderr) console.error(`stderr: ${stderr}`);
        });
    }
}
