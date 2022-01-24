#version 100

struct HX_VertexData
{
    vec3 worldPos;
    vec4 outPos;
};

#ifndef SPIRV_CROSS_CONSTANT_ID_151
#define SPIRV_CROSS_CONSTANT_ID_151 false
#endif
const bool HX_USE_INSTANCING = SPIRV_CROSS_CONSTANT_ID_151;
#ifndef SPIRV_CROSS_CONSTANT_ID_140
#define SPIRV_CROSS_CONSTANT_ID_140 false
#endif
const bool HX_USE_SKINNING = SPIRV_CROSS_CONSTANT_ID_140;
#ifndef SPIRV_CROSS_CONSTANT_ID_141
#define SPIRV_CROSS_CONSTANT_ID_141 true
#endif
const bool HX_USE_SKINNING_TEXTURE = SPIRV_CROSS_CONSTANT_ID_141;
#ifndef SPIRV_CROSS_CONSTANT_ID_143
#define SPIRV_CROSS_CONSTANT_ID_143 0.005235602147877216339111328125
#endif
const float HX_SKELETON_PIXEL_SIZE = SPIRV_CROSS_CONSTANT_ID_143;
#ifndef SPIRV_CROSS_CONSTANT_ID_142
#define SPIRV_CROSS_CONSTANT_ID_142 64
#endif
const int HX_MAX_SKELETON_JOINTS = SPIRV_CROSS_CONSTANT_ID_142;
const int _176 = (HX_MAX_SKELETON_JOINTS * 3);
#ifndef SPIRV_CROSS_CONSTANT_ID_0
#define SPIRV_CROSS_CONSTANT_ID_0 false
#endif
const bool USE_UV_0 = SPIRV_CROSS_CONSTANT_ID_0;
#ifndef SPIRV_CROSS_CONSTANT_ID_1
#define SPIRV_CROSS_CONSTANT_ID_1 false
#endif
const bool USE_UV_1 = SPIRV_CROSS_CONSTANT_ID_1;
#ifndef SPIRV_CROSS_CONSTANT_ID_144
#define SPIRV_CROSS_CONSTANT_ID_144 false
#endif
const bool HX_USE_MORPHING = SPIRV_CROSS_CONSTANT_ID_144;
#ifndef SPIRV_CROSS_CONSTANT_ID_146
#define SPIRV_CROSS_CONSTANT_ID_146 4
#endif
const int HX_MAX_MORPH_TARGETS = SPIRV_CROSS_CONSTANT_ID_146;
const bool _265 = (HX_MAX_MORPH_TARGETS > 0);
const bool _292 = (HX_MAX_MORPH_TARGETS > 1);
const bool _309 = (HX_MAX_MORPH_TARGETS > 2);
const bool _326 = (HX_MAX_MORPH_TARGETS > 3);
const bool _344 = (HX_MAX_MORPH_TARGETS > 4);
const bool _362 = (HX_MAX_MORPH_TARGETS > 5);
const bool _380 = (HX_MAX_MORPH_TARGETS > 6);
const bool _398 = (HX_MAX_MORPH_TARGETS > 7);
#ifndef SPIRV_CROSS_CONSTANT_ID_128
#define SPIRV_CROSS_CONSTANT_ID_128 1
#endif
const int HX_GAMMA_CORRECTION_MODE = SPIRV_CROSS_CONSTANT_ID_128;
#ifndef SPIRV_CROSS_CONSTANT_ID_129
#define SPIRV_CROSS_CONSTANT_ID_129 false
#endif
const bool HX_FLOAT_TEXTURES = SPIRV_CROSS_CONSTANT_ID_129;
#ifndef SPIRV_CROSS_CONSTANT_ID_130
#define SPIRV_CROSS_CONSTANT_ID_130 false
#endif
const bool HX_FLOAT_FBOS = SPIRV_CROSS_CONSTANT_ID_130;
#ifndef SPIRV_CROSS_CONSTANT_ID_131
#define SPIRV_CROSS_CONSTANT_ID_131 false
#endif
const bool HX_HALF_FLOAT_FBOS = SPIRV_CROSS_CONSTANT_ID_131;
#ifndef SPIRV_CROSS_CONSTANT_ID_132
#define SPIRV_CROSS_CONSTANT_ID_132 false
#endif
const bool HX_POST_PROCESS = SPIRV_CROSS_CONSTANT_ID_132;
#ifndef SPIRV_CROSS_CONSTANT_ID_133
#define SPIRV_CROSS_CONSTANT_ID_133 false
#endif
const bool HX_MOTION_VECTOR_TEXTURE = SPIRV_CROSS_CONSTANT_ID_133;
#ifndef SPIRV_CROSS_CONSTANT_ID_145
#define SPIRV_CROSS_CONSTANT_ID_145 false
#endif
const bool HX_USE_MORPH_NORMALS = SPIRV_CROSS_CONSTANT_ID_145;
#ifndef SPIRV_CROSS_CONSTANT_ID_150
#define SPIRV_CROSS_CONSTANT_ID_150 false
#endif
const bool HX_USE_SSAO = SPIRV_CROSS_CONSTANT_ID_150;
#ifndef SPIRV_CROSS_CONSTANT_ID_160
#define SPIRV_CROSS_CONSTANT_ID_160 0
#endif
const int HX_TRANSLUCENCY_MODE = SPIRV_CROSS_CONSTANT_ID_160;
#ifndef SPIRV_CROSS_CONSTANT_ID_10
#define SPIRV_CROSS_CONSTANT_ID_10 false
#endif
const bool USE_MAP_colorMap = SPIRV_CROSS_CONSTANT_ID_10;
#ifndef SPIRV_CROSS_CONSTANT_ID_11
#define SPIRV_CROSS_CONSTANT_ID_11 false
#endif
const bool USE_MAP_specularMap = SPIRV_CROSS_CONSTANT_ID_11;
#ifndef SPIRV_CROSS_CONSTANT_ID_12
#define SPIRV_CROSS_CONSTANT_ID_12 false
#endif
const bool USE_MAP_normalMap = SPIRV_CROSS_CONSTANT_ID_12;
#ifndef SPIRV_CROSS_CONSTANT_ID_13
#define SPIRV_CROSS_CONSTANT_ID_13 false
#endif
const bool USE_MAP_emissiveMap = SPIRV_CROSS_CONSTANT_ID_13;
#ifndef SPIRV_CROSS_CONSTANT_ID_14
#define SPIRV_CROSS_CONSTANT_ID_14 false
#endif
const bool USE_MAP_occlusionMap = SPIRV_CROSS_CONSTANT_ID_14;
#ifndef SPIRV_CROSS_CONSTANT_ID_20
#define SPIRV_CROSS_CONSTANT_ID_20 0
#endif
const int UV_colorMap = SPIRV_CROSS_CONSTANT_ID_20;
#ifndef SPIRV_CROSS_CONSTANT_ID_21
#define SPIRV_CROSS_CONSTANT_ID_21 0
#endif
const int UV_specularMap = SPIRV_CROSS_CONSTANT_ID_21;
#ifndef SPIRV_CROSS_CONSTANT_ID_22
#define SPIRV_CROSS_CONSTANT_ID_22 0
#endif
const int UV_normalMap = SPIRV_CROSS_CONSTANT_ID_22;
#ifndef SPIRV_CROSS_CONSTANT_ID_23
#define SPIRV_CROSS_CONSTANT_ID_23 0
#endif
const int UV_emissiveMap = SPIRV_CROSS_CONSTANT_ID_23;
#ifndef SPIRV_CROSS_CONSTANT_ID_24
#define SPIRV_CROSS_CONSTANT_ID_24 0
#endif
const int UV_occlusionMap = SPIRV_CROSS_CONSTANT_ID_24;
#ifndef SPIRV_CROSS_CONSTANT_ID_30
#define SPIRV_CROSS_CONSTANT_ID_30 0
#endif
const int SPECULAR_MAP_MODE = SPIRV_CROSS_CONSTANT_ID_30;
#ifndef SPIRV_CROSS_CONSTANT_ID_31
#define SPIRV_CROSS_CONSTANT_ID_31 false
#endif
const bool DOUBLE_SIDED = SPIRV_CROSS_CONSTANT_ID_31;
#ifndef SPIRV_CROSS_CONSTANT_ID_32
#define SPIRV_CROSS_CONSTANT_ID_32 false
#endif
const bool USE_ALPHA_THRESHOLD = SPIRV_CROSS_CONSTANT_ID_32;
#ifndef SPIRV_CROSS_CONSTANT_ID_33
#define SPIRV_CROSS_CONSTANT_ID_33 0
#endif
const int NORMAL_MAP_MODE = SPIRV_CROSS_CONSTANT_ID_33;

