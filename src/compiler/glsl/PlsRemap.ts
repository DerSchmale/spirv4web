import { PlsFormat } from "./glsl";

export class PlsRemap
{
    id: number;
    format: PlsFormat;

    constructor(id: number, format: PlsFormat)
    {
        this.id = id;
        this.format = format;
    }
}