import { Args } from "./Args";
import { compile_iteration } from "./compileIteration";

// TODO:
//  - uniform hx_camera _410; ==> id is different from reference, but otherwise export using it looks okay
//  - compare more against baseline compiles
//  - Everywhere we're using slice(), remove this and pass in an offset param

export enum Version
{
    WebGL1 = 100,
    WebGL2 = 300
}

export function compile(data: ArrayBuffer, version: Version): string
{
    const args: Args = new Args();

    args.version = version;
    args.set_version = true;

    args.es = true;
    args.set_es = true;

    args.remove_unused = false;

    const spirv_file = new Uint32Array(data);

    if (args.reflect && args.reflect !== "") {
        throw new Error("Reflection not yet supported!");
        return;
    }

    return compile_iteration(args, spirv_file);
}