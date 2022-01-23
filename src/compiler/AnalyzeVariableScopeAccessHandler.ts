import { OpcodeHandler } from "./OpcodeHandler";
import { SPIRFunction } from "../common/SPIRFunction";
import { Compiler } from "./Compiler";
import { SPIRBlock, SPIRBlockTerminator } from "../common/SPIRBlock";
import { maplike_get } from "../utils/maplike_get";
import { SPIRVariable } from "../common/SPIRVariable";
import { Types } from "../common/Types";
import { SPIRExpression } from "../common/SPIRExpression";
import { SPIRTypeBaseType } from "../common/SPIRType";
import { SPIRExtension, SPIRExtensionExtension } from "../common/SPIRExtension";
import { GLSLstd450 } from "./glsl/glsl";
import { Op } from "../spirv/Op";

export class AnalyzeVariableScopeAccessHandler extends OpcodeHandler
{
    compiler: Compiler;
    entry: SPIRFunction;
    accessed_variables_to_block: Set<number>[] = [];        // std::unordered_map<uint32_t, std::unordered_set<uint32_t>>
    accessed_temporaries_to_block: Set<number>[] = [];      // std::unordered_map<uint32_t, std::unordered_set<uint32_t>>
    result_id_to_type: number[] = [];                       // std::unordered_map<uint32_t, uint32_t>;
    complete_write_variables_to_block: Set<number>[] = [];  // std::unordered_map<uint32_t, std::unordered_set<uint32_t>>
    partial_write_variables_to_block: Set<number>[] = [];   // std::unordered_map<uint32_t, std::unordered_set<uint32_t>>
    access_chain_expressions: Set<number> = new Set();      // std::unordered_set<uint32_t>
    // Access chains used in multiple blocks mean hoisting all the variables used to construct the access chain as not all backends can use pointers.
    access_chain_children: Set<number>[] = [];                                  // std::unordered_map<uint32_t, std::unordered_set<uint32_t>>
    current_block: SPIRBlock = null;

    constructor(compiler: Compiler, entry: SPIRFunction)
    {
        super();
        this.compiler = compiler;
        this.entry = entry;
    }

    follow_function_call(_: SPIRFunction): boolean
    {
        return false;
    }

    set_current_block(block: SPIRBlock): void
    {
        const compiler = this.compiler;
        this.current_block = block;

        // If we're branching to a block which uses OpPhi, in GLSL
        // this will be a variable write when we branch,
        // so we need to track access to these variables as well to
        // have a complete picture.
        const test_phi = (to: number) =>
        {
            const next = compiler.get<SPIRBlock>(SPIRBlock, to);
            for (const phi of next.phi_variables) {
                if (phi.parent === block.self) {
                    maplike_get<Set<number>>(Set, this.accessed_variables_to_block, phi.function_variable).add(block.self);
                    maplike_get<Set<number>>(Set, this.accessed_variables_to_block, phi.function_variable).add(next.self);

                    this.notify_variable_access(phi.local_variable, block.self);
                }
            }
        };

        switch (block.terminator) {
            case SPIRBlockTerminator.Direct:
                this.notify_variable_access(block.condition, block.self);
                test_phi(block.next_block);
                break;

            case SPIRBlockTerminator.Select:
                this.notify_variable_access(block.condition, block.self);
                test_phi(block.true_block);
                test_phi(block.false_block);
                break;

            case SPIRBlockTerminator.MultiSelect: {
                this.notify_variable_access(block.condition, block.self);
                const cases = compiler.get_case_list(block);
                for (let target of cases)
                    test_phi(target.block);
                if (block.default_block)
                    test_phi(block.default_block);
                break;
            }

            default:
                break;
        }
    }

