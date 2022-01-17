import { ObjectPoolBase } from "./ObjectPoolBase";
import { AnyConstructor } from "../common/ConstructorTypes";
export declare class ObjectPool<T> extends ObjectPoolBase {
    private classRef;
    constructor(classRef: AnyConstructor<T>);
    allocate(...args: any[]): T;
    deallocate(ptr: T): void;
    deallocate_opaque(ptr: any): void;
    clear(): void;
}
