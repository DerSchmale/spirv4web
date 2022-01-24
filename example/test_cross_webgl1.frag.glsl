#version 100
precision mediump float;
precision highp int;

struct HX_FragmentData
{
    highp vec4 color;
    highp vec3 normal;
    highp vec3 emissive;
    highp vec3 translucency;
    highp float scattering;
    highp float f0;
    highp float roughness;
    highp float metallicness;
    highp float occlusion;
};

#ifndef SPIRV_CROSS_CONSTANT_ID_128
#define SPIRV_CROSS_CONSTANT_ID_128 1
#endif
const int HX_GAMMA_CORRECTION_MODE = SPIRV_CROSS_CONSTANT_ID_128;
const bool _36 = (HX_GAMMA_CORRECTION_MODE == 1);
const bool _44 = (HX_GAMMA_CORRECTION_MODE == 2);
const bool _81 = (HX_GAMMA_CORRECTION_MODE == 1);
const bool _87 = (HX_GAMMA_CORRECTION_MODE == 2);
#ifndef SPIRV_CROSS_CONSTANT_ID_132
#define SPIRV_CROSS_CONSTANT_ID_132 false
#endif
const bool HX_POST_PROCESS = SPIRV_CROSS_CONSTANT_ID_132;
#ifndef SPIRV_CROSS_CONSTANT_ID_10
#define SPIRV_CROSS_CONSTANT_ID_10 false
#endif
const bool USE_MAP_colorMap = SPIRV_CROSS_CONSTANT_ID_10;
#ifndef SPIRV_CROSS_CONSTANT_ID_20
#define SPIRV_CROSS_CONSTANT_ID_20 0
#endif
const int UV_colorMap = SPIRV_CROSS_CONSTANT_ID_20;
const bool _146 = (UV_colorMap == 1);
#ifndef SPIRV_CROSS_CONSTANT_ID_15
#define SPIRV_CROSS_CONSTANT_ID_15 false
#endif
const bool USE_MAP_maskMap = SPIRV_CROSS_CONSTANT_ID_15;
#ifndef SPIRV_CROSS_CONSTANT_ID_25
#define SPIRV_CROSS_CONSTANT_ID_25 0
#endif
const int UV_maskMap = SPIRV_CROSS_CONSTANT_ID_25;
const bool _174 = (UV_maskMap == 1);
#ifndef SPIRV_CROSS_CONSTANT_ID_32
#define SPIRV_CROSS_CONSTANT_ID_32 false
#endif
const bool USE_ALPHA_THRESHOLD = SPIRV_CROSS_CONSTANT_ID_32;
#ifndef SPIRV_CROSS_CONSTANT_ID_11
#define SPIRV_CROSS_CONSTANT_ID_11 false
#endif
const bool USE_MAP_specularMap = SPIRV_CROSS_CONSTANT_ID_11;
#ifndef SPIRV_CROSS_CONSTANT_ID_30
#define SPIRV_CROSS_CONSTANT_ID_30 0
#endif
const int SPECULAR_MAP_MODE = SPIRV_CROSS_CONSTANT_ID_30;
const bool _221 = (SPECULAR_MAP_MODE != 0);
const bool _222 = (USE_MAP_specularMap && _221);
#ifndef SPIRV_CROSS_CONSTANT_ID_21
#define SPIRV_CROSS_CONSTANT_ID_21 0
#endif
const int UV_specularMap = SPIRV_CROSS_CONSTANT_ID_21;
const bool _229 = (UV_specularMap == 1);
const bool _241 = (SPECULAR_MAP_MODE > 1);
const bool _252 = (SPECULAR_MAP_MODE == 3);
#ifndef SPIRV_CROSS_CONSTANT_ID_13
#define SPIRV_CROSS_CONSTANT_ID_13 false
#endif
const bool USE_MAP_emissiveMap = SPIRV_CROSS_CONSTANT_ID_13;
#ifndef SPIRV_CROSS_CONSTANT_ID_23
#define SPIRV_CROSS_CONSTANT_ID_23 0
#endif
const int UV_emissiveMap = SPIRV_CROSS_CONSTANT_ID_23;
const bool _282 = (UV_emissiveMap == 1);
#ifndef SPIRV_CROSS_CONSTANT_ID_14
#define SPIRV_CROSS_CONSTANT_ID_14 false
#endif
const bool USE_MAP_occlusionMap = SPIRV_CROSS_CONSTANT_ID_14;
#ifndef SPIRV_CROSS_CONSTANT_ID_24
#define SPIRV_CROSS_CONSTANT_ID_24 0
#endif
const int UV_occlusionMap = SPIRV_CROSS_CONSTANT_ID_24;
const bool _305 = (UV_occlusionMap == 1);
#ifndef SPIRV_CROSS_CONSTANT_ID_16
#define SPIRV_CROSS_CONSTANT_ID_16 false
#endif
const bool USE_MAP_lightMap = SPIRV_CROSS_CONSTANT_ID_16;
#ifndef SPIRV_CROSS_CONSTANT_ID_26
#define SPIRV_CROSS_CONSTANT_ID_26 0
#endif
const int UV_lightMap = SPIRV_CROSS_CONSTANT_ID_26;
const bool _329 = (UV_lightMap == 1);
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
#ifndef SPIRV_CROSS_CONSTANT_ID_133
#define SPIRV_CROSS_CONSTANT_ID_133 false
#endif
const bool HX_MOTION_VECTOR_TEXTURE = SPIRV_CROSS_CONSTANT_ID_133;
#ifndef SPIRV_CROSS_CONSTANT_ID_140
#define SPIRV_CROSS_CONSTANT_ID_140 false
#endif
const bool HX_USE_SKINNING = SPIRV_CROSS_CONSTANT_ID_140;
#ifndef SPIRV_CROSS_CONSTANT_ID_141
#define SPIRV_CROSS_CONSTANT_ID_141 true
#endif
const bool HX_USE_SKINNING_TEXTURE = SPIRV_CROSS_CONSTANT_ID_141;
#ifndef SPIRV_CROSS_CONSTANT_ID_142
#define SPIRV_CROSS_CONSTANT_ID_142 64
#endif
const int HX_MAX_SKELETON_JOINTS = SPIRV_CROSS_CONSTANT_ID_142;
#ifndef SPIRV_CROSS_CONSTANT_ID_143
#define SPIRV_CROSS_CONSTANT_ID_143 0.005235602147877216339111328125
#endif
const float HX_SKELETON_PIXEL_SIZE = SPIRV_CROSS_CONSTANT_ID_143;
#ifndef SPIRV_CROSS_CONSTANT_ID_144
#define SPIRV_CROSS_CONSTANT_ID_144 false
#endif
const bool HX_USE_MORPHING = SPIRV_CROSS_CONSTANT_ID_144;
#ifndef SPIRV_CROSS_CONSTANT_ID_145
#define SPIRV_CROSS_CONSTANT_ID_145 false
#endif
const bool HX_USE_MORPH_NORMALS = SPIRV_CROSS_CONSTANT_ID_145;
#ifndef SPIRV_CROSS_CONSTANT_ID_146
#define SPIRV_CROSS_CONSTANT_ID_146 4
#endif
const int HX_MAX_MORPH_TARGETS = SPIRV_CROSS_CONSTANT_ID_146;
#ifndef SPIRV_CROSS_CONSTANT_ID_150
#define SPIRV_CROSS_CONSTANT_ID_150 false
#endif
const bool HX_USE_SSAO = SPIRV_CROSS_CONSTANT_ID_150;
#ifndef SPIRV_CROSS_CONSTANT_ID_151
#define SPIRV_CROSS_CONSTANT_ID_151 false
#endif
const bool HX_USE_INSTANCING = SPIRV_CROSS_CONSTANT_ID_151;
#ifndef SPIRV_CROSS_CONSTANT_ID_160
#define SPIRV_CROSS_CONSTANT_ID_160 0
#endif
const int HX_TRANSLUCENCY_MODE = SPIRV_CROSS_CONSTANT_ID_160;
#ifndef SPIRV_CROSS_CONSTANT_ID_0
#define SPIRV_CROSS_CONSTANT_ID_0 false
#endif
const bool USE_UV_0 = SPIRV_CROSS_CONSTANT_ID_0;
#ifndef SPIRV_CROSS_CONSTANT_ID_1
#define SPIRV_CROSS_CONSTANT_ID_1 false
#endif
const bool USE_UV_1 = SPIRV_CROSS_CONSTANT_ID_1;
#ifndef SPIRV_CROSS_CONSTANT_ID_12
#define SPIRV_CROSS_CONSTANT_ID_12 false
#endif
const bool USE_MAP_normalMap = SPIRV_CROSS_CONSTANT_ID_12;
#ifndef SPIRV_CROSS_CONSTANT_ID_22
#define SPIRV_CROSS_CONSTANT_ID_22 0
#endif
const int UV_normalMap = SPIRV_CROSS_CONSTANT_ID_22;
#ifndef SPIRV_CROSS_CONSTANT_ID_31
#define SPIRV_CROSS_CONSTANT_ID_31 false
#endif
const bool DOUBLE_SIDED = SPIRV_CROSS_CONSTANT_ID_31;
#ifndef SPIRV_CROSS_CONSTANT_ID_33
#define SPIRV_CROSS_CONSTANT_ID_33 0
#endif
const int NORMAL_MAP_MODE = SPIRV_CROSS_CONSTANT_ID_33;
#ifndef SPIRV_CROSS_CONSTANT_ID_200
#define SPIRV_CROSS_CONSTANT_ID_200 1
#endif
const int HX_NUM_DIR_LIGHTS = SPIRV_CROSS_CONSTANT_ID_200;
#ifndef SPIRV_CROSS_CONSTANT_ID_201
#define SPIRV_CROSS_CONSTANT_ID_201 1
#endif
const int HX_NUM_DIR_LIGHTS_BUFF = SPIRV_CROSS_CONSTANT_ID_201;
#ifndef SPIRV_CROSS_CONSTANT_ID_202
#define SPIRV_CROSS_CONSTANT_ID_202 1
#endif
const int HX_NUM_POINT_LIGHTS = SPIRV_CROSS_CONSTANT_ID_202;
#ifndef SPIRV_CROSS_CONSTANT_ID_203
#define SPIRV_CROSS_CONSTANT_ID_203 1
#endif
const int HX_NUM_POINT_LIGHTS_BUFF = SPIRV_CROSS_CONSTANT_ID_203;
#ifndef SPIRV_CROSS_CONSTANT_ID_204
#define SPIRV_CROSS_CONSTANT_ID_204 1
#endif
const int HX_NUM_SPOT_LIGHTS = SPIRV_CROSS_CONSTANT_ID_204;
#ifndef SPIRV_CROSS_CONSTANT_ID_205
#define SPIRV_CROSS_CONSTANT_ID_205 1
#endif
const int HX_NUM_SPOT_LIGHTS_BUFF = SPIRV_CROSS_CONSTANT_ID_205;
#ifndef SPIRV_CROSS_CONSTANT_ID_206
#define SPIRV_CROSS_CONSTANT_ID_206 3
#endif
const int HX_NUM_SHADOW_CASCADES = SPIRV_CROSS_CONSTANT_ID_206;
#ifndef SPIRV_CROSS_CONSTANT_ID_207
#define SPIRV_CROSS_CONSTANT_ID_207 0
#endif
const int HX_OCCLUDE_SPECULAR = SPIRV_CROSS_CONSTANT_ID_207;
#ifndef SPIRV_CROSS_CONSTANT_ID_220
#define SPIRV_CROSS_CONSTANT_ID_220 false
#endif
const bool HX_USE_IRRADIANCE_PROBES = SPIRV_CROSS_CONSTANT_ID_220;
#ifndef SPIRV_CROSS_CONSTANT_ID_221
#define SPIRV_CROSS_CONSTANT_ID_221 1
#endif
const int HX_NUM_PROBES_X = SPIRV_CROSS_CONSTANT_ID_221;
#ifndef SPIRV_CROSS_CONSTANT_ID_222
#define SPIRV_CROSS_CONSTANT_ID_222 1
#endif
const int HX_NUM_PROBES_Y = SPIRV_CROSS_CONSTANT_ID_222;
#ifndef SPIRV_CROSS_CONSTANT_ID_223
#define SPIRV_CROSS_CONSTANT_ID_223 1
#endif
const int HX_NUM_PROBES_Z = SPIRV_CROSS_CONSTANT_ID_223;
#ifndef SPIRV_CROSS_CONSTANT_ID_224
#define SPIRV_CROSS_CONSTANT_ID_224 9
#endif
const int HX_PROBE_UNIF_LEN = SPIRV_CROSS_CONSTANT_ID_224;
#ifndef SPIRV_CROSS_CONSTANT_ID_225
#define SPIRV_CROSS_CONSTANT_ID_225 false
#endif
const bool HX_USE_RADIANCE_PROBES = SPIRV_CROSS_CONSTANT_ID_225;
#ifndef SPIRV_CROSS_CONSTANT_ID_180
#define SPIRV_CROSS_CONSTANT_ID_180 0
#endif
const int HX_SHADOW_MAP_MODE = SPIRV_CROSS_CONSTANT_ID_180;
#ifndef SPIRV_CROSS_CONSTANT_ID_181
#define SPIRV_CROSS_CONSTANT_ID_181 0.00999999977648258209228515625
#endif
const float HX_SHADOW_SOFTNESS = SPIRV_CROSS_CONSTANT_ID_181;
#ifndef SPIRV_CROSS_CONSTANT_ID_182
#define SPIRV_CROSS_CONSTANT_ID_182 6
#endif
const int HX_NUM_PCF_SAMPLES = SPIRV_CROSS_CONSTANT_ID_182;
#ifndef SPIRV_CROSS_CONSTANT_ID_183
#define SPIRV_CROSS_CONSTANT_ID_183 false
#endif
const bool HX_PCF_DITHER_SHADOWS = SPIRV_CROSS_CONSTANT_ID_183;
#ifndef SPIRV_CROSS_CONSTANT_ID_184
#define SPIRV_CROSS_CONSTANT_ID_184 9.9999997473787516355514526367188e-06
#endif
const float HX_VSM_MIN_VARIANCE = SPIRV_CROSS_CONSTANT_ID_184;
#ifndef SPIRV_CROSS_CONSTANT_ID_185
#define SPIRV_CROSS_CONSTANT_ID_185 0.100000001490116119384765625
#endif
const float HX_VSM_LIGHT_BLEED_REDUCTION = SPIRV_CROSS_CONSTANT_ID_185;
#ifndef SPIRV_CROSS_CONSTANT_ID_186
#define SPIRV_CROSS_CONSTANT_ID_186 80.0
#endif
const float HX_ESM_CONSTANT = SPIRV_CROSS_CONSTANT_ID_186;
#ifndef SPIRV_CROSS_CONSTANT_ID_187
#define SPIRV_CROSS_CONSTANT_ID_187 0.3499999940395355224609375
#endif
const float HX_ESM_DARKENING = SPIRV_CROSS_CONSTANT_ID_187;

