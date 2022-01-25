import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultCopy } from "../utils/defaultCopy";

export enum SPIRExtensionExtension {
    Unsupported,
    GLSL,
    SPV_debug_info,
    SPV_AMD_shader_ballot,
    SPV_AMD_shader_explicit_vertex_parameter,
    SPV_AMD_shader_trinary_minmax,
    SPV_AMD_gcn_shader
}

export class SPIRExtension extends IVariant
{
    static type = Types.Extension;

    ext: SPIRExtensionExtension;

    constructor(ext: SPIRExtensionExtension);
    constructor(other: SPIRExtension);
    constructor(param0: SPIRExtensionExtension | SPIRExtension)
    {
        super();

        if (param0 instanceof SPIRExtension)
            defaultCopy(param0, this);
        else
            this.ext = param0;
    }
}