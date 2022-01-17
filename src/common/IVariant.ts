import { defaultCopy } from "../utils/defaultCopy";
import { ObjectPoolBase } from "../containers/ObjectPoolBase";
import { ObjectPool } from "../containers/ObjectPool";

export type IVariantType<T> = {
    type: TypeID,
    new(other: T): T
}

export abstract class IVariant
{
    self: ID = 0;

    clone(pool: ObjectPoolBase): this
    {
        const p = <ObjectPool<this>>(pool);
        const c = p.allocate(this);
        defaultCopy(this, c);
        return c;
    }
}