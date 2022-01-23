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

            case Op.OpFunctionCall:
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

            case Op.OpSelect:
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

            case Op.OpPhi:
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

            case Op.OpAtomicStore:
            case Op.OpStore:
                // Invalid SPIR-V.
                if (length < 1)
                    return false;
                variable = args[offset];
                break;

            case Op.OpCopyMemory:
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

            case Op.OpExtInst:
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
                            case GLSLstd450.GLSLstd450InterpolateAtCentroid:
                            case GLSLstd450.GLSLstd450InterpolateAtSample:
                            case GLSLstd450.GLSLstd450InterpolateAtOffset:
                            {
                                const var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, args[offset + 4]);
                                if (var_ && storage_class_is_interface(var_.storage))
                                variables.add(args[offset + 4]);
                                break;
                            }

                            case GLSLstd450.GLSLstd450Modf:
                            case GLSLstd450.GLSLstd450Fract:
                            {
                                const var_ = compiler.maybe_get<SPIRVariable>(SPIRVariable, args[offset + 5]);
                                if (var_ && storage_class_is_interface(var_.storage))
                                variables.add(args[offset + 5]);
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

            case Op.OpAccessChain:
            case Op.OpInBoundsAccessChain:
            case Op.OpPtrAccessChain:
            case Op.OpLoad:
            case Op.OpCopyObject:
            case Op.OpImageTexelPointer:
            case Op.OpAtomicLoad:
            case Op.OpAtomicExchange:
            case Op.OpAtomicCompareExchange:
            case Op.OpAtomicCompareExchangeWeak:
            case Op.OpAtomicIIncrement:
            case Op.OpAtomicIDecrement:
            case Op.OpAtomicIAdd:
            case Op.OpAtomicISub:
            case Op.OpAtomicSMin:
            case Op.OpAtomicUMin:
            case Op.OpAtomicSMax:
            case Op.OpAtomicUMax:
            case Op.OpAtomicAnd:
            case Op.OpAtomicOr:
            case Op.OpAtomicXor:
            case Op.OpArrayLength:
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
        case StorageClass.StorageClassInput:
        case StorageClass.StorageClassOutput:
        case StorageClass.StorageClassUniform:
        case StorageClass.StorageClassUniformConstant:
        case StorageClass.StorageClassAtomicCounter:
        case StorageClass.StorageClassPushConstant:
        case StorageClass.StorageClassStorageBuffer:
            return true;

        default:
            return false;
    }
}