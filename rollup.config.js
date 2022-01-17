import typescript from "rollup-plugin-typescript2";
import nodeResolve from '@rollup/plugin-node-resolve';

export default [{
    input: ["./src/main.ts"],
    output: [
        {
            file: "build/spirv4web.js",
            format: "iife",
            name: "SPIRV" // the global which can be used in a browser
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
