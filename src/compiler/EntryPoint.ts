import { ExecutionModel } from "../spirv/ExecutionModel";

export class EntryPoint
{
    name: string;
    execution_model: ExecutionModel;

    constructor(name: string, model: ExecutionModel)
    {
        this.name = name;
        this.execution_model = model;
    }
}