    notify_variable_access(id: number, block: number)
    {
        if (id == 0)
            return;

        // Access chains used in multiple blocks mean hoisting all the variables used to construct the access chain as not all backends can use pointers.

        if (this.access_chain_children.hasOwnProperty(id)) {
            const itr_second = this.access_chain_children[id];
            itr_second.forEach(child_id => this.notify_variable_access(child_id, block));
        }

        if (this.id_is_phi_variable(id))
            maplike_get(Set, this.accessed_variables_to_block, id).add(block);
        else if (this.id_is_potential_temporary(id))
            maplike_get(Set, this.accessed_temporaries_to_block, id).add(block);
    }

    id_is_phi_variable(id: number): boolean
    {
        if (id >= this.compiler.get_current_id_bound())
            return false;
        const var_ = this.compiler.maybe_get<SPIRVariable>(SPIRVariable, id);
        return !!var_ && var_.phi_variable;
    }

    id_is_potential_temporary(id: number): boolean
    {
        if (id >= this.compiler.get_current_id_bound())
            return false;

        // Temporaries are not created before we start emitting code.
        return this.compiler.ir.ids[id].empty() || (this.compiler.ir.ids[id].get_type() === Types.TypeExpression);
    }

    handle(op: Op, args: Uint32Array, length: number): boolean
    {
        const compiler = this.compiler;
        // Keep track of the types of temporaries, so we can hoist them out as necessary.
        const result = compiler.instruction_to_result_type(op, args, length);
        if (result)
            this.result_id_to_type[result.result_id] = result.result_type;

        switch (op) {
            case Op.OpStore: {
                if (length < 2)
                    return false;

                const ptr = args[0];
                const var_ = compiler.maybe_get_backing_variable(ptr);

                // If we store through an access chain, we have a partial write.
                if (var_) {
                    maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                    if (var_.self === ptr)
                        maplike_get(Set, this.complete_write_variables_to_block, var_.self).add(this.current_block.self);
                    else
                        maplike_get(Set, this.partial_write_variables_to_block, var_.self).add(this.current_block.self);
                }

                // args[0] might be an access chain we have to track use of.
                this.notify_variable_access(args[0], this.current_block.self);
                // Might try to store a Phi variable here.
                this.notify_variable_access(args[1], this.current_block.self);
                break;
            }

            case Op.OpAccessChain:
            case Op.OpInBoundsAccessChain:
            case Op.OpPtrAccessChain: {
                if (length < 3)
                    return false;

                // Access chains used in multiple blocks mean hoisting all the variables used to construct the access chain as not all backends can use pointers.
                const ptr = args[2];
                const var_ = this.compiler.maybe_get<SPIRVariable>(SPIRVariable, ptr);
                if (var_) {
                    maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                    maplike_get(Set, this.access_chain_children, args[1]).add(var_.self);
                }

                // args[2] might be another access chain we have to track use of.
                for (let i = 2; i < length; i++) {
                    this.notify_variable_access(args[i], this.current_block.self);
                    maplike_get(Set, this.access_chain_children, args[1]).add(args[i]);
                }

                // Also keep track of the access chain pointer itself.
                // In exceptionally rare cases, we can end up with a case where
                // the access chain is generated in the loop body, but is consumed in continue block.
                // This means we need complex loop workarounds, and we must detect this via CFG analysis.
                this.notify_variable_access(args[1], this.current_block.self);

                // The result of an access chain is a fixed expression and is not really considered a temporary.
                const e = compiler.set<SPIRExpression>(SPIRExpression, args[1], "", args[0], true);
                const backing_variable = compiler.maybe_get_backing_variable(ptr);
                e.loaded_from = backing_variable ? <VariableID>(backing_variable.self) : <VariableID>(0);

                // Other backends might use SPIRAccessChain for this later.
                compiler.ir.ids[args[1]].set_allow_type_rewrite();
                this.access_chain_expressions.add(args[1]);
                break;
            }

            case Op.OpCopyMemory: {
                if (length < 2)
                    return false;

                const lhs: ID = args[0];
                const rhs: ID = args[1];
                let var_ = compiler.maybe_get_backing_variable(lhs);

                // If we store through an access chain, we have a partial write.
                if (var_) {
                    maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                    if (var_.self == lhs)
                        maplike_get(Set, this.complete_write_variables_to_block, var_.self).add(this.current_block.self);
                    else
                        maplike_get(Set, this.partial_write_variables_to_block, var_.self).add(this.current_block.self);
                }

                // args[0:1] might be access chains we have to track use of.
                for (let i = 0; i < 2; i++)
                    this.notify_variable_access(args[i], this.current_block.self);

                var_ = compiler.maybe_get_backing_variable(rhs);
                if (var_)
                    maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                break;
            }

            case Op.OpCopyObject: {
                if (length < 3)
                    return false;

                const var_ = compiler.maybe_get_backing_variable(args[2]);
                if (var_)
                    maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);

                // Might be an access chain which we have to keep track of.
                this.notify_variable_access(args[1], this.current_block.self);
                if (this.access_chain_expressions.has(args[2]))
                    this.access_chain_expressions.add(args[1]);

                // Might try to copy a Phi variable here.
                this.notify_variable_access(args[2], this.current_block.self);
                break;
            }

            case Op.OpLoad: {
                if (length < 3)
                    return false;
                const ptr = args[2];
                const var_ = compiler.maybe_get_backing_variable(ptr);
                if (var_)
                    maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);

                // Loaded value is a temporary.
                this.notify_variable_access(args[1], this.current_block.self);

                // Might be an access chain we have to track use of.
                this.notify_variable_access(args[2], this.current_block.self);
                break;
            }

