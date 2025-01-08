import { FunctionType, MethodDecorator, Promisable } from "../../typings/index.js";

export function createMethodDecorator<TC = unknown, Target extends FunctionType = FunctionType>(
    func: (...args: Parameters<Target>) => Promisable<boolean | undefined>
): MethodDecorator<TC, unknown> {
    return (target, _, descriptor) => {
        const originalMethod = descriptor.value as Target;

        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        descriptor.value = async function value(...args: Parameters<Target>) {
            const res = await func(...args);
            if (res === false) return;

            return originalMethod.apply(this, args);
        };
    };
}
