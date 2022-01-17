import { Compiler } from "./Compiler";
import { Dim, Op } from "../spirv";
import { OpcodeHandler } from "./OpcodeHandler";
import { SPIRType, SPIRTypeBaseType } from "../common/SPIRType";
import { SPIRExpression } from "../common/SPIRExpression";

export class DummySamplerForCombinedImageHandler extends OpcodeHandler
{
    compiler: Compiler;
    need_dummy_sampler: boolean = false;

    constructor(compiler: Compiler)
    {
        super();
        this.compiler = compiler;
    }

    handle(opcode: Op, args: Uint32Array, length: number): boolean
    {
        if (this.need_dummy_sampler)
        {
            // No need to traverse further, we know the result.
            return false;
        }

        const compiler = this.compiler;

        switch (opcode)
        {
            case Op.OpLoad:
            {
                if (length < 3)
                    return false;

                const result_type = args[0];

                const type = compiler.get<SPIRType>(SPIRType, result_type);
                const separate_image = type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1 && type.image.dim !== Dim.DimBuffer;

                // If not separate image, don't bother.
                if (!separate_image)
                    return true;

                const id = args[1];
                const ptr = args[2];
                compiler.set<SPIRExpression>(SPIRExpression, id, "", result_type, true);
                compiler.register_read(id, ptr, true);
                break;
            }

            case Op.OpImageFetch:
            case Op.OpImageQuerySizeLod:
            case Op.OpImageQuerySize:
            case Op.OpImageQueryLevels:
            case Op.OpImageQuerySamples:
            {
                // If we are fetching or querying LOD from a plain OpTypeImage, we must pre-combine with our dummy sampler.
                const var_ = compiler.maybe_get_backing_variable(args[2]);
                if (var_)
                {
                    const type = compiler.get<SPIRType>(SPIRType, var_.basetype);
                    if (type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1 && type.image.dim !== Dim.DimBuffer)
                        this.need_dummy_sampler = true;
                }

                break;
            }

            case Op.OpInBoundsAccessChain:
            case Op.OpAccessChain:
            case Op.OpPtrAccessChain:
            {
                if (length < 3)
                    return false;

                const result_type = args[0];
                const type = compiler.get<SPIRType>(SPIRType, result_type);
                const separate_image = type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1 && type.image.dim !== Dim.DimBuffer;
                if (!separate_image)
                    return true;

                const id = args[1];
                const ptr = args[2];
                compiler.set<SPIRExpression>(SPIRExpression, id, "", result_type, true);
                compiler.register_read(id, ptr, true);

                // Other backends might use SPIRAccessChain for this later.
                compiler.ir.ids[id].set_allow_type_rewrite();
                break;
            }

            default:
                break;
        }

        return true;
    }
}
