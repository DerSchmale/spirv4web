// @ts-ignore
import { createWith } from "@derschmale/array-utils";
import { IVariant } from "./IVariant";
import { Types } from "./Types";
import { defaultClone, defaultCopy } from "../utils/defaultCopy";
import { SPIRType } from "./SPIRType";

const u = new DataView(new ArrayBuffer(4));

// like a union
export class SPIRConstantConstant
{
    value: ArrayBuffer = new ArrayBuffer(16);

    private _dataView: DataView = new DataView(this.value);

    get u32(): number
    {
        return this._dataView.getUint32(0);
    }

    set u32(value: number)
    {
        this._dataView.setUint32(0, value);
    }

    get i32(): number
    {
        return this._dataView.getInt32(0);
    }

    set i32(value: number)
    {
        this._dataView.setInt32(0, value);
    }

    get f32(): number
    {
        return this._dataView.getFloat32(0);
    }

    set f32(value: number)
    {
        this._dataView.setFloat32(0, value);
    }

    get u64(): bigint
    {
        return this._dataView.getBigUint64(0);
    }

    set u64(value: bigint)
    {
        this._dataView.setBigUint64(0, value);
    }

    get i64(): bigint
    {
        return this._dataView.getBigInt64(0);
    }

    set i64(value: bigint)
    {
        this._dataView.setBigInt64(0, value);
    }

    get f64(): number
    {
        return this._dataView.getFloat64(0);
    }

    set f64(value: number)
    {
        this._dataView.setFloat64(0, value);
    }

    clone()
    {
        return defaultClone(SPIRConstantConstant, this);
    }
}

export class SPIRConstantConstantVector
{
    r: SPIRConstantConstant[];
    // If != 0, this element is a specialization constant, and we should keep track of it as such.
    id: ID[];
    vecsize: number = 1;

    constructor()
    {
        this.r = createWith(4, () => new SPIRConstantConstant());
        this.id = createWith(4, () => 0);
    }

    clone()
    {
        return defaultClone(SPIRConstantConstantVector, this);
    }
}

export class SPIRConstantConstantMatrix
{
    c: SPIRConstantConstantVector[];
    // If != 0, this column is a specialization constant, and we should keep track of it as such.
    id: ID[];
    columns: number = 1;

    constructor()
    {
        this.c = createWith(4, () => new SPIRConstantConstantVector());
        this.id = createWith(4, () => 0);
    }

    clone()
    {
        return defaultClone(SPIRConstantConstantMatrix, this);
    }
}

export class SPIRConstant extends IVariant
{
    static type = Types.TypeConstant;

    constant_type: TypeID = 0;
    m: SPIRConstantConstantMatrix = new SPIRConstantConstantMatrix();

    // If this constant is a specialization constant (i.e. created with OpSpecConstant*).
    specialization: boolean = false;
    // If this constant is used as an array length which creates specialization restrictions on some backends.
    is_used_as_array_length: boolean = false;

    // If true, this is a LUT, and should always be declared in the outer scope.
    is_used_as_lut: boolean = false;

    // For composites which are constant arrays, etc.
    // should be ConstantID[]
    subconstants: Uint32Array = new Uint32Array();

    // Non-Vulkan GLSL, HLSL and sometimes MSL emits defines for each specialization constant,
    // and uses them to initialize the constant. This allows the user
    // to still be able to specialize the value by supplying corresponding
    // preprocessor directives before compiling the shader.
    specialization_constant_macro_name: string = "";

    f16_to_f32(u16_value: number): number
    {
        // Based on the GLM implementation.
        let s = (u16_value >> 15) & 0x1;
        let e = (u16_value >> 10) & 0x1f;
        let m = (u16_value >> 0) & 0x3ff;

        if (e === 0) {
            if (m === 0) {
                u.setUint32(0, s << 31);
                return u.getFloat32(0);
            }
            else {
                while ((m & 0x400) === 0) {
                    m <<= 1;
                    e--;
                }

                e++;
                m &= ~0x400;
            }
        }
        else if (e === 31) {
            if (m === 0) {
                u.setUint32(0, (s << 31) | 0x7f800000);
                return u.getFloat32(0);
            }
            else {
                u.setUint32(0, (s << 31) | 0x7f800000 | (m << 13));
                return u.getFloat32(0);
            }
        }

        e += 127 - 15;
        m <<= 13;
        u.setUint32(0, (s << 31) | (e << 23) | m);
        return u.getFloat32(0);
    }

    specialization_constant_id(col: number, row?: number): number
    {
        if (row === undefined)
            return this.m.id[col];
        else
            return this.m.c[col].id[row];
    }

    scalar(col: number = 0, row: number = 0): number
    {
        return this.m.c[col].r[row].u32;
    }

    scalar_i16(col: number = 0, row: number = 0): number
    {
        return this.m.c[col].r[row].u32 & 0xffff;
    }

