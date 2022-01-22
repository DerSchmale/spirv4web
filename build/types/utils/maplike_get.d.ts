import { DefaultConstructor } from "../common/ConstructorTypes";
import { Dict } from "./Dict";
export declare function maplike_get<T>(classRef: DefaultConstructor<T>, map: T[] | Dict<T>, id: number | string): T;
export declare function maplike_get(classRef: number, map: number[] | Dict<number>, id: number | string): number;
export declare function maplike_get(classRef: string, map: string[] | Dict<string>, id: number | string): string;
