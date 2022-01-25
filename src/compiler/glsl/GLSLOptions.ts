import { GLSLVertexOptions } from "./GLSLVertexOptions";
import { GLSLFragmentOptions } from "./GLSLFragmentOptions";

// TODO: Remove options and code referring to it that isn't relevant for WebGL
export class GLSLOptions
{
    // The shading language version. Corresponds to #version $VALUE.
    version: number = 450;

    specConstPrefix: string = "SPIRV_CROSS_CONSTANT_ID_";

    // Emit the OpenGL ES shading language instead of desktop OpenGL.
    es: boolean = false;

    // Debug option to always emit temporary variables for all expressions.
    force_temporary: boolean = false;

    // If true, gl_PerVertex is explicitly redeclared in vertex, geometry and tessellation shaders.
    // The members of gl_PerVertex is determined by which built-ins are declared by the shader.
    // This option is ignored in ES versions, as redeclaration in ES is not required, and it depends on a different extension
    // (EXT_shader_io_blocks) which makes things a bit more fuzzy.
    separate_shader_objects: boolean = false;

    // Flattens multidimensional arrays, e.g. float foo[a][b][c] into single-dimensional arrays,
    // e.g. float foo[a * b * c].
    // This function does not change the actual SPIRType of any object.
    // Only the generated code, including declarations of interface variables are changed to be single array dimension.
    flatten_multidimensional_arrays: boolean = false;

    // For older desktop GLSL targets than version 420, the
    // GL_ARB_shading_language_420pack extensions is used to be able to support
    // layout(binding) on UBOs and samplers.
    // If disabled on older targets, binding decorations will be stripped.
    enable_420pack_extension: boolean = true;

    // In non-Vulkan GLSL, emit push constant blocks as UBOs rather than plain uniforms.
    emit_push_constant_as_uniform_buffer: boolean = false;

    // Always emit uniform blocks as plain uniforms, regardless of the GLSL version, even when UBOs are supported.
    // Does not apply to shader storage or push constant blocks.
    emit_uniform_buffer_as_plain_uniforms: boolean = false;

    // Emit OpLine directives if present in the module.
    // May not correspond exactly to original source, but should be a good approximation.
    emit_line_directives: boolean = false;

    // In cases where readonly/writeonly decoration are not used at all,
    // we try to deduce which qualifier(s) we should actually used, since actually emitting
    // read-write decoration is very rare, and older glslang/HLSL compilers tend to just emit readwrite as a matter of fact.
    // The default (true) is to enable automatic deduction for these cases, but if you trust the decorations set
    // by the SPIR-V, it's recommended to set this to false.
    enable_storage_image_qualifier_deduction: boolean = true;

    // On some targets (WebGPU), uninitialized variables are banned.
    // If this is enabled, all variables (temporaries, Private, Function)
    // which would otherwise be uninitialized will now be initialized to 0 instead.
    force_zero_initialized_variables: boolean = false;

    // In GLSL, force use of I/O block flattening, similar to
    // what happens on legacy GLSL targets for blocks and structs.
    force_flattened_io_blocks: boolean = false;

    // In WebGL 1, when we have unnamed uniform blocks, emit them as global uniforms.
    unnamed_ubo_to_global_uniforms: boolean = false;

    // If non-zero, controls layout(num_views = N) in; in GL_OVR_multiview2.
    ovr_multiview_view_count: number = 0;

    vertex: GLSLVertexOptions = new GLSLVertexOptions();
    fragment: GLSLFragmentOptions = new GLSLFragmentOptions();
}