import { Args } from "./Args";
import { compile_iteration } from "./compileIteration";
import { Dict } from "./utils/Dict";

// TODO:
//  - Allow passing in defines that will get injected after the version tag
//  - Allow passing in a map constant index => macro name?
//  - pass in supported extensions and let the compiler handle fallbacks

// TODO optimization:
//  - go through options and remove useless ones --> see compile() for stuff that's always set
//  - go through enums and remove useless ones (perhaps keep some for error checking?)
//  - remove unused functions

/**
 * The target driver version to use.
 */
export enum Version
{
    WebGL1 = 100,
    WebGL2 = 300
}

/**
 * The available options.
 */
export type Options =
{
    /**
     * Removes unused variables. Defaults to true.
     */
    removeUnused?: boolean;

    /**
     * Specialization constants will be converted to `#define` macros. This allows setting a custom prefix for the
     * macro names (defaults to `SPIRV_CROSS_CONSTANT_ID_`).
     */
    specializationConstantPrefix?: string;

    /**
     * This keeps unnamed uniform blocks. If `false`, UBOs will have a temporary name assigned to them.
     * If `true`, in WebGL 1, this will turn the members of unnamed uniform buffers into global uniforms. Defaults to
     * `true`.
     */
    keepUnnamedUBOs?: boolean;

    /**
     * If keepUnnamedUBOs === true and UBOs are not supported, this map is used to store the removed
     * ubos and their members names. This can be used to implement UBO fallbacks on the shader.
     */
    unnamedUBOInfo?: Dict<string[]>;

    /**
     * (WebGL2 only) Strips layout information from vertex attributes. This is useful when you've defined more
     * attributes than supported (Depending on `gl.MAX_VERTEX_ATTRIBS`) but not all of them are used. You'll then need
     * to query the attribute locations by name. Defaults to `false`.
     */
    removeAttributeLayouts?: boolean;   // for webgl 2 only, removes attribute layouts. This can be needed when
                                        // there are too many unused attributes when spirv autogenerates the layouts

    /**
     * Tries to use preprocessor macros as much as possible to handle specialization constants.
     */
    preprocess_spec_const?: boolean;
}

/**
 * Compiles Spir-V bytecode to GLSL.
 * @param data An ArrayBuffer containing valid Spir-V bytecode.
 * @param version Either `Version.WebGL1` or `Version.WebGL2`.
 * @param options An optional object containing optional fields defined in Options.
 */
export function compile(data: ArrayBuffer, version: Version, options?: Options): string
{
    const args: Args = new Args();

    options = options || {};
    options.unnamedUBOInfo = getOrDefault(options.unnamedUBOInfo, { });

    args.version = version;
    args.set_version = true;

    args.remove_unused = getOrDefault(options.removeUnused, true);
    args.glsl_keep_unnamed_ubos = getOrDefault(options.keepUnnamedUBOs, true);
    args.glsl_remove_attribute_layouts = getOrDefault(options.removeAttributeLayouts, false);
    args.specialization_constant_prefix = getOrDefault(options.specializationConstantPrefix, "SPIRV_CROSS_CONSTANT_ID_");
    args.flatten_multidimensional_arrays = true;
    args.preprocess_spec_const = getOrDefault(options.preprocess_spec_const, true);

    const spirv_file = new Uint32Array(data);

    if (args.reflect && args.reflect !== "") {
        throw new Error("Reflection not yet supported!");
    }

    return compile_iteration(args, spirv_file, options.unnamedUBOInfo);
}

function getOrDefault<T>(value: T, def: T): T
{
    return value === undefined || value === null? def : value;
}
