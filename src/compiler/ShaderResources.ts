import { BuiltIn } from "../spirv/BuiltIn";

export class Resource
{
    // Resources are identified with their SPIR-V ID.
    // This is the ID of the OpVariable.
    id: ID;

    // The type ID of the variable which includes arrays and all type modifications.
    // This type ID is not suitable for parsing OpMemberDecoration of a struct and other decorations in general
    // since these modifications typically happen on the base_type_id.
    type_id: TypeID;

    // The base type of the declared resource.
    // This type is the base type which ignores pointers and arrays of the type_id.
    // This is mostly useful to parse decorations of the underlying type.
    // base_type_id can also be obtained with get_type(get_type(type_id).self).
    base_type_id: TypeID;

    // The declared name (OpName) of the resource.
    // For Buffer blocks, the name actually reflects the externally
    // visible Block name.
    //
    // This name can be retrieved again by using either
    // get_name(id) or get_name(base_type_id) depending if it's a buffer block or not.
    //
    // This name can be an empty string in which case get_fallback_name(id) can be
    // used which obtains a suitable fallback identifier for an ID.
    name: string = "";

    constructor(id: ID, type_id: TypeID, base_type_id: TypeID, name: string)
    {
        this.id = id;
        this.type_id = type_id;
        this.base_type_id = base_type_id;
        this.name = name;
    }
}

export class BuiltInResource
{
    // This is mostly here to support reflection of builtins such as Position/PointSize/CullDistance/ClipDistance.
    // This needs to be different from Resource since we can collect builtins from blocks.
    // A builtin present here does not necessarily mean it's considered an active builtin,
    // since variable ID "activeness" is only tracked on OpVariable level, not Block members.
    // For that, update_active_builtins() -> has_active_builtin() can be used to further refine the reflection.
    builtin: BuiltIn;

    // This is the actual value type of the builtin.
    // Typically float4, float, array<float, N> for the gl_PerVertex builtins.
    // If the builtin is a control point, the control point array type will be stripped away here as appropriate.
    value_type_id: TypeID;

    // This refers to the base resource which contains the builtin.
    // If resource is a Block, it can hold multiple builtins, or it might not be a block.
    // For advanced reflection scenarios, all information in builtin/value_type_id can be deduced,
    // it's just more convenient this way.
    resource: Resource;
}

export class ShaderResources
{
    uniform_buffers: Resource[] = [];
    storage_buffers: Resource[] = [];
    stage_inputs: Resource[] = [];
    stage_outputs: Resource[] = [];
    subpass_inputs: Resource[] = [];
    storage_images: Resource[] = [];
    sampled_images: Resource[] = [];
    atomic_counters: Resource[] = [];
    acceleration_structures: Resource[] = [];

    // There can only be one push constant block,
    // but keep the vector in case this restriction is lifted in the future.
    push_constant_buffers: Resource[] = [];

    // For Vulkan GLSL and HLSL source,
    // these correspond to separate texture2D and samplers respectively.
    separate_images: Resource[] = [];
    separate_samplers: Resource[] = [];

    builtin_inputs: BuiltInResource[] = [];
    builtin_outputs: BuiltInResource[] = [];
}