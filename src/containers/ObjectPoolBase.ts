import { FromConstructor } from "../common/ConstructorTypes";

export abstract class ObjectPoolBase
{
    abstract deallocate_opaque(ptr: any);
}
