import { Pair } from "./utils/Pair";
import { PlsFormat } from "./compiler/glsl/glsl";
import { ExecutionModel } from "./spirv/ExecutionModel";
import { StorageClass } from "./spirv/StorageClass";
import { BuiltIn } from "./spirv/BuiltIn";

export class Rename
{
    old_name: string;
    new_name: string;
    execution_model: ExecutionModel;
}

export class VariableTypeRemap
{
    variable_name: string;
    new_variable_type: string ;
}

export class InterfaceVariableRename
{
    storageClass: StorageClass;
    location: number;
    variable_name: string;
}

export class PLSArg
{
    format: PlsFormat;
    name: string;
}

export class Remap
{
    src_name: string;
    dst_name: string;
    components: number;
}


export class Args
{
    version: number = 0;
    shader_model: number = 0;
    // es: boolean = false;
    set_version: boolean = false;
    set_shader_model: boolean = false;
    // set_es: boolean = false;
    dump_resources: boolean = false;
    force_temporary: boolean = false;
    flatten_ubo: boolean = false;
    fixup: boolean = false;
    yflip: boolean = false;
    sso: boolean = false;
    support_nonzero_baseinstance: boolean = true;
    glsl_emit_push_constant_as_ubo: boolean = false;
    glsl_emit_ubo_as_plain_uniforms: boolean = false;
    glsl_force_flattened_io_blocks: boolean = false;
    glsl_keep_unnamed_ubos: boolean = false;
    glsl_ovr_multiview_view_count: number = 0;
    glsl_ext_framebuffer_fetch: Pair<number, number>[] = [];
    glsl_ext_framebuffer_fetch_noncoherent: boolean = false;
    emit_line_directives: boolean = false;
    enable_storage_image_qualifier_deduction: boolean = true;
    force_zero_initialized_variables: boolean = false;

    pls_in: PLSArg[] = [];
    pls_out: PLSArg[] = [];
    remaps: Remap[] = [];

    extensions: string[] = [];
    variable_type_remaps: VariableTypeRemap[] = [];
    interface_variable_renames: InterfaceVariableRename[] = [];
    masked_stage_outputs: Pair<number, number>[] = [];
    masked_stage_builtins: BuiltIn[] = [];
    entry: string;
    entry_stage: string;

    entry_point_rename: Rename[] = [];

    cpp: boolean = false;
    reflect: string;
    flatten_multidimensional_arrays: boolean = false;
    use_420pack_extension: boolean = true;
    remove_unused: boolean = true;
    combined_samplers_inherit_bindings: boolean = false;
    glsl_remove_attribute_layouts: boolean = false;
    specialization_constant_prefix: string = "SPIRV_CROSS_CONSTANT_ID_";
    preprocess_spec_const: boolean = false;
}