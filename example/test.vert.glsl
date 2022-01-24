#version 310 es
precision highp float;
#define HX_VERTEX_SHADER
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



uniform sampler2D hx_skinningTexture;

layout (std140, binding=6) uniform hx_skinning
{
    vec4 hx_skinningMatrices[HX_MAX_SKELETON_JOINTS * 3];
};

mat4 hx_getSkinningMatrix(vec4 weights, vec4 indices)
{
    mat4 mat = mat4(
    0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 1.0
    );

    if (HX_USE_SKINNING) {
        if (HX_USE_SKINNING_TEXTURE) {
            for (int i = 0; i < 4; ++i) {
                float index = indices[i] * HX_SKELETON_PIXEL_SIZE * 3.0;
                mat[0] += weights[i] * texture(hx_skinningTexture, vec2(index, 0.0));
                mat[1] += weights[i] * texture(hx_skinningTexture, vec2(index + HX_SKELETON_PIXEL_SIZE, 0.0));
                mat[2] += weights[i] * texture(hx_skinningTexture, vec2(index + 2.0 * HX_SKELETON_PIXEL_SIZE, 0.0));
            }

        }
        else {
            vec4 indices = indices * 3.0;

            for (int i = 0; i < 4; ++i) {
                mat[0] += weights[i] * hx_skinningMatrices[int(indices[i])];
                mat[1] += weights[i] * hx_skinningMatrices[int(indices[i]) + 1];
                mat[2] += weights[i] * hx_skinningMatrices[int(indices[i]) + 2];
            }
        }
    }

    return mat;
}

vec4 hx_applySkinning(vec4 pos, mat4 skinningMatrix)
{
    // do tests to hopefully remove this code during upload time
    if (HX_USE_SKINNING) {
        return hx_bindShapeMatrixInverse * ((hx_bindShapeMatrix * pos) * skinningMatrix);
    }
    else {
        return pos;
    }
}

vec3 hx_applySkinning(vec3 vec, mat4 skinningMatrix)
{
    // do tests to hopefully remove this code during upload time
    if (HX_USE_SKINNING) {
        return vec * mat3(skinningMatrix);
    }
    else {
        return vec;
    }
}


layout (std140, binding=7) uniform hx_morphing
{
// vec4 to have consistent alignment (float arrays are still aligned to 16 bytes)
    vec4 hx_morphWeights[2];
};

#define hx_applyMorphPosition(pos) \
    {\
        if (HX_MAX_MORPH_TARGETS > 0) pos.xyz += hx_morph0 * hx_morphWeights[0][0];\
        if (HX_MAX_MORPH_TARGETS > 1) pos.xyz += hx_morph1 * hx_morphWeights[0][1];\
        if (HX_MAX_MORPH_TARGETS > 2) pos.xyz += hx_morph2 * hx_morphWeights[0][2];\
        if (HX_MAX_MORPH_TARGETS > 3) pos.xyz += hx_morph3 * hx_morphWeights[0][3];\
        if (HX_MAX_MORPH_TARGETS > 4) pos.xyz += hx_morph4 * hx_morphWeights[1][0];\
        if (HX_MAX_MORPH_TARGETS > 5) pos.xyz += hx_morph5 * hx_morphWeights[1][1];\
        if (HX_MAX_MORPH_TARGETS > 6) pos.xyz += hx_morph6 * hx_morphWeights[1][2];\
        if (HX_MAX_MORPH_TARGETS > 7) pos.xyz += hx_morph7 * hx_morphWeights[1][3];\
    }

#define hx_applyMorphNormal(norm) \
    {\
        if (HX_MAX_MORPH_TARGETS > 0) norm.xyz += hx_morph4 * hx_morphWeights[0][0];\
        if (HX_MAX_MORPH_TARGETS > 1) norm.xyz += hx_morph5 * hx_morphWeights[0][1];\
        if (HX_MAX_MORPH_TARGETS > 2) norm.xyz += hx_morph6 * hx_morphWeights[0][2];\
        if (HX_MAX_MORPH_TARGETS > 3) norm.xyz += hx_morph7 * hx_morphWeights[0][3];\
    }




layout (constant_id = 0) const bool USE_UV_0 = false;
layout (constant_id = 1) const bool USE_UV_1 = false;

layout (constant_id = 10) const bool USE_MAP_colorMap = false;
layout (constant_id = 11) const bool USE_MAP_specularMap = false;
layout (constant_id = 12) const bool USE_MAP_normalMap = false;
layout (constant_id = 13) const bool USE_MAP_emissiveMap = false;
layout (constant_id = 14) const bool USE_MAP_occlusionMap = false;

layout (constant_id = 20) const int UV_colorMap = 0;
layout (constant_id = 21) const int UV_specularMap = 0;
layout (constant_id = 22) const int UV_normalMap = 0;
layout (constant_id = 23) const int UV_emissiveMap = 0;
layout (constant_id = 24) const int UV_occlusionMap = 0;

layout (constant_id = 30) const int SPECULAR_MAP_MODE = 0;
layout (constant_id = 31) const bool DOUBLE_SIDED = false;
layout (constant_id = 32) const bool USE_ALPHA_THRESHOLD = false;
layout (constant_id = 33) const int NORMAL_MAP_MODE = 0;

out vec2 uv0;
out vec2 uv1;
out vec2 uv2;

#ifndef HX_SKIP_NORMALS
out vec3 normal;
out vec3 tangent;
out vec3 bitangent;
#endif

struct HX_VertexData {
// insert default frag data required for lighting model
HX_DEFAULT_VERTEX_DATA
};


HX_VertexData hx_vertexData()
{
    vec4 position = hx_position;

    HX_VertexData data;

    if (USE_UV_0)
    uv0 = hx_texCoord;

    if (USE_UV_1)
    uv1 = hx_texCoord1;

    vec3 morphData[HX_MAX_MORPH_TARGETS];

    if (HX_USE_MORPHING) {
        hx_applyMorphPosition(position);
}

mat4 skinningMatrix;
if (HX_USE_SKINNING) {
    skinningMatrix = hx_getSkinningMatrix(hx_jointWeights, hx_jointIndices);
    position = hx_applySkinning(position, skinningMatrix);
}

    #ifndef HX_SKIP_NORMALS
normal = hx_normal;

if (HX_USE_MORPHING && HX_USE_MORPH_NORMALS) {
    hx_applyMorphNormal(normal);
}

if (HX_USE_SKINNING) {
    normal = hx_applySkinning(normal, skinningMatrix);
}

normal = hx_normalToWorld(normal);

if (USE_MAP_normalMap) {
    if (NORMAL_MAP_MODE == 0) {
        tangent = hx_tangent.xyz;

        if (HX_USE_SKINNING) {
            tangent = hx_applySkinning(tangent, skinningMatrix);
        }
        tangent = hx_objectToWorld(tangent);
        bitangent = cross(tangent, normal) * hx_tangent.w;
    }
    // object space, construct normal basis from regular transform
    if (NORMAL_MAP_MODE == 1) {
        mat3 mat = hx_objectToWorldNormalMatrix();
        tangent = -mat[0];
        normal = -mat[1];
        bitangent = -mat[2];
    }
}
    #endif

vec4 worldPos = hx_objectToWorld(position);

data.worldPos = worldPos.xyz;
data.outPos = hx_viewProjectionMatrix * worldPos;

return data;
}


void main()
{
    // TODO: Apply skinning here or leave that to user?
    HX_VertexData data = hx_vertexData();
    gl_Position = data.outPos;
}
