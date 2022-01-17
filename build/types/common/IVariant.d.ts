import { ObjectPoolBase } from "../containers/ObjectPoolBase";
export declare type IVariantType<T> = {
    type: TypeID;
    new (other: T): T;
};
export declare abstract class IVariant {
    self: ID;
    clone(pool: ObjectPoolBase): this;
}
