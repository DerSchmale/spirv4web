import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv";
import { maplike_get } from "../utils/maplike_get";
import { SPIRFunction } from "../common/SPIRFunction";

export class CombinedImageSamplerUsageHandler extends OpcodeHandler
{
    compiler: Compiler;
    dref_combined_samplers: Set<number> = new Set();

    dependency_hierarchy: Set<number>[] = []; // map<uint32_t, set<uint32_t>>
    comparison_ids: Set<number> = new Set();

    need_subpass_input: boolean = false;
    constructor(compiler: Compiler, dref_combined_samplers: Set<number>)
    {
        super();
        this.compiler = compiler;
        this.dref_combined_samplers = dref_combined_samplers;
    }

    begin_function_scope(args: Uint32Array, length: number): boolean
    {
        if (length < 3)
            return false;

        const func = this.compiler.get<SPIRFunction>(SPIRFunction, args[2]);
        const offset = 3;
        length -= 3;

        for (let i = 0; i < length; i++)
        {
            const argument = func.arguments[i];
            this.add_dependency(argument.id, args[offset + i]);
        }

        return true;
    }

    handle(opcode: Op, args: Uint32Array, length: number): boolean
    {
        // Mark all sampled images which are used with Dref.
        switch (opcode)
        {
            case Op.OpImageSampleDrefExplicitLod:
            case Op.OpImageSampleDrefImplicitLod:
            case Op.OpImageSampleProjDrefExplicitLod:
            case Op.OpImageSampleProjDrefImplicitLod:
            case Op.OpImageSparseSampleProjDrefImplicitLod:
            case Op.OpImageSparseSampleDrefImplicitLod:
            case Op.OpImageSparseSampleProjDrefExplicitLod:
            case Op.OpImageSparseSampleDrefExplicitLod:
            case Op.OpImageDrefGather:
            case Op.OpImageSparseDrefGather:
                this.dref_combined_samplers.add(args[2]);
                return true;

            default:
                break;
        }

        return true;
    }

    add_hierarchy_to_comparison_ids(id: number)
    {
        // Traverse the variable dependency hierarchy and tag everything in its path with comparison ids.
        this.comparison_ids.add(id);

        maplike_get(Set, this.dependency_hierarchy, id).forEach(dep_id => this.add_hierarchy_to_comparison_ids(dep_id));
    }

    add_dependency(dst: number, src: number)
    {
        maplike_get(Set, this.dependency_hierarchy, dst).add(src);
        // Propagate up any comparison state if we're loading from one such variable.
        if (this.comparison_ids.has(src))
            this.comparison_ids.add(dst);
    }
}