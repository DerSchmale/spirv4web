import { SPIRType, SPIRTypeBaseType } from "./SPIRType";
import { Op } from "../spirv";
export declare function type_is_floating_point(type: SPIRType): boolean;
export declare function type_is_integral(type: SPIRType): boolean;
export declare function opcode_is_sign_invariant(opcode: Op): boolean;
export declare function to_signed_basetype(width: number): SPIRTypeBaseType;
export declare function to_unsigned_basetype(width: number): SPIRTypeBaseType;
