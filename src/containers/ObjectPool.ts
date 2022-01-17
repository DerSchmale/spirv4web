import { ObjectPoolBase } from "./ObjectPoolBase";
import { AnyConstructor, DefaultConstructor, FromConstructor } from "../common/ConstructorTypes";

// TODO: Actually use an object pool instead of relying on garbage collection
//  doing it like this for now because we don't have destructors
export class ObjectPool<T> extends ObjectPoolBase
{
    private classRef: AnyConstructor<T>;

    constructor(classRef: AnyConstructor<T>)
    {
        super();
        this.classRef = classRef;
    }

    allocate(...args): T
    {
        // TODO: Keep a pool, but the problem is that disposing an out-of-scope is impossible
        return new this.classRef(...args);
    }

    deallocate(ptr: T)
    {
        // dispose:
        // ptr->~T();
        // vacants.push_back(ptr);
    }

    deallocate_opaque(ptr: any)
    {
        this.deallocate(ptr as T);
    }

    clear()
    {
    }
}