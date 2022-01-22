import { Args } from "./Args";
import { compile_iteration } from "./compileIteration";

export enum Version
{
    WebGL1 = 100,
    WebGL2 = 300
}

// TODO:
//  - for loops don't contain ++i
//  - implement more ops

export function compile(data: ArrayBuffer, version: Version): string
{
    const args: Args = new Args();

    args.version = version;
    args.set_version = true;

    args.es = true;
    args.set_es = true;

    const spirv_file = new Uint32Array(data);

    if (args.reflect && args.reflect !== "") {
        throw new Error("Reflection not yet supported!");
        return;
    }

    return compile_iteration(args, spirv_file);
}