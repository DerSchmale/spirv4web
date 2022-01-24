#version 310 es
precision highp float;
#define HX_FRAGMENT_SHADER
#define HX_SKIP_NORMALS

#define HX_WEBGL_1 1
#define HX_STRICT_LOOPS 1
#define HX_FORCE_RGBA_TEX_CHANNELS 1
#define HX_NO_PROBE_GRIDS 1

// anything >= 128 is reserved
layout (constant_id = 128) const int HX_GAMMA_CORRECTION_MODE = 1;  // 0 = off, 1 = fast, 2 = precise
layout (constant_id = 129) const bool HX_FLOAT_TEXTURES = false;
layout (constant_id = 130) const bool HX_FLOAT_FBOS = false;
layout (constant_id = 131) const bool HX_HALF_FLOAT_FBOS = false;
layout (constant_id = 132) const bool HX_POST_PROCESS = false;
layout (constant_id = 133) const bool HX_MOTION_VECTOR_TEXTURE = false;

layout (constant_id = 140) const bool HX_USE_SKINNING = false;
layout (constant_id = 141) const bool HX_USE_SKINNING_TEXTURE = true;
layout (constant_id = 142) const int HX_MAX_SKELETON_JOINTS = 64;
//#define HX_SKELETON_PIXEL_SIZE (1.0 / float(3 * HX_MAX_SKELETON_JOINTS - 1))
layout (constant_id = 143) const float HX_SKELETON_PIXEL_SIZE = 1.0 / (3.0  * 64.0 - 1.0);
layout (constant_id = 144) const bool HX_USE_MORPHING = false;
layout (constant_id = 145) const bool HX_USE_MORPH_NORMALS = false;
layout (constant_id = 146) const int HX_MAX_MORPH_TARGETS = 4;

layout (constant_id = 150) const bool HX_USE_SSAO = false;
layout (constant_id = 151) const bool HX_USE_INSTANCING = false;

layout (constant_id = 160) const int HX_TRANSLUCENCY_MODE = 0;  // 0 = none, 1 = cheap vegetation, 2 = phase-based (= TODO)?

#ifdef HX_VERTEX_SHADER

in vec4 hx_position;
in vec3 hx_normal;
in vec4 hx_tangent;
in vec2 hx_texCoord;
in vec2 hx_texCoord1;
in vec4 hx_jointIndices;
in vec4 hx_jointWeights;

// these are the matrix ROWS
in vec4 hx_instanceMatrix0;
in vec4 hx_instanceMatrix1;
in vec4 hx_instanceMatrix2;
in float hx_instanceID;

in vec3 hx_morph0;
in vec3 hx_morph1;
in vec3 hx_morph2;
in vec3 hx_morph3;
in vec3 hx_morph4;
in vec3 hx_morph5;
in vec3 hx_morph6;
in vec3 hx_morph7;

#endif


#define HX_LOG_10 2.302585093
#define HX_PI 3.1415926
#define HX_RCP_PI 0.3183098916

// the minimum required frag data needed by the entire engine
// normal should be in view space
// TODO: Should we add the R0 factor?
#define HX_DEFAULT_FRAGMENT_DATA \
    vec4 color;\
    vec3 normal;\
    vec3 emissive;\
    vec3 translucency;\
    float scattering;\
    float f0;\
    float roughness;\
    float metallicness;\
    float occlusion;

#define HX_DEFAULT_VERTEX_DATA \
    vec3 worldPos; \
    vec4 outPos;

struct HX_Reflection {
    vec3 diffuse;
    vec3 specular;
};

// if not supported, these will be automatically injected
layout (std140, binding=0) uniform hx_const
{
    vec2 hx_poissonDisk[32];
};


layout (std140, binding=1) uniform hx_scene
{
    vec3 hx_ambientColor;
};

layout (std140, binding=2) uniform hx_camera
{
    mat4 hx_cameraWorldMatrix;
    mat4 hx_viewMatrix;
    mat4 hx_projectionMatrix;
    mat4 hx_viewProjectionMatrix;
    mat4 hx_inverseProjectionMatrix;
    mat4 hx_prevViewProjectionMatrix;
    vec4 hx_renderTargetSize; // (width, height, 1/width, 1/height)
    vec4 hx_cameraPlaneInfo; // (near, far, far - near, 1 / (far - near))
    vec3 hx_cameraWorldPosition;
    vec2 hx_cameraJitter;
};

layout (std140, binding=3) uniform hx_entity
{
    mat4 hx_bindShapeMatrix;
    mat4 hx_bindShapeMatrixInverse;
    mat4 hx_worldMatrix;
// only available when motion vectors = true
    mat4 hx_motionMatrix;
    mat3 hx_normalMatrix;
    vec3 hx_minBound;
    vec3 hx_maxBound;
};

float saturate(float v)
{
    return clamp(v, 0.0, 1.0);
}

vec2 saturate(vec2 v)
{
    return clamp(v, 0.0, 1.0);
}

vec3 saturate(vec3 v)
{
    return clamp(v, 0.0, 1.0);
}

vec4 saturate(vec4 v)
{
    return clamp(v, 0.0, 1.0);
}

// Only for 0 - 1
vec4 hx_floatToRGBA8(float value)
{
    vec4 enc = value * vec4(1.0, 255.0, 65025.0, 16581375.0);
    // cannot fract first value or 1 would not be encodable
    enc.yzw = fract(enc.yzw);
    return enc - enc.yzww * vec4(1.0/255.0, 1.0/255.0, 1.0/255.0, 0.0);
}

