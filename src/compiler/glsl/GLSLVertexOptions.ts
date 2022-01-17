export class GLSLVertexOptions
{
// "Vertex-like shader" here is any shader stage that can write BuiltInPosition.

    // GLSL: In vertex-like shaders, rewrite [0, w] depth (Vulkan/D3D style) to [-w, w] depth (GL style).
    // MSL: In vertex-like shaders, rewrite [-w, w] depth (GL style) to [0, w] depth.
    // HLSL: In vertex-like shaders, rewrite [-w, w] depth (GL style) to [0, w] depth.
    fixup_clipspace: boolean = false;

    // In vertex-like shaders, inverts gl_Position.y or equivalent.
    flip_vert_y: boolean = false;

    // GLSL only, for HLSL version of this option, see CompilerHLSL.
    // If true, the backend will assume that InstanceIndex will need to apply
    // a base instance offset. Set to false if you know you will never use base instance
    // functionality as it might remove some internal uniforms.
    support_nonzero_base_instance: boolean = true;
}