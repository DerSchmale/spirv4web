import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { SPIRVariable } from "../common/SPIRVariable";
import { SPIRExtension, SPIRExtensionExtension } from "../common/SPIRExtension";
import { GLSLstd450 } from "./glsl/glsl";
import { Op } from "../spirv/Op";
import { StorageClass } from "../spirv/StorageClass";

export class InterfaceVariableAccessHandler extends OpcodeHandler
{
    compiler: Compiler;
    variables: Set<VariableID>;

    constructor(compiler: Compiler, variables: Set<VariableID>)
    {
        super();
        this.compiler = compiler;
        this.variables = variables;
    }

    handle(opcode: Op, args: Uint32Array, length: number): boolean
    {
        const compiler = this.compiler;
        const variables = this.variables;
        let variable = 0;
        let offset = 0;
        switch (opcode)
        {
            // Need this first, otherwise, GCC complains about unhandled switch statements.
            default:
                break;

            case Op.FunctionCall:
            {
                // Invalid SPIR-V.
                if (length < 3)
                    return false;

                const count = length - 3;
                offset += 3;
                for (let i = 0; i < count; i++)
                {
                    const var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, args[offset + i]);
                    if (var_ && storage_class_is_interface(var_.storage))
                    variables.add(args[offset + i]);
                }
                break;
            }

            case Op.Select:
            {
                // Invalid SPIR-V.
                if (length < 5)
                    return false;

                const count = length - 3;
                offset += 3;
                for (let i = 0; i < count; i++)
                {
                    const var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, args[offset + i]);
                    if (var_ && storage_class_is_interface(var_.storage))
                    variables.add(args[offset + i]);
                }
                break;
            }

            case Op.Phi:
            {
                // Invalid SPIR-V.
                if (length < 2)
                    return false;

                const count = length - 2;
                offset += 2;
                for (let i = 0; i < count; i += 2)
                {
                    const var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, args[offset + i]);
                    if (var_ && storage_class_is_interface(var_.storage))
                    variables.add(args[offset + i]);
                }
                break;
            }

            case Op.AtomicStore:
            case Op.Store:
                // Invalid SPIR-V.
                if (length < 1)
                    return false;
                variable = args[offset];
                break;

            case Op.CopyMemory:
            {
                if (length < 2)
                    return false;

                let var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, args[offset]);
                if (var_ && storage_class_is_interface(var_.storage))
                variables.add(args[offset]);

                var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, args[offset + 1]);
                if (var_ && storage_class_is_interface(var_.storage))
                variables.add(args[offset + 1]);
                break;
            }

            case Op.ExtInst:
            {
                if (length < 5)
                    return false;
                const extension_set = compiler.get<SPIRExtension>(SPIRExtension, args[offset + 2]);
                switch (extension_set.ext)
                {
                    case SPIRExtensionExtension.GLSL:
                    {
                        const op = <GLSLstd450>(args[offset + 3]);

                        switch (op)
                        {
                            case GLSLstd450.InterpolateAtCentroid:
                            case GLSLstd450.InterpolateAtSample:
                            case GLSLstd450.InterpolateAtOffset:
                            {
                                const var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, args[offset + 4]);
                                if (var_ && storage_class_is_interface(var_.storage))
                                variables.add(args[offset + 4]);
                                break;
                            }

                            case GLSLstd450.Modf:
                            case GLSLstd450.Fract:
                            {
                                const var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, args[offset + 4]);
                                if (var_ && storage_class_is_interface(var_.storage))
                                variables.add(args[offset + 4]);
                                break;
                            }

                            default:
                                break;
                        }
                        break;
                    }
                    case SPIRExtensionExtension.SPV_AMD_shader_explicit_vertex_parameter:
                    {
                        const InterpolateAtVertexAMD = 1

                        const op = args[offset + 3];

                        switch (op)
                        {
                            case InterpolateAtVertexAMD:
                            {
                                const var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, args[offset + 4]);
                                if (var_ && storage_class_is_interface(var_.storage))
                                variables.add(args[offset + 4]);
                                break;
                            }

                            default:
                                break;
                        }
                        break;
                    }
                    default:
                        break;
                }
                break;
            }

            case Op.AccessChain:
            case Op.InBoundsAccessChain:
            case Op.PtrAccessChain:
            case Op.Load:
            case Op.CopyObject:
            case Op.ImageTexelPointer:
            case Op.AtomicLoad:
            case Op.AtomicExchange:
            case Op.AtomicCompareExchange:
            case Op.AtomicCompareExchangeWeak:
            case Op.AtomicIIncrement:
            case Op.AtomicIDecrement:
            case Op.AtomicIAdd:
            case Op.AtomicISub:
            case Op.AtomicSMin:
            case Op.AtomicUMin:
            case Op.AtomicSMax:
            case Op.AtomicUMax:
            case Op.AtomicAnd:
            case Op.AtomicOr:
            case Op.AtomicXor:
            case Op.ArrayLength:
                // Invalid SPIR-V.
                if (length < 3)
                    return false;
                variable = args[offset + 2];
                break;
        }

        if (variable)
        {
            const var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, variable);
            if (var_ && storage_class_is_interface(var_.storage))
            variables.add(variable);
        }
        return true;
    }
}

function storage_class_is_interface(storage: StorageClass): boolean
{
    switch (storage)
    {
        case StorageClass.Input:
        case StorageClass.Output:
        case StorageClass.Uniform:
        case StorageClass.UniformConstant:
        case StorageClass.AtomicCounter:
        case StorageClass.PushConstant:
        case StorageClass.StorageBuffer:
            return true;

        default:
            return false;
    }
}