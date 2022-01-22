import { DefaultConstructor } from "../common/ConstructorTypes";
import { Dict } from "./Dict";

export function maplike_get<T>(classRef: DefaultConstructor<T>, map: T[] | Dict<T>, id: number | string): T;
export function maplike_get(classRef: number, map: number[] | Dict<number>, id: number | string): number;
export function maplike_get(classRef: string, map: string[] | Dict<string>, id: number | string): string;

// creates an element if it does not exist, similar to a C++ map
// pass in 0 for number map
export function maplike_get<T>(classRef: DefaultConstructor<T> | number | string, map: T[] | Dict<T>, id: number | string): T
{
    if (!map[id]) {
        map[id] = typeof classRef === "number" || typeof classRef === "string"? classRef : new classRef();
    }

    return map[id];
}