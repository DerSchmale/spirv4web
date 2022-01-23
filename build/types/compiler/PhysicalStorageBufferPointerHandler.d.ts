import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { PhysicalBlockMeta } from "./PhysicalBlockMeta";
import { SPIRType } from "../common/SPIRType";
import { Op } from "../spirv/Op";
export declare class PhysicalStorageBufferPointerHandler extends OpcodeHandler {
    compiler: Compiler;
    non_block_types: Set<number>;
    physical_block_type_meta: PhysicalBlockMeta[];
    access_chain_to_physical_block: PhysicalBlockMeta[];
    constructor(compiler: Compiler);
    handle(op: Op, args: Uint32Array, length: number): boolean;
    mark_aligned_access(id: number, args: Uint32Array, length: number): void;
    find_block_meta(id: number): PhysicalBlockMeta;
    type_is_bda_block_entry(type_id: number): boolean;
    setup_meta_chain(type_id: number, var_id: number): void;
    get_minimum_scalar_alignment(type: SPIRType): number;
    analyze_non_block_types_from_block(type: SPIRType): void;
    get_base_non_block_type_id(type_id: number): number;
}
