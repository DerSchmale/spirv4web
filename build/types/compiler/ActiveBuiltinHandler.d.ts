import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { BuiltIn, Op } from "../spirv";
import { Bitset } from "../common/Bitset";
import { SPIRType } from "../common/SPIRType";
export declare class ActiveBuiltinHandler extends OpcodeHandler {
    compiler: Compiler;
    constructor(compiler: Compiler);
    handle(opcode: Op, args: Uint32Array, length: number): boolean;
    handle_builtin(type: SPIRType, builtin: BuiltIn, decoration_flags: Bitset): void;
    add_if_builtin_or_block(id: number): void;
    add_if_builtin(id: number, allow_blocks?: boolean): void;
}
