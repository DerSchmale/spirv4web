/**
 * The target driver version to use.
 */
export declare enum Version {
    WebGL1 = 100,
    WebGL2 = 300
}
/**
 * The available options.
 */
export declare type Options = {
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
     * (WebGL2 only) Strips layout information from vertex attributes. This is useful when you've defined more
     * attributes than supported (Depending on `gl.MAX_VERTEX_ATTRIBS`) but not all of them are used. You'll then need
     * to query the attribute locations by name. Defaults to `false`.
     */
    removeAttributeLayouts?: boolean;
};
/**
 * Compiles Spir-V bytecode to GLSL.
 * @param data An ArrayBuffer containing valid Spir-V bytecode.
 * @param version Either `Version.WebGL1` or `Version.WebGL2`.
 * @param options An optional object containing optional fields defined in Options.
 */
export declare function compile(data: ArrayBuffer, version: Version, options?: Options): string;
