import { Types } from "./Types";
import { ObjectPoolBase } from "../containers/ObjectPoolBase";

export class ObjectPoolGroup
{
    pools: ObjectPoolBase[] = new Array(Types.Count);

    constructor()
    {
    }
}