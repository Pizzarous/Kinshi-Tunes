import { CommandComponent } from "../typings/index.js";
import { CommandContext } from "./CommandContext.js";
import { KinshiTunes } from "./KinshiTunes.js";

export abstract class BaseCommand implements CommandComponent {
    public constructor(
        public client: KinshiTunes,
        public meta: CommandComponent["meta"]
    ) {}

    public abstract execute(ctx: CommandContext): unknown;
}

export type ExtendedCommandConstructor = new (...args: ConstructorParameters<typeof BaseCommand>) => BaseCommand;
