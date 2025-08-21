import type { CommandComponent } from "../typings/index.js";
import type { CommandContext } from "./CommandContext.js";
import type { KinshiTunes } from "./KinshiTunes.js";

export abstract class BaseCommand implements CommandComponent {
    public constructor(
        public client: KinshiTunes,
        public meta: CommandComponent["meta"]
    ) {}

    public abstract execute(ctx: CommandContext): any;
}

export type ExtendedCommandConstructor = new (...args: ConstructorParameters<typeof BaseCommand>) => BaseCommand;
