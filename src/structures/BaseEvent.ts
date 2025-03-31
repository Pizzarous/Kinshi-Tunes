/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Event } from "../typings/index.js";
import type { KinshiTunes } from "./KinshiTunes.js";

export abstract class BaseEvent implements Event {
    public constructor(
        public client: KinshiTunes,
        public readonly name: Event["name"]
    ) {}

    public abstract execute(...args: any[]): any;
}

export type ExtendedEventConstructor = new (...args: ConstructorParameters<typeof BaseEvent>) => BaseEvent;