float hx_RGBA8ToFloat(vec4 rgba)
{
    return dot(rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0));
}

vec2 hx_floatToRG8(float value)
{
    vec2 enc = vec2(1.0, 255.0) * value;
    enc.y = fract(enc.y);
    enc.x -= enc.y / 255.0;
    return enc;
}

float hx_RG8ToFloat(vec2 rg)
{
    return dot(rg, vec2(1.0, 1.0/255.0));
}

// this results in view-space normals!
// Since we're using this for screen-space techniques, that's what we want
vec2 hx_encodeNormal(vec3 normal)
{
    vec2 data;
    float p = sqrt(-normal.y*8.0 + 8.0);
    data = normal.xz / p + .5;
    return data;
}

vec3 hx_decodeNormal(vec4 data)
{
    vec3 normal;
    data.xy = data.xy*4.0 - 2.0;
    float f = dot(data.xy, data.xy);
    float g = sqrt(1.0 - f * .25);
    normal.xz = data.xy * g;
    normal.y = -(1.0 - f * .5);
    return normal;
}

vec2 hx_decodeMotionVector(vec4 data)
{
    vec2 vel;
    vel.x = hx_RG8ToFloat(data.xy);
    vel.y = hx_RG8ToFloat(data.zw);
    return vel * 2.0 - 1.0;
}

float hx_log10(float val)
{
    return log(val) / HX_LOG_10;
}

vec3 hx_gammaToLinear(vec3 color)
{
    if (HX_GAMMA_CORRECTION_MODE == 1) {
        color.xyz *= color.xyz;
    }
    else if (HX_GAMMA_CORRECTION_MODE == 2) {
        color.x = pow(color.x, 2.2);
        color.y = pow(color.y, 2.2);
        color.z = pow(color.z, 2.2);
    }

    return color;
}

vec4 hx_gammaToLinear(vec4 color)
{
    color.xyz = hx_gammaToLinear(color.xyz);
    return color;
}

vec3 hx_linearToGamma(vec3 color)
{
    if (HX_GAMMA_CORRECTION_MODE == 1) {
        color.xyz = sqrt(color.xyz);
    }
    else if (HX_GAMMA_CORRECTION_MODE == 2) {
        color.x = pow(color.x, 0.454545);
        color.y = pow(color.y, 0.454545);
        color.z = pow(color.z, 0.454545);
    }

    return color;
}

vec4 hx_linearToGamma(vec4 color)
{
    color.xyz = hx_linearToGamma(color.xyz);
    return color;
}

// used by materials to composite
vec4 hx_linearToScreen(vec4 color)
{
    // output linear if we're performing post-processing
    if (HX_POST_PROCESS)
    return color;
    // otherwise, output gamma
    else
    return hx_linearToGamma(color);
}

float hx_decodeLinearDepth(vec4 samp)
{
    return hx_RG8ToFloat(samp.zw);
}

vec3 hx_getFrustumVector(vec2 position, mat4 unprojectionMatrix)
{
    vec4 unprojNear = unprojectionMatrix * vec4(position, -1.0, 1.0);
    vec4 unprojFar = unprojectionMatrix * vec4(position, 1.0, 1.0);
    return unprojFar.xyz/unprojFar.w - unprojNear.xyz/unprojNear.w;
}

// view vector with z = 1, so we can use nearPlaneDist + linearDepth * (farPlaneDist - nearPlaneDist) as a scale factor to find view space position
vec3 hx_getLinearDepthViewVector(vec2 position, mat4 unprojectionMatrix)
{
    vec4 unproj = unprojectionMatrix * vec4(position, 0.0, 1.0);
    unproj /= unproj.w;
    return unproj.xyz / unproj.y;
}


float hx_depthToViewY(float depth, mat4 projectionMatrix)
{
    float d = depth * 2.0 - 1.0;

    return -(d * projectionMatrix[3][3] - projectionMatrix[3][2]) /
    (d * projectionMatrix[1][3] - projectionMatrix[1][2]);
}

vec3 hx_getNormalSpecularReflectance(float metallicness, float insulatorNormalSpecularReflectance, vec3 color)
{
    return mix(vec3(insulatorNormalSpecularReflectance), color, metallicness);
}

// Schlick
vec3 hx_fresnelSchlick(vec3 f0, float lDotH)
{
    return f0 + (1.0 - f0) * pow(1.0 - lDotH, 5.0);
}

// https://seblagarde.wordpress.com/2011/08/17/hello-world/
vec3 hx_fresnelSchlickRoughness(vec3 f0, vec3 dir, vec3 normal, float roughness)
{
    float cosAngle = 1.0 - saturate(dot(normal, dir));
    // to the 5th power
    float power = pow(cosAngle, 5.0);
    float gloss = 1.0 - roughness;
    vec3 bound = max(vec3(gloss * gloss), f0);
    return f0 + (bound - f0) * power;
}


float hx_luminance(vec4 color)
{
    return dot(color.xyz, vec3(.30, 0.59, .11));
}

float hx_luminance(vec3 color)
{
    return dot(color, vec3(.30, 0.59, .11));
}

// linear variant of smoothstep
float hx_linearStep(float lower, float upper, float x)
{
    return clamp((x - lower) / (upper - lower), 0.0, 1.0);
}

