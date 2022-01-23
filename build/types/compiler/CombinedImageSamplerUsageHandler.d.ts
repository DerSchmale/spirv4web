import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv/Op";
export declare class CombinedImageSamplerUsageHandler extends OpcodeHandler {
    compiler: Compiler;
    dref_combined_samplers: Set<number>;
    dependency_hierarchy: Set<number>[];
    comparison_ids: Set<number>;
    need_subpass_input: boolean;
    constructor(compiler: Compiler, dref_combined_samplers: Set<number>);
    begin_function_scope(args: Uint32Array, length: number): boolean;
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
    add_hierarchy_to_comparison_ids(id: number): void;
    add_dependency(dst: number, src: number): void;
}
