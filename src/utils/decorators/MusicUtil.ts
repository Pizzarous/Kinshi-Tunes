import { PermissionFlagsBits } from "discord.js";
import i18n from "../../config/index.js";
import { createEmbed } from "../functions/createEmbed.js";
import { createCmdExecuteDecorator } from "./createCmdExecuteDecorator.js";

export const haveQueue = createCmdExecuteDecorator(ctx => {
    if (!ctx.guild?.queue) {
        void ctx.reply({
            embeds: [createEmbed("warn", i18n.__("utils.musicDecorator.noQueue"))]
        });
        return false;
    }
    return true;
});

export const inVC = createCmdExecuteDecorator(ctx => {
    if (!ctx.member?.voice.channel) {
        void ctx.reply({
            embeds: [createEmbed("warn", i18n.__("utils.musicDecorator.noInVC"))]
        });
        return false;
    }
    return true;
});

export const validVC = createCmdExecuteDecorator(ctx => {
    const voiceChannel = ctx.member?.voice.channel;

    if (!ctx.guild?.members.me) return true;
    if (voiceChannel?.id === ctx.guild.members.me.voice.channel?.id) return true;
    if (voiceChannel?.joinable !== true) {
        void ctx.reply({
            embeds: [createEmbed("error", i18n.__("utils.musicDecorator.validVCJoinable"), true)]
        });

        return false;
    }
    if (!voiceChannel.permissionsFor(ctx.guild.members.me).has(PermissionFlagsBits.Speak)) {
        void ctx.reply({
            embeds: [createEmbed("error", i18n.__("utils.musicDecorator.validVCPermission"), true)]
        });
        return false;
    }

    return true;
});

export const sameVC = createCmdExecuteDecorator(ctx => {
    if (!ctx.guild?.members.me?.voice.channel) return true;

    const botVC = ctx.guild.queue?.connection?.joinConfig.channelId ?? ctx.guild.members.me.voice.channel.id;
    if (ctx.member?.voice.channel?.id !== botVC) {
        void ctx.reply({
            embeds: [createEmbed("warn", i18n.__("utils.musicDecorator.sameVC"))]
        });
        return false;
    }

    return true;
});
