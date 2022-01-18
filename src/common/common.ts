import { SPIRType, SPIRTypeBaseType } from "./SPIRType";

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