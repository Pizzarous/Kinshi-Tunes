/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from "date-fns";
import type { LoggerOptions } from "../../typings/index.js";

enum ANSIColorOpening {
    Red = "\u001B[31m",
    Yellow = "\u001B[33m",
    Green = "\u001B[32m",
    Blue = "\u001B[34m"
}

const ansiColorClosing = "\u001B[39m";

export type LogLevel = "debug" | "error" | "info" | "warn";

const levelColors: Record<LogLevel, string> = {
    debug: ANSIColorOpening.Blue,
    error: ANSIColorOpening.Red,
    info: ANSIColorOpening.Green,
    warn: ANSIColorOpening.Yellow
};

export class BaseLogger {
    public constructor(public readonly color: boolean = true) {}

    protected log(messages: any[], level: LogLevel = "info"): void {
        const opening = this.color ? "" : levelColors[level];
        const closing = this.color ? "" : ansiColorClosing;
        const formattedDate = format(Date.now(), "yyyy-MM-dd HH:mm:ss (x)");
        const message = messages.map(String).join(" ");

        console[level](`${opening}[${formattedDate}] [${level}]: ${message} ${closing}`);
    }
}

export class Logger extends BaseLogger {
    public constructor(public readonly options: LoggerOptions) {
        super(options.prod);
    }

    public info(...messages: any[]): void {
        this.log(messages, "info");
    }

    public debug(...messages: any[]): void {
        if (this.options.prod) return;
        this.log(messages, "debug");
    }

    public error(...messages: any[]): void {
        this.log(messages, "error");
    }

    public warn(...messages: any[]): void {
        this.log(messages, "warn");
    }
}
