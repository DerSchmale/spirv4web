import { SPIRType, SPIRBaseType } from "./SPIRType";
import { Op } from "../spirv/Op";

export function type_is_floating_point(type: SPIRType): boolean
{
    return type.basetype === SPIRBaseType.Half || type.basetype === SPIRBaseType.Float || type.basetype === SPIRBaseType.Double;
}

export function type_is_integral(type: SPIRType): boolean
{
    return type.basetype === SPIRBaseType.SByte || type.basetype === SPIRBaseType.UByte || type.basetype === SPIRBaseType.Short ||
        type.basetype === SPIRBaseType.UShort || type.basetype === SPIRBaseType.Int || type.basetype === SPIRBaseType.UInt ||
        type.basetype === SPIRBaseType.Int64 || type.basetype === SPIRBaseType.UInt64;
}



// Returns true if an arithmetic operation does not change behavior depending on signedness.
export function opcode_is_sign_invariant(opcode: Op): boolean
{
    switch (opcode) {
        case Op.IEqual:
        case Op.INotEqual:
        case Op.ISub:
        case Op.IAdd:
        case Op.IMul:
        case Op.ShiftLeftLogical:
        case Op.BitwiseOr:
        case Op.BitwiseXor:
        case Op.BitwiseAnd:
            return true;

        default:
            return false;
    }
}

export function to_signed_basetype(width: number): SPIRBaseType
{
    switch (width) {
        case 8:
            return SPIRBaseType.SByte;
        case 16:
            return SPIRBaseType.Short;
        case 32:
            return SPIRBaseType.Int;
        case 64:
            return SPIRBaseType.Int64;
        default:
            throw new Error("Invalid bit width.");
    }
}

export function to_unsigned_basetype(width: number): SPIRBaseType
{
    switch (width) {
        case 8:
            return SPIRBaseType.UByte;
        case 16:
            return SPIRBaseType.UShort;
        case 32:
            return SPIRBaseType.UInt;
        case 64:
            return SPIRBaseType.UInt64;
        default:
            throw new Error("Invalid bit width.");
    }
}