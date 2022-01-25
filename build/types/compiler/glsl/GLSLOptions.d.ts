import { GLSLVertexOptions } from "./GLSLVertexOptions";
import { GLSLFragmentOptions } from "./GLSLFragmentOptions";
export declare class GLSLOptions {
    version: number;
    specConstPrefix: string;
    es: boolean;
    force_temporary: boolean;
    separate_shader_objects: boolean;
    flatten_multidimensional_arrays: boolean;
    enable_420pack_extension: boolean;
    emit_push_constant_as_uniform_buffer: boolean;
    emit_uniform_buffer_as_plain_uniforms: boolean;
    emit_line_directives: boolean;
    enable_storage_image_qualifier_deduction: boolean;
    force_zero_initialized_variables: boolean;
    force_flattened_io_blocks: boolean;
    unnamed_ubo_to_global_uniforms: boolean;
    ovr_multiview_view_count: number;
    vertex: GLSLVertexOptions;
    fragment: GLSLFragmentOptions;
}
