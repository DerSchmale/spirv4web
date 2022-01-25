import { Args } from "./Args";
import { compile_iteration } from "./compileIteration";

// TODO:
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
    keepUnnamedUBOs?: boolean;          // in webgl 1: unnamed ubo members become global uniforms, in webgl 2:
                                        // unnamed ubos remain unnamed
    removeAttributeLayouts?: boolean;   // for webgl 2 only, removes attribute layouts. This can be needed when
                                        // there are too many unused attributes when spirv autogenerates the layouts
}

export function compile(data: ArrayBuffer, version: Version, options?: Options): string
{
    const args: Args = new Args();

    options = options || {};

    args.version = version;
    args.set_version = true;

    args.es = true;
    args.set_es = true;

    args.remove_unused = getOrDefault(options.removeUnused, true);
    args.glsl_keep_unnamed_ubos = getOrDefault(options.keepUnnamedUBOs, true);
    args.glsl_remove_attribute_layouts = getOrDefault(options.removeAttributeLayouts, false);
    args.specialization_constant_prefix = getOrDefault(options.specializationConstantPrefix, "SPIRV_CROSS_CONSTANT_ID_")

    const spirv_file = new Uint32Array(data);

    if (args.reflect && args.reflect !== "") {
        throw new Error("Reflection not yet supported!");
    }

    return compile_iteration(args, spirv_file);
}

function getOrDefault<T>(value: T, def: T): T
{
    return value === undefined || value === null? def : value;
}