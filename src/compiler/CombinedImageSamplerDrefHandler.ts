import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv/Op";

export class CombinedImageSamplerDrefHandler extends OpcodeHandler
{
    compiler: Compiler;
    dref_combined_samplers: Set<number> = new Set<number>();

    constructor(compiler: Compiler)
    {
        super();
        this.compiler = compiler;
    }

    handle(opcode: Op, args: Uint32Array, length: number): boolean
    {
        // Mark all sampled images which are used with Dref.
        switch (opcode)
        {
            case Op.ImageSampleDrefExplicitLod:
            case Op.ImageSampleDrefImplicitLod:
            case Op.ImageSampleProjDrefExplicitLod:
            case Op.ImageSampleProjDrefImplicitLod:
            case Op.ImageSparseSampleProjDrefImplicitLod:
            case Op.ImageSparseSampleDrefImplicitLod:
            case Op.ImageSparseSampleProjDrefExplicitLod:
            case Op.ImageSparseSampleDrefExplicitLod:
            case Op.ImageDrefGather:
            case Op.ImageSparseDrefGather:
                this.dref_combined_samplers.add(args[2]);
                return true;

            default:
                break;
        }

        return true;
    }

}