struct hx_const
{
    highp vec2 hx_poissonDisk[32];
};

uniform hx_const _397;

struct hx_scene
{
    highp vec3 hx_ambientColor;
};

uniform hx_scene _400;

struct hx_camera
{
    highp mat4 hx_cameraWorldMatrix;
    highp mat4 hx_viewMatrix;
    highp mat4 hx_projectionMatrix;
    highp mat4 hx_viewProjectionMatrix;
    highp mat4 hx_inverseProjectionMatrix;
    highp mat4 hx_prevViewProjectionMatrix;
    highp vec4 hx_renderTargetSize;
    highp vec4 hx_cameraPlaneInfo;
    highp vec3 hx_cameraWorldPosition;
    highp vec2 hx_cameraJitter;
};

uniform hx_camera _404;

struct hx_entity
{
    highp mat4 hx_bindShapeMatrix;
    highp mat4 hx_bindShapeMatrixInverse;
    highp mat4 hx_worldMatrix;
    highp mat4 hx_motionMatrix;
    highp mat3 hx_normalMatrix;
    highp vec3 hx_minBound;
    highp vec3 hx_maxBound;
};

uniform hx_entity _408;

uniform highp vec4 color;
uniform mediump sampler2D colorMap;
uniform highp vec2 colorMapOffsetUV;
uniform highp vec2 colorMapScaleUV;
uniform mediump sampler2D maskMap;
uniform highp vec2 maskMapOffsetUV;
uniform highp vec2 maskMapScaleUV;
uniform highp float alphaThreshold;
uniform highp float roughness;
uniform highp float f0;
uniform highp float metallicness;
uniform mediump sampler2D specularMap;
uniform highp vec2 specularMapOffsetUV;
uniform highp vec2 specularMapScaleUV;
uniform highp float roughnessMapRange;
uniform highp vec3 emissiveColor;
uniform mediump sampler2D emissiveMap;
uniform highp vec2 emissiveMapOffsetUV;
uniform highp vec2 emissiveMapScaleUV;
uniform mediump sampler2D occlusionMap;
uniform highp vec2 occlusionMapOffsetUV;
uniform highp vec2 occlusionMapScaleUV;
uniform mediump sampler2D lightMap;
uniform highp vec2 lightMapOffsetUV;
uniform highp vec2 lightMapScaleUV;
uniform mediump sampler2D hx_dither2D;
uniform mediump sampler2D hx_shadowMap;

