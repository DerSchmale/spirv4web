import { BuiltIn } from "../spirv/BuiltIn";
export declare class Resource {
    id: ID;
    type_id: TypeID;
    base_type_id: TypeID;
    name: string;
    constructor(id: ID, type_id: TypeID, base_type_id: TypeID, name: string);
}
export declare class BuiltInResource {
    builtin: BuiltIn;
    value_type_id: TypeID;
    resource: Resource;
}
export declare class ShaderResources {
    uniform_buffers: Resource[];
    storage_buffers: Resource[];
    stage_inputs: Resource[];
    stage_outputs: Resource[];
    subpass_inputs: Resource[];
    storage_images: Resource[];
    sampled_images: Resource[];
    atomic_counters: Resource[];
    acceleration_structures: Resource[];
    push_constant_buffers: Resource[];
    separate_images: Resource[];
    separate_samplers: Resource[];
    builtin_inputs: BuiltInResource[];
    builtin_outputs: BuiltInResource[];
}
