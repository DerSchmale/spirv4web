import { ObjectPoolGroup } from "./ObjectPoolGroup";
import { Types } from "./Types";
import { IVariant, IVariantType } from "./IVariant";
import { ObjectPool } from "../containers/ObjectPool";

export class Variant
{
    private group: ObjectPoolGroup;
    private holder: IVariant = null;
    private type: Types = Types.None;
    private allow_type_rewrite: boolean = false;
    private createdIn: string;

    constructor(group: ObjectPoolGroup)
    {
        this.group = group;
        this.createdIn = new Error().stack;
    }

    set(val: IVariant, new_type: Types)
    {
        if (this.holder)
            this.group.pools[this.type].deallocate_opaque(this.holder);

        this.holder = null;

        if (!this.allow_type_rewrite && this.type !== Types.None && this.type !== new_type) {
            if (val)
                this.group.pools[new_type].deallocate_opaque(val);

            throw new Error("Overwriting a variant with new type.");
        }

        this.holder = val;
        this.type = new_type;
        this.allow_type_rewrite = false;
    }

    allocate_and_set<T extends IVariant>(new_type: Types, ...args): T
    {
        const p = <ObjectPool<T>>(this.group.pools[new_type]);
        const val = p.allocate(...args);
        this.set(val, new_type);
        return val;
    }

    get<T extends IVariant>(classRef: IVariantType<T>)
    {
        if (!this.holder)
            throw new Error("nullptr");
        if (classRef.type !== this.type)
            throw new Error("Bad cast");
        return <T>(this.holder);
    }

    get_type(): Types
    {
        return this.type;
    }

    get_id(): ID
    {
        return this.holder ? this.holder.self : 0;
    }

    empty(): boolean
    {
        return !this.holder;
    }

    reset()
    {
        if (this.holder)
            this.group.pools[this.type].deallocate_opaque(this.holder);
        this.holder = null;
        this.type = Types.None;
    }

    set_allow_type_rewrite()
    {
        this.allow_type_rewrite = true;
    }
}

export function variant_get<T extends IVariant>(classRef: IVariantType<T>, var_: Variant): T
{
    return var_.get<T>(classRef);
}

export function variant_set<T extends IVariant>(classRef: IVariantType<T>, var_: Variant, ...args): T
{
    return var_.allocate_and_set<T>(classRef.type, ...args);
}