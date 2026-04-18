import process from "node:process";
import { clientOptions } from "../../config/index.js";
import { discordTokens, isMultiBot, isProd } from "../../config/env.js";
import { KinshiTunes } from "../../structures/KinshiTunes.js";
import { Logger } from "./Logger.js";
import { MultiBotManager } from "./MultiBotManager.js";

const log = new Logger({ prod: isProd });

export class MultiBotLauncher {
    private readonly clients: KinshiTunes[] = [];
    private readonly multiBotManager = MultiBotManager.getInstance();

    private async gracefulShutdown(signal: string): Promise<void> {
        log.info(`[MultiBot] Received ${signal}, shutting down gracefully...`);
        for (const client of this.clients) {
            void client.destroy();
        }
        log.info("[MultiBot] All instances destroyed.");
        process.exit(0);
    }

    private setupProcessHandlers(): void {
        process.on("SIGINT", () => void this.gracefulShutdown("SIGINT"));
        process.on("SIGTERM", () => void this.gracefulShutdown("SIGTERM"));
        process
            .on("exit", code => log.info(`NodeJS process exited with code ${code}`))
            .on("unhandledRejection", reason => {
                const message = (reason as Error).stack ?? String(reason);
                log.error(`UNHANDLED_REJECTION: ${message}`);
            })
            .on("warning", warning => log.warn(`NODE_WARNING: ${warning}`))
            .on("uncaughtException", err => {
                log.error(`UNCAUGHT_EXCEPTION: ${err.stack ?? err}`);
                process.exit(1);
            });
    }

    private async createBotInstance(token: string, tokenIndex: number): Promise<KinshiTunes> {
        const client = new KinshiTunes(clientOptions);

        client.on("clientReady", () => {
            log.info(
                `[MultiBot] Bot #${tokenIndex} (${client.user?.tag}) is ready! (${client.guilds.cache.size} guilds)`
            );
            if (client.user) {
                this.multiBotManager.registerBot(client, tokenIndex, client.user.id);
                log.info(`[MultiBot] Registered bot #${tokenIndex} (${client.user.tag})`);
            }
        });

        client.on("error", error => log.error(`[MultiBot] Bot #${tokenIndex} error: ${error.message}`));

        await client.build(token);
        return client;
    }

    public async start(): Promise<void> {
        this.setupProcessHandlers();

        if (!isMultiBot || discordTokens.length <= 1) {
            const token = discordTokens[0] ?? process.env.DISCORD_TOKEN;
            if (!token) {
                log.error("[FATAL] DISCORD_TOKEN is not set!");
                process.exit(1);
            }
            const client = await this.createBotInstance(token, 0);
            this.clients.push(client);
            log.info("[MultiBot] Single-bot mode — started 1 instance.");
            return;
        }

        log.info(`[MultiBot] Starting ${discordTokens.length} bot instances...`);
        for (let i = 0; i < discordTokens.length; i++) {
            const token = discordTokens[i];
            if (!token) {
                log.warn(`[MultiBot] Token #${i} is empty, skipping...`);
                continue;
            }
            try {
                const client = await this.createBotInstance(token, i);
                this.clients.push(client);
            } catch (error: unknown) {
                log.error(`[MultiBot] Error starting bot #${i}: ${error}`);
                throw error;
            }
        }
        log.info(`[MultiBot] Successfully started ${this.clients.length} bot instances!`);
    }

    public getClients(): KinshiTunes[] {
        return this.clients;
    }
}
