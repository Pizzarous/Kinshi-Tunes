import { Event } from "../typings/index.js";
import { KinshiTunes } from "./KinshiTunes.js";

export abstract class BaseEvent implements Event {
    public constructor(
        public client: KinshiTunes,
        public readonly name: Event["name"]
    ) {}

    public abstract execute(...args: unknown[]): unknown;
}

export type ExtendedEventConstructor = new (...args: ConstructorParameters<typeof BaseEvent>) => BaseEvent;
