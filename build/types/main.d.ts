export declare enum Version {
    WebGL1 = 100,
    WebGL2 = 300
}
export declare type Options = {
    removeUnused?: boolean;
    specializationConstantPrefix?: string;
    keepUnnamedUBOs?: boolean;
    removeAttributeLayouts?: boolean;
};
export declare function compile(data: ArrayBuffer, version: Version, options?: Options): string;
