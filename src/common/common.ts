import { SPIRType, SPIRTypeBaseType } from "./SPIRType";
import { Op } from "../spirv";

export function type_is_floating_point(type: SPIRType): boolean
{
    return type.basetype === SPIRTypeBaseType.Half || type.basetype === SPIRTypeBaseType.Float || type.basetype === SPIRTypeBaseType.Double;
}

export function type_is_integral(type: SPIRType): boolean
{
    return type.basetype === SPIRTypeBaseType.SByte || type.basetype === SPIRTypeBaseType.UByte || type.basetype === SPIRTypeBaseType.Short ||
        type.basetype === SPIRTypeBaseType.UShort || type.basetype === SPIRTypeBaseType.Int || type.basetype === SPIRTypeBaseType.UInt ||
        type.basetype === SPIRTypeBaseType.Int64 || type.basetype === SPIRTypeBaseType.UInt64;
}



// Returns true if an arithmetic operation does not change behavior depending on signedness.
export function opcode_is_sign_invariant(opcode: Op): boolean
{
    switch (opcode) {
        case Op.OpIEqual:
        case Op.OpINotEqual:
        case Op.OpISub:
        case Op.OpIAdd:
        case Op.OpIMul:
        case Op.OpShiftLeftLogical:
        case Op.OpBitwiseOr:
        case Op.OpBitwiseXor:
        case Op.OpBitwiseAnd:
            return true;

        default:
            return false;
    }
}

export function to_signed_basetype(width: number): SPIRTypeBaseType
{
    switch (width) {
        case 8:
            return SPIRTypeBaseType.SByte;
        case 16:
            return SPIRTypeBaseType.Short;
        case 32:
            return SPIRTypeBaseType.Int;
        case 64:
            return SPIRTypeBaseType.Int64;
        default:
            throw new Error("Invalid bit width.");
    }
}

export function to_unsigned_basetype(width: number): SPIRTypeBaseType
{
    switch (width) {
        case 8:
            return SPIRTypeBaseType.UByte;
        case 16:
            return SPIRTypeBaseType.UShort;
        case 32:
            return SPIRTypeBaseType.UInt;
        case 64:
            return SPIRTypeBaseType.UInt64;
        default:
            throw new Error("Invalid bit width.");
    }
}