vec4 hx_sampleDefaultDither(sampler2D ditherTexture, vec2 uv)
{
    vec4 s = texture(ditherTexture, uv);

    if (!HX_FLOAT_TEXTURES) {
        s = s * 2.0 - 1.0;
    }

    return s;
}

// I'm keeping this for reference, even tho it doesn't work in iOS
void hx_sumSH(in vec3 a[9], in float weight, inout vec3 b[9])
{
    // have to manually unroll this, on some platforms the loop is weirdly slow
    b[0] += a[0] * weight;
    b[1] += a[1] * weight;
    b[2] += a[2] * weight;
    b[3] += a[3] * weight;
    b[4] += a[4] * weight;
    b[5] += a[5] * weight;
    b[6] += a[6] * weight;
    b[7] += a[7] * weight;
    b[8] += a[8] * weight;
}

vec3 hx_reproject(sampler2D normalDepthBuffer, vec2 uv)
{
    vec4 normalDepth = texture(normalDepthBuffer, uv);
    float depth = hx_decodeLinearDepth(normalDepth);
    float viewY = hx_cameraPlaneInfo.x + depth * hx_cameraPlaneInfo.z;
    // unproject any point on the view ray to view space:
    vec2 ndc = uv * 2.0 - 1.0;
    // view projection matrix is jittered, so hx_inverseProjectionMatrix will "unjitter"
    // so we need to reapply the jitter to counter this
    vec3 viewDir = hx_getLinearDepthViewVector(ndc + hx_cameraJitter, hx_inverseProjectionMatrix);
    // reconstruct world position based on linear depth
    vec3 viewPos = viewDir * viewY;
    vec4 worldPos = hx_cameraWorldMatrix * vec4(viewPos, 1.0);

    // reproject with previous frame matrix
    vec4 oldProj = hx_prevViewProjectionMatrix * worldPos;
    return oldProj.xyz / oldProj.w;
}

vec3 hx_intersectCubeMap(vec3 rayOrigin, vec3 rayDir, vec3 cubeCenter, float cubeSize)
{
    vec3 relPos = rayOrigin - cubeCenter;
    vec3 t = (cubeSize * sign(rayDir) - relPos) / rayDir;
    float minT = min(min(t.x, t.y), t.z);
    return normalize(relPos + minT * rayDir);
}

    #ifdef HX_VERTEX_SHADER
mat4 hx_objectToWorldMatrix()
{
    if (HX_USE_INSTANCING) {
        mat4 instanceMatrix = mat4(hx_instanceMatrix0, hx_instanceMatrix1, hx_instanceMatrix2, vec4(0.0, 0.0, 0.0, 1.0));
        // instanceMatrix is transposed!
        return hx_worldMatrix * transpose(instanceMatrix);
    }
    return hx_worldMatrix;
}

mat3 hx_objectToWorldNormalMatrix()
{
    if (HX_USE_INSTANCING) {
        mat3 instanceMatrix = mat3(hx_instanceMatrix0, hx_instanceMatrix1, hx_instanceMatrix2);
        // instanceMatrix is transposed!
        return hx_normalMatrix * transpose(instanceMatrix);
    }
    return hx_normalMatrix;
}

vec4 hx_objectToWorld(vec4 pos)
{
    if (HX_USE_INSTANCING) {
        mat4 instanceMatrix = mat4(hx_instanceMatrix0, hx_instanceMatrix1, hx_instanceMatrix2, vec4(0.0, 0.0, 0.0, 1.0));
        // instanceMatrix is transposed, so post-multiply!
        pos = pos * instanceMatrix;
    }
    return hx_worldMatrix * pos;
}

// passing in a vec3 doesn't apply translation
vec3 hx_objectToWorld(vec3 vec)
{
    if (HX_USE_INSTANCING) {
        mat3 instanceMatrix = mat3(hx_instanceMatrix0.xyz, hx_instanceMatrix1.xyz, hx_instanceMatrix2.xyz);
        // instanceMatrix is transposed, so post-multiply!
        vec = vec * instanceMatrix;
    }
    return mat3(hx_worldMatrix) * vec;
}

vec3 hx_normalToWorld(vec3 normal)
{
    if (HX_USE_INSTANCING) {
        // does not support non-uniform transforms
        mat3 instanceMatrix = mat3(hx_instanceMatrix0.xyz, hx_instanceMatrix1.xyz, hx_instanceMatrix2.xyz);
        // instanceMatrix is transposed, so post-multiply!
        normal = normal * instanceMatrix;
    }
    return hx_normalMatrix * normal;
}
    #endif

    // we use a define for hx_evaluateSH so that SpirV never tries to pass a duplicate of an array which
    // is not supported when compiled for WebGL 1
    // this includes a swizzle to xzy
    #define hx_evaluateSH(sh, dir)\
    max((sh[0] + sh[1] * dir.z + sh[2] * dir.y + sh[3] * dir.x +\
    sh[4] * dir.x * dir.z + sh[5] * dir.z * dir.y + sh[6] * (3.0 * dir.y * dir.y - 1.0) +\
    sh[7] * dir.y * dir.x + sh[8] * (dir.x * dir.x - dir.z * dir.z)).xyz, vec3(0.0))

    #define hx_bilerp(tl, tr, bl, br, uv) mix(mix(tl, tr, uv.x), mix(bl, br, uv.x), uv.y)
    #define hx_trilerp(tln, trn, bln, brn, tlf, trf, blf, brf, uvw) mix(hx_bilerp(tln, trn, bln, brn, uvw.xy), hx_bilerp(tlf, trf, blf, brf, uvw.xy), uvw.z)

