glslangValidator test.vert.glsl -o test.vert.spv -e main -G -v --auto-map-locations -S vert
glslangValidator test.frag.glsl -o test.frag.spv -e main -G -v --auto-map-locations -S frag

spirv-cross test.vert.spv --output test_cross_webgl1.vert.glsl --version 100 --es
spirv-cross test.frag.spv --output test_cross_webgl1.frag.glsl --version 100 --es

spirv-cross test.vert.spv --output test_cross_webgl2.vert.glsl --version 300 --es
spirv-cross test.frag.spv --output test_cross_webgl2.frag.glsl --version 300 --es