            case Op.OpFunctionCall: {
                if (length < 3)
                    return false;

                // Return value may be a temporary.
                if (compiler.get_type(args[0]).basetype !== SPIRTypeBaseType.Void)
                    this.notify_variable_access(args[1], this.current_block.self);

                length -= 3;
                args = args.slice(3);

                for (let i = 0; i < length; i++) {
                    const var_ = compiler.maybe_get_backing_variable(args[i]);
                    if (var_) {
                        maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                        // Assume we can get partial writes to this variable.
                        maplike_get(Set, this.partial_write_variables_to_block, var_.self).add(this.current_block.self);
                    }

                    // Cannot easily prove if argument we pass to a function is completely written.
                    // Usually, functions write to a dummy variable,
                    // which is then copied to in full to the real argument.

                    // Might try to copy a Phi variable here.
                    this.notify_variable_access(args[i], this.current_block.self);
                }
                break;
            }

            case Op.OpSelect: {
                // In case of variable pointers, we might access a variable here.
                // We cannot prove anything about these accesses however.
                for (let i = 1; i < length; i++) {
                    if (i >= 3) {
                        const var_ = compiler.maybe_get_backing_variable(args[i]);
                        if (var_) {
                            maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                            // Assume we can get partial writes to this variable.
                            maplike_get(Set, this.partial_write_variables_to_block, var_.self).add(this.current_block.self);
                        }
                    }

                    // Might try to copy a Phi variable here.
                    this.notify_variable_access(args[i], this.current_block.self);
                }
                break;
            }

            case Op.OpExtInst: {
                for (let i = 4; i < length; i++)
                    this.notify_variable_access(args[i], this.current_block.self);
                this.notify_variable_access(args[1], this.current_block.self);

                const extension_set = args[2];
                if (compiler.get<SPIRExtension>(SPIRExtension, extension_set).ext === SPIRExtensionExtension.GLSL) {
                    const op_450 = <GLSLstd450>(args[3]);
                    switch (op_450) {
                        case GLSLstd450.GLSLstd450Modf:
                        case GLSLstd450.GLSLstd450Frexp: {
                            const ptr = args[5];
                            const var_ = compiler.maybe_get_backing_variable(ptr);
                            if (var_) {
                                maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                                if (var_.self == ptr)
                                    maplike_get(Set, this.complete_write_variables_to_block, var_.self).add(this.current_block.self);
                                else
                                    maplike_get(Set, this.partial_write_variables_to_block, var_.self).add(this.current_block.self);
                            }
                            break;
                        }

                        default:
                            break;
                    }
                }
                break;
            }