float hx_phaseHG(float dot, float g)
{
    // division by PI already happened in light's luminance
    return 0.25 * (1.0 - g * g) / pow(1.0 + g * g + 2.0 * g * dot, 1.5);
}



    #define SPECULAR_MAP_MODE_NORMAL_MAP 0
    #define SPECULAR_MAP_MODE_ROUGHNESS 1
    #define SPECULAR_MAP_MODE_METALLIC_ROUGHNESS 2
    #define SPECULAR_MAP_MODE_ALL 3

layout (constant_id = 0) const bool USE_UV_0 = false;
layout (constant_id = 1) const bool USE_UV_1 = false;

layout (constant_id = 10) const bool USE_MAP_colorMap = false;
layout (constant_id = 11) const bool USE_MAP_specularMap = false;
layout (constant_id = 12) const bool USE_MAP_normalMap = false;
layout (constant_id = 13) const bool USE_MAP_emissiveMap = false;
layout (constant_id = 14) const bool USE_MAP_occlusionMap = false;
layout (constant_id = 15) const bool USE_MAP_maskMap = false;
layout (constant_id = 16) const bool USE_MAP_lightMap = false;

layout (constant_id = 20) const int UV_colorMap = 0;
layout (constant_id = 21) const int UV_specularMap = 0;
layout (constant_id = 22) const int UV_normalMap = 0;
layout (constant_id = 23) const int UV_emissiveMap = 0;
layout (constant_id = 24) const int UV_occlusionMap = 0;
layout (constant_id = 25) const int UV_maskMap = 0;
layout (constant_id = 26) const int UV_lightMap = 0;

layout (constant_id = 30) const int SPECULAR_MAP_MODE = 0;
layout (constant_id = 31) const bool DOUBLE_SIDED = false;
layout (constant_id = 32) const bool USE_ALPHA_THRESHOLD = false;
layout (constant_id = 33) const int NORMAL_MAP_MODE = 0;


uniform vec4 color;
uniform vec3 emissiveColor;

// TODO: allow setting f0 factor

uniform float roughness;
uniform float f0;
uniform float metallicness;
uniform float roughnessMapRange;
uniform float alphaThreshold;

uniform sampler2D colorMap;
uniform vec2 colorMapScaleUV;
uniform vec2 colorMapOffsetUV;

uniform sampler2D maskMap;
uniform vec2 maskMapScaleUV;
uniform vec2 maskMapOffsetUV;

uniform sampler2D emissiveMap;
uniform vec2 emissiveMapScaleUV;
uniform vec2 emissiveMapOffsetUV;

uniform sampler2D occlusionMap;
uniform vec2 occlusionMapScaleUV;
uniform vec2 occlusionMapOffsetUV;

uniform sampler2D specularMap;
uniform vec2 specularMapScaleUV;
uniform vec2 specularMapOffsetUV;

uniform sampler2D lightMap;
uniform vec2 lightMapScaleUV;
uniform vec2 lightMapOffsetUV;

#ifndef HX_SKIP_NORMALS
in vec3 normal;

in vec3 tangent;
in vec3 bitangent;

uniform sampler2D normalMap;
uniform vec2 normalMapScaleUV;
uniform vec2 normalMapOffsetUV;
#endif

in vec2 uv0;
in vec2 uv1;

#define tex(samp, index, offset, scale) \
    texture(samp, ((index == 1? uv1 : uv0) + offset) * scale)

struct HX_FragmentData {
// insert default frag data required for lighting model
HX_DEFAULT_FRAGMENT_DATA
};

HX_FragmentData hx_fragmentData()
{
    HX_FragmentData data;
    data.color = color;

    if (USE_MAP_colorMap) {
        data.color *= tex(colorMap, UV_colorMap, colorMapOffsetUV, colorMapScaleUV);
    }

    if (USE_MAP_maskMap) {
        data.color.w *= tex(maskMap, UV_maskMap, maskMapOffsetUV, maskMapScaleUV).x;
    }

    if (USE_ALPHA_THRESHOLD) {
        if (data.color.w < alphaThreshold)
        discard;
    }

    data.occlusion = 1.0;
    data.roughness = roughness;
    data.f0 = f0;
    data.metallicness = metallicness;

    if (USE_MAP_specularMap && SPECULAR_MAP_MODE != SPECULAR_MAP_MODE_NORMAL_MAP) {
        vec4 specSample = tex(specularMap, UV_specularMap, specularMapOffsetUV, specularMapScaleUV);

        if (SPECULAR_MAP_MODE > 1)
        data.metallicness *= specSample.y;

        else if (SPECULAR_MAP_MODE == 3)
        data.f0 *= specSample.x;

        data.roughness += (specSample.z - .5) * roughnessMapRange;
    }

        #ifndef HX_SKIP_NORMALS
    vec3 fragNormal = normal;

    if (USE_MAP_normalMap) {
        vec4 normalSample = tex(normalMap, UV_normalMap, normalMapOffsetUV, normalMapScaleUV);

        // world space
        if (NORMAL_MAP_MODE == 2) {
            fragNormal = normalSample.xyz - .5;
        }
        else {
            mat3 TBN;
            TBN[0] = normalize(tangent);
            TBN[1] = normalize(bitangent);
            TBN[2] = normalize(normal);

            fragNormal = TBN * (normalSample.xyz - .5);
        }

        if (SPECULAR_MAP_MODE == SPECULAR_MAP_MODE_NORMAL_MAP)
        data.roughness += (normalSample.w - .5) * roughnessMapRange;

        if (DOUBLE_SIDED)
        fragNormal *= gl_FrontFacing? 1.0 : -1.0;
    }

    data.normal = normalize(fragNormal);
    #endif

    data.emissive = emissiveColor;

    if (USE_MAP_emissiveMap) {
        data.emissive *= tex(emissiveMap, UV_emissiveMap, emissiveMapOffsetUV,
        emissiveMapScaleUV).xyz;
    }

    if (USE_MAP_occlusionMap) {
        data.occlusion *= tex(
        occlusionMap,
        UV_occlusionMap, occlusionMapOffsetUV, occlusionMapScaleUV
        ).x;
    }

    if (USE_MAP_lightMap) {
        vec4 lightMapVal = tex(lightMap, UV_lightMap, lightMapOffsetUV, lightMapScaleUV);
        data.emissive += data.color.xyz * lightMapVal.xyz;
    }

    return data;
}


