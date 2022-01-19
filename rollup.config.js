import typescript from "rollup-plugin-typescript2";
import nodeResolve from '@rollup/plugin-node-resolve';
import {terser} from "rollup-plugin-terser";

export default [{
    input: ["./src/main.ts"],
    output: [
        {
            file: "build/spirv4web.js",
            format: "iife",
            name: "SPIRV" // the global which can be used in a browser
        },
        {
            file: "build/spirv4web.min.js",
            format: "iife",
            name: "SPIRV", // the global which can be used in a browser
            plugins: [terser()]
        },
        {
            file: "build/spirv4web.module.js",
            format: "es"
        }
    ],
    plugins: [
        typescript({
            useTsconfigDeclarationDir: true,
            sourceMap: true,
            inlineSources: true
        }),
        nodeResolve()
    ]
}];
