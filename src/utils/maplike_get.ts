import { DefaultConstructor } from "../common/ConstructorTypes";

// creates an element if it does not exist, similar to a C++ map
// pass in 0 for number map
export function maplike_get<T>(classRef: any, map: T[], id: number)
{
    if (!map[id]) {
        map[id] = classRef === 0? classRef : new classRef();
    }

    return map[id];
}