import { Pair } from "./utils/Pair";
import { PlsFormat } from "./compiler/glsl/glsl";
import { ExecutionModel } from "./spirv/ExecutionModel";
import { StorageClass } from "./spirv/StorageClass";
import { BuiltIn } from "./spirv/BuiltIn";
export declare class Rename {
    old_name: string;
    new_name: string;
    execution_model: ExecutionModel;
}
export declare class VariableTypeRemap {
    variable_name: string;
    new_variable_type: string;
}
export declare class InterfaceVariableRename {
    storageClass: StorageClass;
    location: number;
    variable_name: string;
}
export declare class PLSArg {
    format: PlsFormat;
    name: string;
}
export declare class Remap {
    src_name: string;
    dst_name: string;
    components: number;
}
export declare class Args {
    version: number;
    shader_model: number;
    es: boolean;
    set_version: boolean;
    set_shader_model: boolean;
    set_es: boolean;
    dump_resources: boolean;
    force_temporary: boolean;
    flatten_ubo: boolean;
    fixup: boolean;
    yflip: boolean;
    sso: boolean;
    support_nonzero_baseinstance: boolean;
    glsl_emit_push_constant_as_ubo: boolean;
    glsl_emit_ubo_as_plain_uniforms: boolean;
    glsl_force_flattened_io_blocks: boolean;
    glsl_keep_unnamed_ubos: boolean;
    glsl_ovr_multiview_view_count: number;
    glsl_ext_framebuffer_fetch: Pair<number, number>[];
    glsl_ext_framebuffer_fetch_noncoherent: boolean;
    emit_line_directives: boolean;
    enable_storage_image_qualifier_deduction: boolean;
    force_zero_initialized_variables: boolean;
    pls_in: PLSArg[];
    pls_out: PLSArg[];
    remaps: Remap[];
    extensions: string[];
    variable_type_remaps: VariableTypeRemap[];
    interface_variable_renames: InterfaceVariableRename[];
    masked_stage_outputs: Pair<number, number>[];
    masked_stage_builtins: BuiltIn[];
    entry: string;
    entry_stage: string;
    entry_point_rename: Rename[];
    cpp: boolean;
    reflect: string;
    flatten_multidimensional_arrays: boolean;
    use_420pack_extension: boolean;
    remove_unused: boolean;
    combined_samplers_inherit_bindings: boolean;
    glsl_remove_attribute_layouts: boolean;
    specialization_constant_prefix: string;
}
