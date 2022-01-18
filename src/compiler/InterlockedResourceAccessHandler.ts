import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Decoration, Op, StorageClass } from "../spirv";
import { SPIRExpression } from "../common/SPIRExpression";
import { SPIRType } from "../common/SPIRType";

export class InterlockedResourceAccessHandler extends OpcodeHandler
{
    compiler: Compiler;
    in_crit_sec: boolean = false;

    interlock_function_id: number = 0;
    split_function_case: boolean = false;
    control_flow_interlock: boolean = false;
    use_critical_section: boolean = false;
    call_stack_is_interlocked: boolean = false;
    call_stack: number[] = [];

    constructor(compiler: Compiler, entry_point_id: number)
    {
        super();
        this.compiler = compiler;
        this.call_stack.push(entry_point_id);
    }

    handle(opcode: Op, args: Uint32Array, length: number): boolean
    {
        // Only care about critical section analysis if we have simple case.
        if (this.use_critical_section) {
            if (opcode === Op.OpBeginInvocationInterlockEXT) {
                this.in_crit_sec = true;
                return true;
            }

            if (opcode === Op.OpEndInvocationInterlockEXT) {
                // End critical section--nothing more to do.
                return false;
            }
        }

        const compiler = this.compiler;

        // We need to figure out where images and buffers are loaded from, so do only the bare bones compilation we need.
        switch (opcode) {
            case Op.OpLoad: {
                if (length < 3)
                    return false;

                const ptr = args[2];
                const var_ = this.compiler.maybe_get_backing_variable(ptr);

                // We're only concerned with buffer and image memory here.
                if (!var_)
                    break;

                switch (var_.storage) {
                    default:
                        break;

                    case StorageClass.StorageClassUniformConstant: {
                        const result_type = args[0];
                        const id = args[1];
                        compiler.set<SPIRExpression>(SPIRExpression, id, "", result_type, true);
                        compiler.register_read(id, ptr, true);
                        break;
                    }

                    case StorageClass.StorageClassUniform:
                        // Must have BufferBlock; we only care about SSBOs.
                        if (!compiler.has_decoration(compiler.get<SPIRType>(SPIRType, var_.basetype).self, Decoration.DecorationBufferBlock))
                            break;
                    // fallthrough
                    case StorageClass.StorageClassStorageBuffer:
                        this.access_potential_resource(var_.self);
                        break;
                }
                break;
            }

            case Op.OpInBoundsAccessChain:
            case Op.OpAccessChain:
            case Op.OpPtrAccessChain: {
                if (length < 3)
                    return false;

                const result_type = args[0];

                const type = compiler.get<SPIRType>(SPIRType, result_type);
                if (type.storage == StorageClass.StorageClassUniform || type.storage == StorageClass.StorageClassUniformConstant ||
                    type.storage == StorageClass.StorageClassStorageBuffer) {
                    const id = args[1];
                    const ptr = args[2];
                    compiler.set<SPIRExpression>(SPIRExpression, id, "", result_type, true);
                    compiler.register_read(id, ptr, true);
                    compiler.ir.ids[id].set_allow_type_rewrite();
                }
                break;
            }

            case Op.OpImageTexelPointer: {
                if (length < 3)
                    return false;

                const result_type = args[0];
                const id = args[1];
                const ptr = args[2];
                const e = compiler.set<SPIRExpression>(SPIRExpression, id, "", result_type, true);
                const var_ = compiler.maybe_get_backing_variable(ptr);
                if (var_)
                    e.loaded_from = var_.self;
                break;
            }

            case Op.OpStore:
            case Op.OpImageWrite:
            case Op.OpAtomicStore: {
                if (length < 1)
                    return false;

                const ptr = args[0];
                const var_ = compiler.maybe_get_backing_variable(ptr);
                if (var_ && (var_.storage === StorageClass.StorageClassUniform || var_.storage === StorageClass.StorageClassUniformConstant ||
                    var_.storage === StorageClass.StorageClassStorageBuffer)) {
                    this.access_potential_resource(var_.self);
                }

                break;
            }

            case Op.OpCopyMemory: {
                if (length < 2)
                    return false;

                const dst = args[0];
                const src = args[1];
                const dst_var = compiler.maybe_get_backing_variable(dst);
                const src_var = compiler.maybe_get_backing_variable(src);

                if (dst_var && (dst_var.storage === StorageClass.StorageClassUniform || dst_var.storage === StorageClass.StorageClassStorageBuffer))
                    this.access_potential_resource(dst_var.self);

                if (src_var) {
                    if (src_var.storage != StorageClass.StorageClassUniform && src_var.storage != StorageClass.StorageClassStorageBuffer)
                        break;

                    if (src_var.storage == StorageClass.StorageClassUniform &&
                        !compiler.has_decoration(compiler.get<SPIRType>(SPIRType, src_var.basetype).self, Decoration.DecorationBufferBlock)) {
                        break;
                    }

                    this.access_potential_resource(src_var.self);
                }

                break;
            }

            case Op.OpImageRead:
            case Op.OpAtomicLoad: {
                if (length < 3)
                    return false;

                const ptr = args[2];
                const var_ = compiler.maybe_get_backing_variable(ptr);

                // We're only concerned with buffer and image memory here.
                if (!var_)
                    break;

                switch (var_.storage) {
                    default:
                        break;

                    case StorageClass.StorageClassUniform:
                        // Must have BufferBlock; we only care about SSBOs.
                        if (!compiler.has_decoration(compiler.get<SPIRType>(SPIRType, var_.basetype).self, Decoration.DecorationBufferBlock))
                            break;
                    // fallthrough
                    case StorageClass.StorageClassUniformConstant:
                    case StorageClass.StorageClassStorageBuffer:
                        this.access_potential_resource(var_.self);
                        break;
                }
                break;
            }

            case Op.OpAtomicExchange:
            case Op.OpAtomicCompareExchange:
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
            case Op.OpAtomicXor: {
                if (length < 3)
                    return false;

                const ptr = args[2];
                const var_ = compiler.maybe_get_backing_variable(ptr);
                if (var_ && (var_.storage == StorageClass.StorageClassUniform || var_.storage == StorageClass.StorageClassUniformConstant ||
                    var_.storage == StorageClass.StorageClassStorageBuffer)) {
                    this.access_potential_resource(var_.self);
                }

                break;
            }

            default:
                break;
        }

        return true;
    }

    begin_function_scope(args: Uint32Array, length: number): boolean
    {
        if (length < 3)
            return false;

        if (args[2] === this.interlock_function_id)
            this.call_stack_is_interlocked = true;

        this.call_stack.push(args[2]);
        return true;
    }

    end_function_scope(args: Uint32Array, length: number): boolean
    {
        if (this.call_stack[this.call_stack.length - 1] === this.interlock_function_id)
            this.call_stack_is_interlocked = false;

        this.call_stack.pop();
        return true;
    }

    access_potential_resource(id: number)
    {
        if ((this.use_critical_section && this.in_crit_sec) || (this.control_flow_interlock && this.call_stack_is_interlocked) ||
            this.split_function_case) {
            this.compiler.interlocked_resources.add(id);
        }
    }
}