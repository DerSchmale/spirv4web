export declare enum Version {
    WebGL1 = 100,
    WebGL2 = 300
}
export declare type Options = {
    removeUnused?: boolean;
    specializationConstantPrefix?: string;
    unnamed_ubo_to_global_uniforms?: boolean;
};
export declare function compile(data: ArrayBuffer, version: Version, options?: Options): string;