struct hx_entity
{
    mat4 hx_bindShapeMatrix;
    mat4 hx_bindShapeMatrixInverse;
    mat4 hx_worldMatrix;
    mat4 hx_motionMatrix;
    mat3 hx_normalMatrix;
    vec3 hx_minBound;
    vec3 hx_maxBound;
};

uniform hx_entity _72;

struct hx_skinning
{
    vec4 hx_skinningMatrices[_176];
};

uniform hx_skinning _180;

struct hx_morphing
{
    vec4 hx_morphWeights[2];
};

uniform hx_morphing _276;

struct hx_camera
{
    mat4 hx_cameraWorldMatrix;
    mat4 hx_viewMatrix;
    mat4 hx_projectionMatrix;
    mat4 hx_viewProjectionMatrix;
    mat4 hx_inverseProjectionMatrix;
    mat4 hx_prevViewProjectionMatrix;
    vec4 hx_renderTargetSize;
    vec4 hx_cameraPlaneInfo;
    vec3 hx_cameraWorldPosition;
    vec2 hx_cameraJitter;
};

uniform hx_camera _442;

struct hx_const
{
    vec2 hx_poissonDisk[32];
};

uniform hx_const _477;

struct hx_scene
{
    vec3 hx_ambientColor;
};

uniform hx_scene _480;

