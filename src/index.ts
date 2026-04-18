import nodePath from "node:path";
import process from "node:process";
import { start } from "node:repl";
import { ShardingManager } from "discord.js";
import { discordTokens, enableRepl, isMultiBot, isProd, shardingMode, shardsCount } from "./config/index.js";
import { importURLToString } from "./utils/functions/importURLToString.js";
import { Logger } from "./utils/structures/Logger.js";
import { MultiBotLauncher } from "./utils/structures/MultiBotLauncher.js";

const log = new Logger({ prod: isProd });

if (isMultiBot && discordTokens.length > 1) {
    log.info(`[MultiBot] Starting ${discordTokens.length} bot instances directly...`);
    const launcher = new MultiBotLauncher();
    await launcher.start().catch((error: unknown) => {
        log.error("MULTIBOT_LAUNCHER_ERR: ", error);
        process.exit(1);
    });
} else {
    const token = discordTokens[0] ?? "";
    if (!token) {
        log.error("[FATAL] DISCORD_TOKEN is not set in environment variables!");
        process.exit(1);
    }

    const manager = new ShardingManager(nodePath.resolve(importURLToString(import.meta.url), "bot.js"), {
        totalShards: shardsCount,
        respawn: true,
        token,
        mode: shardingMode
    });

    if (enableRepl) {
        const repl = start({
            prompt: "> "
        });

        repl.context.shardManager = manager;
        process.stdin.on("data", () => repl.displayPrompt(true));
        repl.on("exit", () => process.exit());
    }

    await manager
        .on("shardCreate", shard => {
            log.info(`[ShardManager] Shard #${shard.id} has spawned.`);
            shard
                .on("disconnect", () =>
                    log.warn("SHARD_DISCONNECTED: ", { stack: `[ShardManager] Shard #${shard.id} has disconnected.` })
                )
                .on("reconnecting", () => log.info(`[ShardManager] Shard #${shard.id} has reconnected.`));
            if (manager.shards.size === manager.totalShards)
                log.info("[ShardManager] All shards are spawned successfully.");
        })
        .spawn()
        .catch((error: unknown) => log.error("SHARD_SPAWN_ERR: ", error));
}