varying highp vec2 uv1;
varying highp vec2 uv0;

HX_FragmentData hx_fragmentData()
{
    HX_FragmentData data;
    data.color = color;
    if (USE_MAP_colorMap)
    {
        bvec2 _154 = bvec2(_146);
        data.color *= texture2D(colorMap, (vec2(_154.x ? uv1.x : uv0.x, _154.y ? uv1.y : uv0.y) + colorMapOffsetUV) * colorMapScaleUV);
    }
    if (USE_MAP_maskMap)
    {
        bvec2 _177 = bvec2(_174);
        data.color.w *= texture2D(maskMap, (vec2(_177.x ? uv1.x : uv0.x, _177.y ? uv1.y : uv0.y) + maskMapOffsetUV) * maskMapScaleUV).x;
    }
    if (USE_ALPHA_THRESHOLD)
    {
        if (data.color.w < alphaThreshold)
        {
            discard;
        }
    }
    data.occlusion = 1.0;
    data.roughness = roughness;
    data.f0 = f0;
    data.metallicness = metallicness;
    if (_222)
    {
        bvec2 _232 = bvec2(_229);
        highp vec4 specSample = texture2D(specularMap, (vec2(_232.x ? uv1.x : uv0.x, _232.y ? uv1.y : uv0.y) + specularMapOffsetUV) * specularMapScaleUV);
        if (_241)
        {
            data.metallicness *= specSample.y;
        }
        else
        {
            if (_252)
            {
                data.f0 *= specSample.x;
            }
        }
        data.roughness += ((specSample.z - 0.5) * roughnessMapRange);
    }
    data.emissive = emissiveColor;
    if (USE_MAP_emissiveMap)
    {
        bvec2 _285 = bvec2(_282);
        data.emissive *= texture2D(emissiveMap, (vec2(_285.x ? uv1.x : uv0.x, _285.y ? uv1.y : uv0.y) + emissiveMapOffsetUV) * emissiveMapScaleUV).xyz;
    }
    if (USE_MAP_occlusionMap)
    {
        bvec2 _308 = bvec2(_305);
        data.occlusion *= texture2D(occlusionMap, (vec2(_308.x ? uv1.x : uv0.x, _308.y ? uv1.y : uv0.y) + occlusionMapOffsetUV) * occlusionMapScaleUV).x;
    }
    if (USE_MAP_lightMap)
    {
        bvec2 _332 = bvec2(_329);
        highp vec4 lightMapVal = texture2D(lightMap, (vec2(_332.x ? uv1.x : uv0.x, _332.y ? uv1.y : uv0.y) + lightMapOffsetUV) * lightMapScaleUV);
        data.emissive += (data.color.xyz * lightMapVal.xyz);
    }
    return data;
}