uniform mediump sampler2D hx_skinningTexture;

attribute vec4 hx_instanceMatrix0;
attribute vec4 hx_instanceMatrix1;
attribute vec4 hx_instanceMatrix2;
attribute vec4 hx_position;
varying vec2 uv0;
attribute vec2 hx_texCoord;
varying vec2 uv1;
attribute vec2 hx_texCoord1;
attribute vec3 hx_morph0;
attribute vec3 hx_morph1;
attribute vec3 hx_morph2;
attribute vec3 hx_morph3;
attribute vec3 hx_morph4;
attribute vec3 hx_morph5;
attribute vec3 hx_morph6;
attribute vec3 hx_morph7;
attribute vec4 hx_jointWeights;
attribute vec4 hx_jointIndices;
attribute vec3 hx_normal;
attribute vec4 hx_tangent;
attribute float hx_instanceID;
varying vec2 uv2;

mat4 hx_getSkinningMatrix(vec4 weights, vec4 indices)
{
    mat4 mat = mat4(vec4(0.0), vec4(0.0), vec4(0.0), vec4(0.0, 0.0, 0.0, 1.0));
    if (HX_USE_SKINNING)
    {
        if (HX_USE_SKINNING_TEXTURE)
        {
            for (int i = 0; i < 4; i++)
            {
                float index = (indices[i] * HX_SKELETON_PIXEL_SIZE) * 3.0;
                mat[0] += (texture2DLod(hx_skinningTexture, vec2(index, 0.0), 0.0) * weights[i]);
                mat[1] += (texture2DLod(hx_skinningTexture, vec2(index + HX_SKELETON_PIXEL_SIZE, 0.0), 0.0) * weights[i]);
                mat[2] += (texture2DLod(hx_skinningTexture, vec2(index + (2.0 * HX_SKELETON_PIXEL_SIZE), 0.0), 0.0) * weights[i]);
            }
        }
        else
        {
            vec4 indices_1 = indices * 3.0;
            for (int i_1 = 0; i_1 < 4; i_1++)
            {
                mat[0] += (_180.hx_skinningMatrices[int(indices_1[i_1])] * weights[i_1]);
                mat[1] += (_180.hx_skinningMatrices[int(indices_1[i_1]) + 1] * weights[i_1]);
                mat[2] += (_180.hx_skinningMatrices[int(indices_1[i_1]) + 2] * weights[i_1]);
            }
        }
    }
    return mat;
}

