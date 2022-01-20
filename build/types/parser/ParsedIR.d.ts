import { Variant } from "../common/Variant";
import { Meta } from "../common/Meta";
import { Types } from "../common/Types";
import { AddressingModel, Capability, Decoration, MemoryModel } from "../spirv";
import { SPIREntryPoint } from "../common/SPIREntryPoint";
import { Bitset } from "../common/Bitset";
import { MemberPointer, Pointer } from "../utils/Pointer";
import { SPIRVariable } from "../common/SPIRVariable";
import { SPIRType } from "../common/SPIRType";
import { IVariant, IVariantType } from "../common/IVariant";
export declare enum BlockMetaFlagBits {
    BLOCK_META_LOOP_HEADER_BIT = 1,
    BLOCK_META_CONTINUE_BIT = 2,
    BLOCK_META_LOOP_MERGE_BIT = 4,
    BLOCK_META_SELECTION_MERGE_BIT = 8,
    BLOCK_META_MULTISELECT_MERGE_BIT = 16
}
declare class Source {
    version: number;
    es: boolean;
    known: boolean;
    hlsl: boolean;
}
declare class LoopLock {
    private lock;
    constructor(lock: MemberPointer<ParsedIR, number> | Pointer<number>);
    dispose(): void;
}
export declare class ParsedIR {
    private pool_group;
    spirv: Uint32Array;
    ids: Variant[];
    meta: Meta[];
    ids_for_type: ID[][];
    ids_for_constant_or_type: ID[];
    ids_for_constant_or_variable: ID[];
    load_type_width: number[];
    declared_capabilities: Capability[];
    declared_extensions: string[];
    block_meta: number[];
    continue_block_to_loop_header: BlockID[];
    entry_points: SPIREntryPoint[];
    default_entry_point: FunctionID;
    source: Source;
    addressing_model: AddressingModel;
    memory_model: MemoryModel;
    private loop_iteration_depth_hard;
    private loop_iteration_depth_soft;
    private empty_string;
    private cleared_bitset;
    private meta_needing_name_fixup;
    constructor();
    set_id_bounds(bounds: number): void;
    set_name(id: ID, name: string): void;
    get_name(id: ID): string;
    set_decoration(id: ID, decoration: Decoration, argument?: number): void;
    set_decoration_string(id: ID, decoration: Decoration, argument: string): void;
    has_decoration(id: ID, decoration: Decoration): boolean;
    get_decoration(id: ID, decoration: Decoration): number;
    get_decoration_string(id: ID, decoration: Decoration): string;
    get_decoration_bitset(id: ID): Bitset;
    unset_decoration(id: ID, decoration: Decoration): void;
    private resize_members;
    set_member_name(id: TypeID, index: number, name: string): void;
    get_member_name(id: TypeID, index: number): string;
    set_member_decoration(id: TypeID, index: number, decoration: Decoration, argument?: number): void;
    set_member_decoration_string(id: TypeID, index: number, decoration: Decoration, argument: string): void;
    get_member_decoration(id: TypeID, index: number, decoration: Decoration): number;
    get_member_decoration_string(id: TypeID, index: number, decoration: Decoration): string;
    has_member_decoration(id: TypeID, index: number, decoration: Decoration): boolean;
    get_member_decoration_bitset(id: TypeID, index: number): Bitset;
    unset_member_decoration(id: TypeID, index: number, decoration: Decoration): void;
    mark_used_as_array_length(id: ID): void;
    get_buffer_block_flags(var_: SPIRVariable): Bitset;
    get_buffer_block_type_flags(type: SPIRType): Bitset;
    add_typed_id(type: Types, id: ID): void;
    remove_typed_id(type: Types, id: ID): void;
    create_loop_hard_lock(): LoopLock;
    create_loop_soft_lock(): LoopLock;
    for_each_typed_id<T extends IVariant>(classRef: IVariantType<T>, op: (id: ID, t: T) => void): void;
    reset_all_of_type(type: Types | IVariantType<any>): void;
    get_meta(id: ID): Meta;
    find_meta(id: ID): Meta;
    get_empty_string(): string;
    make_constant_null(id: number, type: number, add_to_typed_id_set: boolean): void;
    fixup_reserved_names(): void;
    static sanitize_identifier(name: string, member: boolean, allow_reserved_prefixes: boolean): string;
    static sanitize_underscores(str: string): string;
    static is_globally_reserved_identifier(str: string, allow_reserved_prefixes: boolean): boolean;
    increase_bound_by(incr_amount: number): number;
    get_spirv_version(): number;
    private get;
}
export {};