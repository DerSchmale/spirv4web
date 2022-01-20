import { ObjectPoolGroup } from "./ObjectPoolGroup";
import { Types } from "./Types";
import { IVariant, IVariantType } from "./IVariant";
export declare class Variant {
    private group;
    private holder;
    private type;
    private allow_type_rewrite;
    private createdIn;
    constructor(group: ObjectPoolGroup);
    set(val: IVariant, new_type: Types): void;
    allocate_and_set<T extends IVariant>(new_type: Types, ...args: any[]): T;
    get<T extends IVariant>(classRef: IVariantType<T>): T;
    get_type(): Types;
    get_id(): ID;
    empty(): boolean;
    reset(): void;
    set_allow_type_rewrite(): void;
}
export declare function variant_get<T extends IVariant>(classRef: IVariantType<T>, var_: Variant): T;
export declare function variant_set<T extends IVariant>(classRef: IVariantType<T>, var_: Variant, ...args: any[]): T;