// every count has one for the dynamic buffer size, so we don't end up with LightType lights[0]
// every count has one for the dynamic buffer size, so we don't end up with LightType lights[0]
layout (constant_id = 200) const int HX_NUM_DIR_LIGHTS = 1;
layout (constant_id = 201) const int HX_NUM_DIR_LIGHTS_BUFF = 1;
layout (constant_id = 202) const int HX_NUM_POINT_LIGHTS = 1;
layout (constant_id = 203) const int HX_NUM_POINT_LIGHTS_BUFF = 1;
layout (constant_id = 204) const int HX_NUM_SPOT_LIGHTS = 1;
layout (constant_id = 205) const int HX_NUM_SPOT_LIGHTS_BUFF = 1;
layout (constant_id = 206) const int HX_NUM_SHADOW_CASCADES = 3;
layout (constant_id = 207) const int HX_OCCLUDE_SPECULAR = 0;

layout (constant_id = 220) const bool HX_USE_IRRADIANCE_PROBES = false;
layout (constant_id = 221) const int HX_NUM_PROBES_X = 1;
layout (constant_id = 222) const int HX_NUM_PROBES_Y = 1;
layout (constant_id = 223) const int HX_NUM_PROBES_Z = 1;
layout (constant_id = 224) const int HX_PROBE_UNIF_LEN = 9;
layout (constant_id = 225) const bool HX_USE_RADIANCE_PROBES = false;

struct HX_DirectionalLight
{
    vec3 luminance;   // the RGB luminance in nits divided by PI (for the brdf normalization factor)
    float depthBias;
    vec3 direction; // world space
    int castShadows;
};

struct HX_PointLight
{
// the order here is ordered in function of packing
    vec3 luminance;
    float rcpRadius;

    vec3 position;
    float depthBias;

    int castShadows;
};

struct HX_SpotLight
{
// the order here is ordered in function of packing
    vec3 luminance;
    float rcpRadius;

    vec3 position;
    float depthBias;

    vec3 direction;
    int castShadows;

    float cosAngleInner;    // cos(inner), rcp(cos(outer) - cos(inner))
    float rcpAngleRange;    // cos(inner), rcp(cos(outer) - cos(inner))
};

#if defined(HX_FRAGMENT_SHADER) && defined(HX_USE_LIGHTING)

layout (std140, binding=5) uniform hx_irradiance
{
    vec4 hx_irradianceSH[HX_PROBE_UNIF_LEN];
    float hx_radianceIntensity;
    float hx_radianceSize;
    float hx_radianceMaxMip;
    vec3 hx_radiancePosition;
};

HX_Reflection hx_calculateLight(
HX_DirectionalLight light, HX_FragmentData fragment,
vec3 position, vec3 viewDir, vec3 specular
) {
    return hx_brdf(fragment, light.direction, viewDir, light.luminance, specular);
}

HX_Reflection hx_calculateLight(
HX_PointLight light, HX_FragmentData fragment,
vec3 position, vec3 viewDir, vec3 specular
)
{
    vec3 direction = position - light.position;
    float distSqr = dot(direction, direction);  // distance squared
    float distance = sqrt(distSqr);
    // normalize
    direction /= distance;
    float attenuation = saturate((1.0 - distance * light.rcpRadius) / distSqr);

    return hx_brdf(fragment, direction, viewDir, light.luminance * attenuation, specular);
}


HX_Reflection hx_calculateLight(
HX_SpotLight light, HX_FragmentData fragment,
vec3 position, vec3 viewDir, vec3 specular
)
{
    vec3 direction = position - light.position;
    float distSqr = dot(direction, direction);  // distance squared
    float distance = sqrt(distSqr);
    // normalize
    direction /= distance;

    float cosAngle = dot(light.direction, direction);

    float attenuation = saturate((1.0 - distance * light.rcpRadius) / distSqr);
    attenuation *=  saturate((cosAngle - light.cosAngleInner) * light.rcpAngleRange);

    return hx_brdf(fragment, direction, viewDir, light.luminance * attenuation, specular);
}

