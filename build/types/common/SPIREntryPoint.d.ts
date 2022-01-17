import { ExecutionModel } from "../spirv";
import { Bitset } from "./Bitset";
declare class SPIREntryPointWorkgroupSize {
    x: number;
    y: number;
    z: number;
    constant: number;
    clone(): SPIREntryPointWorkgroupSize;
}
export declare class SPIREntryPoint {
    self: FunctionID;
    name: string;
    orig_name: string;
    interface_variables: VariableID[];
    flags: Bitset;
    workgroup_size: SPIREntryPointWorkgroupSize;
    invocations: number;
    output_vertices: number;
    model: ExecutionModel;
    geometry_passthrough: boolean;
    constructor(self: FunctionID, execution_model: ExecutionModel, entry_name: string);
}
export {};
