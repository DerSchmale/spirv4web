import { IVariant } from "./IVariant";
import { Types } from "./Types";
export declare enum SPIRExtensionExtension {
    Unsupported = 0,
    GLSL = 1,
    SPV_debug_info = 2,
    SPV_AMD_shader_ballot = 3,
    SPV_AMD_shader_explicit_vertex_parameter = 4,
    SPV_AMD_shader_trinary_minmax = 5,
    SPV_AMD_gcn_shader = 6
}
export declare class SPIRExtension extends IVariant {
    static type: Types;
    ext: SPIRExtensionExtension;
    constructor(ext: SPIRExtensionExtension);
    constructor(other: SPIRExtension);
}