vec3 hx_specularColor(inout HX_FragmentData data)
{
    //    vec3 specular = mix(vec3(data.specular), data.color.xyz, data.metallicness);
    vec3 specularColor = mix(vec3(data.f0), data.color.xyz, data.metallicness);
    data.color.xyz *= 1.0 - data.metallicness;
    return specularColor;
}

    // not always supported (WebGL 1)
    #ifndef HX_NO_PROBE_GRIDS
highp vec3 hx_evaluateSubSH(highp vec3 dir, int offset)
{
    dir = dir.xzy;
    vec4 col =  hx_irradianceSH[offset] +
    hx_irradianceSH[offset + 1] * dir.y + hx_irradianceSH[offset + 2] * dir.z +
    hx_irradianceSH[offset + 3] * dir.x + hx_irradianceSH[offset + 4] * dir.x * dir.y +
    hx_irradianceSH[offset + 5] * dir.y * dir.z + hx_irradianceSH[offset + 6] * (3.0 * dir.z * dir.z - 1.0) +
    hx_irradianceSH[offset + 7] * dir.z * dir.x + hx_irradianceSH[offset + 8] * (dir.x * dir.x - dir.y * dir.y);

    return saturate(col.rgb);
}
    #endif

vec3 hx_evaluateSHGrid(vec3 normal, vec3 uvw)
{
    #ifndef HX_NO_PROBE_GRIDS
    if (HX_NUM_PROBES_X == 1 && HX_NUM_PROBES_Y == 1 && HX_NUM_PROBES_Z == 1) {
        #endif
        return hx_evaluateSH(hx_irradianceSH, normal);
        #ifndef HX_NO_PROBE_GRIDS
    }

    vec3 gridSize = vec3(float(HX_NUM_PROBES_X), float(HX_NUM_PROBES_Y), float(HX_NUM_PROBES_Z));
    vec3 indices = uvw * (gridSize - 1.0);
    vec3 fr = fract(indices);
    indices -= fr;

    int tln = int(indices.x + (indices.y + indices.z * gridSize.y) * gridSize.x);
    int trn = tln + 1;
    int bln = tln + HX_NUM_PROBES_X;
    int brn = bln + 1;
    int tlf = tln + HX_NUM_PROBES_X * HX_NUM_PROBES_Y;
    int trf = tlf + 1;
    int blf = tlf + HX_NUM_PROBES_X;
    int brf = blf + 1;

    tln *= 9;
    trn *= 9;
    bln *= 9;
    brn *= 9;
    tlf *= 9;
    trf *= 9;
    blf *= 9;
    brf *= 9;

    // provide all optimized cases
    if (HX_NUM_PROBES_X == 1) {
        if (HX_NUM_PROBES_Y == 1) {
            // lerp
            return mix(hx_evaluateSubSH(normal, tln), hx_evaluateSubSH(normal, tlf), fr.z);
        }
        else if (HX_NUM_PROBES_Z == 1) {
            // lerp
            return mix(hx_evaluateSubSH(normal, tln), hx_evaluateSubSH(normal, bln), fr.y);
        }
        else {
            // bilerp
            return hx_bilerp(
            hx_evaluateSubSH(normal, tln), hx_evaluateSubSH(normal, bln),
            hx_evaluateSubSH(normal, tlf), hx_evaluateSubSH(normal, blf),
            fr.yz
            );
        }
    }
    else if (HX_NUM_PROBES_Y == 1) {
        if (HX_NUM_PROBES_Z == 1) {
            return mix(hx_evaluateSubSH(normal, tln), hx_evaluateSubSH(normal, trn), fr.x);
        }
        else {
            return hx_bilerp(
            hx_evaluateSubSH(normal, tln), hx_evaluateSubSH(normal, trn),
            hx_evaluateSubSH(normal, tlf), hx_evaluateSubSH(normal, trf),
            fr.xz);
        }
    }
    else if (HX_NUM_PROBES_Z == 1) {
        return hx_bilerp(
        hx_evaluateSubSH(normal, tln), hx_evaluateSubSH(normal, trn),
        hx_evaluateSubSH(normal, bln), hx_evaluateSubSH(normal, brn),
        fr.xy);
    }
    else {
        // it should be more efficient (+ have more room for compile-time optimizations) to interpolate
        // the evaluated values, rather than evaluate the interpolated SH.
        return hx_trilerp(
hx_evaluateSubSH(normal, tln),
hx_evaluateSubSH(normal, trn),
hx_evaluateSubSH(normal, bln),
hx_evaluateSubSH(normal, brn),
hx_evaluateSubSH(normal, tlf),
hx_evaluateSubSH(normal, trf),
hx_evaluateSubSH(normal, blf),
hx_evaluateSubSH(normal, brf),
fr
);
}

#endif
}

vec3 hx_evaluateRadianceProbe(samplerCube tex, vec3 pos, vec3 dir, HX_FragmentData fragment, vec3 specular)
{
// https://seblagarde.wordpress.com/2011/08/17/hello-world/
vec3 fresnel = hx_fresnelSchlickRoughness(specular, dir, fragment.normal, fragment.roughness);

if (hx_radianceSize > 0.0)
dir = hx_intersectCubeMap(pos, dir, hx_radiancePosition, hx_radianceSize);

float mipLevel = fragment.roughness * hx_radianceMaxMip;
vec4 specProbeSample = textureLod(tex, dir.xzy, mipLevel);

// TODO: Should we use linear maps?
return hx_gammaToLinear(specProbeSample.xyz) * fresnel * hx_radianceIntensity;
}

