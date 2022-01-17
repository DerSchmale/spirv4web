import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv";
import { SPIRFunction } from "../common/SPIRFunction";
export declare class CombinedImageSamplerHandler extends OpcodeHandler {
    compiler: Compiler;
    parameter_remapping: number[][];
    functions: SPIRFunction[];
    constructor(compiler: Compiler);
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
    begin_function_scope(args: Uint32Array, length: number): boolean;
    end_function_scope(args: Uint32Array, length: number): boolean;
    remap_parameter(id: number): number;
    push_remap_parameters(func: SPIRFunction, args: Uint32Array, length: number): void;
    pop_remap_parameters(): void;
    register_combined_image_sampler(caller: SPIRFunction, combined_module_id: VariableID, image_id: VariableID, sampler_id: VariableID, depth: boolean): void;
}