vec4 hx_applySkinning(vec4 pos, mat4 skinningMatrix)
{
    if (HX_USE_SKINNING)
    {
        return _72.hx_bindShapeMatrixInverse * ((_72.hx_bindShapeMatrix * pos) * skinningMatrix);
    }
    else
    {
        return pos;
    }
}

vec4 hx_objectToWorld(inout vec4 pos)
{
    if (HX_USE_INSTANCING)
    {
        mat4 instanceMatrix = mat4(vec4(hx_instanceMatrix0), vec4(hx_instanceMatrix1), vec4(hx_instanceMatrix2), vec4(0.0, 0.0, 0.0, 1.0));
        pos *= instanceMatrix;
    }
    return _72.hx_worldMatrix * pos;
}

HX_VertexData hx_vertexData()
{
    vec4 position = hx_position;
    if (USE_UV_0)
    {
        uv0 = hx_texCoord;
    }
    if (USE_UV_1)
    {
        uv1 = hx_texCoord1;
    }
    if (HX_USE_MORPHING)
    {
        if (_265)
        {
            vec4 _282 = position;
            vec3 _284 = _282.xyz + (hx_morph0 * _276.hx_morphWeights[0].x);
            position.x = _284.x;
            position.y = _284.y;
            position.z = _284.z;
        }
        if (_292)
        {
            vec4 _300 = position;
            vec3 _302 = _300.xyz + (hx_morph1 * _276.hx_morphWeights[0].y);
            position.x = _302.x;
            position.y = _302.y;
            position.z = _302.z;
        }
        if (_309)
        {
            vec4 _317 = position;
            vec3 _319 = _317.xyz + (hx_morph2 * _276.hx_morphWeights[0].z);
            position.x = _319.x;
            position.y = _319.y;
            position.z = _319.z;
        }
        if (_326)
        {
            vec4 _335 = position;
            vec3 _337 = _335.xyz + (hx_morph3 * _276.hx_morphWeights[0].w);
            position.x = _337.x;
            position.y = _337.y;
            position.z = _337.z;
        }
        if (_344)
        {
            vec4 _352 = position;
            vec3 _354 = _352.xyz + (hx_morph4 * _276.hx_morphWeights[1].x);
            position.x = _354.x;
            position.y = _354.y;
            position.z = _354.z;
        }
        if (_362)
        {
            vec4 _370 = position;
            vec3 _372 = _370.xyz + (hx_morph5 * _276.hx_morphWeights[1].y);
            position.x = _372.x;
            position.y = _372.y;
            position.z = _372.z;
        }
        if (_380)
        {
            vec4 _388 = position;
            vec3 _390 = _388.xyz + (hx_morph6 * _276.hx_morphWeights[1].z);
            position.x = _390.x;
            position.y = _390.y;
            position.z = _390.z;
        }
        if (_398)
        {
            vec4 _406 = position;
            vec3 _408 = _406.xyz + (hx_morph7 * _276.hx_morphWeights[1].w);
            position.x = _408.x;
            position.y = _408.y;
            position.z = _408.z;
        }
    }
    if (HX_USE_SKINNING)
    {
        vec4 param = hx_jointWeights;
        vec4 param_1 = hx_jointIndices;
        mat4 skinningMatrix = hx_getSkinningMatrix(param, param_1);
        vec4 param_2 = position;
        mat4 param_3 = skinningMatrix;
        position = hx_applySkinning(param_2, param_3);
    }
    vec4 param_4 = position;
    vec4 _433 = hx_objectToWorld(param_4);
    vec4 worldPos = _433;
    HX_VertexData data;
    data.worldPos = worldPos.xyz;
    data.outPos = _442.hx_viewProjectionMatrix * worldPos;
    return data;
}

void main()
{
    HX_VertexData _452 = hx_vertexData();
    HX_VertexData data = _452;
    gl_Position = data.outPos;
}