#endif

layout (constant_id = 180) const int HX_SHADOW_MAP_MODE = 0;
layout (constant_id = 181) const float HX_SHADOW_SOFTNESS = 0.01;
layout (constant_id = 182) const int HX_NUM_PCF_SAMPLES = 6;
layout (constant_id = 183) const bool HX_PCF_DITHER_SHADOWS = false;
layout (constant_id = 184) const float HX_VSM_MIN_VARIANCE = 0.00001;
layout (constant_id = 185) const float HX_VSM_LIGHT_BLEED_REDUCTION = 0.1;
layout (constant_id = 186) const float HX_ESM_CONSTANT = 80.0;
layout (constant_id = 187) const float HX_ESM_DARKENING = 0.35;

#define HX_SHADOW_MAP_NONE 0
#define HX_SHADOW_MAP_PCF 1
#define HX_SHADOW_MAP_VSM 2
#define HX_SHADOW_MAP_ESM 3

// guard so it's not included twice
#ifndef HX_DITHER_2D
#define HX_DITHER_2D
uniform sampler2D hx_dither2D;
#endif

uniform sampler2D hx_shadowMap;

struct HX_DirectionalShadow
{
    vec4 splitDistances;
// SpirV does not allow using spec constants here, and WebGL1 gives errors copying structs
// arrays
    mat4 shadowMapMatrix0;
    mat4 shadowMapMatrix1;
    mat4 shadowMapMatrix2;
    mat4 shadowMapMatrix3;
};

struct HX_PointShadow
{
// for each cube face
    vec4 shadowTile0;
    vec4 shadowTile1;
    vec4 shadowTile2;
    vec4 shadowTile3;
    vec4 shadowTile4;
    vec4 shadowTile5;
};

struct HX_SpotShadow
{
    vec4 shadowTile;    // xy = scale, zw = offset
    mat4 shadowMapMatrix;
};

vec4 hx_getShadowMapValue(float depth)
{
    if (HX_SHADOW_MAP_MODE == HX_SHADOW_MAP_NONE || HX_SHADOW_MAP_MODE == HX_SHADOW_MAP_PCF) {
        #ifdef HX_FORCE_RGBA_TEX_CHANNELS
        return hx_floatToRGBA8(depth);
        #else
        return vec4(depth);
        #endif
    }
    else if (HX_SHADOW_MAP_MODE == HX_SHADOW_MAP_VSM) {
        float dx = dFdx(depth);
        float dy = dFdy(depth);
        float moment2 = depth * depth + 0.25 * (dx*dx + dy*dy);

        if (HX_FLOAT_FBOS) {
            return vec4(depth, moment2, 0.0, 1.0);
        }
        else {
            // encode in 16 bits
            return vec4(hx_floatToRG8(depth), hx_floatToRG8(moment2));
        }
    }
    else if (HX_SHADOW_MAP_MODE == HX_SHADOW_MAP_ESM) {
        return vec4(exp(HX_ESM_CONSTANT * depth));
    }
    else {
        return vec4(1.0);
    }
}

float hx_readShadow(vec4 shadowMapCoord, float depthBias)
{
    if (HX_SHADOW_MAP_MODE == HX_SHADOW_MAP_NONE) {
        #ifdef HX_PACKED_FLOATS
        float shadowSample = hx_RGBA8ToFloat(texture(hx_shadowMap, shadowMapCoord.xy));
        #else
        float shadowSample = texture(hx_shadowMap, shadowMapCoord.xy).x;
        #endif
        float diff = shadowMapCoord.z - shadowSample - depthBias;
        return float(diff < 0.0);
    }
    else if (HX_SHADOW_MAP_MODE == HX_SHADOW_MAP_PCF) {
        float shadowTest = 0.0;

        vec4 dither;
        if (HX_PCF_DITHER_SHADOWS) {
            vec2 ditherUV = gl_FragCoord.xy / 32.0;
            dither = hx_sampleDefaultDither(hx_dither2D, ditherUV);
            dither = vec4(dither.x, -dither.y, dither.y, dither.x) * HX_SHADOW_SOFTNESS;
        }

        for (int i = 0; i < HX_NUM_PCF_SAMPLES; i++) {
            vec2 offset;
            if (HX_PCF_DITHER_SHADOWS) {
                offset.x = dot(dither.xy, hx_poissonDisk[i]);
                offset.y = dot(dither.zw, hx_poissonDisk[i]);
            }
            else {
                offset = hx_poissonDisk[i] * HX_SHADOW_SOFTNESS;
            }

                #ifdef HX_FORCE_RGBA_TEX_CHANNELS
            float shadowSample = hx_RGBA8ToFloat(texture(hx_shadowMap, shadowMapCoord.xy + offset));
            #else
            float shadowSample = texture(hx_shadowMap, shadowMapCoord.xy + offset).x;
            #endif
            float diff = shadowMapCoord.z - shadowSample - depthBias;
            shadowTest += float(diff < 0.0);
        }

        return shadowTest / float(HX_NUM_PCF_SAMPLES);
    }
    else if (HX_SHADOW_MAP_MODE == HX_SHADOW_MAP_VSM) {
        vec4 s = texture(hx_shadowMap, shadowMapCoord.xy);
        vec2 moments;
        if (HX_FLOAT_FBOS) {
            moments = s.xy;
        }
        else {
            moments = vec2(hx_RG8ToFloat(s.xy), hx_RG8ToFloat(s.zw));
        }
        shadowMapCoord.z -= depthBias;

        float variance = moments.y - moments.x * moments.x;
        variance = max(variance, HX_VSM_MIN_VARIANCE);

        float diff = shadowMapCoord.z - moments.x;

        // transparents could be closer to the light than casters, in which case it should be 1.0
        float upperBound = float(diff < 0.0);
        upperBound = max(upperBound, variance / (variance + diff * diff));

        return hx_linearStep(HX_VSM_LIGHT_BLEED_REDUCTION, 1.0, upperBound);
    }
    else if (HX_SHADOW_MAP_MODE == HX_SHADOW_MAP_ESM) {
        float shadowSample = texture(hx_shadowMap, shadowMapCoord.xy).x;
        shadowMapCoord.z -= depthBias;
        return saturate(HX_ESM_DARKENING * shadowSample * exp(-HX_ESM_CONSTANT * shadowMapCoord.z));
    }
    else {
        return 1.0;
    }
}