            case Op.OpArrayLength:
                // Only result is a temporary.
                this.notify_variable_access(args[1], this.current_block.self);
                break;

            case Op.OpLine:
            case Op.OpNoLine:
                // Uses literals, but cannot be a phi variable or temporary, so ignore.
                break;

            // Atomics shouldn't be able to access function-local variables.
            // Some GLSL builtins access a pointer.

            case Op.OpCompositeInsert:
            case Op.OpVectorShuffle:
                // Specialize for opcode which contains literals.
                for (let i = 1; i < 4; i++)
                    this.notify_variable_access(args[i], this.current_block.self);
                break;

            case Op.OpCompositeExtract:
                // Specialize for opcode which contains literals.
                for (let i = 1; i < 3; i++)
                    this.notify_variable_access(args[i], this.current_block.self);
                break;

            case Op.OpImageWrite:
                for (let i = 0; i < length; i++) {
                    // Argument 3 is a literal.
                    if (i != 3)
                        this.notify_variable_access(args[i], this.current_block.self);
                }
                break;

            case Op.OpImageSampleImplicitLod:
            case Op.OpImageSampleExplicitLod:
            case Op.OpImageSparseSampleImplicitLod:
            case Op.OpImageSparseSampleExplicitLod:
            case Op.OpImageSampleProjImplicitLod:
            case Op.OpImageSampleProjExplicitLod:
            case Op.OpImageSparseSampleProjImplicitLod:
            case Op.OpImageSparseSampleProjExplicitLod:
            case Op.OpImageFetch:
            case Op.OpImageSparseFetch:
            case Op.OpImageRead:
            case Op.OpImageSparseRead:
                for (let i = 1; i < length; i++) {
                    // Argument 4 is a literal.
                    if (i != 4)
                        this.notify_variable_access(args[i], this.current_block.self);
                }
                break;

            case Op.OpImageSampleDrefImplicitLod:
            case Op.OpImageSampleDrefExplicitLod:
            case Op.OpImageSparseSampleDrefImplicitLod:
            case Op.OpImageSparseSampleDrefExplicitLod:
            case Op.OpImageSampleProjDrefImplicitLod:
            case Op.OpImageSampleProjDrefExplicitLod:
            case Op.OpImageSparseSampleProjDrefImplicitLod:
            case Op.OpImageSparseSampleProjDrefExplicitLod:
            case Op.OpImageGather:
            case Op.OpImageSparseGather:
            case Op.OpImageDrefGather:
            case Op.OpImageSparseDrefGather:
                for (let i = 1; i < length; i++) {
                    // Argument 5 is a literal.
                    if (i != 5)
                        this.notify_variable_access(args[i], this.current_block.self);
                }
                break;

            default: {
                // Rather dirty way of figuring out where Phi variables are used.
                // As long as only IDs are used, we can scan through instructions and try to find any evidence that
                // the ID of a variable has been used.
                // There are potential false positives here where a literal is used in-place of an ID,
                // but worst case, it does not affect the correctness of the compile.
                // Exhaustive analysis would be better here, but it's not worth it for now.
                for (let i = 0; i < length; i++)
                    this.notify_variable_access(args[i], this.current_block.self);
                break;
            }
        }
        return true;
    }

    handle_terminator(block: SPIRBlock): boolean
    {
        switch (block.terminator) {
            case SPIRBlockTerminator.Return:
                if (block.return_value)
                    this.notify_variable_access(block.return_value, block.self);
                break;

            case SPIRBlockTerminator.Select:
            case SPIRBlockTerminator.MultiSelect:
                this.notify_variable_access(block.condition, block.self);
                break;

            default:
                break;
        }

        return true;
    }
}