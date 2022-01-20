import { ParsedIR } from "../parser/ParsedIR";
import { SPIRType, SPIRTypeBaseType } from "../common/SPIRType";
import { BuiltIn, Decoration, ExecutionModel, ImageFormat, Op, StorageClass } from "../spirv";
import { SPIRVariable } from "../common/SPIRVariable";
import { IVariant, IVariantType } from "../common/IVariant";
import { SPIREntryPoint } from "../common/SPIREntryPoint";
import { EntryPoint } from "./EntryPoint";
import { SPIRFunction } from "../common/SPIRFunction";
import { SPIRExpression } from "../common/SPIRExpression";
import { SPIRBlock, SPIRBlockCase, SPIRBlockContinueBlockType, SPIRBlockMethod } from "../common/SPIRBlock";
import { SPIRAccessChain } from "../common/SPIRAccessChain";
import { SPIRConstantOp } from "../common/SPIRConstantOp";
import { OpcodeHandler } from "./OpcodeHandler";
import { Instruction } from "../common/Instruction";
import { ShaderResources } from "./ShaderResources";
import { ExtendedDecorations } from "../common/Meta";
import { Bitset } from "../common/Bitset";
import { CombinedImageSampler } from "./CombinedImageSampler";
import { CFG } from "../cfg/CFG";
import { AnalyzeVariableScopeAccessHandler } from "./AnalyzeVariableScopeAccessHandler";
import { PhysicalBlockMeta } from "./PhysicalBlockMeta";
declare type VariableTypeRemapCallback = (type: SPIRType, name: string, type_name: string) => string;
export declare abstract class Compiler {
    ir: ParsedIR;
    protected global_variables: number[];
    protected aliased_variables: number[];
    protected current_function: SPIRFunction;
    protected current_block: SPIRBlock;
    protected current_loop_level: number;
    protected active_interface_variables: Set<VariableID>;
    protected check_active_interface_variables: boolean;
    protected invalid_expressions: Set<number>;
    protected is_force_recompile: boolean;
    combined_image_samplers: CombinedImageSampler[];
    protected variable_remap_callback: VariableTypeRemapCallback;
    protected forced_temporaries: Set<number>;
    protected forwarded_temporaries: Set<number>;
    protected suppressed_usage_tracking: Set<number>;
    protected hoisted_temporaries: Set<number>;
    protected forced_invariant_temporaries: Set<number>;
    active_input_builtins: Bitset;
    active_output_builtins: Bitset;
    clip_distance_count: number;
    cull_distance_count: number;
    position_invariant: boolean;
    protected comparison_ids: Set<number>;
    protected need_subpass_input: boolean;
    dummy_sampler_id: number;
    protected function_cfgs: CFG[];
    protected physical_storage_non_block_pointer_types: number[];
    protected physical_storage_type_to_alignment: PhysicalBlockMeta[];
    interlocked_resources: Set<number>;
    protected interlocked_is_complex: boolean;
    protected declared_block_names: string[];
    constructor(parsedIR: ParsedIR);
    abstract compile(): string;
    get_name(id: ID): string;
    set_decoration(id: ID, decoration: Decoration, argument?: number): void;
    set_decoration_string(id: ID, decoration: Decoration, argument: string): void;
    set_name(id: ID, name: string): void;
    get_decoration_bitset(id: ID): Bitset;
    get_declared_struct_member_size(struct_type: SPIRType, index: number): number;
    get_active_interface_variables(): Set<VariableID>;
    set_enabled_interface_variables(active_variables: Set<VariableID>): void;
    get_shader_resources(): ShaderResources;
    get_shader_resources(active_variables: Set<VariableID>): ShaderResources;
    get_common_basic_type(type: SPIRType): SPIRTypeBaseType;
    set_remapped_variable_state(id: VariableID, remap_enable: boolean): void;
    get_remapped_variable_state(id: VariableID): boolean;
    set_subpass_input_remapped_components(id: VariableID, components: number): void;
    get_subpass_input_remapped_components(id: VariableID): number;
    get_entry_points_and_stages(): EntryPoint[];
    set_entry_point(name: string, model: ExecutionModel): void;
    rename_entry_point(old_name: string, new_name: string, model: ExecutionModel): void;
    get_entry_point(): SPIREntryPoint;
    get_entry_point(name: string, model: ExecutionModel): SPIREntryPoint;
    update_active_builtins(): void;
    has_active_builtin(builtin: BuiltIn, storage: StorageClass): boolean;
    get_execution_model(): ExecutionModel;
    build_dummy_sampler_for_combined_images(): VariableID;
    build_combined_image_samplers(): void;
    get_combined_image_samplers(): CombinedImageSampler[];
    set_variable_type_remap_callback(cb: VariableTypeRemapCallback): void;
    get_current_id_bound(): number;
    protected stream(instr: Instruction): Uint32Array;
    execution_is_branchless(from: SPIRBlock, to: SPIRBlock): boolean;
    execution_is_direct_branch(from: SPIRBlock, to: SPIRBlock): boolean;
    protected is_break(next: number): boolean;
    protected is_loop_break(next: number): boolean;
    protected is_conditional(next: number): boolean;
    protected flush_dependees(var_: SPIRVariable): void;
    protected flush_all_active_variables(): void;
    protected flush_all_aliased_variables(): void;
    protected flush_control_dependent_expressions(block_id: number): void;
    update_name_cache(cache_primary: Set<string>, name: string): string;
    update_name_cache(cache_primary: Set<string>, cache_secondary: Set<string>, name: string): string;
    protected execution_is_noop(from: SPIRBlock, to: SPIRBlock): boolean;
    protected continue_block_type(block: SPIRBlock): SPIRBlockContinueBlockType;
    protected force_recompile(): void;
    protected is_forcing_recompilation(): boolean;
    protected block_is_loop_candidate(block: SPIRBlock, method: SPIRBlockMethod): boolean;
    protected inherit_expression_dependencies(dst: number, source_expression: number): void;
    protected add_implied_read_expression(e: SPIRExpression | SPIRAccessChain, source: number): void;
    protected clear_force_recompile(): void;
    protected interface_variable_exists_in_entry_point(id: number): boolean;
    protected remap_variable_type_name(type: SPIRType, var_name: string, type_name: string): string;
    protected set_ir(ir: ParsedIR): void;
    protected parse_fixup(): void;
    protected variable_storage_is_aliased(v: SPIRVariable): boolean;
    protected add_loop_level(): void;
    protected set_initializers(e: IVariant): void;
    set<T extends IVariant>(classRef: IVariantType<T>, id: number, ...args: any[]): T;
    get<T extends IVariant>(classRef: IVariantType<T>, id: number): T;
    has_decoration(id: ID, decoration: Decoration): boolean;
    get_decoration(id: ID, decoration: Decoration): number;
    protected get_decoration_string(id: ID, decoration: Decoration): string;
    protected unset_decoration(id: ID, decoration: Decoration): void;
    get_type(id: TypeID): SPIRType;
    protected get_fallback_name(id: ID): string;
    protected get_block_fallback_name(id: VariableID): string;
    protected get_member_name(id: TypeID, index: number): string;
    get_member_decoration(id: TypeID, index: number, decoration: Decoration): number;
    protected get_member_decoration_string(id: TypeID, index: number, decoration: Decoration): string;
    set_member_name(id: TypeID, index: number, name: string): void;
    protected get_member_qualified_name(type_id: TypeID, index: number): string;
    get_member_decoration_bitset(id: TypeID, index: number): Bitset;
    has_member_decoration(id: TypeID, index: number, decoration: Decoration): boolean;
    protected set_member_decoration(id: TypeID, index: number, decoration: Decoration, argument?: number): void;
    protected set_member_decoration_string(id: TypeID, index: number, decoration: Decoration, argument: string): void;
    protected unset_member_decoration(id: TypeID, index: number, decoration: Decoration): void;
    protected get_fallback_member_name(index: number): string;
    protected get_declared_struct_size(type: SPIRType): number;
    maybe_get<T extends IVariant>(classRef: IVariantType<T>, id: number): T;
    protected get_pointee_type_id(type_id: number): number;
    get_pointee_type<T>(type: SPIRType): SPIRType;
    get_pointee_type<T>(type: number): SPIRType;
    protected get_variable_data_type_id(var_: SPIRVariable): number;
    protected get_variable_data_type(var_: SPIRVariable): SPIRType;
    protected is_immutable(id: number): boolean;
    maybe_get_backing_variable(chain: number): SPIRVariable;
    to_name(id: number, allow_alias?: boolean): string;
    protected is_builtin_variable(var_: SPIRVariable): boolean;
    protected is_builtin_type(type: SPIRType): boolean;
    protected is_hidden_variable(var_: SPIRVariable, include_builtins?: boolean): boolean;
    protected is_member_builtin(type: SPIRType, index: number): BuiltIn;
    protected is_scalar(type: SPIRType): boolean;
    protected is_vector(type: SPIRType): boolean;
    protected is_matrix(type: SPIRType): boolean;
    protected is_array(type: SPIRType): boolean;
    protected expression_type_id(id: number): number;
    expression_type(id: number): SPIRType;
    protected expression_is_lvalue(id: number): boolean;
    register_read(expr: number, chain: number, forwarded: boolean): void;
    protected register_write(chain: number): void;
    protected is_continue(next: number): boolean;
    protected is_single_block_loop(next: number): boolean;
    protected traverse_all_reachable_opcodes(block: SPIRBlock, handler: OpcodeHandler): boolean;
    protected traverse_all_reachable_opcodes(block: SPIRFunction, handler: OpcodeHandler): boolean;
    analyze_image_and_sampler_usage(): void;
    protected build_function_control_flow_graphs_and_analyze(): void;
    get_cfg_for_current_function(): CFG;
    get_cfg_for_function(id: number): CFG;
    analyze_parameter_preservation(entry: SPIRFunction, cfg: CFG, variable_to_blocks: Set<number>[], complete_write_blocks: Set<number>[]): void;
    protected analyze_non_block_pointer_types(): void;
    protected analyze_variable_scope(entry: SPIRFunction, handler: AnalyzeVariableScopeAccessHandler): void;
    find_function_local_luts(entry: SPIRFunction, handler: AnalyzeVariableScopeAccessHandler, single_function: boolean): void;
    protected may_read_undefined_variable_in_block(block: SPIRBlock, var_: number): boolean;
    protected analyze_interlocked_resource_usage(): void;
    instruction_to_result_type(result: {
        result_type: number;
        result_id: number;
    }, op: Op, args: Uint32Array, length: number): boolean;
    combined_decoration_for_member(type: SPIRType, index: number): Bitset;
    is_desktop_only_format(format: ImageFormat): boolean;
    protected set_extended_decoration(id: number, decoration: ExtendedDecorations, value?: number): void;
    protected get_extended_decoration(id: number, decoration: ExtendedDecorations): number;
    protected has_extended_decoration(id: number, decoration: ExtendedDecorations): boolean;
    protected unset_extended_decoration(id: number, decoration: ExtendedDecorations): void;
    protected set_extended_member_decoration(type: number, index: number, decoration: ExtendedDecorations, value?: number): void;
    protected get_extended_member_decoration(type: number, index: number, decoration: ExtendedDecorations): number;
    protected has_extended_member_decoration(type: number, index: number, decoration: ExtendedDecorations): boolean;
    protected unset_extended_member_decoration(type: number, index: number, decoration: ExtendedDecorations): void;
    type_is_array_of_pointers(type: SPIRType): boolean;
    protected type_is_opaque_value(type: SPIRType): boolean;
    protected is_depth_image(type: SPIRType, id: number): boolean;
    protected reflection_ssbo_instance_name_is_significant(): boolean;
    protected type_struct_member_offset(type: SPIRType, index: number): number;
    protected type_struct_member_array_stride(type: SPIRType, index: number): number;
    protected type_struct_member_matrix_stride(type: SPIRType, index: number): number;
    protected get_remapped_declared_block_name(id: number, fallback_prefer_instance_name: boolean): string;
    protected type_is_block_like(type: SPIRType): boolean;
    protected flush_phi_required(from: BlockID, to: BlockID): boolean;
    protected evaluate_spec_constant_u32(spec: SPIRConstantOp): number;
    protected evaluate_constant_u32(id: number): number;
    is_vertex_like_shader(): boolean;
    get_case_list(block: SPIRBlock): SPIRBlockCase[];
}
export declare function opcode_is_sign_invariant(opcode: Op): boolean;
export declare function to_signed_basetype(width: number): SPIRTypeBaseType;
export declare function to_unsigned_basetype(width: number): SPIRTypeBaseType;
export {};