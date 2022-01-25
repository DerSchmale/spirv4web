import { Bitset } from "./Bitset";
import { defaultClone, defaultCopy } from "../utils/defaultCopy";
import { ExecutionModel } from "../spirv/ExecutionModel";

class SPIREntryPointWorkgroupSize
{
    x: number = 0;
    y: number = 0;
    z: number = 0;
    id_x: number = 0;
    id_y: number = 0;
    id_z: number = 0;
    constant: number = 0; // Workgroup size can be expressed as a constant/spec-constant instead.

    clone() { return defaultClone(SPIREntryPointWorkgroupSize, this); }
}

// SPIREntryPoint is not a variant since its IDs are used to decorate OpFunction,
// so in order to avoid conflicts, we can't stick them in the ids array.
export class SPIREntryPoint
{
    self: FunctionID = 0;
    name: string;
    orig_name: string;
    interface_variables: VariableID[] = [];

    flags: Bitset = new Bitset();
    workgroup_size: SPIREntryPointWorkgroupSize = new SPIREntryPointWorkgroupSize();
    invocations: number = 0;
    output_vertices: number = 0;
    model: ExecutionModel = ExecutionModel.Max;
    geometry_passthrough: boolean = false;

    constructor(param0: FunctionID | SPIREntryPoint, execution_model: ExecutionModel, entry_name: string)
    {
        if (param0 instanceof SPIREntryPoint) {
            defaultCopy(param0, this);
        }
        else {
            this.self = param0;
            this.name = entry_name;
            this.orig_name = entry_name;
            this.model = execution_model;
        }
    }
}