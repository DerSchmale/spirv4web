import { ExecutionModel } from "../spirv";

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