import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { SPIRExpression } from "../common/SPIRExpression";
import { SPIRType } from "../common/SPIRType";
import { Op } from "../spirv/Op";
import { StorageClass } from "../spirv/StorageClass";
import { Decoration } from "../spirv/Decoration";

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
            if (opcode === Op.BeginInvocationInterlockEXT) {
                this.in_crit_sec = true;
                return true;
            }

            if (opcode === Op.EndInvocationInterlockEXT) {
                // End critical section--nothing more to do.
                return false;
            }
        }

        const compiler = this.compiler;

        // We need to figure out where images and buffers are loaded from, so do only the bare bones compilation we need.
        switch (opcode) {
            case Op.Load: {
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

                    case StorageClass.UniformConstant: {
                        const result_type = args[0];
                        const id = args[1];
                        compiler.set<SPIRExpression>(SPIRExpression, id, "", result_type, true);
                        compiler.register_read(id, ptr, true);
                        break;
                    }

                    case StorageClass.Uniform:
                        // Must have BufferBlock; we only care about SSBOs.
                        if (!compiler.has_decoration(compiler.get<SPIRType>(SPIRType, var_.basetype).self, Decoration.BufferBlock))
                            break;
                    // fallthrough
                    case StorageClass.StorageBuffer:
                        this.access_potential_resource(var_.self);
                        break;
                }
                break;
            }

            case Op.InBoundsAccessChain:
            case Op.AccessChain:
            case Op.PtrAccessChain: {
                if (length < 3)
                    return false;

                const result_type = args[0];

                const type = compiler.get<SPIRType>(SPIRType, result_type);
                if (type.storage === StorageClass.Uniform || type.storage === StorageClass.UniformConstant ||
                    type.storage === StorageClass.StorageBuffer) {
                    const id = args[1];
                    const ptr = args[2];
                    compiler.set<SPIRExpression>(SPIRExpression, id, "", result_type, true);
                    compiler.register_read(id, ptr, true);
                    compiler.ir.ids[id].set_allow_type_rewrite();
                }
                break;
            }

            case Op.ImageTexelPointer: {
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

            case Op.Store:
            case Op.ImageWrite:
            case Op.AtomicStore: {
                if (length < 1)
                    return false;

                const ptr = args[0];
                const var_ = compiler.maybe_get_backing_variable(ptr);
                if (var_ && (var_.storage === StorageClass.Uniform || var_.storage === StorageClass.UniformConstant ||
                    var_.storage === StorageClass.StorageBuffer)) {
                    this.access_potential_resource(var_.self);
                }

                break;
            }

            case Op.CopyMemory: {
                if (length < 2)
                    return false;

                const dst = args[0];
                const src = args[1];
                const dst_var = compiler.maybe_get_backing_variable(dst);
                const src_var = compiler.maybe_get_backing_variable(src);

                if (dst_var && (dst_var.storage === StorageClass.Uniform || dst_var.storage === StorageClass.StorageBuffer))
                    this.access_potential_resource(dst_var.self);

                if (src_var) {
                    if (src_var.storage !== StorageClass.Uniform && src_var.storage !== StorageClass.StorageBuffer)
                        break;

                    if (src_var.storage === StorageClass.Uniform &&
                        !compiler.has_decoration(compiler.get<SPIRType>(SPIRType, src_var.basetype).self, Decoration.BufferBlock)) {
                        break;
                    }

                    this.access_potential_resource(src_var.self);
                }

                break;
            }

            case Op.ImageRead:
            case Op.AtomicLoad: {
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

                    case StorageClass.Uniform:
                        // Must have BufferBlock; we only care about SSBOs.
                        if (!compiler.has_decoration(compiler.get<SPIRType>(SPIRType, var_.basetype).self, Decoration.BufferBlock))
                            break;
                    // fallthrough
                    case StorageClass.UniformConstant:
                    case StorageClass.StorageBuffer:
                        this.access_potential_resource(var_.self);
                        break;
                }
                break;
            }

            case Op.AtomicExchange:
            case Op.AtomicCompareExchange:
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
            case Op.AtomicXor: {
                if (length < 3)
                    return false;

                const ptr = args[2];
                const var_ = compiler.maybe_get_backing_variable(ptr);
                if (var_ && (var_.storage === StorageClass.Uniform || var_.storage === StorageClass.UniformConstant ||
                    var_.storage === StorageClass.StorageBuffer)) {
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