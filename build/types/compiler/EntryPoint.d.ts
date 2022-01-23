import { ExecutionModel } from "../spirv/ExecutionModel";
export declare class EntryPoint {
    name: string;
    execution_model: ExecutionModel;
    constructor(name: string, model: ExecutionModel);
}
