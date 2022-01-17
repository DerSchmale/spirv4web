import { GLSLPrecision } from "./GLSLPrecision";

export class GLSLFragmentOptions
{
    // Add precision mediump float in ES targets when emitting GLES source.
    // Add precision highp int in ES targets when emitting GLES source.
    default_float_precision: GLSLPrecision = GLSLPrecision.Mediump;
    default_int_precision: GLSLPrecision = GLSLPrecision.Highp;
}
