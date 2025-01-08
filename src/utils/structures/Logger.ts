import { LoggerOptions } from "../../typings/index.js";
import { format } from "date-fns";

enum ANSIColorOpening {
    Red = "\x1b[31m",
    Yellow = "\x1b[33m",
    Green = "\x1b[32m",
    Blue = "\x1b[34m"
}

const ansiColorClosing = "\x1b[39m";

export type LogLevel = "debug" | "error" | "info" | "warn";

const levelColors: Record<LogLevel, string> = {
    debug: ANSIColorOpening.Blue,
    error: ANSIColorOpening.Red,
    info: ANSIColorOpening.Green,
    warn: ANSIColorOpening.Yellow
};

export class BaseLogger {
    public constructor(public readonly color: boolean = true) {}

    protected log(messages: unknown[], level: LogLevel = "info"): void {
        const opening = this.color ? "" : levelColors[level];
        const closing = this.color ? "" : ansiColorClosing;
        const formattedDate = format(Date.now(), "yyyy-MM-dd HH:mm:ss (x)");
        const message = messages.map(x => String(x)).join(" ");

        console[level](`${opening}[${formattedDate}] [${level}]: ${message} ${closing}`);
    }
}

export class Logger extends BaseLogger {
    public constructor(public readonly options: LoggerOptions) {
        super(options.prod);
    }

    public info(...messages: unknown[]): void {
        this.log(messages, "info");
    }

    public debug(...messages: unknown[]): void {
        if (this.options.prod) return;
        this.log(messages, "debug");
    }

    public error(...messages: unknown[]): void {
        this.log(messages, "error");
    }

    public warn(...messages: unknown[]): void {
        this.log(messages, "warn");
    }
}