float hx_calculateShadows(HX_DirectionalLight light, HX_DirectionalShadow shadow, vec3 position)
{
    // not really a distance, but the projected position to the light dir
    float dist = dot(hx_cameraWorldMatrix[1].xyz, position);

    mat4 shadowMatrix;

    // not very efficient :(
    // a loop cannot be correctly cross-compiled to WebGL1
    if (dist < shadow.splitDistances[0]) {
        shadowMatrix = shadow.shadowMapMatrix0;
    }
    else if (HX_NUM_SHADOW_CASCADES >= 2 && dist < shadow.splitDistances[1]) {
        shadowMatrix = shadow.shadowMapMatrix1;
    }
    else if (HX_NUM_SHADOW_CASCADES >= 3 && dist < shadow.splitDistances[2]) {
        shadowMatrix = shadow.shadowMapMatrix2;
    }
    else if (HX_NUM_SHADOW_CASCADES == 4 && dist < shadow.splitDistances[3]) {
        shadowMatrix = shadow.shadowMapMatrix3;
    }
    else return 1.0;

    vec4 shadowMapCoord = shadowMatrix * vec4(position, 1.0);
    float shadowValue = hx_readShadow(shadowMapCoord, light.depthBias);

    // this can occur when meshInstance.castShadows = false, or using inherited bounds
    bool isOutside = max(shadowMapCoord.x, shadowMapCoord.y) > 1.0 || min(shadowMapCoord.x, shadowMapCoord.y) < 0.0;
    if (isOutside) shadowValue = 1.0;

    return shadowValue;
}

float hx_calculateShadows(HX_SpotLight light, HX_SpotShadow shadow, vec3 position)
{
    vec4 shadowMapCoord = shadow.shadowMapMatrix * vec4(position, 1.0);
    shadowMapCoord /= shadowMapCoord.w;

    // .95: match the scaling applied in the shadow map pass, used to reduce bleeding from filtering
    shadowMapCoord.xy = shadowMapCoord.xy * .95 * shadow.shadowTile.xy + shadow.shadowTile.zw;

    // so the depth map value is based from nearPlane - farPlane
    // shadowMapCoord is based from 0 - farPlane
    shadowMapCoord.z = length(position - light.position) * light.rcpRadius;
    return hx_readShadow(shadowMapCoord, light.depthBias);
}


float hx_calculateShadows(HX_PointLight light, HX_PointShadow shadow, vec3 position)
{
    vec3 dir = position - light.position;
    float dist = length(dir);

    // swizzle to opengl cube map space
    dir = dir.xzy;

    vec3 absDir = abs(dir);

    vec2 uv;
    vec4 tile;

    if (absDir.x >= absDir.y && absDir.x >= absDir.z) {
        tile = dir.x > 0.0? shadow.shadowTile0: shadow.shadowTile1;
        // signs are important (hence division by either dir or absDir
        uv = vec2(-dir.z / dir.x, -dir.y / absDir.x);
    }
    else if (absDir.y >= absDir.x && absDir.y >= absDir.z) {
        tile = dir.y > 0.0? shadow.shadowTile4: shadow.shadowTile5;
        uv = vec2(dir.x / absDir.y, dir.z / dir.y);
    }
    else {
        tile = dir.z > 0.0? shadow.shadowTile2: shadow.shadowTile3;
        uv = vec2(dir.x / dir.z, -dir.y / absDir.z);
    }

    // match the scaling applied in the shadow map pass (used to reduce bleeding from filtering)
    uv *= .95;

    vec4 shadowMapCoord;
    shadowMapCoord.xy = uv * tile.xy + tile.zw;
    shadowMapCoord.z = dist * light.rcpRadius;
    shadowMapCoord.w = 1.0;
    return  hx_readShadow(shadowMapCoord, light.depthBias);
}


out vec4 hx_fragColor;

void main()
{
    HX_FragmentData data = hx_fragmentData();
    hx_fragColor = hx_gammaToLinear(data.color);
    hx_fragColor.xyz += hx_gammaToLinear(data.emissive);

    hx_fragColor = hx_linearToScreen(hx_fragColor);
}