    scalar_u16(col: number = 0, row: number = 0): number
    {
        return this.m.c[col].r[row].u32 & 0xffff;
    }

    scalar_i8(col: number = 0, row: number = 0): number
    {
        return this.m.c[col].r[row].u32 & 0xff;
    }

    scalar_u8(col: number = 0, row: number = 0): number
    {
        return this.m.c[col].r[row].u32 & 0xff;
    }

    scalar_f16(col: number = 0, row: number = 0): number
    {
        return this.f16_to_f32(this.scalar_u16(col, row));
    }

    scalar_f32(col: number = 0, row: number = 0): number
    {
        return this.m.c[col].r[row].f32;
    }

    scalar_i32(col: number = 0, row: number = 0): number
    {
        return this.m.c[col].r[row].i32;
    }

    scalar_f64(col: number = 0, row: number = 0): number
    {
        return this.m.c[col].r[row].f64;
    }

    scalar_i64(col: number = 0, row: number = 0): bigint
    {
        return this.m.c[col].r[row].i64;
    }

    scalar_u64(col: number = 0, row: number = 0): bigint
    {
        return this.m.c[col].r[row].u64;
    }

    vector(): SPIRConstantConstantVector
    {
        return this.m.c[0];
    }

    vector_size(): number
    {
        return this.m.c[0].vecsize;
    }

    columns(): number
    {
        return this.m.columns;
    }

    make_null(constant_type: SPIRType)
    {
        this.m = new SPIRConstantConstantMatrix();
        this.m.columns = constant_type.columns;
        for (let c of this.m.c)
            c.vecsize = constant_type.vecsize;
    }

    constant_is_null(): boolean
    {
        if (this.specialization)
            return false;
        if (this.subconstants.length !== 0)
            return false;

        for (let col = 0; col < this.columns(); col++)
            for (let row = 0; row < this.vector_size(); row++)
                if (this.scalar_u64(col, row) !== BigInt(0))
                    return false;

        return true;
    }

    constructor();
    constructor(other: SPIRConstant);
    constructor(constant_type: TypeID);
    constructor(constant_type: TypeID, elements: number[], num_elements: number, specialized: boolean);
    constructor(constant_type: TypeID, v0: number, specialized: boolean);
    constructor(constant_type: TypeID, v0: bigint, specialized: boolean);
    constructor(constant_type: TypeID, vector_elements: SPIRConstant[], num_elements: number, specialized: boolean);

    constructor(...args)
    {
        super();

        // default constructor
        if (args.length === 0)
            return;
        if (args.length === 1) {
            if (args[0] instanceof SPIRConstant)
                defaultCopy(args[0], this);
            else
                this._construct(args[0]);
        }
        else if (typeof args[1] === "bigint")
            this._constructScalar64(args[0], args[1], args[2]);
        else if (typeof args[1] === "number")
            this._constructScalar32(args[0], args[1], args[2]);
        else if (typeof args[1][0] === "number")
            this._constructArray(args[0], args[1], args[2], args[3]);
        else
            this._constructVecMat(args[0], args[1], args[2], args[3]);
    }

    _construct(constant_type: TypeID)
    {
        this.constant_type = constant_type;
    }

    _constructArray(constant_type: TypeID, elements: Uint32Array, num_elements: number, specialized: boolean)
    {
        this.constant_type = constant_type;
        this.specialization = specialized;
        this.subconstants = elements.slice();
    }

    // Construct scalar (32-bit).
    _constructScalar32(constant_type: TypeID, v0: number, specialized: boolean)
    {
        this.constant_type = constant_type;
        this.specialization = specialized;
        this.m.c[0].r[0].u32 = v0;
        this.m.c[0].vecsize = 1;
        this.m.columns = 1;
    }

    // Construct scalar (64-bit).
    _constructScalar64(constant_type: TypeID, v0: bigint, specialized: boolean)
    {
        this.constant_type = constant_type;
        this.specialization = specialized;
        this.m.c[0].r[0].u64 = v0;
        this.m.c[0].vecsize = 1;
        this.m.columns = 1;
    }

    // Construct vectors and matrices.
    _constructVecMat(constant_type: TypeID, vector_elements: SPIRConstant[], num_elements: number, specialized: boolean)
    {
        this.constant_type = constant_type;
        this.specialization = specialized;
        const matrix = vector_elements[0].m.c[0].vecsize > 1;

        if (matrix) {
            this.m.columns = num_elements;

            for (let i = 0; i < num_elements; i++) {
                this.m.c[i] = vector_elements[i].m.c[0];
                if (vector_elements[i].specialization)
                    this.m.id[i] = vector_elements[i].self;
            }
        }
        else {
            this.m.c[0].vecsize = num_elements;
            this.m.columns = 1;

            for (let i = 0; i < num_elements; i++) {
                this.m.c[0].r[i] = vector_elements[i].m.c[0].r[0];
                if (vector_elements[i].specialization)
                    this.m.c[0].id[i] = vector_elements[i].self;
            }
        }
    }
}