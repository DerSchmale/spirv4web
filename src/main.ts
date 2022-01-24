import { Args } from "./Args";
import { compile_iteration } from "./compileIteration";

// TODO:
//  - assertion fails in bitcast_glsl_op in frag shaders
//  - compare more against baseline compiles
//  - Everywhere we're using slice(), remove this and pass in an offset param

export enum Version
{
    WebGL1 = 100,
    WebGL2 = 300
}

export type Options =
{
    removeUnused?: boolean;
    specializationConstantPrefix?: string;
}

export function compile(data: ArrayBuffer, version: Version, options?: Options): string
{
    const args: Args = new Args();

    options = options || {};
    options.removeUnused = getOrDefault(options.removeUnused, false);
    options.specializationConstantPrefix = getOrDefault(options.specializationConstantPrefix, "SPIRV_CROSS_CONSTANT_ID_");


    args.version = version;
    args.set_version = true;

    args.es = true;
    args.set_es = true;

    args.remove_unused = options.removeUnused;

    const spirv_file = new Uint32Array(data);

    if (args.reflect && args.reflect !== "") {
        throw new Error("Reflection not yet supported!");
        return;
    }

    return compile_iteration(args, spirv_file, options);
}

function getOrDefault<T>(value: T, def: T): T
{
    return value === undefined || value === null? def : value;
}