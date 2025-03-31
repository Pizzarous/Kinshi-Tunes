/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FunctionType, MethodDecorator, Promisable } from "../../typings/index.js";

export function createMethodDecorator<TC = any, Target extends FunctionType = FunctionType>(
    func: (...args: Parameters<Target>) => Promisable<boolean | undefined>
): MethodDecorator<TC, any> {
    return (target, _, descriptor) => {
        const originalMethod = descriptor.value as Target;

        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        descriptor.value = async function value(...args: Parameters<Target>) {
            const res = await func(...args);
            if (res === false) return;

            originalMethod.apply(this, args);
        };
    };
}