highp vec3 hx_gammaToLinear(inout highp vec3 color_1)
{
    if (_36)
    {
        color_1 *= color_1;
    }
    else
    {
        if (_44)
        {
            color_1.x = pow(color_1.x, 2.2000000476837158203125);
            color_1.y = pow(color_1.y, 2.2000000476837158203125);
            color_1.z = pow(color_1.z, 2.2000000476837158203125);
        }
    }
    return color_1;
}

highp vec4 hx_gammaToLinear(inout highp vec4 color_1)
{
    highp vec3 param = color_1.xyz;
    highp vec3 _71 = hx_gammaToLinear(param);
    color_1.x = _71.x;
    color_1.y = _71.y;
    color_1.z = _71.z;
    return color_1;
}

highp vec3 hx_linearToGamma(inout highp vec3 color_1)
{
    if (_81)
    {
        color_1 = sqrt(color_1);
    }
    else
    {
        if (_87)
        {
            color_1.x = pow(color_1.x, 0.4545449912548065185546875);
            color_1.y = pow(color_1.y, 0.4545449912548065185546875);
            color_1.z = pow(color_1.z, 0.4545449912548065185546875);
        }
    }
    return color_1;
}

highp vec4 hx_linearToGamma(inout highp vec4 color_1)
{
    highp vec3 param = color_1.xyz;
    highp vec3 _109 = hx_linearToGamma(param);
    color_1.x = _109.x;
    color_1.y = _109.y;
    color_1.z = _109.z;
    return color_1;
}

highp vec4 hx_linearToScreen(highp vec4 color_1)
{
    if (HX_POST_PROCESS)
    {
        return color_1;
    }
    else
    {
        highp vec4 param = color_1;
        highp vec4 _127 = hx_linearToGamma(param);
        return _127;
    }
}

void main()
{
    HX_FragmentData _355 = hx_fragmentData();
    HX_FragmentData data = _355;
    highp vec4 param = data.color;
    highp vec4 _361 = hx_gammaToLinear(param);
    gl_FragData[0] = _361;
    highp vec3 param_1 = data.emissive;
    highp vec3 _365 = hx_gammaToLinear(param_1);
    highp vec4 _366 = gl_FragData[0];
    highp vec3 _368 = _366.xyz + _365;
    gl_FragData[0].x = _368.x;
    gl_FragData[0].y = _368.y;
    gl_FragData[0].z = _368.z;
    highp vec4 param_2 = gl_FragData[0];
    gl_FragData[0] = hx_linearToScreen(param_2);
}

