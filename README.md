# Spir-V for Web

A Spir-V to GLSL compiler for use with WebGL 1 and 2.

This is a partial TypeScript port of [SPIRV-Cross](https://github.com/KhronosGroup/SPIRV-Cross).
Mainly built for my own use case, which is writing a single shader (in GLSL ES 3.1) and being able to convert it to WebGL 1 and 2.
As such, **this is very much still in an alpha stage!**

## Usage

### Installation

Install the package as a dependency:

```
npm install @derschmale/spirv4web 
```

or

```
yarn add @derschmale/spirv4web
```

### Javascript

```

import { compile, Version } from "@derschmale/spirv4web";

async function yourLoadingCode(filename)
{
    // ...
    // load your data into some array buffer
    // ...    
    return arrayBuffer;
}

// the compile function expects data in an ArrayBuffer
const spirv = await yourLoadingCode("someFilename.spv");

const glslCode = compile(spirv, Version.WebGL2, {
    // options (see below)
    removeAttributeLayouts: true
});

```

### Options

The `compile` function has the following signature:

```
function compile(data: ArrayBuffer, version: Version, options?: Options): string
```

- `data`: An ArrayBuffer containing valid Spir-V bytecode.
- `version`: Either `Version.WebGL1` or `Version.WebGL2`
- `options`: An optional object containing the following optional fields:
  - `removeUnused`: Removes unused variables and resources. Defaults to `true`.
  - `specializationConstantPrefix`: [Specialization constants](https://www.khronos.org/registry/vulkan/specs/1.1-khr-extensions/html/chap10.html#pipelines-specialization-constants) will be converted to `#define` macros. This allows setting a custom prefix for the macro names (defaults to `SPIRV_CROSS_CONSTANT_ID_`).
  - `keepUnnamedUBOs`: This keeps unnamed uniform blocks. If `false`, UBOs will have a temporary name assigned to them. If `true`, in WebGL 1, this will turn the members of unnamed uniform buffers into global uniforms. Defaults to `true`.
  - `removeAttributeLayouts`: (WebGL2 only) Strips layout information from vertex attributes. This is useful when you've defined more attributes than supported (Depending on `gl.MAX_VERTEX_ATTRIBS`) but not all of them are used. Defaults to `false`.

## Generating Spir-V

You need `glslangValidator`, available in the [Vulkan SDK](https://www.lunarg.com/vulkan-sdk/) to convert shader code to Spir-V bytecode. 
You can use whatever source language is supported, but results when compiling to WebGL may vary depending on the language and version. 
I've had the best results using GLSL ES 3.1 (`#version 310 es`), using the following settings:

```
glslangValidator some.frag.glsl -o some.frag.spv -e main -G -v --auto-map-locations -S frag
```

## Building

If, for some reason, you need to run a custom build, run:

```
npm install
npm run build
```

## What's next?

There are still a couple of features I want to prioritize, such as:
- Providing a list of available extensions and optionally emitting fallbacks (for example: texture2DLod -> texture2D) if a feature is not supported.
- Prune the library code for unsupported features for smaller build sizes.
- At some point... WebGPU support.