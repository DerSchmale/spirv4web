var SPIRV = (function (exports) {
    'use strict';

    var Args = /** @class */ (function () {
        function Args() {
            this.version = 0;
            this.shader_model = 0;
            this.es = false;
            this.set_version = false;
            this.set_shader_model = false;
            this.set_es = false;
            this.dump_resources = false;
            this.force_temporary = false;
            this.flatten_ubo = false;
            this.fixup = false;
            this.yflip = false;
            this.sso = false;
            this.support_nonzero_baseinstance = true;
            this.glsl_emit_push_constant_as_ubo = false;
            this.glsl_emit_ubo_as_plain_uniforms = false;
            this.glsl_force_flattened_io_blocks = false;
            this.glsl_ovr_multiview_view_count = 0;
            this.glsl_ext_framebuffer_fetch = [];
            this.glsl_ext_framebuffer_fetch_noncoherent = false;
            this.emit_line_directives = false;
            this.enable_storage_image_qualifier_deduction = true;
            this.force_zero_initialized_variables = false;
            this.pls_in = [];
            this.pls_out = [];
            this.remaps = [];
            this.extensions = [];
            this.variable_type_remaps = [];
            this.interface_variable_renames = [];
            this.masked_stage_outputs = [];
            this.masked_stage_builtins = [];
            this.entry_point_rename = [];
            this.cpp = false;
            this.flatten_multidimensional_arrays = false;
            this.use_420pack_extension = true;
            this.remove_unused = true;
            this.combined_samplers_inherit_bindings = false;
        }
        return Args;
    }());

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    }

    /**
     * Randomizes the order of the elements in the array.
     */
    /**
     * Removes all elements from the array with the given value, keeping the order.
     */
    function removeAllElements(target, value) {
        for (var index = target.indexOf(value); index >= 0; index = target.indexOf(value)) {
            target.splice(index, 1);
        }
    }

    function createWith(length, creator) {
        var arr = new Array(length);
        for (var i = 0; i < length; ++i) {
            arr[i] = creator(i);
        }
        return arr;
    }

    /**
     * Replaces every element element of an array with the result of a transformation function.
     *
     * @param target The Array to transform.
     * @param func A function that takes the current element and returns the new value.
     * @param start An optional start index into the array. Defaults to 0.
     * @param end An optional end index into the array. Defaults to the length of the array.
     */
    function transform(target, func, start, end) {
        if (start === void 0) { start = 0; }
        if (end === void 0) { end = target.length; }
        for (var i = start; i < end; ++i) {
            target[i] = func[i];
        }
    }

    function equals(a, b) {
        var length = a.length;
        if (a.length !== b.length)
            return false;
        for (var i = 0; i < length; ++i) {
            if (a[i] !== b[i])
                return false;
        }
        return true;
    }

    /**
     * Returns the number of elements in a (sparse) Array.
     */
    function count(arr) {
        return arr.reduce(function (x) { return x + 1; }, 0);
    }

    var Types;
    (function (Types) {
        Types[Types["TypeNone"] = 0] = "TypeNone";
        Types[Types["TypeType"] = 1] = "TypeType";
        Types[Types["TypeVariable"] = 2] = "TypeVariable";
        Types[Types["TypeConstant"] = 3] = "TypeConstant";
        Types[Types["TypeFunction"] = 4] = "TypeFunction";
        Types[Types["TypeFunctionPrototype"] = 5] = "TypeFunctionPrototype";
        Types[Types["TypeBlock"] = 6] = "TypeBlock";
        Types[Types["TypeExtension"] = 7] = "TypeExtension";
        Types[Types["TypeExpression"] = 8] = "TypeExpression";
        Types[Types["TypeConstantOp"] = 9] = "TypeConstantOp";
        Types[Types["TypeCombinedImageSampler"] = 10] = "TypeCombinedImageSampler";
        Types[Types["TypeAccessChain"] = 11] = "TypeAccessChain";
        Types[Types["TypeUndef"] = 12] = "TypeUndef";
        Types[Types["TypeString"] = 13] = "TypeString";
        Types[Types["TypeCount"] = 14] = "TypeCount";
    })(Types || (Types = {}));

    var Variant = /** @class */ (function () {
        function Variant(group) {
            this.holder = null;
            this.type = Types.TypeNone;
            this.allow_type_rewrite = false;
            this.group = group;
        }
        Variant.prototype.set = function (val, new_type) {
            if (this.holder)
                this.group.pools[this.type].deallocate_opaque(this.holder);
            this.holder = null;
            if (!this.allow_type_rewrite && this.type !== Types.TypeNone && this.type !== new_type) {
                if (val)
                    this.group.pools[new_type].deallocate_opaque(val);
                throw new Error("Overwriting a variant with new type.");
            }
            this.holder = val;
            this.type = new_type;
            this.allow_type_rewrite = false;
        };
        Variant.prototype.allocate_and_set = function (new_type) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            var p = (this.group.pools[new_type]);
            var val = p.allocate.apply(p, args);
            this.set(val, new_type);
            return val;
        };
        Variant.prototype.get = function (classRef) {
            if (!this.holder)
                throw new Error("nullptr");
            if (classRef.type !== this.type)
                throw new Error("Bad cast");
            return (this.holder);
        };
        Variant.prototype.get_type = function () {
            return this.type;
        };
        Variant.prototype.get_id = function () {
            return this.holder ? this.holder.self : 0;
        };
        Variant.prototype.empty = function () {
            return !this.holder;
        };
        Variant.prototype.reset = function () {
            if (this.holder)
                this.group.pools[this.type].deallocate_opaque(this.holder);
            this.holder = null;
            this.type = Types.TypeNone;
        };
        Variant.prototype.set_allow_type_rewrite = function () {
            this.allow_type_rewrite = true;
        };
        return Variant;
    }());
    function variant_get(classRef, var_) {
        return var_.get(classRef);
    }
    function variant_set(classRef, var_) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        return var_.allocate_and_set.apply(var_, __spreadArray([classRef.type], args, false));
    }

    var ObjectPoolGroup = /** @class */ (function () {
        function ObjectPoolGroup() {
            this.pools = new Array(Types.TypeCount);
        }
        return ObjectPoolGroup;
    }());

    function defaultCopy(src, dst) {
        for (var key in src) {
            if (src.hasOwnProperty(key))
                dst[key] = _clone(src[key]);
        }
    }
    function defaultClone(classRef, src) {
        var c = new classRef();
        defaultCopy(src, c);
        return c;
    }
    function _clone(src) {
        if (Array.isArray(src)) {
            return src.map(function (elm) { return _clone(elm); });
        }
        else {
            var type = typeof src;
            if (type === "object") {
                // the object knows how to clone itself
                if (typeof src.clone === "function")
                    return src.clone();
                else if (src instanceof Set) {
                    var dst_1 = new Set();
                    src.forEach((function (value) { return dst_1.add(value); }));
                    return dst_1;
                }
                else if (src instanceof Uint8Array || src instanceof Uint8ClampedArray || src instanceof Uint16Array || src instanceof Uint32Array ||
                    src instanceof Int8Array || src instanceof Int16Array || src instanceof Int32Array ||
                    src instanceof BigInt64Array || src instanceof BigUint64Array ||
                    src instanceof Float32Array || src instanceof Float64Array) {
                    return src.slice();
                }
                else {
                    throw new Error("The object ".concat(src, " does not have a clone function."));
                }
            }
            else if (type !== "function") {
                // it's a primitive, it can just be passed back
                return src;
            }
        }
    }

    var Bitset = /** @class */ (function () {
        function Bitset(lower) {
            if (lower === void 0) { lower = 0; }
            this.higher = new Set();
            this.lower = lower;
        }
        Bitset.prototype.get = function (bit) {
            if (bit < 32)
                return (this.lower & (1 << bit)) !== 0;
            else
                return this.higher.has(bit);
        };
        Bitset.prototype.set = function (bit) {
            if (bit < 32)
                this.lower |= 1 << bit;
            else
                this.higher.add(bit);
        };
        Bitset.prototype.clear = function (bit) {
            if (bit < 32)
                this.lower &= ~(1 << bit);
            else
                this.higher.delete(bit);
        };
        Bitset.prototype.get_lower = function () {
            return this.lower;
        };
        Bitset.prototype.reset = function () {
            this.lower = 0;
            this.higher.clear();
        };
        Bitset.prototype.merge_and = function (other) {
            this.lower &= other.lower;
            var tmp_set = new Set();
            this.higher.forEach(function (v) {
                if (other.higher.has(v))
                    tmp_set.add(v);
            });
            this.higher = tmp_set;
        };
        Bitset.prototype.merge_or = function (other) {
            var _this = this;
            this.lower |= other.lower;
            other.higher.forEach(function (v) { return _this.higher.add(v); });
        };
        Bitset.prototype.equals = function (other) {
            if (this.lower !== other.lower)
                return false;
            if (this.higher.size !== other.higher.size)
                return false;
            for (var it = this.higher.values(), val = null; (val = it.next().value);) {
                if (!other.higher.has(val))
                    return false;
            }
            return true;
        };
        Bitset.prototype.for_each_bit = function (op) {
            // TODO: Add ctz-based iteration.
            for (var i = 0; i < 32; i++) {
                if (this.lower & (1 << i))
                    op(i);
            }
            if (this.higher.size === 0)
                return;
            // Need to enforce an order here for reproducible results,
            // but hitting this path should happen extremely rarely, so having this slow path is fine.
            var bits = Array.from(this.higher);
            bits.sort();
            bits.forEach(op);
        };
        Bitset.prototype.empty = function () {
            return this.lower === 0 && this.higher.size === 0;
        };
        Bitset.prototype.clone = function () {
            return defaultClone(Bitset, this);
        };
        return Bitset;
    }());

    var MagicNumber = 0x07230203;
    var SourceLanguage;
    (function (SourceLanguage) {
        SourceLanguage[SourceLanguage["SourceLanguageUnknown"] = 0] = "SourceLanguageUnknown";
        SourceLanguage[SourceLanguage["SourceLanguageESSL"] = 1] = "SourceLanguageESSL";
        SourceLanguage[SourceLanguage["SourceLanguageGLSL"] = 2] = "SourceLanguageGLSL";
        SourceLanguage[SourceLanguage["SourceLanguageOpenCL_C"] = 3] = "SourceLanguageOpenCL_C";
        SourceLanguage[SourceLanguage["SourceLanguageOpenCL_CPP"] = 4] = "SourceLanguageOpenCL_CPP";
        SourceLanguage[SourceLanguage["SourceLanguageHLSL"] = 5] = "SourceLanguageHLSL";
        SourceLanguage[SourceLanguage["SourceLanguageMax"] = 2147483647] = "SourceLanguageMax";
    })(SourceLanguage || (SourceLanguage = {}));
    var ExecutionModel;
    (function (ExecutionModel) {
        ExecutionModel[ExecutionModel["ExecutionModelVertex"] = 0] = "ExecutionModelVertex";
        ExecutionModel[ExecutionModel["ExecutionModelTessellationControl"] = 1] = "ExecutionModelTessellationControl";
        ExecutionModel[ExecutionModel["ExecutionModelTessellationEvaluation"] = 2] = "ExecutionModelTessellationEvaluation";
        ExecutionModel[ExecutionModel["ExecutionModelGeometry"] = 3] = "ExecutionModelGeometry";
        ExecutionModel[ExecutionModel["ExecutionModelFragment"] = 4] = "ExecutionModelFragment";
        ExecutionModel[ExecutionModel["ExecutionModelGLCompute"] = 5] = "ExecutionModelGLCompute";
        ExecutionModel[ExecutionModel["ExecutionModelKernel"] = 6] = "ExecutionModelKernel";
        ExecutionModel[ExecutionModel["ExecutionModelTaskNV"] = 5267] = "ExecutionModelTaskNV";
        ExecutionModel[ExecutionModel["ExecutionModelMeshNV"] = 5268] = "ExecutionModelMeshNV";
        ExecutionModel[ExecutionModel["ExecutionModelRayGenerationKHR"] = 5313] = "ExecutionModelRayGenerationKHR";
        ExecutionModel[ExecutionModel["ExecutionModelRayGenerationNV"] = 5313] = "ExecutionModelRayGenerationNV";
        ExecutionModel[ExecutionModel["ExecutionModelIntersectionKHR"] = 5314] = "ExecutionModelIntersectionKHR";
        ExecutionModel[ExecutionModel["ExecutionModelIntersectionNV"] = 5314] = "ExecutionModelIntersectionNV";
        ExecutionModel[ExecutionModel["ExecutionModelAnyHitKHR"] = 5315] = "ExecutionModelAnyHitKHR";
        ExecutionModel[ExecutionModel["ExecutionModelAnyHitNV"] = 5315] = "ExecutionModelAnyHitNV";
        ExecutionModel[ExecutionModel["ExecutionModelClosestHitKHR"] = 5316] = "ExecutionModelClosestHitKHR";
        ExecutionModel[ExecutionModel["ExecutionModelClosestHitNV"] = 5316] = "ExecutionModelClosestHitNV";
        ExecutionModel[ExecutionModel["ExecutionModelMissKHR"] = 5317] = "ExecutionModelMissKHR";
        ExecutionModel[ExecutionModel["ExecutionModelMissNV"] = 5317] = "ExecutionModelMissNV";
        ExecutionModel[ExecutionModel["ExecutionModelCallableKHR"] = 5318] = "ExecutionModelCallableKHR";
        ExecutionModel[ExecutionModel["ExecutionModelCallableNV"] = 5318] = "ExecutionModelCallableNV";
        ExecutionModel[ExecutionModel["ExecutionModelMax"] = 2147483647] = "ExecutionModelMax";
    })(ExecutionModel || (ExecutionModel = {}));
    var AddressingModel;
    (function (AddressingModel) {
        AddressingModel[AddressingModel["AddressingModelLogical"] = 0] = "AddressingModelLogical";
        AddressingModel[AddressingModel["AddressingModelPhysical32"] = 1] = "AddressingModelPhysical32";
        AddressingModel[AddressingModel["AddressingModelPhysical64"] = 2] = "AddressingModelPhysical64";
        AddressingModel[AddressingModel["AddressingModelPhysicalStorageBuffer64"] = 5348] = "AddressingModelPhysicalStorageBuffer64";
        AddressingModel[AddressingModel["AddressingModelPhysicalStorageBuffer64EXT"] = 5348] = "AddressingModelPhysicalStorageBuffer64EXT";
        AddressingModel[AddressingModel["AddressingModelMax"] = 2147483647] = "AddressingModelMax";
    })(AddressingModel || (AddressingModel = {}));
    var MemoryModel;
    (function (MemoryModel) {
        MemoryModel[MemoryModel["MemoryModelSimple"] = 0] = "MemoryModelSimple";
        MemoryModel[MemoryModel["MemoryModelGLSL450"] = 1] = "MemoryModelGLSL450";
        MemoryModel[MemoryModel["MemoryModelOpenCL"] = 2] = "MemoryModelOpenCL";
        MemoryModel[MemoryModel["MemoryModelVulkan"] = 3] = "MemoryModelVulkan";
        MemoryModel[MemoryModel["MemoryModelVulkanKHR"] = 3] = "MemoryModelVulkanKHR";
        MemoryModel[MemoryModel["MemoryModelMax"] = 2147483647] = "MemoryModelMax";
    })(MemoryModel || (MemoryModel = {}));
    var ExecutionMode;
    (function (ExecutionMode) {
        ExecutionMode[ExecutionMode["ExecutionModeInvocations"] = 0] = "ExecutionModeInvocations";
        ExecutionMode[ExecutionMode["ExecutionModeSpacingEqual"] = 1] = "ExecutionModeSpacingEqual";
        ExecutionMode[ExecutionMode["ExecutionModeSpacingFractionalEven"] = 2] = "ExecutionModeSpacingFractionalEven";
        ExecutionMode[ExecutionMode["ExecutionModeSpacingFractionalOdd"] = 3] = "ExecutionModeSpacingFractionalOdd";
        ExecutionMode[ExecutionMode["ExecutionModeVertexOrderCw"] = 4] = "ExecutionModeVertexOrderCw";
        ExecutionMode[ExecutionMode["ExecutionModeVertexOrderCcw"] = 5] = "ExecutionModeVertexOrderCcw";
        ExecutionMode[ExecutionMode["ExecutionModePixelCenterInteger"] = 6] = "ExecutionModePixelCenterInteger";
        ExecutionMode[ExecutionMode["ExecutionModeOriginUpperLeft"] = 7] = "ExecutionModeOriginUpperLeft";
        ExecutionMode[ExecutionMode["ExecutionModeOriginLowerLeft"] = 8] = "ExecutionModeOriginLowerLeft";
        ExecutionMode[ExecutionMode["ExecutionModeEarlyFragmentTests"] = 9] = "ExecutionModeEarlyFragmentTests";
        ExecutionMode[ExecutionMode["ExecutionModePointMode"] = 10] = "ExecutionModePointMode";
        ExecutionMode[ExecutionMode["ExecutionModeXfb"] = 11] = "ExecutionModeXfb";
        ExecutionMode[ExecutionMode["ExecutionModeDepthReplacing"] = 12] = "ExecutionModeDepthReplacing";
        ExecutionMode[ExecutionMode["ExecutionModeDepthGreater"] = 14] = "ExecutionModeDepthGreater";
        ExecutionMode[ExecutionMode["ExecutionModeDepthLess"] = 15] = "ExecutionModeDepthLess";
        ExecutionMode[ExecutionMode["ExecutionModeDepthUnchanged"] = 16] = "ExecutionModeDepthUnchanged";
        ExecutionMode[ExecutionMode["ExecutionModeLocalSize"] = 17] = "ExecutionModeLocalSize";
        ExecutionMode[ExecutionMode["ExecutionModeLocalSizeHint"] = 18] = "ExecutionModeLocalSizeHint";
        ExecutionMode[ExecutionMode["ExecutionModeInputPoints"] = 19] = "ExecutionModeInputPoints";
        ExecutionMode[ExecutionMode["ExecutionModeInputLines"] = 20] = "ExecutionModeInputLines";
        ExecutionMode[ExecutionMode["ExecutionModeInputLinesAdjacency"] = 21] = "ExecutionModeInputLinesAdjacency";
        ExecutionMode[ExecutionMode["ExecutionModeTriangles"] = 22] = "ExecutionModeTriangles";
        ExecutionMode[ExecutionMode["ExecutionModeInputTrianglesAdjacency"] = 23] = "ExecutionModeInputTrianglesAdjacency";
        ExecutionMode[ExecutionMode["ExecutionModeQuads"] = 24] = "ExecutionModeQuads";
        ExecutionMode[ExecutionMode["ExecutionModeIsolines"] = 25] = "ExecutionModeIsolines";
        ExecutionMode[ExecutionMode["ExecutionModeOutputVertices"] = 26] = "ExecutionModeOutputVertices";
        ExecutionMode[ExecutionMode["ExecutionModeOutputPoints"] = 27] = "ExecutionModeOutputPoints";
        ExecutionMode[ExecutionMode["ExecutionModeOutputLineStrip"] = 28] = "ExecutionModeOutputLineStrip";
        ExecutionMode[ExecutionMode["ExecutionModeOutputTriangleStrip"] = 29] = "ExecutionModeOutputTriangleStrip";
        ExecutionMode[ExecutionMode["ExecutionModeVecTypeHint"] = 30] = "ExecutionModeVecTypeHint";
        ExecutionMode[ExecutionMode["ExecutionModeContractionOff"] = 31] = "ExecutionModeContractionOff";
        ExecutionMode[ExecutionMode["ExecutionModeInitializer"] = 33] = "ExecutionModeInitializer";
        ExecutionMode[ExecutionMode["ExecutionModeFinalizer"] = 34] = "ExecutionModeFinalizer";
        ExecutionMode[ExecutionMode["ExecutionModeSubgroupSize"] = 35] = "ExecutionModeSubgroupSize";
        ExecutionMode[ExecutionMode["ExecutionModeSubgroupsPerWorkgroup"] = 36] = "ExecutionModeSubgroupsPerWorkgroup";
        ExecutionMode[ExecutionMode["ExecutionModeSubgroupsPerWorkgroupId"] = 37] = "ExecutionModeSubgroupsPerWorkgroupId";
        ExecutionMode[ExecutionMode["ExecutionModeLocalSizeId"] = 38] = "ExecutionModeLocalSizeId";
        ExecutionMode[ExecutionMode["ExecutionModeLocalSizeHintId"] = 39] = "ExecutionModeLocalSizeHintId";
        ExecutionMode[ExecutionMode["ExecutionModePostDepthCoverage"] = 4446] = "ExecutionModePostDepthCoverage";
        ExecutionMode[ExecutionMode["ExecutionModeDenormPreserve"] = 4459] = "ExecutionModeDenormPreserve";
        ExecutionMode[ExecutionMode["ExecutionModeDenormFlushToZero"] = 4460] = "ExecutionModeDenormFlushToZero";
        ExecutionMode[ExecutionMode["ExecutionModeSignedZeroInfNanPreserve"] = 4461] = "ExecutionModeSignedZeroInfNanPreserve";
        ExecutionMode[ExecutionMode["ExecutionModeRoundingModeRTE"] = 4462] = "ExecutionModeRoundingModeRTE";
        ExecutionMode[ExecutionMode["ExecutionModeRoundingModeRTZ"] = 4463] = "ExecutionModeRoundingModeRTZ";
        ExecutionMode[ExecutionMode["ExecutionModeStencilRefReplacingEXT"] = 5027] = "ExecutionModeStencilRefReplacingEXT";
        ExecutionMode[ExecutionMode["ExecutionModeOutputLinesNV"] = 5269] = "ExecutionModeOutputLinesNV";
        ExecutionMode[ExecutionMode["ExecutionModeOutputPrimitivesNV"] = 5270] = "ExecutionModeOutputPrimitivesNV";
        ExecutionMode[ExecutionMode["ExecutionModeDerivativeGroupQuadsNV"] = 5289] = "ExecutionModeDerivativeGroupQuadsNV";
        ExecutionMode[ExecutionMode["ExecutionModeDerivativeGroupLinearNV"] = 5290] = "ExecutionModeDerivativeGroupLinearNV";
        ExecutionMode[ExecutionMode["ExecutionModeOutputTrianglesNV"] = 5298] = "ExecutionModeOutputTrianglesNV";
        ExecutionMode[ExecutionMode["ExecutionModePixelInterlockOrderedEXT"] = 5366] = "ExecutionModePixelInterlockOrderedEXT";
        ExecutionMode[ExecutionMode["ExecutionModePixelInterlockUnorderedEXT"] = 5367] = "ExecutionModePixelInterlockUnorderedEXT";
        ExecutionMode[ExecutionMode["ExecutionModeSampleInterlockOrderedEXT"] = 5368] = "ExecutionModeSampleInterlockOrderedEXT";
        ExecutionMode[ExecutionMode["ExecutionModeSampleInterlockUnorderedEXT"] = 5369] = "ExecutionModeSampleInterlockUnorderedEXT";
        ExecutionMode[ExecutionMode["ExecutionModeShadingRateInterlockOrderedEXT"] = 5370] = "ExecutionModeShadingRateInterlockOrderedEXT";
        ExecutionMode[ExecutionMode["ExecutionModeShadingRateInterlockUnorderedEXT"] = 5371] = "ExecutionModeShadingRateInterlockUnorderedEXT";
        ExecutionMode[ExecutionMode["ExecutionModeMaxWorkgroupSizeINTEL"] = 5893] = "ExecutionModeMaxWorkgroupSizeINTEL";
        ExecutionMode[ExecutionMode["ExecutionModeMaxWorkDimINTEL"] = 5894] = "ExecutionModeMaxWorkDimINTEL";
        ExecutionMode[ExecutionMode["ExecutionModeNoGlobalOffsetINTEL"] = 5895] = "ExecutionModeNoGlobalOffsetINTEL";
        ExecutionMode[ExecutionMode["ExecutionModeNumSIMDWorkitemsINTEL"] = 5896] = "ExecutionModeNumSIMDWorkitemsINTEL";
        ExecutionMode[ExecutionMode["ExecutionModeMax"] = 2147483647] = "ExecutionModeMax";
    })(ExecutionMode || (ExecutionMode = {}));
    var StorageClass;
    (function (StorageClass) {
        StorageClass[StorageClass["StorageClassUniformConstant"] = 0] = "StorageClassUniformConstant";
        StorageClass[StorageClass["StorageClassInput"] = 1] = "StorageClassInput";
        StorageClass[StorageClass["StorageClassUniform"] = 2] = "StorageClassUniform";
        StorageClass[StorageClass["StorageClassOutput"] = 3] = "StorageClassOutput";
        StorageClass[StorageClass["StorageClassWorkgroup"] = 4] = "StorageClassWorkgroup";
        StorageClass[StorageClass["StorageClassCrossWorkgroup"] = 5] = "StorageClassCrossWorkgroup";
        StorageClass[StorageClass["StorageClassPrivate"] = 6] = "StorageClassPrivate";
        StorageClass[StorageClass["StorageClassFunction"] = 7] = "StorageClassFunction";
        StorageClass[StorageClass["StorageClassGeneric"] = 8] = "StorageClassGeneric";
        StorageClass[StorageClass["StorageClassPushConstant"] = 9] = "StorageClassPushConstant";
        StorageClass[StorageClass["StorageClassAtomicCounter"] = 10] = "StorageClassAtomicCounter";
        StorageClass[StorageClass["StorageClassImage"] = 11] = "StorageClassImage";
        StorageClass[StorageClass["StorageClassStorageBuffer"] = 12] = "StorageClassStorageBuffer";
        StorageClass[StorageClass["StorageClassCallableDataKHR"] = 5328] = "StorageClassCallableDataKHR";
        StorageClass[StorageClass["StorageClassCallableDataNV"] = 5328] = "StorageClassCallableDataNV";
        StorageClass[StorageClass["StorageClassIncomingCallableDataKHR"] = 5329] = "StorageClassIncomingCallableDataKHR";
        StorageClass[StorageClass["StorageClassIncomingCallableDataNV"] = 5329] = "StorageClassIncomingCallableDataNV";
        StorageClass[StorageClass["StorageClassRayPayloadKHR"] = 5338] = "StorageClassRayPayloadKHR";
        StorageClass[StorageClass["StorageClassRayPayloadNV"] = 5338] = "StorageClassRayPayloadNV";
        StorageClass[StorageClass["StorageClassHitAttributeKHR"] = 5339] = "StorageClassHitAttributeKHR";
        StorageClass[StorageClass["StorageClassHitAttributeNV"] = 5339] = "StorageClassHitAttributeNV";
        StorageClass[StorageClass["StorageClassIncomingRayPayloadKHR"] = 5342] = "StorageClassIncomingRayPayloadKHR";
        StorageClass[StorageClass["StorageClassIncomingRayPayloadNV"] = 5342] = "StorageClassIncomingRayPayloadNV";
        StorageClass[StorageClass["StorageClassShaderRecordBufferKHR"] = 5343] = "StorageClassShaderRecordBufferKHR";
        StorageClass[StorageClass["StorageClassShaderRecordBufferNV"] = 5343] = "StorageClassShaderRecordBufferNV";
        StorageClass[StorageClass["StorageClassPhysicalStorageBuffer"] = 5349] = "StorageClassPhysicalStorageBuffer";
        StorageClass[StorageClass["StorageClassPhysicalStorageBufferEXT"] = 5349] = "StorageClassPhysicalStorageBufferEXT";
        StorageClass[StorageClass["StorageClassCodeSectionINTEL"] = 5605] = "StorageClassCodeSectionINTEL";
        StorageClass[StorageClass["StorageClassMax"] = 2147483647] = "StorageClassMax";
    })(StorageClass || (StorageClass = {}));
    var Dim;
    (function (Dim) {
        Dim[Dim["Dim1D"] = 0] = "Dim1D";
        Dim[Dim["Dim2D"] = 1] = "Dim2D";
        Dim[Dim["Dim3D"] = 2] = "Dim3D";
        Dim[Dim["DimCube"] = 3] = "DimCube";
        Dim[Dim["DimRect"] = 4] = "DimRect";
        Dim[Dim["DimBuffer"] = 5] = "DimBuffer";
        Dim[Dim["DimSubpassData"] = 6] = "DimSubpassData";
        Dim[Dim["DimMax"] = 2147483647] = "DimMax";
    })(Dim || (Dim = {}));
    var SamplerAddressingMode;
    (function (SamplerAddressingMode) {
        SamplerAddressingMode[SamplerAddressingMode["SamplerAddressingModeNone"] = 0] = "SamplerAddressingModeNone";
        SamplerAddressingMode[SamplerAddressingMode["SamplerAddressingModeClampToEdge"] = 1] = "SamplerAddressingModeClampToEdge";
        SamplerAddressingMode[SamplerAddressingMode["SamplerAddressingModeClamp"] = 2] = "SamplerAddressingModeClamp";
        SamplerAddressingMode[SamplerAddressingMode["SamplerAddressingModeRepeat"] = 3] = "SamplerAddressingModeRepeat";
        SamplerAddressingMode[SamplerAddressingMode["SamplerAddressingModeRepeatMirrored"] = 4] = "SamplerAddressingModeRepeatMirrored";
        SamplerAddressingMode[SamplerAddressingMode["SamplerAddressingModeMax"] = 2147483647] = "SamplerAddressingModeMax";
    })(SamplerAddressingMode || (SamplerAddressingMode = {}));
    var SamplerFilterMode;
    (function (SamplerFilterMode) {
        SamplerFilterMode[SamplerFilterMode["SamplerFilterModeNearest"] = 0] = "SamplerFilterModeNearest";
        SamplerFilterMode[SamplerFilterMode["SamplerFilterModeLinear"] = 1] = "SamplerFilterModeLinear";
        SamplerFilterMode[SamplerFilterMode["SamplerFilterModeMax"] = 2147483647] = "SamplerFilterModeMax";
    })(SamplerFilterMode || (SamplerFilterMode = {}));
    var ImageFormat;
    (function (ImageFormat) {
        ImageFormat[ImageFormat["ImageFormatUnknown"] = 0] = "ImageFormatUnknown";
        ImageFormat[ImageFormat["ImageFormatRgba32f"] = 1] = "ImageFormatRgba32f";
        ImageFormat[ImageFormat["ImageFormatRgba16f"] = 2] = "ImageFormatRgba16f";
        ImageFormat[ImageFormat["ImageFormatR32f"] = 3] = "ImageFormatR32f";
        ImageFormat[ImageFormat["ImageFormatRgba8"] = 4] = "ImageFormatRgba8";
        ImageFormat[ImageFormat["ImageFormatRgba8Snorm"] = 5] = "ImageFormatRgba8Snorm";
        ImageFormat[ImageFormat["ImageFormatRg32f"] = 6] = "ImageFormatRg32f";
        ImageFormat[ImageFormat["ImageFormatRg16f"] = 7] = "ImageFormatRg16f";
        ImageFormat[ImageFormat["ImageFormatR11fG11fB10f"] = 8] = "ImageFormatR11fG11fB10f";
        ImageFormat[ImageFormat["ImageFormatR16f"] = 9] = "ImageFormatR16f";
        ImageFormat[ImageFormat["ImageFormatRgba16"] = 10] = "ImageFormatRgba16";
        ImageFormat[ImageFormat["ImageFormatRgb10A2"] = 11] = "ImageFormatRgb10A2";
        ImageFormat[ImageFormat["ImageFormatRg16"] = 12] = "ImageFormatRg16";
        ImageFormat[ImageFormat["ImageFormatRg8"] = 13] = "ImageFormatRg8";
        ImageFormat[ImageFormat["ImageFormatR16"] = 14] = "ImageFormatR16";
        ImageFormat[ImageFormat["ImageFormatR8"] = 15] = "ImageFormatR8";
        ImageFormat[ImageFormat["ImageFormatRgba16Snorm"] = 16] = "ImageFormatRgba16Snorm";
        ImageFormat[ImageFormat["ImageFormatRg16Snorm"] = 17] = "ImageFormatRg16Snorm";
        ImageFormat[ImageFormat["ImageFormatRg8Snorm"] = 18] = "ImageFormatRg8Snorm";
        ImageFormat[ImageFormat["ImageFormatR16Snorm"] = 19] = "ImageFormatR16Snorm";
        ImageFormat[ImageFormat["ImageFormatR8Snorm"] = 20] = "ImageFormatR8Snorm";
        ImageFormat[ImageFormat["ImageFormatRgba32i"] = 21] = "ImageFormatRgba32i";
        ImageFormat[ImageFormat["ImageFormatRgba16i"] = 22] = "ImageFormatRgba16i";
        ImageFormat[ImageFormat["ImageFormatRgba8i"] = 23] = "ImageFormatRgba8i";
        ImageFormat[ImageFormat["ImageFormatR32i"] = 24] = "ImageFormatR32i";
        ImageFormat[ImageFormat["ImageFormatRg32i"] = 25] = "ImageFormatRg32i";
        ImageFormat[ImageFormat["ImageFormatRg16i"] = 26] = "ImageFormatRg16i";
        ImageFormat[ImageFormat["ImageFormatRg8i"] = 27] = "ImageFormatRg8i";
        ImageFormat[ImageFormat["ImageFormatR16i"] = 28] = "ImageFormatR16i";
        ImageFormat[ImageFormat["ImageFormatR8i"] = 29] = "ImageFormatR8i";
        ImageFormat[ImageFormat["ImageFormatRgba32ui"] = 30] = "ImageFormatRgba32ui";
        ImageFormat[ImageFormat["ImageFormatRgba16ui"] = 31] = "ImageFormatRgba16ui";
        ImageFormat[ImageFormat["ImageFormatRgba8ui"] = 32] = "ImageFormatRgba8ui";
        ImageFormat[ImageFormat["ImageFormatR32ui"] = 33] = "ImageFormatR32ui";
        ImageFormat[ImageFormat["ImageFormatRgb10a2ui"] = 34] = "ImageFormatRgb10a2ui";
        ImageFormat[ImageFormat["ImageFormatRg32ui"] = 35] = "ImageFormatRg32ui";
        ImageFormat[ImageFormat["ImageFormatRg16ui"] = 36] = "ImageFormatRg16ui";
        ImageFormat[ImageFormat["ImageFormatRg8ui"] = 37] = "ImageFormatRg8ui";
        ImageFormat[ImageFormat["ImageFormatR16ui"] = 38] = "ImageFormatR16ui";
        ImageFormat[ImageFormat["ImageFormatR8ui"] = 39] = "ImageFormatR8ui";
        ImageFormat[ImageFormat["ImageFormatR64ui"] = 40] = "ImageFormatR64ui";
        ImageFormat[ImageFormat["ImageFormatR64i"] = 41] = "ImageFormatR64i";
        ImageFormat[ImageFormat["ImageFormatMax"] = 2147483647] = "ImageFormatMax";
    })(ImageFormat || (ImageFormat = {}));
    var ImageChannelOrder;
    (function (ImageChannelOrder) {
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderR"] = 0] = "ImageChannelOrderR";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderA"] = 1] = "ImageChannelOrderA";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderRG"] = 2] = "ImageChannelOrderRG";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderRA"] = 3] = "ImageChannelOrderRA";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderRGB"] = 4] = "ImageChannelOrderRGB";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderRGBA"] = 5] = "ImageChannelOrderRGBA";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderBGRA"] = 6] = "ImageChannelOrderBGRA";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderARGB"] = 7] = "ImageChannelOrderARGB";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderIntensity"] = 8] = "ImageChannelOrderIntensity";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderLuminance"] = 9] = "ImageChannelOrderLuminance";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderRx"] = 10] = "ImageChannelOrderRx";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderRGx"] = 11] = "ImageChannelOrderRGx";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderRGBx"] = 12] = "ImageChannelOrderRGBx";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderDepth"] = 13] = "ImageChannelOrderDepth";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderDepthStencil"] = 14] = "ImageChannelOrderDepthStencil";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrdersRGB"] = 15] = "ImageChannelOrdersRGB";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrdersRGBx"] = 16] = "ImageChannelOrdersRGBx";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrdersRGBA"] = 17] = "ImageChannelOrdersRGBA";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrdersBGRA"] = 18] = "ImageChannelOrdersBGRA";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderABGR"] = 19] = "ImageChannelOrderABGR";
        ImageChannelOrder[ImageChannelOrder["ImageChannelOrderMax"] = 2147483647] = "ImageChannelOrderMax";
    })(ImageChannelOrder || (ImageChannelOrder = {}));
    var ImageChannelDataType;
    (function (ImageChannelDataType) {
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeSnormInt8"] = 0] = "ImageChannelDataTypeSnormInt8";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeSnormInt16"] = 1] = "ImageChannelDataTypeSnormInt16";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeUnormInt8"] = 2] = "ImageChannelDataTypeUnormInt8";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeUnormInt16"] = 3] = "ImageChannelDataTypeUnormInt16";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeUnormShort565"] = 4] = "ImageChannelDataTypeUnormShort565";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeUnormShort555"] = 5] = "ImageChannelDataTypeUnormShort555";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeUnormInt101010"] = 6] = "ImageChannelDataTypeUnormInt101010";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeSignedInt8"] = 7] = "ImageChannelDataTypeSignedInt8";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeSignedInt16"] = 8] = "ImageChannelDataTypeSignedInt16";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeSignedInt32"] = 9] = "ImageChannelDataTypeSignedInt32";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeUnsignedInt8"] = 10] = "ImageChannelDataTypeUnsignedInt8";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeUnsignedInt16"] = 11] = "ImageChannelDataTypeUnsignedInt16";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeUnsignedInt32"] = 12] = "ImageChannelDataTypeUnsignedInt32";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeHalfFloat"] = 13] = "ImageChannelDataTypeHalfFloat";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeFloat"] = 14] = "ImageChannelDataTypeFloat";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeUnormInt24"] = 15] = "ImageChannelDataTypeUnormInt24";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeUnormInt101010_2"] = 16] = "ImageChannelDataTypeUnormInt101010_2";
        ImageChannelDataType[ImageChannelDataType["ImageChannelDataTypeMax"] = 2147483647] = "ImageChannelDataTypeMax";
    })(ImageChannelDataType || (ImageChannelDataType = {}));
    var ImageOperandsShift;
    (function (ImageOperandsShift) {
        ImageOperandsShift[ImageOperandsShift["ImageOperandsBiasShift"] = 0] = "ImageOperandsBiasShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsLodShift"] = 1] = "ImageOperandsLodShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsGradShift"] = 2] = "ImageOperandsGradShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsConstOffsetShift"] = 3] = "ImageOperandsConstOffsetShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsOffsetShift"] = 4] = "ImageOperandsOffsetShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsConstOffsetsShift"] = 5] = "ImageOperandsConstOffsetsShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsSampleShift"] = 6] = "ImageOperandsSampleShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsMinLodShift"] = 7] = "ImageOperandsMinLodShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsMakeTexelAvailableShift"] = 8] = "ImageOperandsMakeTexelAvailableShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsMakeTexelAvailableKHRShift"] = 8] = "ImageOperandsMakeTexelAvailableKHRShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsMakeTexelVisibleShift"] = 9] = "ImageOperandsMakeTexelVisibleShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsMakeTexelVisibleKHRShift"] = 9] = "ImageOperandsMakeTexelVisibleKHRShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsNonPrivateTexelShift"] = 10] = "ImageOperandsNonPrivateTexelShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsNonPrivateTexelKHRShift"] = 10] = "ImageOperandsNonPrivateTexelKHRShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsVolatileTexelShift"] = 11] = "ImageOperandsVolatileTexelShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsVolatileTexelKHRShift"] = 11] = "ImageOperandsVolatileTexelKHRShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsSignExtendShift"] = 12] = "ImageOperandsSignExtendShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsZeroExtendShift"] = 13] = "ImageOperandsZeroExtendShift";
        ImageOperandsShift[ImageOperandsShift["ImageOperandsMax"] = 2147483647] = "ImageOperandsMax";
    })(ImageOperandsShift || (ImageOperandsShift = {}));
    var ImageOperandsMask;
    (function (ImageOperandsMask) {
        ImageOperandsMask[ImageOperandsMask["ImageOperandsMaskNone"] = 0] = "ImageOperandsMaskNone";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsBiasMask"] = 1] = "ImageOperandsBiasMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsLodMask"] = 2] = "ImageOperandsLodMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsGradMask"] = 4] = "ImageOperandsGradMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsConstOffsetMask"] = 8] = "ImageOperandsConstOffsetMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsOffsetMask"] = 16] = "ImageOperandsOffsetMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsConstOffsetsMask"] = 32] = "ImageOperandsConstOffsetsMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsSampleMask"] = 64] = "ImageOperandsSampleMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsMinLodMask"] = 128] = "ImageOperandsMinLodMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsMakeTexelAvailableMask"] = 256] = "ImageOperandsMakeTexelAvailableMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsMakeTexelAvailableKHRMask"] = 256] = "ImageOperandsMakeTexelAvailableKHRMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsMakeTexelVisibleMask"] = 512] = "ImageOperandsMakeTexelVisibleMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsMakeTexelVisibleKHRMask"] = 512] = "ImageOperandsMakeTexelVisibleKHRMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsNonPrivateTexelMask"] = 1024] = "ImageOperandsNonPrivateTexelMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsNonPrivateTexelKHRMask"] = 1024] = "ImageOperandsNonPrivateTexelKHRMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsVolatileTexelMask"] = 2048] = "ImageOperandsVolatileTexelMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsVolatileTexelKHRMask"] = 2048] = "ImageOperandsVolatileTexelKHRMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsSignExtendMask"] = 4096] = "ImageOperandsSignExtendMask";
        ImageOperandsMask[ImageOperandsMask["ImageOperandsZeroExtendMask"] = 8192] = "ImageOperandsZeroExtendMask";
    })(ImageOperandsMask || (ImageOperandsMask = {}));
    var FPFastMathModeShift;
    (function (FPFastMathModeShift) {
        FPFastMathModeShift[FPFastMathModeShift["FPFastMathModeNotNaNShift"] = 0] = "FPFastMathModeNotNaNShift";
        FPFastMathModeShift[FPFastMathModeShift["FPFastMathModeNotInfShift"] = 1] = "FPFastMathModeNotInfShift";
        FPFastMathModeShift[FPFastMathModeShift["FPFastMathModeNSZShift"] = 2] = "FPFastMathModeNSZShift";
        FPFastMathModeShift[FPFastMathModeShift["FPFastMathModeAllowRecipShift"] = 3] = "FPFastMathModeAllowRecipShift";
        FPFastMathModeShift[FPFastMathModeShift["FPFastMathModeFastShift"] = 4] = "FPFastMathModeFastShift";
        FPFastMathModeShift[FPFastMathModeShift["FPFastMathModeMax"] = 2147483647] = "FPFastMathModeMax";
    })(FPFastMathModeShift || (FPFastMathModeShift = {}));
    var FPFastMathModeMask;
    (function (FPFastMathModeMask) {
        FPFastMathModeMask[FPFastMathModeMask["FPFastMathModeMaskNone"] = 0] = "FPFastMathModeMaskNone";
        FPFastMathModeMask[FPFastMathModeMask["FPFastMathModeNotNaNMask"] = 1] = "FPFastMathModeNotNaNMask";
        FPFastMathModeMask[FPFastMathModeMask["FPFastMathModeNotInfMask"] = 2] = "FPFastMathModeNotInfMask";
        FPFastMathModeMask[FPFastMathModeMask["FPFastMathModeNSZMask"] = 4] = "FPFastMathModeNSZMask";
        FPFastMathModeMask[FPFastMathModeMask["FPFastMathModeAllowRecipMask"] = 8] = "FPFastMathModeAllowRecipMask";
        FPFastMathModeMask[FPFastMathModeMask["FPFastMathModeFastMask"] = 16] = "FPFastMathModeFastMask";
    })(FPFastMathModeMask || (FPFastMathModeMask = {}));
    var FPRoundingMode;
    (function (FPRoundingMode) {
        FPRoundingMode[FPRoundingMode["FPRoundingModeRTE"] = 0] = "FPRoundingModeRTE";
        FPRoundingMode[FPRoundingMode["FPRoundingModeRTZ"] = 1] = "FPRoundingModeRTZ";
        FPRoundingMode[FPRoundingMode["FPRoundingModeRTP"] = 2] = "FPRoundingModeRTP";
        FPRoundingMode[FPRoundingMode["FPRoundingModeRTN"] = 3] = "FPRoundingModeRTN";
        FPRoundingMode[FPRoundingMode["FPRoundingModeMax"] = 2147483647] = "FPRoundingModeMax";
    })(FPRoundingMode || (FPRoundingMode = {}));
    var LinkageType;
    (function (LinkageType) {
        LinkageType[LinkageType["LinkageTypeExport"] = 0] = "LinkageTypeExport";
        LinkageType[LinkageType["LinkageTypeImport"] = 1] = "LinkageTypeImport";
        LinkageType[LinkageType["LinkageTypeMax"] = 2147483647] = "LinkageTypeMax";
    })(LinkageType || (LinkageType = {}));
    var AccessQualifier;
    (function (AccessQualifier) {
        AccessQualifier[AccessQualifier["AccessQualifierReadOnly"] = 0] = "AccessQualifierReadOnly";
        AccessQualifier[AccessQualifier["AccessQualifierWriteOnly"] = 1] = "AccessQualifierWriteOnly";
        AccessQualifier[AccessQualifier["AccessQualifierReadWrite"] = 2] = "AccessQualifierReadWrite";
        AccessQualifier[AccessQualifier["AccessQualifierMax"] = 2147483647] = "AccessQualifierMax";
    })(AccessQualifier || (AccessQualifier = {}));
    var FunctionParameterAttribute;
    (function (FunctionParameterAttribute) {
        FunctionParameterAttribute[FunctionParameterAttribute["FunctionParameterAttributeZext"] = 0] = "FunctionParameterAttributeZext";
        FunctionParameterAttribute[FunctionParameterAttribute["FunctionParameterAttributeSext"] = 1] = "FunctionParameterAttributeSext";
        FunctionParameterAttribute[FunctionParameterAttribute["FunctionParameterAttributeByVal"] = 2] = "FunctionParameterAttributeByVal";
        FunctionParameterAttribute[FunctionParameterAttribute["FunctionParameterAttributeSret"] = 3] = "FunctionParameterAttributeSret";
        FunctionParameterAttribute[FunctionParameterAttribute["FunctionParameterAttributeNoAlias"] = 4] = "FunctionParameterAttributeNoAlias";
        FunctionParameterAttribute[FunctionParameterAttribute["FunctionParameterAttributeNoCapture"] = 5] = "FunctionParameterAttributeNoCapture";
        FunctionParameterAttribute[FunctionParameterAttribute["FunctionParameterAttributeNoWrite"] = 6] = "FunctionParameterAttributeNoWrite";
        FunctionParameterAttribute[FunctionParameterAttribute["FunctionParameterAttributeNoReadWrite"] = 7] = "FunctionParameterAttributeNoReadWrite";
        FunctionParameterAttribute[FunctionParameterAttribute["FunctionParameterAttributeMax"] = 2147483647] = "FunctionParameterAttributeMax";
    })(FunctionParameterAttribute || (FunctionParameterAttribute = {}));
    var Decoration;
    (function (Decoration) {
        Decoration[Decoration["DecorationRelaxedPrecision"] = 0] = "DecorationRelaxedPrecision";
        Decoration[Decoration["DecorationSpecId"] = 1] = "DecorationSpecId";
        Decoration[Decoration["DecorationBlock"] = 2] = "DecorationBlock";
        Decoration[Decoration["DecorationBufferBlock"] = 3] = "DecorationBufferBlock";
        Decoration[Decoration["DecorationRowMajor"] = 4] = "DecorationRowMajor";
        Decoration[Decoration["DecorationColMajor"] = 5] = "DecorationColMajor";
        Decoration[Decoration["DecorationArrayStride"] = 6] = "DecorationArrayStride";
        Decoration[Decoration["DecorationMatrixStride"] = 7] = "DecorationMatrixStride";
        Decoration[Decoration["DecorationGLSLShared"] = 8] = "DecorationGLSLShared";
        Decoration[Decoration["DecorationGLSLPacked"] = 9] = "DecorationGLSLPacked";
        Decoration[Decoration["DecorationCPacked"] = 10] = "DecorationCPacked";
        Decoration[Decoration["DecorationBuiltIn"] = 11] = "DecorationBuiltIn";
        Decoration[Decoration["DecorationNoPerspective"] = 13] = "DecorationNoPerspective";
        Decoration[Decoration["DecorationFlat"] = 14] = "DecorationFlat";
        Decoration[Decoration["DecorationPatch"] = 15] = "DecorationPatch";
        Decoration[Decoration["DecorationCentroid"] = 16] = "DecorationCentroid";
        Decoration[Decoration["DecorationSample"] = 17] = "DecorationSample";
        Decoration[Decoration["DecorationInvariant"] = 18] = "DecorationInvariant";
        Decoration[Decoration["DecorationRestrict"] = 19] = "DecorationRestrict";
        Decoration[Decoration["DecorationAliased"] = 20] = "DecorationAliased";
        Decoration[Decoration["DecorationVolatile"] = 21] = "DecorationVolatile";
        Decoration[Decoration["DecorationConstant"] = 22] = "DecorationConstant";
        Decoration[Decoration["DecorationCoherent"] = 23] = "DecorationCoherent";
        Decoration[Decoration["DecorationNonWritable"] = 24] = "DecorationNonWritable";
        Decoration[Decoration["DecorationNonReadable"] = 25] = "DecorationNonReadable";
        Decoration[Decoration["DecorationUniform"] = 26] = "DecorationUniform";
        Decoration[Decoration["DecorationUniformId"] = 27] = "DecorationUniformId";
        Decoration[Decoration["DecorationSaturatedConversion"] = 28] = "DecorationSaturatedConversion";
        Decoration[Decoration["DecorationStream"] = 29] = "DecorationStream";
        Decoration[Decoration["DecorationLocation"] = 30] = "DecorationLocation";
        Decoration[Decoration["DecorationComponent"] = 31] = "DecorationComponent";
        Decoration[Decoration["DecorationIndex"] = 32] = "DecorationIndex";
        Decoration[Decoration["DecorationBinding"] = 33] = "DecorationBinding";
        Decoration[Decoration["DecorationDescriptorSet"] = 34] = "DecorationDescriptorSet";
        Decoration[Decoration["DecorationOffset"] = 35] = "DecorationOffset";
        Decoration[Decoration["DecorationXfbBuffer"] = 36] = "DecorationXfbBuffer";
        Decoration[Decoration["DecorationXfbStride"] = 37] = "DecorationXfbStride";
        Decoration[Decoration["DecorationFuncParamAttr"] = 38] = "DecorationFuncParamAttr";
        Decoration[Decoration["DecorationFPRoundingMode"] = 39] = "DecorationFPRoundingMode";
        Decoration[Decoration["DecorationFPFastMathMode"] = 40] = "DecorationFPFastMathMode";
        Decoration[Decoration["DecorationLinkageAttributes"] = 41] = "DecorationLinkageAttributes";
        Decoration[Decoration["DecorationNoContraction"] = 42] = "DecorationNoContraction";
        Decoration[Decoration["DecorationInputAttachmentIndex"] = 43] = "DecorationInputAttachmentIndex";
        Decoration[Decoration["DecorationAlignment"] = 44] = "DecorationAlignment";
        Decoration[Decoration["DecorationMaxByteOffset"] = 45] = "DecorationMaxByteOffset";
        Decoration[Decoration["DecorationAlignmentId"] = 46] = "DecorationAlignmentId";
        Decoration[Decoration["DecorationMaxByteOffsetId"] = 47] = "DecorationMaxByteOffsetId";
        Decoration[Decoration["DecorationNoSignedWrap"] = 4469] = "DecorationNoSignedWrap";
        Decoration[Decoration["DecorationNoUnsignedWrap"] = 4470] = "DecorationNoUnsignedWrap";
        Decoration[Decoration["DecorationExplicitInterpAMD"] = 4999] = "DecorationExplicitInterpAMD";
        Decoration[Decoration["DecorationOverrideCoverageNV"] = 5248] = "DecorationOverrideCoverageNV";
        Decoration[Decoration["DecorationPassthroughNV"] = 5250] = "DecorationPassthroughNV";
        Decoration[Decoration["DecorationViewportRelativeNV"] = 5252] = "DecorationViewportRelativeNV";
        Decoration[Decoration["DecorationSecondaryViewportRelativeNV"] = 5256] = "DecorationSecondaryViewportRelativeNV";
        Decoration[Decoration["DecorationPerPrimitiveNV"] = 5271] = "DecorationPerPrimitiveNV";
        Decoration[Decoration["DecorationPerViewNV"] = 5272] = "DecorationPerViewNV";
        Decoration[Decoration["DecorationPerTaskNV"] = 5273] = "DecorationPerTaskNV";
        Decoration[Decoration["DecorationPerVertexNV"] = 5285] = "DecorationPerVertexNV";
        Decoration[Decoration["DecorationNonUniform"] = 5300] = "DecorationNonUniform";
        Decoration[Decoration["DecorationNonUniformEXT"] = 5300] = "DecorationNonUniformEXT";
        Decoration[Decoration["DecorationRestrictPointer"] = 5355] = "DecorationRestrictPointer";
        Decoration[Decoration["DecorationRestrictPointerEXT"] = 5355] = "DecorationRestrictPointerEXT";
        Decoration[Decoration["DecorationAliasedPointer"] = 5356] = "DecorationAliasedPointer";
        Decoration[Decoration["DecorationAliasedPointerEXT"] = 5356] = "DecorationAliasedPointerEXT";
        Decoration[Decoration["DecorationReferencedIndirectlyINTEL"] = 5602] = "DecorationReferencedIndirectlyINTEL";
        Decoration[Decoration["DecorationCounterBuffer"] = 5634] = "DecorationCounterBuffer";
        Decoration[Decoration["DecorationHlslCounterBufferGOOGLE"] = 5634] = "DecorationHlslCounterBufferGOOGLE";
        Decoration[Decoration["DecorationHlslSemanticGOOGLE"] = 5635] = "DecorationHlslSemanticGOOGLE";
        Decoration[Decoration["DecorationUserSemantic"] = 5635] = "DecorationUserSemantic";
        Decoration[Decoration["DecorationUserTypeGOOGLE"] = 5636] = "DecorationUserTypeGOOGLE";
        Decoration[Decoration["DecorationRegisterINTEL"] = 5825] = "DecorationRegisterINTEL";
        Decoration[Decoration["DecorationMemoryINTEL"] = 5826] = "DecorationMemoryINTEL";
        Decoration[Decoration["DecorationNumbanksINTEL"] = 5827] = "DecorationNumbanksINTEL";
        Decoration[Decoration["DecorationBankwidthINTEL"] = 5828] = "DecorationBankwidthINTEL";
        Decoration[Decoration["DecorationMaxPrivateCopiesINTEL"] = 5829] = "DecorationMaxPrivateCopiesINTEL";
        Decoration[Decoration["DecorationSinglepumpINTEL"] = 5830] = "DecorationSinglepumpINTEL";
        Decoration[Decoration["DecorationDoublepumpINTEL"] = 5831] = "DecorationDoublepumpINTEL";
        Decoration[Decoration["DecorationMaxReplicatesINTEL"] = 5832] = "DecorationMaxReplicatesINTEL";
        Decoration[Decoration["DecorationSimpleDualPortINTEL"] = 5833] = "DecorationSimpleDualPortINTEL";
        Decoration[Decoration["DecorationMergeINTEL"] = 5834] = "DecorationMergeINTEL";
        Decoration[Decoration["DecorationBankBitsINTEL"] = 5835] = "DecorationBankBitsINTEL";
        Decoration[Decoration["DecorationForcePow2DepthINTEL"] = 5836] = "DecorationForcePow2DepthINTEL";
        Decoration[Decoration["DecorationMax"] = 2147483647] = "DecorationMax";
    })(Decoration || (Decoration = {}));
    var BuiltIn;
    (function (BuiltIn) {
        BuiltIn[BuiltIn["BuiltInPosition"] = 0] = "BuiltInPosition";
        BuiltIn[BuiltIn["BuiltInPointSize"] = 1] = "BuiltInPointSize";
        BuiltIn[BuiltIn["BuiltInClipDistance"] = 3] = "BuiltInClipDistance";
        BuiltIn[BuiltIn["BuiltInCullDistance"] = 4] = "BuiltInCullDistance";
        BuiltIn[BuiltIn["BuiltInVertexId"] = 5] = "BuiltInVertexId";
        BuiltIn[BuiltIn["BuiltInInstanceId"] = 6] = "BuiltInInstanceId";
        BuiltIn[BuiltIn["BuiltInPrimitiveId"] = 7] = "BuiltInPrimitiveId";
        BuiltIn[BuiltIn["BuiltInInvocationId"] = 8] = "BuiltInInvocationId";
        BuiltIn[BuiltIn["BuiltInLayer"] = 9] = "BuiltInLayer";
        BuiltIn[BuiltIn["BuiltInViewportIndex"] = 10] = "BuiltInViewportIndex";
        BuiltIn[BuiltIn["BuiltInTessLevelOuter"] = 11] = "BuiltInTessLevelOuter";
        BuiltIn[BuiltIn["BuiltInTessLevelInner"] = 12] = "BuiltInTessLevelInner";
        BuiltIn[BuiltIn["BuiltInTessCoord"] = 13] = "BuiltInTessCoord";
        BuiltIn[BuiltIn["BuiltInPatchVertices"] = 14] = "BuiltInPatchVertices";
        BuiltIn[BuiltIn["BuiltInFragCoord"] = 15] = "BuiltInFragCoord";
        BuiltIn[BuiltIn["BuiltInPointCoord"] = 16] = "BuiltInPointCoord";
        BuiltIn[BuiltIn["BuiltInFrontFacing"] = 17] = "BuiltInFrontFacing";
        BuiltIn[BuiltIn["BuiltInSampleId"] = 18] = "BuiltInSampleId";
        BuiltIn[BuiltIn["BuiltInSamplePosition"] = 19] = "BuiltInSamplePosition";
        BuiltIn[BuiltIn["BuiltInSampleMask"] = 20] = "BuiltInSampleMask";
        BuiltIn[BuiltIn["BuiltInFragDepth"] = 22] = "BuiltInFragDepth";
        BuiltIn[BuiltIn["BuiltInHelperInvocation"] = 23] = "BuiltInHelperInvocation";
        BuiltIn[BuiltIn["BuiltInNumWorkgroups"] = 24] = "BuiltInNumWorkgroups";
        BuiltIn[BuiltIn["BuiltInWorkgroupSize"] = 25] = "BuiltInWorkgroupSize";
        BuiltIn[BuiltIn["BuiltInWorkgroupId"] = 26] = "BuiltInWorkgroupId";
        BuiltIn[BuiltIn["BuiltInLocalInvocationId"] = 27] = "BuiltInLocalInvocationId";
        BuiltIn[BuiltIn["BuiltInGlobalInvocationId"] = 28] = "BuiltInGlobalInvocationId";
        BuiltIn[BuiltIn["BuiltInLocalInvocationIndex"] = 29] = "BuiltInLocalInvocationIndex";
        BuiltIn[BuiltIn["BuiltInWorkDim"] = 30] = "BuiltInWorkDim";
        BuiltIn[BuiltIn["BuiltInGlobalSize"] = 31] = "BuiltInGlobalSize";
        BuiltIn[BuiltIn["BuiltInEnqueuedWorkgroupSize"] = 32] = "BuiltInEnqueuedWorkgroupSize";
        BuiltIn[BuiltIn["BuiltInGlobalOffset"] = 33] = "BuiltInGlobalOffset";
        BuiltIn[BuiltIn["BuiltInGlobalLinearId"] = 34] = "BuiltInGlobalLinearId";
        BuiltIn[BuiltIn["BuiltInSubgroupSize"] = 36] = "BuiltInSubgroupSize";
        BuiltIn[BuiltIn["BuiltInSubgroupMaxSize"] = 37] = "BuiltInSubgroupMaxSize";
        BuiltIn[BuiltIn["BuiltInNumSubgroups"] = 38] = "BuiltInNumSubgroups";
        BuiltIn[BuiltIn["BuiltInNumEnqueuedSubgroups"] = 39] = "BuiltInNumEnqueuedSubgroups";
        BuiltIn[BuiltIn["BuiltInSubgroupId"] = 40] = "BuiltInSubgroupId";
        BuiltIn[BuiltIn["BuiltInSubgroupLocalInvocationId"] = 41] = "BuiltInSubgroupLocalInvocationId";
        BuiltIn[BuiltIn["BuiltInVertexIndex"] = 42] = "BuiltInVertexIndex";
        BuiltIn[BuiltIn["BuiltInInstanceIndex"] = 43] = "BuiltInInstanceIndex";
        BuiltIn[BuiltIn["BuiltInSubgroupEqMask"] = 4416] = "BuiltInSubgroupEqMask";
        BuiltIn[BuiltIn["BuiltInSubgroupEqMaskKHR"] = 4416] = "BuiltInSubgroupEqMaskKHR";
        BuiltIn[BuiltIn["BuiltInSubgroupGeMask"] = 4417] = "BuiltInSubgroupGeMask";
        BuiltIn[BuiltIn["BuiltInSubgroupGeMaskKHR"] = 4417] = "BuiltInSubgroupGeMaskKHR";
        BuiltIn[BuiltIn["BuiltInSubgroupGtMask"] = 4418] = "BuiltInSubgroupGtMask";
        BuiltIn[BuiltIn["BuiltInSubgroupGtMaskKHR"] = 4418] = "BuiltInSubgroupGtMaskKHR";
        BuiltIn[BuiltIn["BuiltInSubgroupLeMask"] = 4419] = "BuiltInSubgroupLeMask";
        BuiltIn[BuiltIn["BuiltInSubgroupLeMaskKHR"] = 4419] = "BuiltInSubgroupLeMaskKHR";
        BuiltIn[BuiltIn["BuiltInSubgroupLtMask"] = 4420] = "BuiltInSubgroupLtMask";
        BuiltIn[BuiltIn["BuiltInSubgroupLtMaskKHR"] = 4420] = "BuiltInSubgroupLtMaskKHR";
        BuiltIn[BuiltIn["BuiltInBaseVertex"] = 4424] = "BuiltInBaseVertex";
        BuiltIn[BuiltIn["BuiltInBaseInstance"] = 4425] = "BuiltInBaseInstance";
        BuiltIn[BuiltIn["BuiltInDrawIndex"] = 4426] = "BuiltInDrawIndex";
        BuiltIn[BuiltIn["BuiltInPrimitiveShadingRateKHR"] = 4432] = "BuiltInPrimitiveShadingRateKHR";
        BuiltIn[BuiltIn["BuiltInDeviceIndex"] = 4438] = "BuiltInDeviceIndex";
        BuiltIn[BuiltIn["BuiltInViewIndex"] = 4440] = "BuiltInViewIndex";
        BuiltIn[BuiltIn["BuiltInShadingRateKHR"] = 4444] = "BuiltInShadingRateKHR";
        BuiltIn[BuiltIn["BuiltInBaryCoordNoPerspAMD"] = 4992] = "BuiltInBaryCoordNoPerspAMD";
        BuiltIn[BuiltIn["BuiltInBaryCoordNoPerspCentroidAMD"] = 4993] = "BuiltInBaryCoordNoPerspCentroidAMD";
        BuiltIn[BuiltIn["BuiltInBaryCoordNoPerspSampleAMD"] = 4994] = "BuiltInBaryCoordNoPerspSampleAMD";
        BuiltIn[BuiltIn["BuiltInBaryCoordSmoothAMD"] = 4995] = "BuiltInBaryCoordSmoothAMD";
        BuiltIn[BuiltIn["BuiltInBaryCoordSmoothCentroidAMD"] = 4996] = "BuiltInBaryCoordSmoothCentroidAMD";
        BuiltIn[BuiltIn["BuiltInBaryCoordSmoothSampleAMD"] = 4997] = "BuiltInBaryCoordSmoothSampleAMD";
        BuiltIn[BuiltIn["BuiltInBaryCoordPullModelAMD"] = 4998] = "BuiltInBaryCoordPullModelAMD";
        BuiltIn[BuiltIn["BuiltInFragStencilRefEXT"] = 5014] = "BuiltInFragStencilRefEXT";
        BuiltIn[BuiltIn["BuiltInViewportMaskNV"] = 5253] = "BuiltInViewportMaskNV";
        BuiltIn[BuiltIn["BuiltInSecondaryPositionNV"] = 5257] = "BuiltInSecondaryPositionNV";
        BuiltIn[BuiltIn["BuiltInSecondaryViewportMaskNV"] = 5258] = "BuiltInSecondaryViewportMaskNV";
        BuiltIn[BuiltIn["BuiltInPositionPerViewNV"] = 5261] = "BuiltInPositionPerViewNV";
        BuiltIn[BuiltIn["BuiltInViewportMaskPerViewNV"] = 5262] = "BuiltInViewportMaskPerViewNV";
        BuiltIn[BuiltIn["BuiltInFullyCoveredEXT"] = 5264] = "BuiltInFullyCoveredEXT";
        BuiltIn[BuiltIn["BuiltInTaskCountNV"] = 5274] = "BuiltInTaskCountNV";
        BuiltIn[BuiltIn["BuiltInPrimitiveCountNV"] = 5275] = "BuiltInPrimitiveCountNV";
        BuiltIn[BuiltIn["BuiltInPrimitiveIndicesNV"] = 5276] = "BuiltInPrimitiveIndicesNV";
        BuiltIn[BuiltIn["BuiltInClipDistancePerViewNV"] = 5277] = "BuiltInClipDistancePerViewNV";
        BuiltIn[BuiltIn["BuiltInCullDistancePerViewNV"] = 5278] = "BuiltInCullDistancePerViewNV";
        BuiltIn[BuiltIn["BuiltInLayerPerViewNV"] = 5279] = "BuiltInLayerPerViewNV";
        BuiltIn[BuiltIn["BuiltInMeshViewCountNV"] = 5280] = "BuiltInMeshViewCountNV";
        BuiltIn[BuiltIn["BuiltInMeshViewIndicesNV"] = 5281] = "BuiltInMeshViewIndicesNV";
        BuiltIn[BuiltIn["BuiltInBaryCoordNV"] = 5286] = "BuiltInBaryCoordNV";
        BuiltIn[BuiltIn["BuiltInBaryCoordNoPerspNV"] = 5287] = "BuiltInBaryCoordNoPerspNV";
        BuiltIn[BuiltIn["BuiltInFragSizeEXT"] = 5292] = "BuiltInFragSizeEXT";
        BuiltIn[BuiltIn["BuiltInFragmentSizeNV"] = 5292] = "BuiltInFragmentSizeNV";
        BuiltIn[BuiltIn["BuiltInFragInvocationCountEXT"] = 5293] = "BuiltInFragInvocationCountEXT";
        BuiltIn[BuiltIn["BuiltInInvocationsPerPixelNV"] = 5293] = "BuiltInInvocationsPerPixelNV";
        BuiltIn[BuiltIn["BuiltInLaunchIdKHR"] = 5319] = "BuiltInLaunchIdKHR";
        BuiltIn[BuiltIn["BuiltInLaunchIdNV"] = 5319] = "BuiltInLaunchIdNV";
        BuiltIn[BuiltIn["BuiltInLaunchSizeKHR"] = 5320] = "BuiltInLaunchSizeKHR";
        BuiltIn[BuiltIn["BuiltInLaunchSizeNV"] = 5320] = "BuiltInLaunchSizeNV";
        BuiltIn[BuiltIn["BuiltInWorldRayOriginKHR"] = 5321] = "BuiltInWorldRayOriginKHR";
        BuiltIn[BuiltIn["BuiltInWorldRayOriginNV"] = 5321] = "BuiltInWorldRayOriginNV";
        BuiltIn[BuiltIn["BuiltInWorldRayDirectionKHR"] = 5322] = "BuiltInWorldRayDirectionKHR";
        BuiltIn[BuiltIn["BuiltInWorldRayDirectionNV"] = 5322] = "BuiltInWorldRayDirectionNV";
        BuiltIn[BuiltIn["BuiltInObjectRayOriginKHR"] = 5323] = "BuiltInObjectRayOriginKHR";
        BuiltIn[BuiltIn["BuiltInObjectRayOriginNV"] = 5323] = "BuiltInObjectRayOriginNV";
        BuiltIn[BuiltIn["BuiltInObjectRayDirectionKHR"] = 5324] = "BuiltInObjectRayDirectionKHR";
        BuiltIn[BuiltIn["BuiltInObjectRayDirectionNV"] = 5324] = "BuiltInObjectRayDirectionNV";
        BuiltIn[BuiltIn["BuiltInRayTminKHR"] = 5325] = "BuiltInRayTminKHR";
        BuiltIn[BuiltIn["BuiltInRayTminNV"] = 5325] = "BuiltInRayTminNV";
        BuiltIn[BuiltIn["BuiltInRayTmaxKHR"] = 5326] = "BuiltInRayTmaxKHR";
        BuiltIn[BuiltIn["BuiltInRayTmaxNV"] = 5326] = "BuiltInRayTmaxNV";
        BuiltIn[BuiltIn["BuiltInInstanceCustomIndexKHR"] = 5327] = "BuiltInInstanceCustomIndexKHR";
        BuiltIn[BuiltIn["BuiltInInstanceCustomIndexNV"] = 5327] = "BuiltInInstanceCustomIndexNV";
        BuiltIn[BuiltIn["BuiltInObjectToWorldKHR"] = 5330] = "BuiltInObjectToWorldKHR";
        BuiltIn[BuiltIn["BuiltInObjectToWorldNV"] = 5330] = "BuiltInObjectToWorldNV";
        BuiltIn[BuiltIn["BuiltInWorldToObjectKHR"] = 5331] = "BuiltInWorldToObjectKHR";
        BuiltIn[BuiltIn["BuiltInWorldToObjectNV"] = 5331] = "BuiltInWorldToObjectNV";
        BuiltIn[BuiltIn["BuiltInHitTNV"] = 5332] = "BuiltInHitTNV";
        BuiltIn[BuiltIn["BuiltInHitKindKHR"] = 5333] = "BuiltInHitKindKHR";
        BuiltIn[BuiltIn["BuiltInHitKindNV"] = 5333] = "BuiltInHitKindNV";
        BuiltIn[BuiltIn["BuiltInIncomingRayFlagsKHR"] = 5351] = "BuiltInIncomingRayFlagsKHR";
        BuiltIn[BuiltIn["BuiltInIncomingRayFlagsNV"] = 5351] = "BuiltInIncomingRayFlagsNV";
        BuiltIn[BuiltIn["BuiltInRayGeometryIndexKHR"] = 5352] = "BuiltInRayGeometryIndexKHR";
        BuiltIn[BuiltIn["BuiltInWarpsPerSMNV"] = 5374] = "BuiltInWarpsPerSMNV";
        BuiltIn[BuiltIn["BuiltInSMCountNV"] = 5375] = "BuiltInSMCountNV";
        BuiltIn[BuiltIn["BuiltInWarpIDNV"] = 5376] = "BuiltInWarpIDNV";
        BuiltIn[BuiltIn["BuiltInSMIDNV"] = 5377] = "BuiltInSMIDNV";
        BuiltIn[BuiltIn["BuiltInMax"] = 2147483647] = "BuiltInMax";
    })(BuiltIn || (BuiltIn = {}));
    var SelectionControlShift;
    (function (SelectionControlShift) {
        SelectionControlShift[SelectionControlShift["SelectionControlFlattenShift"] = 0] = "SelectionControlFlattenShift";
        SelectionControlShift[SelectionControlShift["SelectionControlDontFlattenShift"] = 1] = "SelectionControlDontFlattenShift";
        SelectionControlShift[SelectionControlShift["SelectionControlMax"] = 2147483647] = "SelectionControlMax";
    })(SelectionControlShift || (SelectionControlShift = {}));
    var SelectionControlMask;
    (function (SelectionControlMask) {
        SelectionControlMask[SelectionControlMask["SelectionControlMaskNone"] = 0] = "SelectionControlMaskNone";
        SelectionControlMask[SelectionControlMask["SelectionControlFlattenMask"] = 1] = "SelectionControlFlattenMask";
        SelectionControlMask[SelectionControlMask["SelectionControlDontFlattenMask"] = 2] = "SelectionControlDontFlattenMask";
    })(SelectionControlMask || (SelectionControlMask = {}));
    var LoopControlShift;
    (function (LoopControlShift) {
        LoopControlShift[LoopControlShift["LoopControlUnrollShift"] = 0] = "LoopControlUnrollShift";
        LoopControlShift[LoopControlShift["LoopControlDontUnrollShift"] = 1] = "LoopControlDontUnrollShift";
        LoopControlShift[LoopControlShift["LoopControlDependencyInfiniteShift"] = 2] = "LoopControlDependencyInfiniteShift";
        LoopControlShift[LoopControlShift["LoopControlDependencyLengthShift"] = 3] = "LoopControlDependencyLengthShift";
        LoopControlShift[LoopControlShift["LoopControlMinIterationsShift"] = 4] = "LoopControlMinIterationsShift";
        LoopControlShift[LoopControlShift["LoopControlMaxIterationsShift"] = 5] = "LoopControlMaxIterationsShift";
        LoopControlShift[LoopControlShift["LoopControlIterationMultipleShift"] = 6] = "LoopControlIterationMultipleShift";
        LoopControlShift[LoopControlShift["LoopControlPeelCountShift"] = 7] = "LoopControlPeelCountShift";
        LoopControlShift[LoopControlShift["LoopControlPartialCountShift"] = 8] = "LoopControlPartialCountShift";
        LoopControlShift[LoopControlShift["LoopControlInitiationIntervalINTELShift"] = 16] = "LoopControlInitiationIntervalINTELShift";
        LoopControlShift[LoopControlShift["LoopControlMaxConcurrencyINTELShift"] = 17] = "LoopControlMaxConcurrencyINTELShift";
        LoopControlShift[LoopControlShift["LoopControlDependencyArrayINTELShift"] = 18] = "LoopControlDependencyArrayINTELShift";
        LoopControlShift[LoopControlShift["LoopControlPipelineEnableINTELShift"] = 19] = "LoopControlPipelineEnableINTELShift";
        LoopControlShift[LoopControlShift["LoopControlLoopCoalesceINTELShift"] = 20] = "LoopControlLoopCoalesceINTELShift";
        LoopControlShift[LoopControlShift["LoopControlMaxInterleavingINTELShift"] = 21] = "LoopControlMaxInterleavingINTELShift";
        LoopControlShift[LoopControlShift["LoopControlSpeculatedIterationsINTELShift"] = 22] = "LoopControlSpeculatedIterationsINTELShift";
        LoopControlShift[LoopControlShift["LoopControlMax"] = 2147483647] = "LoopControlMax";
    })(LoopControlShift || (LoopControlShift = {}));
    var LoopControlMask;
    (function (LoopControlMask) {
        LoopControlMask[LoopControlMask["LoopControlMaskNone"] = 0] = "LoopControlMaskNone";
        LoopControlMask[LoopControlMask["LoopControlUnrollMask"] = 1] = "LoopControlUnrollMask";
        LoopControlMask[LoopControlMask["LoopControlDontUnrollMask"] = 2] = "LoopControlDontUnrollMask";
        LoopControlMask[LoopControlMask["LoopControlDependencyInfiniteMask"] = 4] = "LoopControlDependencyInfiniteMask";
        LoopControlMask[LoopControlMask["LoopControlDependencyLengthMask"] = 8] = "LoopControlDependencyLengthMask";
        LoopControlMask[LoopControlMask["LoopControlMinIterationsMask"] = 16] = "LoopControlMinIterationsMask";
        LoopControlMask[LoopControlMask["LoopControlMaxIterationsMask"] = 32] = "LoopControlMaxIterationsMask";
        LoopControlMask[LoopControlMask["LoopControlIterationMultipleMask"] = 64] = "LoopControlIterationMultipleMask";
        LoopControlMask[LoopControlMask["LoopControlPeelCountMask"] = 128] = "LoopControlPeelCountMask";
        LoopControlMask[LoopControlMask["LoopControlPartialCountMask"] = 256] = "LoopControlPartialCountMask";
        LoopControlMask[LoopControlMask["LoopControlInitiationIntervalINTELMask"] = 65536] = "LoopControlInitiationIntervalINTELMask";
        LoopControlMask[LoopControlMask["LoopControlMaxConcurrencyINTELMask"] = 131072] = "LoopControlMaxConcurrencyINTELMask";
        LoopControlMask[LoopControlMask["LoopControlDependencyArrayINTELMask"] = 262144] = "LoopControlDependencyArrayINTELMask";
        LoopControlMask[LoopControlMask["LoopControlPipelineEnableINTELMask"] = 524288] = "LoopControlPipelineEnableINTELMask";
        LoopControlMask[LoopControlMask["LoopControlLoopCoalesceINTELMask"] = 1048576] = "LoopControlLoopCoalesceINTELMask";
        LoopControlMask[LoopControlMask["LoopControlMaxInterleavingINTELMask"] = 2097152] = "LoopControlMaxInterleavingINTELMask";
        LoopControlMask[LoopControlMask["LoopControlSpeculatedIterationsINTELMask"] = 4194304] = "LoopControlSpeculatedIterationsINTELMask";
    })(LoopControlMask || (LoopControlMask = {}));
    var FunctionControlShift;
    (function (FunctionControlShift) {
        FunctionControlShift[FunctionControlShift["FunctionControlInlineShift"] = 0] = "FunctionControlInlineShift";
        FunctionControlShift[FunctionControlShift["FunctionControlDontInlineShift"] = 1] = "FunctionControlDontInlineShift";
        FunctionControlShift[FunctionControlShift["FunctionControlPureShift"] = 2] = "FunctionControlPureShift";
        FunctionControlShift[FunctionControlShift["FunctionControlConstShift"] = 3] = "FunctionControlConstShift";
        FunctionControlShift[FunctionControlShift["FunctionControlMax"] = 2147483647] = "FunctionControlMax";
    })(FunctionControlShift || (FunctionControlShift = {}));
    var FunctionControlMask;
    (function (FunctionControlMask) {
        FunctionControlMask[FunctionControlMask["FunctionControlMaskNone"] = 0] = "FunctionControlMaskNone";
        FunctionControlMask[FunctionControlMask["FunctionControlInlineMask"] = 1] = "FunctionControlInlineMask";
        FunctionControlMask[FunctionControlMask["FunctionControlDontInlineMask"] = 2] = "FunctionControlDontInlineMask";
        FunctionControlMask[FunctionControlMask["FunctionControlPureMask"] = 4] = "FunctionControlPureMask";
        FunctionControlMask[FunctionControlMask["FunctionControlConstMask"] = 8] = "FunctionControlConstMask";
    })(FunctionControlMask || (FunctionControlMask = {}));
    var MemorySemanticsShift;
    (function (MemorySemanticsShift) {
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsAcquireShift"] = 1] = "MemorySemanticsAcquireShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsReleaseShift"] = 2] = "MemorySemanticsReleaseShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsAcquireReleaseShift"] = 3] = "MemorySemanticsAcquireReleaseShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsSequentiallyConsistentShift"] = 4] = "MemorySemanticsSequentiallyConsistentShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsUniformMemoryShift"] = 6] = "MemorySemanticsUniformMemoryShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsSubgroupMemoryShift"] = 7] = "MemorySemanticsSubgroupMemoryShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsWorkgroupMemoryShift"] = 8] = "MemorySemanticsWorkgroupMemoryShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsCrossWorkgroupMemoryShift"] = 9] = "MemorySemanticsCrossWorkgroupMemoryShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsAtomicCounterMemoryShift"] = 10] = "MemorySemanticsAtomicCounterMemoryShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsImageMemoryShift"] = 11] = "MemorySemanticsImageMemoryShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsOutputMemoryShift"] = 12] = "MemorySemanticsOutputMemoryShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsOutputMemoryKHRShift"] = 12] = "MemorySemanticsOutputMemoryKHRShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsMakeAvailableShift"] = 13] = "MemorySemanticsMakeAvailableShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsMakeAvailableKHRShift"] = 13] = "MemorySemanticsMakeAvailableKHRShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsMakeVisibleShift"] = 14] = "MemorySemanticsMakeVisibleShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsMakeVisibleKHRShift"] = 14] = "MemorySemanticsMakeVisibleKHRShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsVolatileShift"] = 15] = "MemorySemanticsVolatileShift";
        MemorySemanticsShift[MemorySemanticsShift["MemorySemanticsMax"] = 2147483647] = "MemorySemanticsMax";
    })(MemorySemanticsShift || (MemorySemanticsShift = {}));
    var MemorySemanticsMask;
    (function (MemorySemanticsMask) {
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsMaskNone"] = 0] = "MemorySemanticsMaskNone";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsAcquireMask"] = 2] = "MemorySemanticsAcquireMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsReleaseMask"] = 4] = "MemorySemanticsReleaseMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsAcquireReleaseMask"] = 8] = "MemorySemanticsAcquireReleaseMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsSequentiallyConsistentMask"] = 16] = "MemorySemanticsSequentiallyConsistentMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsUniformMemoryMask"] = 64] = "MemorySemanticsUniformMemoryMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsSubgroupMemoryMask"] = 128] = "MemorySemanticsSubgroupMemoryMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsWorkgroupMemoryMask"] = 256] = "MemorySemanticsWorkgroupMemoryMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsCrossWorkgroupMemoryMask"] = 512] = "MemorySemanticsCrossWorkgroupMemoryMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsAtomicCounterMemoryMask"] = 1024] = "MemorySemanticsAtomicCounterMemoryMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsImageMemoryMask"] = 2048] = "MemorySemanticsImageMemoryMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsOutputMemoryMask"] = 4096] = "MemorySemanticsOutputMemoryMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsOutputMemoryKHRMask"] = 4096] = "MemorySemanticsOutputMemoryKHRMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsMakeAvailableMask"] = 8192] = "MemorySemanticsMakeAvailableMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsMakeAvailableKHRMask"] = 8192] = "MemorySemanticsMakeAvailableKHRMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsMakeVisibleMask"] = 16384] = "MemorySemanticsMakeVisibleMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsMakeVisibleKHRMask"] = 16384] = "MemorySemanticsMakeVisibleKHRMask";
        MemorySemanticsMask[MemorySemanticsMask["MemorySemanticsVolatileMask"] = 32768] = "MemorySemanticsVolatileMask";
    })(MemorySemanticsMask || (MemorySemanticsMask = {}));
    var MemoryAccessShift;
    (function (MemoryAccessShift) {
        MemoryAccessShift[MemoryAccessShift["MemoryAccessVolatileShift"] = 0] = "MemoryAccessVolatileShift";
        MemoryAccessShift[MemoryAccessShift["MemoryAccessAlignedShift"] = 1] = "MemoryAccessAlignedShift";
        MemoryAccessShift[MemoryAccessShift["MemoryAccessNontemporalShift"] = 2] = "MemoryAccessNontemporalShift";
        MemoryAccessShift[MemoryAccessShift["MemoryAccessMakePointerAvailableShift"] = 3] = "MemoryAccessMakePointerAvailableShift";
        MemoryAccessShift[MemoryAccessShift["MemoryAccessMakePointerAvailableKHRShift"] = 3] = "MemoryAccessMakePointerAvailableKHRShift";
        MemoryAccessShift[MemoryAccessShift["MemoryAccessMakePointerVisibleShift"] = 4] = "MemoryAccessMakePointerVisibleShift";
        MemoryAccessShift[MemoryAccessShift["MemoryAccessMakePointerVisibleKHRShift"] = 4] = "MemoryAccessMakePointerVisibleKHRShift";
        MemoryAccessShift[MemoryAccessShift["MemoryAccessNonPrivatePointerShift"] = 5] = "MemoryAccessNonPrivatePointerShift";
        MemoryAccessShift[MemoryAccessShift["MemoryAccessNonPrivatePointerKHRShift"] = 5] = "MemoryAccessNonPrivatePointerKHRShift";
        MemoryAccessShift[MemoryAccessShift["MemoryAccessMax"] = 2147483647] = "MemoryAccessMax";
    })(MemoryAccessShift || (MemoryAccessShift = {}));
    var MemoryAccessMask;
    (function (MemoryAccessMask) {
        MemoryAccessMask[MemoryAccessMask["MemoryAccessMaskNone"] = 0] = "MemoryAccessMaskNone";
        MemoryAccessMask[MemoryAccessMask["MemoryAccessVolatileMask"] = 1] = "MemoryAccessVolatileMask";
        MemoryAccessMask[MemoryAccessMask["MemoryAccessAlignedMask"] = 2] = "MemoryAccessAlignedMask";
        MemoryAccessMask[MemoryAccessMask["MemoryAccessNontemporalMask"] = 4] = "MemoryAccessNontemporalMask";
        MemoryAccessMask[MemoryAccessMask["MemoryAccessMakePointerAvailableMask"] = 8] = "MemoryAccessMakePointerAvailableMask";
        MemoryAccessMask[MemoryAccessMask["MemoryAccessMakePointerAvailableKHRMask"] = 8] = "MemoryAccessMakePointerAvailableKHRMask";
        MemoryAccessMask[MemoryAccessMask["MemoryAccessMakePointerVisibleMask"] = 16] = "MemoryAccessMakePointerVisibleMask";
        MemoryAccessMask[MemoryAccessMask["MemoryAccessMakePointerVisibleKHRMask"] = 16] = "MemoryAccessMakePointerVisibleKHRMask";
        MemoryAccessMask[MemoryAccessMask["MemoryAccessNonPrivatePointerMask"] = 32] = "MemoryAccessNonPrivatePointerMask";
        MemoryAccessMask[MemoryAccessMask["MemoryAccessNonPrivatePointerKHRMask"] = 32] = "MemoryAccessNonPrivatePointerKHRMask";
    })(MemoryAccessMask || (MemoryAccessMask = {}));
    var Scope;
    (function (Scope) {
        Scope[Scope["ScopeCrossDevice"] = 0] = "ScopeCrossDevice";
        Scope[Scope["ScopeDevice"] = 1] = "ScopeDevice";
        Scope[Scope["ScopeWorkgroup"] = 2] = "ScopeWorkgroup";
        Scope[Scope["ScopeSubgroup"] = 3] = "ScopeSubgroup";
        Scope[Scope["ScopeInvocation"] = 4] = "ScopeInvocation";
        Scope[Scope["ScopeQueueFamily"] = 5] = "ScopeQueueFamily";
        Scope[Scope["ScopeQueueFamilyKHR"] = 5] = "ScopeQueueFamilyKHR";
        Scope[Scope["ScopeShaderCallKHR"] = 6] = "ScopeShaderCallKHR";
        Scope[Scope["ScopeMax"] = 2147483647] = "ScopeMax";
    })(Scope || (Scope = {}));
    var GroupOperation;
    (function (GroupOperation) {
        GroupOperation[GroupOperation["GroupOperationReduce"] = 0] = "GroupOperationReduce";
        GroupOperation[GroupOperation["GroupOperationInclusiveScan"] = 1] = "GroupOperationInclusiveScan";
        GroupOperation[GroupOperation["GroupOperationExclusiveScan"] = 2] = "GroupOperationExclusiveScan";
        GroupOperation[GroupOperation["GroupOperationClusteredReduce"] = 3] = "GroupOperationClusteredReduce";
        GroupOperation[GroupOperation["GroupOperationPartitionedReduceNV"] = 6] = "GroupOperationPartitionedReduceNV";
        GroupOperation[GroupOperation["GroupOperationPartitionedInclusiveScanNV"] = 7] = "GroupOperationPartitionedInclusiveScanNV";
        GroupOperation[GroupOperation["GroupOperationPartitionedExclusiveScanNV"] = 8] = "GroupOperationPartitionedExclusiveScanNV";
        GroupOperation[GroupOperation["GroupOperationMax"] = 2147483647] = "GroupOperationMax";
    })(GroupOperation || (GroupOperation = {}));
    var KernelEnqueueFlags;
    (function (KernelEnqueueFlags) {
        KernelEnqueueFlags[KernelEnqueueFlags["KernelEnqueueFlagsNoWait"] = 0] = "KernelEnqueueFlagsNoWait";
        KernelEnqueueFlags[KernelEnqueueFlags["KernelEnqueueFlagsWaitKernel"] = 1] = "KernelEnqueueFlagsWaitKernel";
        KernelEnqueueFlags[KernelEnqueueFlags["KernelEnqueueFlagsWaitWorkGroup"] = 2] = "KernelEnqueueFlagsWaitWorkGroup";
        KernelEnqueueFlags[KernelEnqueueFlags["KernelEnqueueFlagsMax"] = 2147483647] = "KernelEnqueueFlagsMax";
    })(KernelEnqueueFlags || (KernelEnqueueFlags = {}));
    var KernelProfilingInfoShift;
    (function (KernelProfilingInfoShift) {
        KernelProfilingInfoShift[KernelProfilingInfoShift["KernelProfilingInfoCmdExecTimeShift"] = 0] = "KernelProfilingInfoCmdExecTimeShift";
        KernelProfilingInfoShift[KernelProfilingInfoShift["KernelProfilingInfoMax"] = 2147483647] = "KernelProfilingInfoMax";
    })(KernelProfilingInfoShift || (KernelProfilingInfoShift = {}));
    var KernelProfilingInfoMask;
    (function (KernelProfilingInfoMask) {
        KernelProfilingInfoMask[KernelProfilingInfoMask["KernelProfilingInfoMaskNone"] = 0] = "KernelProfilingInfoMaskNone";
        KernelProfilingInfoMask[KernelProfilingInfoMask["KernelProfilingInfoCmdExecTimeMask"] = 1] = "KernelProfilingInfoCmdExecTimeMask";
    })(KernelProfilingInfoMask || (KernelProfilingInfoMask = {}));
    var Capability;
    (function (Capability) {
        Capability[Capability["CapabilityMatrix"] = 0] = "CapabilityMatrix";
        Capability[Capability["CapabilityShader"] = 1] = "CapabilityShader";
        Capability[Capability["CapabilityGeometry"] = 2] = "CapabilityGeometry";
        Capability[Capability["CapabilityTessellation"] = 3] = "CapabilityTessellation";
        Capability[Capability["CapabilityAddresses"] = 4] = "CapabilityAddresses";
        Capability[Capability["CapabilityLinkage"] = 5] = "CapabilityLinkage";
        Capability[Capability["CapabilityKernel"] = 6] = "CapabilityKernel";
        Capability[Capability["CapabilityVector16"] = 7] = "CapabilityVector16";
        Capability[Capability["CapabilityFloat16Buffer"] = 8] = "CapabilityFloat16Buffer";
        Capability[Capability["CapabilityFloat16"] = 9] = "CapabilityFloat16";
        Capability[Capability["CapabilityFloat64"] = 10] = "CapabilityFloat64";
        Capability[Capability["CapabilityInt64"] = 11] = "CapabilityInt64";
        Capability[Capability["CapabilityInt64Atomics"] = 12] = "CapabilityInt64Atomics";
        Capability[Capability["CapabilityImageBasic"] = 13] = "CapabilityImageBasic";
        Capability[Capability["CapabilityImageReadWrite"] = 14] = "CapabilityImageReadWrite";
        Capability[Capability["CapabilityImageMipmap"] = 15] = "CapabilityImageMipmap";
        Capability[Capability["CapabilityPipes"] = 17] = "CapabilityPipes";
        Capability[Capability["CapabilityGroups"] = 18] = "CapabilityGroups";
        Capability[Capability["CapabilityDeviceEnqueue"] = 19] = "CapabilityDeviceEnqueue";
        Capability[Capability["CapabilityLiteralSampler"] = 20] = "CapabilityLiteralSampler";
        Capability[Capability["CapabilityAtomicStorage"] = 21] = "CapabilityAtomicStorage";
        Capability[Capability["CapabilityInt16"] = 22] = "CapabilityInt16";
        Capability[Capability["CapabilityTessellationPointSize"] = 23] = "CapabilityTessellationPointSize";
        Capability[Capability["CapabilityGeometryPointSize"] = 24] = "CapabilityGeometryPointSize";
        Capability[Capability["CapabilityImageGatherExtended"] = 25] = "CapabilityImageGatherExtended";
        Capability[Capability["CapabilityStorageImageMultisample"] = 27] = "CapabilityStorageImageMultisample";
        Capability[Capability["CapabilityUniformBufferArrayDynamicIndexing"] = 28] = "CapabilityUniformBufferArrayDynamicIndexing";
        Capability[Capability["CapabilitySampledImageArrayDynamicIndexing"] = 29] = "CapabilitySampledImageArrayDynamicIndexing";
        Capability[Capability["CapabilityStorageBufferArrayDynamicIndexing"] = 30] = "CapabilityStorageBufferArrayDynamicIndexing";
        Capability[Capability["CapabilityStorageImageArrayDynamicIndexing"] = 31] = "CapabilityStorageImageArrayDynamicIndexing";
        Capability[Capability["CapabilityClipDistance"] = 32] = "CapabilityClipDistance";
        Capability[Capability["CapabilityCullDistance"] = 33] = "CapabilityCullDistance";
        Capability[Capability["CapabilityImageCubeArray"] = 34] = "CapabilityImageCubeArray";
        Capability[Capability["CapabilitySampleRateShading"] = 35] = "CapabilitySampleRateShading";
        Capability[Capability["CapabilityImageRect"] = 36] = "CapabilityImageRect";
        Capability[Capability["CapabilitySampledRect"] = 37] = "CapabilitySampledRect";
        Capability[Capability["CapabilityGenericPointer"] = 38] = "CapabilityGenericPointer";
        Capability[Capability["CapabilityInt8"] = 39] = "CapabilityInt8";
        Capability[Capability["CapabilityInputAttachment"] = 40] = "CapabilityInputAttachment";
        Capability[Capability["CapabilitySparseResidency"] = 41] = "CapabilitySparseResidency";
        Capability[Capability["CapabilityMinLod"] = 42] = "CapabilityMinLod";
        Capability[Capability["CapabilitySampled1D"] = 43] = "CapabilitySampled1D";
        Capability[Capability["CapabilityImage1D"] = 44] = "CapabilityImage1D";
        Capability[Capability["CapabilitySampledCubeArray"] = 45] = "CapabilitySampledCubeArray";
        Capability[Capability["CapabilitySampledBuffer"] = 46] = "CapabilitySampledBuffer";
        Capability[Capability["CapabilityImageBuffer"] = 47] = "CapabilityImageBuffer";
        Capability[Capability["CapabilityImageMSArray"] = 48] = "CapabilityImageMSArray";
        Capability[Capability["CapabilityStorageImageExtendedFormats"] = 49] = "CapabilityStorageImageExtendedFormats";
        Capability[Capability["CapabilityImageQuery"] = 50] = "CapabilityImageQuery";
        Capability[Capability["CapabilityDerivativeControl"] = 51] = "CapabilityDerivativeControl";
        Capability[Capability["CapabilityInterpolationFunction"] = 52] = "CapabilityInterpolationFunction";
        Capability[Capability["CapabilityTransformFeedback"] = 53] = "CapabilityTransformFeedback";
        Capability[Capability["CapabilityGeometryStreams"] = 54] = "CapabilityGeometryStreams";
        Capability[Capability["CapabilityStorageImageReadWithoutFormat"] = 55] = "CapabilityStorageImageReadWithoutFormat";
        Capability[Capability["CapabilityStorageImageWriteWithoutFormat"] = 56] = "CapabilityStorageImageWriteWithoutFormat";
        Capability[Capability["CapabilityMultiViewport"] = 57] = "CapabilityMultiViewport";
        Capability[Capability["CapabilitySubgroupDispatch"] = 58] = "CapabilitySubgroupDispatch";
        Capability[Capability["CapabilityNamedBarrier"] = 59] = "CapabilityNamedBarrier";
        Capability[Capability["CapabilityPipeStorage"] = 60] = "CapabilityPipeStorage";
        Capability[Capability["CapabilityGroupNonUniform"] = 61] = "CapabilityGroupNonUniform";
        Capability[Capability["CapabilityGroupNonUniformVote"] = 62] = "CapabilityGroupNonUniformVote";
        Capability[Capability["CapabilityGroupNonUniformArithmetic"] = 63] = "CapabilityGroupNonUniformArithmetic";
        Capability[Capability["CapabilityGroupNonUniformBallot"] = 64] = "CapabilityGroupNonUniformBallot";
        Capability[Capability["CapabilityGroupNonUniformShuffle"] = 65] = "CapabilityGroupNonUniformShuffle";
        Capability[Capability["CapabilityGroupNonUniformShuffleRelative"] = 66] = "CapabilityGroupNonUniformShuffleRelative";
        Capability[Capability["CapabilityGroupNonUniformClustered"] = 67] = "CapabilityGroupNonUniformClustered";
        Capability[Capability["CapabilityGroupNonUniformQuad"] = 68] = "CapabilityGroupNonUniformQuad";
        Capability[Capability["CapabilityShaderLayer"] = 69] = "CapabilityShaderLayer";
        Capability[Capability["CapabilityShaderViewportIndex"] = 70] = "CapabilityShaderViewportIndex";
        Capability[Capability["CapabilityFragmentShadingRateKHR"] = 4422] = "CapabilityFragmentShadingRateKHR";
        Capability[Capability["CapabilitySubgroupBallotKHR"] = 4423] = "CapabilitySubgroupBallotKHR";
        Capability[Capability["CapabilityDrawParameters"] = 4427] = "CapabilityDrawParameters";
        Capability[Capability["CapabilitySubgroupVoteKHR"] = 4431] = "CapabilitySubgroupVoteKHR";
        Capability[Capability["CapabilityStorageBuffer16BitAccess"] = 4433] = "CapabilityStorageBuffer16BitAccess";
        Capability[Capability["CapabilityStorageUniformBufferBlock16"] = 4433] = "CapabilityStorageUniformBufferBlock16";
        Capability[Capability["CapabilityStorageUniform16"] = 4434] = "CapabilityStorageUniform16";
        Capability[Capability["CapabilityUniformAndStorageBuffer16BitAccess"] = 4434] = "CapabilityUniformAndStorageBuffer16BitAccess";
        Capability[Capability["CapabilityStoragePushConstant16"] = 4435] = "CapabilityStoragePushConstant16";
        Capability[Capability["CapabilityStorageInputOutput16"] = 4436] = "CapabilityStorageInputOutput16";
        Capability[Capability["CapabilityDeviceGroup"] = 4437] = "CapabilityDeviceGroup";
        Capability[Capability["CapabilityMultiView"] = 4439] = "CapabilityMultiView";
        Capability[Capability["CapabilityVariablePointersStorageBuffer"] = 4441] = "CapabilityVariablePointersStorageBuffer";
        Capability[Capability["CapabilityVariablePointers"] = 4442] = "CapabilityVariablePointers";
        Capability[Capability["CapabilityAtomicStorageOps"] = 4445] = "CapabilityAtomicStorageOps";
        Capability[Capability["CapabilitySampleMaskPostDepthCoverage"] = 4447] = "CapabilitySampleMaskPostDepthCoverage";
        Capability[Capability["CapabilityStorageBuffer8BitAccess"] = 4448] = "CapabilityStorageBuffer8BitAccess";
        Capability[Capability["CapabilityUniformAndStorageBuffer8BitAccess"] = 4449] = "CapabilityUniformAndStorageBuffer8BitAccess";
        Capability[Capability["CapabilityStoragePushConstant8"] = 4450] = "CapabilityStoragePushConstant8";
        Capability[Capability["CapabilityDenormPreserve"] = 4464] = "CapabilityDenormPreserve";
        Capability[Capability["CapabilityDenormFlushToZero"] = 4465] = "CapabilityDenormFlushToZero";
        Capability[Capability["CapabilitySignedZeroInfNanPreserve"] = 4466] = "CapabilitySignedZeroInfNanPreserve";
        Capability[Capability["CapabilityRoundingModeRTE"] = 4467] = "CapabilityRoundingModeRTE";
        Capability[Capability["CapabilityRoundingModeRTZ"] = 4468] = "CapabilityRoundingModeRTZ";
        Capability[Capability["CapabilityRayQueryProvisionalKHR"] = 4471] = "CapabilityRayQueryProvisionalKHR";
        Capability[Capability["CapabilityRayQueryKHR"] = 4472] = "CapabilityRayQueryKHR";
        Capability[Capability["CapabilityRayTraversalPrimitiveCullingKHR"] = 4478] = "CapabilityRayTraversalPrimitiveCullingKHR";
        Capability[Capability["CapabilityRayTracingKHR"] = 4479] = "CapabilityRayTracingKHR";
        Capability[Capability["CapabilityFloat16ImageAMD"] = 5008] = "CapabilityFloat16ImageAMD";
        Capability[Capability["CapabilityImageGatherBiasLodAMD"] = 5009] = "CapabilityImageGatherBiasLodAMD";
        Capability[Capability["CapabilityFragmentMaskAMD"] = 5010] = "CapabilityFragmentMaskAMD";
        Capability[Capability["CapabilityStencilExportEXT"] = 5013] = "CapabilityStencilExportEXT";
        Capability[Capability["CapabilityImageReadWriteLodAMD"] = 5015] = "CapabilityImageReadWriteLodAMD";
        Capability[Capability["CapabilityInt64ImageEXT"] = 5016] = "CapabilityInt64ImageEXT";
        Capability[Capability["CapabilityShaderClockKHR"] = 5055] = "CapabilityShaderClockKHR";
        Capability[Capability["CapabilitySampleMaskOverrideCoverageNV"] = 5249] = "CapabilitySampleMaskOverrideCoverageNV";
        Capability[Capability["CapabilityGeometryShaderPassthroughNV"] = 5251] = "CapabilityGeometryShaderPassthroughNV";
        Capability[Capability["CapabilityShaderViewportIndexLayerEXT"] = 5254] = "CapabilityShaderViewportIndexLayerEXT";
        Capability[Capability["CapabilityShaderViewportIndexLayerNV"] = 5254] = "CapabilityShaderViewportIndexLayerNV";
        Capability[Capability["CapabilityShaderViewportMaskNV"] = 5255] = "CapabilityShaderViewportMaskNV";
        Capability[Capability["CapabilityShaderStereoViewNV"] = 5259] = "CapabilityShaderStereoViewNV";
        Capability[Capability["CapabilityPerViewAttributesNV"] = 5260] = "CapabilityPerViewAttributesNV";
        Capability[Capability["CapabilityFragmentFullyCoveredEXT"] = 5265] = "CapabilityFragmentFullyCoveredEXT";
        Capability[Capability["CapabilityMeshShadingNV"] = 5266] = "CapabilityMeshShadingNV";
        Capability[Capability["CapabilityImageFootprintNV"] = 5282] = "CapabilityImageFootprintNV";
        Capability[Capability["CapabilityFragmentBarycentricNV"] = 5284] = "CapabilityFragmentBarycentricNV";
        Capability[Capability["CapabilityComputeDerivativeGroupQuadsNV"] = 5288] = "CapabilityComputeDerivativeGroupQuadsNV";
        Capability[Capability["CapabilityFragmentDensityEXT"] = 5291] = "CapabilityFragmentDensityEXT";
        Capability[Capability["CapabilityShadingRateNV"] = 5291] = "CapabilityShadingRateNV";
        Capability[Capability["CapabilityGroupNonUniformPartitionedNV"] = 5297] = "CapabilityGroupNonUniformPartitionedNV";
        Capability[Capability["CapabilityShaderNonUniform"] = 5301] = "CapabilityShaderNonUniform";
        Capability[Capability["CapabilityShaderNonUniformEXT"] = 5301] = "CapabilityShaderNonUniformEXT";
        Capability[Capability["CapabilityRuntimeDescriptorArray"] = 5302] = "CapabilityRuntimeDescriptorArray";
        Capability[Capability["CapabilityRuntimeDescriptorArrayEXT"] = 5302] = "CapabilityRuntimeDescriptorArrayEXT";
        Capability[Capability["CapabilityInputAttachmentArrayDynamicIndexing"] = 5303] = "CapabilityInputAttachmentArrayDynamicIndexing";
        Capability[Capability["CapabilityInputAttachmentArrayDynamicIndexingEXT"] = 5303] = "CapabilityInputAttachmentArrayDynamicIndexingEXT";
        Capability[Capability["CapabilityUniformTexelBufferArrayDynamicIndexing"] = 5304] = "CapabilityUniformTexelBufferArrayDynamicIndexing";
        Capability[Capability["CapabilityUniformTexelBufferArrayDynamicIndexingEXT"] = 5304] = "CapabilityUniformTexelBufferArrayDynamicIndexingEXT";
        Capability[Capability["CapabilityStorageTexelBufferArrayDynamicIndexing"] = 5305] = "CapabilityStorageTexelBufferArrayDynamicIndexing";
        Capability[Capability["CapabilityStorageTexelBufferArrayDynamicIndexingEXT"] = 5305] = "CapabilityStorageTexelBufferArrayDynamicIndexingEXT";
        Capability[Capability["CapabilityUniformBufferArrayNonUniformIndexing"] = 5306] = "CapabilityUniformBufferArrayNonUniformIndexing";
        Capability[Capability["CapabilityUniformBufferArrayNonUniformIndexingEXT"] = 5306] = "CapabilityUniformBufferArrayNonUniformIndexingEXT";
        Capability[Capability["CapabilitySampledImageArrayNonUniformIndexing"] = 5307] = "CapabilitySampledImageArrayNonUniformIndexing";
        Capability[Capability["CapabilitySampledImageArrayNonUniformIndexingEXT"] = 5307] = "CapabilitySampledImageArrayNonUniformIndexingEXT";
        Capability[Capability["CapabilityStorageBufferArrayNonUniformIndexing"] = 5308] = "CapabilityStorageBufferArrayNonUniformIndexing";
        Capability[Capability["CapabilityStorageBufferArrayNonUniformIndexingEXT"] = 5308] = "CapabilityStorageBufferArrayNonUniformIndexingEXT";
        Capability[Capability["CapabilityStorageImageArrayNonUniformIndexing"] = 5309] = "CapabilityStorageImageArrayNonUniformIndexing";
        Capability[Capability["CapabilityStorageImageArrayNonUniformIndexingEXT"] = 5309] = "CapabilityStorageImageArrayNonUniformIndexingEXT";
        Capability[Capability["CapabilityInputAttachmentArrayNonUniformIndexing"] = 5310] = "CapabilityInputAttachmentArrayNonUniformIndexing";
        Capability[Capability["CapabilityInputAttachmentArrayNonUniformIndexingEXT"] = 5310] = "CapabilityInputAttachmentArrayNonUniformIndexingEXT";
        Capability[Capability["CapabilityUniformTexelBufferArrayNonUniformIndexing"] = 5311] = "CapabilityUniformTexelBufferArrayNonUniformIndexing";
        Capability[Capability["CapabilityUniformTexelBufferArrayNonUniformIndexingEXT"] = 5311] = "CapabilityUniformTexelBufferArrayNonUniformIndexingEXT";
        Capability[Capability["CapabilityStorageTexelBufferArrayNonUniformIndexing"] = 5312] = "CapabilityStorageTexelBufferArrayNonUniformIndexing";
        Capability[Capability["CapabilityStorageTexelBufferArrayNonUniformIndexingEXT"] = 5312] = "CapabilityStorageTexelBufferArrayNonUniformIndexingEXT";
        Capability[Capability["CapabilityRayTracingNV"] = 5340] = "CapabilityRayTracingNV";
        Capability[Capability["CapabilityVulkanMemoryModel"] = 5345] = "CapabilityVulkanMemoryModel";
        Capability[Capability["CapabilityVulkanMemoryModelKHR"] = 5345] = "CapabilityVulkanMemoryModelKHR";
        Capability[Capability["CapabilityVulkanMemoryModelDeviceScope"] = 5346] = "CapabilityVulkanMemoryModelDeviceScope";
        Capability[Capability["CapabilityVulkanMemoryModelDeviceScopeKHR"] = 5346] = "CapabilityVulkanMemoryModelDeviceScopeKHR";
        Capability[Capability["CapabilityPhysicalStorageBufferAddresses"] = 5347] = "CapabilityPhysicalStorageBufferAddresses";
        Capability[Capability["CapabilityPhysicalStorageBufferAddressesEXT"] = 5347] = "CapabilityPhysicalStorageBufferAddressesEXT";
        Capability[Capability["CapabilityComputeDerivativeGroupLinearNV"] = 5350] = "CapabilityComputeDerivativeGroupLinearNV";
        Capability[Capability["CapabilityRayTracingProvisionalKHR"] = 5353] = "CapabilityRayTracingProvisionalKHR";
        Capability[Capability["CapabilityCooperativeMatrixNV"] = 5357] = "CapabilityCooperativeMatrixNV";
        Capability[Capability["CapabilityFragmentShaderSampleInterlockEXT"] = 5363] = "CapabilityFragmentShaderSampleInterlockEXT";
        Capability[Capability["CapabilityFragmentShaderShadingRateInterlockEXT"] = 5372] = "CapabilityFragmentShaderShadingRateInterlockEXT";
        Capability[Capability["CapabilityShaderSMBuiltinsNV"] = 5373] = "CapabilityShaderSMBuiltinsNV";
        Capability[Capability["CapabilityFragmentShaderPixelInterlockEXT"] = 5378] = "CapabilityFragmentShaderPixelInterlockEXT";
        Capability[Capability["CapabilityDemoteToHelperInvocationEXT"] = 5379] = "CapabilityDemoteToHelperInvocationEXT";
        Capability[Capability["CapabilitySubgroupShuffleINTEL"] = 5568] = "CapabilitySubgroupShuffleINTEL";
        Capability[Capability["CapabilitySubgroupBufferBlockIOINTEL"] = 5569] = "CapabilitySubgroupBufferBlockIOINTEL";
        Capability[Capability["CapabilitySubgroupImageBlockIOINTEL"] = 5570] = "CapabilitySubgroupImageBlockIOINTEL";
        Capability[Capability["CapabilitySubgroupImageMediaBlockIOINTEL"] = 5579] = "CapabilitySubgroupImageMediaBlockIOINTEL";
        Capability[Capability["CapabilityIntegerFunctions2INTEL"] = 5584] = "CapabilityIntegerFunctions2INTEL";
        Capability[Capability["CapabilityFunctionPointersINTEL"] = 5603] = "CapabilityFunctionPointersINTEL";
        Capability[Capability["CapabilityIndirectReferencesINTEL"] = 5604] = "CapabilityIndirectReferencesINTEL";
        Capability[Capability["CapabilitySubgroupAvcMotionEstimationINTEL"] = 5696] = "CapabilitySubgroupAvcMotionEstimationINTEL";
        Capability[Capability["CapabilitySubgroupAvcMotionEstimationIntraINTEL"] = 5697] = "CapabilitySubgroupAvcMotionEstimationIntraINTEL";
        Capability[Capability["CapabilitySubgroupAvcMotionEstimationChromaINTEL"] = 5698] = "CapabilitySubgroupAvcMotionEstimationChromaINTEL";
        Capability[Capability["CapabilityFPGAMemoryAttributesINTEL"] = 5824] = "CapabilityFPGAMemoryAttributesINTEL";
        Capability[Capability["CapabilityUnstructuredLoopControlsINTEL"] = 5886] = "CapabilityUnstructuredLoopControlsINTEL";
        Capability[Capability["CapabilityFPGALoopControlsINTEL"] = 5888] = "CapabilityFPGALoopControlsINTEL";
        Capability[Capability["CapabilityKernelAttributesINTEL"] = 5892] = "CapabilityKernelAttributesINTEL";
        Capability[Capability["CapabilityFPGAKernelAttributesINTEL"] = 5897] = "CapabilityFPGAKernelAttributesINTEL";
        Capability[Capability["CapabilityBlockingPipesINTEL"] = 5945] = "CapabilityBlockingPipesINTEL";
        Capability[Capability["CapabilityFPGARegINTEL"] = 5948] = "CapabilityFPGARegINTEL";
        Capability[Capability["CapabilityAtomicFloat32AddEXT"] = 6033] = "CapabilityAtomicFloat32AddEXT";
        Capability[Capability["CapabilityAtomicFloat64AddEXT"] = 6034] = "CapabilityAtomicFloat64AddEXT";
        Capability[Capability["CapabilityMax"] = 2147483647] = "CapabilityMax";
    })(Capability || (Capability = {}));
    var RayFlagsShift;
    (function (RayFlagsShift) {
        RayFlagsShift[RayFlagsShift["RayFlagsOpaqueKHRShift"] = 0] = "RayFlagsOpaqueKHRShift";
        RayFlagsShift[RayFlagsShift["RayFlagsNoOpaqueKHRShift"] = 1] = "RayFlagsNoOpaqueKHRShift";
        RayFlagsShift[RayFlagsShift["RayFlagsTerminateOnFirstHitKHRShift"] = 2] = "RayFlagsTerminateOnFirstHitKHRShift";
        RayFlagsShift[RayFlagsShift["RayFlagsSkipClosestHitShaderKHRShift"] = 3] = "RayFlagsSkipClosestHitShaderKHRShift";
        RayFlagsShift[RayFlagsShift["RayFlagsCullBackFacingTrianglesKHRShift"] = 4] = "RayFlagsCullBackFacingTrianglesKHRShift";
        RayFlagsShift[RayFlagsShift["RayFlagsCullFrontFacingTrianglesKHRShift"] = 5] = "RayFlagsCullFrontFacingTrianglesKHRShift";
        RayFlagsShift[RayFlagsShift["RayFlagsCullOpaqueKHRShift"] = 6] = "RayFlagsCullOpaqueKHRShift";
        RayFlagsShift[RayFlagsShift["RayFlagsCullNoOpaqueKHRShift"] = 7] = "RayFlagsCullNoOpaqueKHRShift";
        RayFlagsShift[RayFlagsShift["RayFlagsSkipTrianglesKHRShift"] = 8] = "RayFlagsSkipTrianglesKHRShift";
        RayFlagsShift[RayFlagsShift["RayFlagsSkipAABBsKHRShift"] = 9] = "RayFlagsSkipAABBsKHRShift";
        RayFlagsShift[RayFlagsShift["RayFlagsMax"] = 2147483647] = "RayFlagsMax";
    })(RayFlagsShift || (RayFlagsShift = {}));
    var RayFlagsMask;
    (function (RayFlagsMask) {
        RayFlagsMask[RayFlagsMask["RayFlagsMaskNone"] = 0] = "RayFlagsMaskNone";
        RayFlagsMask[RayFlagsMask["RayFlagsOpaqueKHRMask"] = 1] = "RayFlagsOpaqueKHRMask";
        RayFlagsMask[RayFlagsMask["RayFlagsNoOpaqueKHRMask"] = 2] = "RayFlagsNoOpaqueKHRMask";
        RayFlagsMask[RayFlagsMask["RayFlagsTerminateOnFirstHitKHRMask"] = 4] = "RayFlagsTerminateOnFirstHitKHRMask";
        RayFlagsMask[RayFlagsMask["RayFlagsSkipClosestHitShaderKHRMask"] = 8] = "RayFlagsSkipClosestHitShaderKHRMask";
        RayFlagsMask[RayFlagsMask["RayFlagsCullBackFacingTrianglesKHRMask"] = 16] = "RayFlagsCullBackFacingTrianglesKHRMask";
        RayFlagsMask[RayFlagsMask["RayFlagsCullFrontFacingTrianglesKHRMask"] = 32] = "RayFlagsCullFrontFacingTrianglesKHRMask";
        RayFlagsMask[RayFlagsMask["RayFlagsCullOpaqueKHRMask"] = 64] = "RayFlagsCullOpaqueKHRMask";
        RayFlagsMask[RayFlagsMask["RayFlagsCullNoOpaqueKHRMask"] = 128] = "RayFlagsCullNoOpaqueKHRMask";
        RayFlagsMask[RayFlagsMask["RayFlagsSkipTrianglesKHRMask"] = 256] = "RayFlagsSkipTrianglesKHRMask";
        RayFlagsMask[RayFlagsMask["RayFlagsSkipAABBsKHRMask"] = 512] = "RayFlagsSkipAABBsKHRMask";
    })(RayFlagsMask || (RayFlagsMask = {}));
    var RayQueryIntersection;
    (function (RayQueryIntersection) {
        RayQueryIntersection[RayQueryIntersection["RayQueryIntersectionRayQueryCandidateIntersectionKHR"] = 0] = "RayQueryIntersectionRayQueryCandidateIntersectionKHR";
        RayQueryIntersection[RayQueryIntersection["RayQueryIntersectionRayQueryCommittedIntersectionKHR"] = 1] = "RayQueryIntersectionRayQueryCommittedIntersectionKHR";
        RayQueryIntersection[RayQueryIntersection["RayQueryIntersectionMax"] = 2147483647] = "RayQueryIntersectionMax";
    })(RayQueryIntersection || (RayQueryIntersection = {}));
    var RayQueryCommittedIntersectionType;
    (function (RayQueryCommittedIntersectionType) {
        RayQueryCommittedIntersectionType[RayQueryCommittedIntersectionType["RayQueryCommittedIntersectionTypeRayQueryCommittedIntersectionNoneKHR"] = 0] = "RayQueryCommittedIntersectionTypeRayQueryCommittedIntersectionNoneKHR";
        RayQueryCommittedIntersectionType[RayQueryCommittedIntersectionType["RayQueryCommittedIntersectionTypeRayQueryCommittedIntersectionTriangleKHR"] = 1] = "RayQueryCommittedIntersectionTypeRayQueryCommittedIntersectionTriangleKHR";
        RayQueryCommittedIntersectionType[RayQueryCommittedIntersectionType["RayQueryCommittedIntersectionTypeRayQueryCommittedIntersectionGeneratedKHR"] = 2] = "RayQueryCommittedIntersectionTypeRayQueryCommittedIntersectionGeneratedKHR";
        RayQueryCommittedIntersectionType[RayQueryCommittedIntersectionType["RayQueryCommittedIntersectionTypeMax"] = 2147483647] = "RayQueryCommittedIntersectionTypeMax";
    })(RayQueryCommittedIntersectionType || (RayQueryCommittedIntersectionType = {}));
    var RayQueryCandidateIntersectionType;
    (function (RayQueryCandidateIntersectionType) {
        RayQueryCandidateIntersectionType[RayQueryCandidateIntersectionType["RayQueryCandidateIntersectionTypeRayQueryCandidateIntersectionTriangleKHR"] = 0] = "RayQueryCandidateIntersectionTypeRayQueryCandidateIntersectionTriangleKHR";
        RayQueryCandidateIntersectionType[RayQueryCandidateIntersectionType["RayQueryCandidateIntersectionTypeRayQueryCandidateIntersectionAABBKHR"] = 1] = "RayQueryCandidateIntersectionTypeRayQueryCandidateIntersectionAABBKHR";
        RayQueryCandidateIntersectionType[RayQueryCandidateIntersectionType["RayQueryCandidateIntersectionTypeMax"] = 2147483647] = "RayQueryCandidateIntersectionTypeMax";
    })(RayQueryCandidateIntersectionType || (RayQueryCandidateIntersectionType = {}));
    var FragmentShadingRateShift;
    (function (FragmentShadingRateShift) {
        FragmentShadingRateShift[FragmentShadingRateShift["FragmentShadingRateVertical2PixelsShift"] = 0] = "FragmentShadingRateVertical2PixelsShift";
        FragmentShadingRateShift[FragmentShadingRateShift["FragmentShadingRateVertical4PixelsShift"] = 1] = "FragmentShadingRateVertical4PixelsShift";
        FragmentShadingRateShift[FragmentShadingRateShift["FragmentShadingRateHorizontal2PixelsShift"] = 2] = "FragmentShadingRateHorizontal2PixelsShift";
        FragmentShadingRateShift[FragmentShadingRateShift["FragmentShadingRateHorizontal4PixelsShift"] = 3] = "FragmentShadingRateHorizontal4PixelsShift";
        FragmentShadingRateShift[FragmentShadingRateShift["FragmentShadingRateMax"] = 2147483647] = "FragmentShadingRateMax";
    })(FragmentShadingRateShift || (FragmentShadingRateShift = {}));
    var FragmentShadingRateMask;
    (function (FragmentShadingRateMask) {
        FragmentShadingRateMask[FragmentShadingRateMask["FragmentShadingRateMaskNone"] = 0] = "FragmentShadingRateMaskNone";
        FragmentShadingRateMask[FragmentShadingRateMask["FragmentShadingRateVertical2PixelsMask"] = 1] = "FragmentShadingRateVertical2PixelsMask";
        FragmentShadingRateMask[FragmentShadingRateMask["FragmentShadingRateVertical4PixelsMask"] = 2] = "FragmentShadingRateVertical4PixelsMask";
        FragmentShadingRateMask[FragmentShadingRateMask["FragmentShadingRateHorizontal2PixelsMask"] = 4] = "FragmentShadingRateHorizontal2PixelsMask";
        FragmentShadingRateMask[FragmentShadingRateMask["FragmentShadingRateHorizontal4PixelsMask"] = 8] = "FragmentShadingRateHorizontal4PixelsMask";
    })(FragmentShadingRateMask || (FragmentShadingRateMask = {}));
    var Op;
    (function (Op) {
        Op[Op["OpNop"] = 0] = "OpNop";
        Op[Op["OpUndef"] = 1] = "OpUndef";
        Op[Op["OpSourceContinued"] = 2] = "OpSourceContinued";
        Op[Op["OpSource"] = 3] = "OpSource";
        Op[Op["OpSourceExtension"] = 4] = "OpSourceExtension";
        Op[Op["OpName"] = 5] = "OpName";
        Op[Op["OpMemberName"] = 6] = "OpMemberName";
        Op[Op["OpString"] = 7] = "OpString";
        Op[Op["OpLine"] = 8] = "OpLine";
        Op[Op["OpExtension"] = 10] = "OpExtension";
        Op[Op["OpExtInstImport"] = 11] = "OpExtInstImport";
        Op[Op["OpExtInst"] = 12] = "OpExtInst";
        Op[Op["OpMemoryModel"] = 14] = "OpMemoryModel";
        Op[Op["OpEntryPoint"] = 15] = "OpEntryPoint";
        Op[Op["OpExecutionMode"] = 16] = "OpExecutionMode";
        Op[Op["OpCapability"] = 17] = "OpCapability";
        Op[Op["OpTypeVoid"] = 19] = "OpTypeVoid";
        Op[Op["OpTypeBool"] = 20] = "OpTypeBool";
        Op[Op["OpTypeInt"] = 21] = "OpTypeInt";
        Op[Op["OpTypeFloat"] = 22] = "OpTypeFloat";
        Op[Op["OpTypeVector"] = 23] = "OpTypeVector";
        Op[Op["OpTypeMatrix"] = 24] = "OpTypeMatrix";
        Op[Op["OpTypeImage"] = 25] = "OpTypeImage";
        Op[Op["OpTypeSampler"] = 26] = "OpTypeSampler";
        Op[Op["OpTypeSampledImage"] = 27] = "OpTypeSampledImage";
        Op[Op["OpTypeArray"] = 28] = "OpTypeArray";
        Op[Op["OpTypeRuntimeArray"] = 29] = "OpTypeRuntimeArray";
        Op[Op["OpTypeStruct"] = 30] = "OpTypeStruct";
        Op[Op["OpTypeOpaque"] = 31] = "OpTypeOpaque";
        Op[Op["OpTypePointer"] = 32] = "OpTypePointer";
        Op[Op["OpTypeFunction"] = 33] = "OpTypeFunction";
        Op[Op["OpTypeEvent"] = 34] = "OpTypeEvent";
        Op[Op["OpTypeDeviceEvent"] = 35] = "OpTypeDeviceEvent";
        Op[Op["OpTypeReserveId"] = 36] = "OpTypeReserveId";
        Op[Op["OpTypeQueue"] = 37] = "OpTypeQueue";
        Op[Op["OpTypePipe"] = 38] = "OpTypePipe";
        Op[Op["OpTypeForwardPointer"] = 39] = "OpTypeForwardPointer";
        Op[Op["OpConstantTrue"] = 41] = "OpConstantTrue";
        Op[Op["OpConstantFalse"] = 42] = "OpConstantFalse";
        Op[Op["OpConstant"] = 43] = "OpConstant";
        Op[Op["OpConstantComposite"] = 44] = "OpConstantComposite";
        Op[Op["OpConstantSampler"] = 45] = "OpConstantSampler";
        Op[Op["OpConstantNull"] = 46] = "OpConstantNull";
        Op[Op["OpSpecConstantTrue"] = 48] = "OpSpecConstantTrue";
        Op[Op["OpSpecConstantFalse"] = 49] = "OpSpecConstantFalse";
        Op[Op["OpSpecConstant"] = 50] = "OpSpecConstant";
        Op[Op["OpSpecConstantComposite"] = 51] = "OpSpecConstantComposite";
        Op[Op["OpSpecConstantOp"] = 52] = "OpSpecConstantOp";
        Op[Op["OpFunction"] = 54] = "OpFunction";
        Op[Op["OpFunctionParameter"] = 55] = "OpFunctionParameter";
        Op[Op["OpFunctionEnd"] = 56] = "OpFunctionEnd";
        Op[Op["OpFunctionCall"] = 57] = "OpFunctionCall";
        Op[Op["OpVariable"] = 59] = "OpVariable";
        Op[Op["OpImageTexelPointer"] = 60] = "OpImageTexelPointer";
        Op[Op["OpLoad"] = 61] = "OpLoad";
        Op[Op["OpStore"] = 62] = "OpStore";
        Op[Op["OpCopyMemory"] = 63] = "OpCopyMemory";
        Op[Op["OpCopyMemorySized"] = 64] = "OpCopyMemorySized";
        Op[Op["OpAccessChain"] = 65] = "OpAccessChain";
        Op[Op["OpInBoundsAccessChain"] = 66] = "OpInBoundsAccessChain";
        Op[Op["OpPtrAccessChain"] = 67] = "OpPtrAccessChain";
        Op[Op["OpArrayLength"] = 68] = "OpArrayLength";
        Op[Op["OpGenericPtrMemSemantics"] = 69] = "OpGenericPtrMemSemantics";
        Op[Op["OpInBoundsPtrAccessChain"] = 70] = "OpInBoundsPtrAccessChain";
        Op[Op["OpDecorate"] = 71] = "OpDecorate";
        Op[Op["OpMemberDecorate"] = 72] = "OpMemberDecorate";
        Op[Op["OpDecorationGroup"] = 73] = "OpDecorationGroup";
        Op[Op["OpGroupDecorate"] = 74] = "OpGroupDecorate";
        Op[Op["OpGroupMemberDecorate"] = 75] = "OpGroupMemberDecorate";
        Op[Op["OpVectorExtractDynamic"] = 77] = "OpVectorExtractDynamic";
        Op[Op["OpVectorInsertDynamic"] = 78] = "OpVectorInsertDynamic";
        Op[Op["OpVectorShuffle"] = 79] = "OpVectorShuffle";
        Op[Op["OpCompositeConstruct"] = 80] = "OpCompositeConstruct";
        Op[Op["OpCompositeExtract"] = 81] = "OpCompositeExtract";
        Op[Op["OpCompositeInsert"] = 82] = "OpCompositeInsert";
        Op[Op["OpCopyObject"] = 83] = "OpCopyObject";
        Op[Op["OpTranspose"] = 84] = "OpTranspose";
        Op[Op["OpSampledImage"] = 86] = "OpSampledImage";
        Op[Op["OpImageSampleImplicitLod"] = 87] = "OpImageSampleImplicitLod";
        Op[Op["OpImageSampleExplicitLod"] = 88] = "OpImageSampleExplicitLod";
        Op[Op["OpImageSampleDrefImplicitLod"] = 89] = "OpImageSampleDrefImplicitLod";
        Op[Op["OpImageSampleDrefExplicitLod"] = 90] = "OpImageSampleDrefExplicitLod";
        Op[Op["OpImageSampleProjImplicitLod"] = 91] = "OpImageSampleProjImplicitLod";
        Op[Op["OpImageSampleProjExplicitLod"] = 92] = "OpImageSampleProjExplicitLod";
        Op[Op["OpImageSampleProjDrefImplicitLod"] = 93] = "OpImageSampleProjDrefImplicitLod";
        Op[Op["OpImageSampleProjDrefExplicitLod"] = 94] = "OpImageSampleProjDrefExplicitLod";
        Op[Op["OpImageFetch"] = 95] = "OpImageFetch";
        Op[Op["OpImageGather"] = 96] = "OpImageGather";
        Op[Op["OpImageDrefGather"] = 97] = "OpImageDrefGather";
        Op[Op["OpImageRead"] = 98] = "OpImageRead";
        Op[Op["OpImageWrite"] = 99] = "OpImageWrite";
        Op[Op["OpImage"] = 100] = "OpImage";
        Op[Op["OpImageQueryFormat"] = 101] = "OpImageQueryFormat";
        Op[Op["OpImageQueryOrder"] = 102] = "OpImageQueryOrder";
        Op[Op["OpImageQuerySizeLod"] = 103] = "OpImageQuerySizeLod";
        Op[Op["OpImageQuerySize"] = 104] = "OpImageQuerySize";
        Op[Op["OpImageQueryLod"] = 105] = "OpImageQueryLod";
        Op[Op["OpImageQueryLevels"] = 106] = "OpImageQueryLevels";
        Op[Op["OpImageQuerySamples"] = 107] = "OpImageQuerySamples";
        Op[Op["OpConvertFToU"] = 109] = "OpConvertFToU";
        Op[Op["OpConvertFToS"] = 110] = "OpConvertFToS";
        Op[Op["OpConvertSToF"] = 111] = "OpConvertSToF";
        Op[Op["OpConvertUToF"] = 112] = "OpConvertUToF";
        Op[Op["OpUConvert"] = 113] = "OpUConvert";
        Op[Op["OpSConvert"] = 114] = "OpSConvert";
        Op[Op["OpFConvert"] = 115] = "OpFConvert";
        Op[Op["OpQuantizeToF16"] = 116] = "OpQuantizeToF16";
        Op[Op["OpConvertPtrToU"] = 117] = "OpConvertPtrToU";
        Op[Op["OpSatConvertSToU"] = 118] = "OpSatConvertSToU";
        Op[Op["OpSatConvertUToS"] = 119] = "OpSatConvertUToS";
        Op[Op["OpConvertUToPtr"] = 120] = "OpConvertUToPtr";
        Op[Op["OpPtrCastToGeneric"] = 121] = "OpPtrCastToGeneric";
        Op[Op["OpGenericCastToPtr"] = 122] = "OpGenericCastToPtr";
        Op[Op["OpGenericCastToPtrExplicit"] = 123] = "OpGenericCastToPtrExplicit";
        Op[Op["OpBitcast"] = 124] = "OpBitcast";
        Op[Op["OpSNegate"] = 126] = "OpSNegate";
        Op[Op["OpFNegate"] = 127] = "OpFNegate";
        Op[Op["OpIAdd"] = 128] = "OpIAdd";
        Op[Op["OpFAdd"] = 129] = "OpFAdd";
        Op[Op["OpISub"] = 130] = "OpISub";
        Op[Op["OpFSub"] = 131] = "OpFSub";
        Op[Op["OpIMul"] = 132] = "OpIMul";
        Op[Op["OpFMul"] = 133] = "OpFMul";
        Op[Op["OpUDiv"] = 134] = "OpUDiv";
        Op[Op["OpSDiv"] = 135] = "OpSDiv";
        Op[Op["OpFDiv"] = 136] = "OpFDiv";
        Op[Op["OpUMod"] = 137] = "OpUMod";
        Op[Op["OpSRem"] = 138] = "OpSRem";
        Op[Op["OpSMod"] = 139] = "OpSMod";
        Op[Op["OpFRem"] = 140] = "OpFRem";
        Op[Op["OpFMod"] = 141] = "OpFMod";
        Op[Op["OpVectorTimesScalar"] = 142] = "OpVectorTimesScalar";
        Op[Op["OpMatrixTimesScalar"] = 143] = "OpMatrixTimesScalar";
        Op[Op["OpVectorTimesMatrix"] = 144] = "OpVectorTimesMatrix";
        Op[Op["OpMatrixTimesVector"] = 145] = "OpMatrixTimesVector";
        Op[Op["OpMatrixTimesMatrix"] = 146] = "OpMatrixTimesMatrix";
        Op[Op["OpOuterProduct"] = 147] = "OpOuterProduct";
        Op[Op["OpDot"] = 148] = "OpDot";
        Op[Op["OpIAddCarry"] = 149] = "OpIAddCarry";
        Op[Op["OpISubBorrow"] = 150] = "OpISubBorrow";
        Op[Op["OpUMulExtended"] = 151] = "OpUMulExtended";
        Op[Op["OpSMulExtended"] = 152] = "OpSMulExtended";
        Op[Op["OpAny"] = 154] = "OpAny";
        Op[Op["OpAll"] = 155] = "OpAll";
        Op[Op["OpIsNan"] = 156] = "OpIsNan";
        Op[Op["OpIsInf"] = 157] = "OpIsInf";
        Op[Op["OpIsFinite"] = 158] = "OpIsFinite";
        Op[Op["OpIsNormal"] = 159] = "OpIsNormal";
        Op[Op["OpSignBitSet"] = 160] = "OpSignBitSet";
        Op[Op["OpLessOrGreater"] = 161] = "OpLessOrGreater";
        Op[Op["OpOrdered"] = 162] = "OpOrdered";
        Op[Op["OpUnordered"] = 163] = "OpUnordered";
        Op[Op["OpLogicalEqual"] = 164] = "OpLogicalEqual";
        Op[Op["OpLogicalNotEqual"] = 165] = "OpLogicalNotEqual";
        Op[Op["OpLogicalOr"] = 166] = "OpLogicalOr";
        Op[Op["OpLogicalAnd"] = 167] = "OpLogicalAnd";
        Op[Op["OpLogicalNot"] = 168] = "OpLogicalNot";
        Op[Op["OpSelect"] = 169] = "OpSelect";
        Op[Op["OpIEqual"] = 170] = "OpIEqual";
        Op[Op["OpINotEqual"] = 171] = "OpINotEqual";
        Op[Op["OpUGreaterThan"] = 172] = "OpUGreaterThan";
        Op[Op["OpSGreaterThan"] = 173] = "OpSGreaterThan";
        Op[Op["OpUGreaterThanEqual"] = 174] = "OpUGreaterThanEqual";
        Op[Op["OpSGreaterThanEqual"] = 175] = "OpSGreaterThanEqual";
        Op[Op["OpULessThan"] = 176] = "OpULessThan";
        Op[Op["OpSLessThan"] = 177] = "OpSLessThan";
        Op[Op["OpULessThanEqual"] = 178] = "OpULessThanEqual";
        Op[Op["OpSLessThanEqual"] = 179] = "OpSLessThanEqual";
        Op[Op["OpFOrdEqual"] = 180] = "OpFOrdEqual";
        Op[Op["OpFUnordEqual"] = 181] = "OpFUnordEqual";
        Op[Op["OpFOrdNotEqual"] = 182] = "OpFOrdNotEqual";
        Op[Op["OpFUnordNotEqual"] = 183] = "OpFUnordNotEqual";
        Op[Op["OpFOrdLessThan"] = 184] = "OpFOrdLessThan";
        Op[Op["OpFUnordLessThan"] = 185] = "OpFUnordLessThan";
        Op[Op["OpFOrdGreaterThan"] = 186] = "OpFOrdGreaterThan";
        Op[Op["OpFUnordGreaterThan"] = 187] = "OpFUnordGreaterThan";
        Op[Op["OpFOrdLessThanEqual"] = 188] = "OpFOrdLessThanEqual";
        Op[Op["OpFUnordLessThanEqual"] = 189] = "OpFUnordLessThanEqual";
        Op[Op["OpFOrdGreaterThanEqual"] = 190] = "OpFOrdGreaterThanEqual";
        Op[Op["OpFUnordGreaterThanEqual"] = 191] = "OpFUnordGreaterThanEqual";
        Op[Op["OpShiftRightLogical"] = 194] = "OpShiftRightLogical";
        Op[Op["OpShiftRightArithmetic"] = 195] = "OpShiftRightArithmetic";
        Op[Op["OpShiftLeftLogical"] = 196] = "OpShiftLeftLogical";
        Op[Op["OpBitwiseOr"] = 197] = "OpBitwiseOr";
        Op[Op["OpBitwiseXor"] = 198] = "OpBitwiseXor";
        Op[Op["OpBitwiseAnd"] = 199] = "OpBitwiseAnd";
        Op[Op["OpNot"] = 200] = "OpNot";
        Op[Op["OpBitFieldInsert"] = 201] = "OpBitFieldInsert";
        Op[Op["OpBitFieldSExtract"] = 202] = "OpBitFieldSExtract";
        Op[Op["OpBitFieldUExtract"] = 203] = "OpBitFieldUExtract";
        Op[Op["OpBitReverse"] = 204] = "OpBitReverse";
        Op[Op["OpBitCount"] = 205] = "OpBitCount";
        Op[Op["OpDPdx"] = 207] = "OpDPdx";
        Op[Op["OpDPdy"] = 208] = "OpDPdy";
        Op[Op["OpFwidth"] = 209] = "OpFwidth";
        Op[Op["OpDPdxFine"] = 210] = "OpDPdxFine";
        Op[Op["OpDPdyFine"] = 211] = "OpDPdyFine";
        Op[Op["OpFwidthFine"] = 212] = "OpFwidthFine";
        Op[Op["OpDPdxCoarse"] = 213] = "OpDPdxCoarse";
        Op[Op["OpDPdyCoarse"] = 214] = "OpDPdyCoarse";
        Op[Op["OpFwidthCoarse"] = 215] = "OpFwidthCoarse";
        Op[Op["OpEmitVertex"] = 218] = "OpEmitVertex";
        Op[Op["OpEndPrimitive"] = 219] = "OpEndPrimitive";
        Op[Op["OpEmitStreamVertex"] = 220] = "OpEmitStreamVertex";
        Op[Op["OpEndStreamPrimitive"] = 221] = "OpEndStreamPrimitive";
        Op[Op["OpControlBarrier"] = 224] = "OpControlBarrier";
        Op[Op["OpMemoryBarrier"] = 225] = "OpMemoryBarrier";
        Op[Op["OpAtomicLoad"] = 227] = "OpAtomicLoad";
        Op[Op["OpAtomicStore"] = 228] = "OpAtomicStore";
        Op[Op["OpAtomicExchange"] = 229] = "OpAtomicExchange";
        Op[Op["OpAtomicCompareExchange"] = 230] = "OpAtomicCompareExchange";
        Op[Op["OpAtomicCompareExchangeWeak"] = 231] = "OpAtomicCompareExchangeWeak";
        Op[Op["OpAtomicIIncrement"] = 232] = "OpAtomicIIncrement";
        Op[Op["OpAtomicIDecrement"] = 233] = "OpAtomicIDecrement";
        Op[Op["OpAtomicIAdd"] = 234] = "OpAtomicIAdd";
        Op[Op["OpAtomicISub"] = 235] = "OpAtomicISub";
        Op[Op["OpAtomicSMin"] = 236] = "OpAtomicSMin";
        Op[Op["OpAtomicUMin"] = 237] = "OpAtomicUMin";
        Op[Op["OpAtomicSMax"] = 238] = "OpAtomicSMax";
        Op[Op["OpAtomicUMax"] = 239] = "OpAtomicUMax";
        Op[Op["OpAtomicAnd"] = 240] = "OpAtomicAnd";
        Op[Op["OpAtomicOr"] = 241] = "OpAtomicOr";
        Op[Op["OpAtomicXor"] = 242] = "OpAtomicXor";
        Op[Op["OpPhi"] = 245] = "OpPhi";
        Op[Op["OpLoopMerge"] = 246] = "OpLoopMerge";
        Op[Op["OpSelectionMerge"] = 247] = "OpSelectionMerge";
        Op[Op["OpLabel"] = 248] = "OpLabel";
        Op[Op["OpBranch"] = 249] = "OpBranch";
        Op[Op["OpBranchConditional"] = 250] = "OpBranchConditional";
        Op[Op["OpSwitch"] = 251] = "OpSwitch";
        Op[Op["OpKill"] = 252] = "OpKill";
        Op[Op["OpReturn"] = 253] = "OpReturn";
        Op[Op["OpReturnValue"] = 254] = "OpReturnValue";
        Op[Op["OpUnreachable"] = 255] = "OpUnreachable";
        Op[Op["OpLifetimeStart"] = 256] = "OpLifetimeStart";
        Op[Op["OpLifetimeStop"] = 257] = "OpLifetimeStop";
        Op[Op["OpGroupAsyncCopy"] = 259] = "OpGroupAsyncCopy";
        Op[Op["OpGroupWaitEvents"] = 260] = "OpGroupWaitEvents";
        Op[Op["OpGroupAll"] = 261] = "OpGroupAll";
        Op[Op["OpGroupAny"] = 262] = "OpGroupAny";
        Op[Op["OpGroupBroadcast"] = 263] = "OpGroupBroadcast";
        Op[Op["OpGroupIAdd"] = 264] = "OpGroupIAdd";
        Op[Op["OpGroupFAdd"] = 265] = "OpGroupFAdd";
        Op[Op["OpGroupFMin"] = 266] = "OpGroupFMin";
        Op[Op["OpGroupUMin"] = 267] = "OpGroupUMin";
        Op[Op["OpGroupSMin"] = 268] = "OpGroupSMin";
        Op[Op["OpGroupFMax"] = 269] = "OpGroupFMax";
        Op[Op["OpGroupUMax"] = 270] = "OpGroupUMax";
        Op[Op["OpGroupSMax"] = 271] = "OpGroupSMax";
        Op[Op["OpReadPipe"] = 274] = "OpReadPipe";
        Op[Op["OpWritePipe"] = 275] = "OpWritePipe";
        Op[Op["OpReservedReadPipe"] = 276] = "OpReservedReadPipe";
        Op[Op["OpReservedWritePipe"] = 277] = "OpReservedWritePipe";
        Op[Op["OpReserveReadPipePackets"] = 278] = "OpReserveReadPipePackets";
        Op[Op["OpReserveWritePipePackets"] = 279] = "OpReserveWritePipePackets";
        Op[Op["OpCommitReadPipe"] = 280] = "OpCommitReadPipe";
        Op[Op["OpCommitWritePipe"] = 281] = "OpCommitWritePipe";
        Op[Op["OpIsValidReserveId"] = 282] = "OpIsValidReserveId";
        Op[Op["OpGetNumPipePackets"] = 283] = "OpGetNumPipePackets";
        Op[Op["OpGetMaxPipePackets"] = 284] = "OpGetMaxPipePackets";
        Op[Op["OpGroupReserveReadPipePackets"] = 285] = "OpGroupReserveReadPipePackets";
        Op[Op["OpGroupReserveWritePipePackets"] = 286] = "OpGroupReserveWritePipePackets";
        Op[Op["OpGroupCommitReadPipe"] = 287] = "OpGroupCommitReadPipe";
        Op[Op["OpGroupCommitWritePipe"] = 288] = "OpGroupCommitWritePipe";
        Op[Op["OpEnqueueMarker"] = 291] = "OpEnqueueMarker";
        Op[Op["OpEnqueueKernel"] = 292] = "OpEnqueueKernel";
        Op[Op["OpGetKernelNDrangeSubGroupCount"] = 293] = "OpGetKernelNDrangeSubGroupCount";
        Op[Op["OpGetKernelNDrangeMaxSubGroupSize"] = 294] = "OpGetKernelNDrangeMaxSubGroupSize";
        Op[Op["OpGetKernelWorkGroupSize"] = 295] = "OpGetKernelWorkGroupSize";
        Op[Op["OpGetKernelPreferredWorkGroupSizeMultiple"] = 296] = "OpGetKernelPreferredWorkGroupSizeMultiple";
        Op[Op["OpRetainEvent"] = 297] = "OpRetainEvent";
        Op[Op["OpReleaseEvent"] = 298] = "OpReleaseEvent";
        Op[Op["OpCreateUserEvent"] = 299] = "OpCreateUserEvent";
        Op[Op["OpIsValidEvent"] = 300] = "OpIsValidEvent";
        Op[Op["OpSetUserEventStatus"] = 301] = "OpSetUserEventStatus";
        Op[Op["OpCaptureEventProfilingInfo"] = 302] = "OpCaptureEventProfilingInfo";
        Op[Op["OpGetDefaultQueue"] = 303] = "OpGetDefaultQueue";
        Op[Op["OpBuildNDRange"] = 304] = "OpBuildNDRange";
        Op[Op["OpImageSparseSampleImplicitLod"] = 305] = "OpImageSparseSampleImplicitLod";
        Op[Op["OpImageSparseSampleExplicitLod"] = 306] = "OpImageSparseSampleExplicitLod";
        Op[Op["OpImageSparseSampleDrefImplicitLod"] = 307] = "OpImageSparseSampleDrefImplicitLod";
        Op[Op["OpImageSparseSampleDrefExplicitLod"] = 308] = "OpImageSparseSampleDrefExplicitLod";
        Op[Op["OpImageSparseSampleProjImplicitLod"] = 309] = "OpImageSparseSampleProjImplicitLod";
        Op[Op["OpImageSparseSampleProjExplicitLod"] = 310] = "OpImageSparseSampleProjExplicitLod";
        Op[Op["OpImageSparseSampleProjDrefImplicitLod"] = 311] = "OpImageSparseSampleProjDrefImplicitLod";
        Op[Op["OpImageSparseSampleProjDrefExplicitLod"] = 312] = "OpImageSparseSampleProjDrefExplicitLod";
        Op[Op["OpImageSparseFetch"] = 313] = "OpImageSparseFetch";
        Op[Op["OpImageSparseGather"] = 314] = "OpImageSparseGather";
        Op[Op["OpImageSparseDrefGather"] = 315] = "OpImageSparseDrefGather";
        Op[Op["OpImageSparseTexelsResident"] = 316] = "OpImageSparseTexelsResident";
        Op[Op["OpNoLine"] = 317] = "OpNoLine";
        Op[Op["OpAtomicFlagTestAndSet"] = 318] = "OpAtomicFlagTestAndSet";
        Op[Op["OpAtomicFlagClear"] = 319] = "OpAtomicFlagClear";
        Op[Op["OpImageSparseRead"] = 320] = "OpImageSparseRead";
        Op[Op["OpSizeOf"] = 321] = "OpSizeOf";
        Op[Op["OpTypePipeStorage"] = 322] = "OpTypePipeStorage";
        Op[Op["OpConstantPipeStorage"] = 323] = "OpConstantPipeStorage";
        Op[Op["OpCreatePipeFromPipeStorage"] = 324] = "OpCreatePipeFromPipeStorage";
        Op[Op["OpGetKernelLocalSizeForSubgroupCount"] = 325] = "OpGetKernelLocalSizeForSubgroupCount";
        Op[Op["OpGetKernelMaxNumSubgroups"] = 326] = "OpGetKernelMaxNumSubgroups";
        Op[Op["OpTypeNamedBarrier"] = 327] = "OpTypeNamedBarrier";
        Op[Op["OpNamedBarrierInitialize"] = 328] = "OpNamedBarrierInitialize";
        Op[Op["OpMemoryNamedBarrier"] = 329] = "OpMemoryNamedBarrier";
        Op[Op["OpModuleProcessed"] = 330] = "OpModuleProcessed";
        Op[Op["OpExecutionModeId"] = 331] = "OpExecutionModeId";
        Op[Op["OpDecorateId"] = 332] = "OpDecorateId";
        Op[Op["OpGroupNonUniformElect"] = 333] = "OpGroupNonUniformElect";
        Op[Op["OpGroupNonUniformAll"] = 334] = "OpGroupNonUniformAll";
        Op[Op["OpGroupNonUniformAny"] = 335] = "OpGroupNonUniformAny";
        Op[Op["OpGroupNonUniformAllEqual"] = 336] = "OpGroupNonUniformAllEqual";
        Op[Op["OpGroupNonUniformBroadcast"] = 337] = "OpGroupNonUniformBroadcast";
        Op[Op["OpGroupNonUniformBroadcastFirst"] = 338] = "OpGroupNonUniformBroadcastFirst";
        Op[Op["OpGroupNonUniformBallot"] = 339] = "OpGroupNonUniformBallot";
        Op[Op["OpGroupNonUniformInverseBallot"] = 340] = "OpGroupNonUniformInverseBallot";
        Op[Op["OpGroupNonUniformBallotBitExtract"] = 341] = "OpGroupNonUniformBallotBitExtract";
        Op[Op["OpGroupNonUniformBallotBitCount"] = 342] = "OpGroupNonUniformBallotBitCount";
        Op[Op["OpGroupNonUniformBallotFindLSB"] = 343] = "OpGroupNonUniformBallotFindLSB";
        Op[Op["OpGroupNonUniformBallotFindMSB"] = 344] = "OpGroupNonUniformBallotFindMSB";
        Op[Op["OpGroupNonUniformShuffle"] = 345] = "OpGroupNonUniformShuffle";
        Op[Op["OpGroupNonUniformShuffleXor"] = 346] = "OpGroupNonUniformShuffleXor";
        Op[Op["OpGroupNonUniformShuffleUp"] = 347] = "OpGroupNonUniformShuffleUp";
        Op[Op["OpGroupNonUniformShuffleDown"] = 348] = "OpGroupNonUniformShuffleDown";
        Op[Op["OpGroupNonUniformIAdd"] = 349] = "OpGroupNonUniformIAdd";
        Op[Op["OpGroupNonUniformFAdd"] = 350] = "OpGroupNonUniformFAdd";
        Op[Op["OpGroupNonUniformIMul"] = 351] = "OpGroupNonUniformIMul";
        Op[Op["OpGroupNonUniformFMul"] = 352] = "OpGroupNonUniformFMul";
        Op[Op["OpGroupNonUniformSMin"] = 353] = "OpGroupNonUniformSMin";
        Op[Op["OpGroupNonUniformUMin"] = 354] = "OpGroupNonUniformUMin";
        Op[Op["OpGroupNonUniformFMin"] = 355] = "OpGroupNonUniformFMin";
        Op[Op["OpGroupNonUniformSMax"] = 356] = "OpGroupNonUniformSMax";
        Op[Op["OpGroupNonUniformUMax"] = 357] = "OpGroupNonUniformUMax";
        Op[Op["OpGroupNonUniformFMax"] = 358] = "OpGroupNonUniformFMax";
        Op[Op["OpGroupNonUniformBitwiseAnd"] = 359] = "OpGroupNonUniformBitwiseAnd";
        Op[Op["OpGroupNonUniformBitwiseOr"] = 360] = "OpGroupNonUniformBitwiseOr";
        Op[Op["OpGroupNonUniformBitwiseXor"] = 361] = "OpGroupNonUniformBitwiseXor";
        Op[Op["OpGroupNonUniformLogicalAnd"] = 362] = "OpGroupNonUniformLogicalAnd";
        Op[Op["OpGroupNonUniformLogicalOr"] = 363] = "OpGroupNonUniformLogicalOr";
        Op[Op["OpGroupNonUniformLogicalXor"] = 364] = "OpGroupNonUniformLogicalXor";
        Op[Op["OpGroupNonUniformQuadBroadcast"] = 365] = "OpGroupNonUniformQuadBroadcast";
        Op[Op["OpGroupNonUniformQuadSwap"] = 366] = "OpGroupNonUniformQuadSwap";
        Op[Op["OpCopyLogical"] = 400] = "OpCopyLogical";
        Op[Op["OpPtrEqual"] = 401] = "OpPtrEqual";
        Op[Op["OpPtrNotEqual"] = 402] = "OpPtrNotEqual";
        Op[Op["OpPtrDiff"] = 403] = "OpPtrDiff";
        Op[Op["OpTerminateInvocation"] = 4416] = "OpTerminateInvocation";
        Op[Op["OpSubgroupBallotKHR"] = 4421] = "OpSubgroupBallotKHR";
        Op[Op["OpSubgroupFirstInvocationKHR"] = 4422] = "OpSubgroupFirstInvocationKHR";
        Op[Op["OpSubgroupAllKHR"] = 4428] = "OpSubgroupAllKHR";
        Op[Op["OpSubgroupAnyKHR"] = 4429] = "OpSubgroupAnyKHR";
        Op[Op["OpSubgroupAllEqualKHR"] = 4430] = "OpSubgroupAllEqualKHR";
        Op[Op["OpSubgroupReadInvocationKHR"] = 4432] = "OpSubgroupReadInvocationKHR";
        Op[Op["OpTraceRayKHR"] = 4445] = "OpTraceRayKHR";
        Op[Op["OpExecuteCallableKHR"] = 4446] = "OpExecuteCallableKHR";
        Op[Op["OpConvertUToAccelerationStructureKHR"] = 4447] = "OpConvertUToAccelerationStructureKHR";
        Op[Op["OpIgnoreIntersectionKHR"] = 4448] = "OpIgnoreIntersectionKHR";
        Op[Op["OpTerminateRayKHR"] = 4449] = "OpTerminateRayKHR";
        Op[Op["OpTypeRayQueryKHR"] = 4472] = "OpTypeRayQueryKHR";
        Op[Op["OpRayQueryInitializeKHR"] = 4473] = "OpRayQueryInitializeKHR";
        Op[Op["OpRayQueryTerminateKHR"] = 4474] = "OpRayQueryTerminateKHR";
        Op[Op["OpRayQueryGenerateIntersectionKHR"] = 4475] = "OpRayQueryGenerateIntersectionKHR";
        Op[Op["OpRayQueryConfirmIntersectionKHR"] = 4476] = "OpRayQueryConfirmIntersectionKHR";
        Op[Op["OpRayQueryProceedKHR"] = 4477] = "OpRayQueryProceedKHR";
        Op[Op["OpRayQueryGetIntersectionTypeKHR"] = 4479] = "OpRayQueryGetIntersectionTypeKHR";
        Op[Op["OpGroupIAddNonUniformAMD"] = 5000] = "OpGroupIAddNonUniformAMD";
        Op[Op["OpGroupFAddNonUniformAMD"] = 5001] = "OpGroupFAddNonUniformAMD";
        Op[Op["OpGroupFMinNonUniformAMD"] = 5002] = "OpGroupFMinNonUniformAMD";
        Op[Op["OpGroupUMinNonUniformAMD"] = 5003] = "OpGroupUMinNonUniformAMD";
        Op[Op["OpGroupSMinNonUniformAMD"] = 5004] = "OpGroupSMinNonUniformAMD";
        Op[Op["OpGroupFMaxNonUniformAMD"] = 5005] = "OpGroupFMaxNonUniformAMD";
        Op[Op["OpGroupUMaxNonUniformAMD"] = 5006] = "OpGroupUMaxNonUniformAMD";
        Op[Op["OpGroupSMaxNonUniformAMD"] = 5007] = "OpGroupSMaxNonUniformAMD";
        Op[Op["OpFragmentMaskFetchAMD"] = 5011] = "OpFragmentMaskFetchAMD";
        Op[Op["OpFragmentFetchAMD"] = 5012] = "OpFragmentFetchAMD";
        Op[Op["OpReadClockKHR"] = 5056] = "OpReadClockKHR";
        Op[Op["OpImageSampleFootprintNV"] = 5283] = "OpImageSampleFootprintNV";
        Op[Op["OpGroupNonUniformPartitionNV"] = 5296] = "OpGroupNonUniformPartitionNV";
        Op[Op["OpWritePackedPrimitiveIndices4x8NV"] = 5299] = "OpWritePackedPrimitiveIndices4x8NV";
        Op[Op["OpReportIntersectionKHR"] = 5334] = "OpReportIntersectionKHR";
        Op[Op["OpReportIntersectionNV"] = 5334] = "OpReportIntersectionNV";
        Op[Op["OpIgnoreIntersectionNV"] = 5335] = "OpIgnoreIntersectionNV";
        Op[Op["OpTerminateRayNV"] = 5336] = "OpTerminateRayNV";
        Op[Op["OpTraceNV"] = 5337] = "OpTraceNV";
        Op[Op["OpTypeAccelerationStructureKHR"] = 5341] = "OpTypeAccelerationStructureKHR";
        Op[Op["OpTypeAccelerationStructureNV"] = 5341] = "OpTypeAccelerationStructureNV";
        Op[Op["OpExecuteCallableNV"] = 5344] = "OpExecuteCallableNV";
        Op[Op["OpTypeCooperativeMatrixNV"] = 5358] = "OpTypeCooperativeMatrixNV";
        Op[Op["OpCooperativeMatrixLoadNV"] = 5359] = "OpCooperativeMatrixLoadNV";
        Op[Op["OpCooperativeMatrixStoreNV"] = 5360] = "OpCooperativeMatrixStoreNV";
        Op[Op["OpCooperativeMatrixMulAddNV"] = 5361] = "OpCooperativeMatrixMulAddNV";
        Op[Op["OpCooperativeMatrixLengthNV"] = 5362] = "OpCooperativeMatrixLengthNV";
        Op[Op["OpBeginInvocationInterlockEXT"] = 5364] = "OpBeginInvocationInterlockEXT";
        Op[Op["OpEndInvocationInterlockEXT"] = 5365] = "OpEndInvocationInterlockEXT";
        Op[Op["OpDemoteToHelperInvocationEXT"] = 5380] = "OpDemoteToHelperInvocationEXT";
        Op[Op["OpIsHelperInvocationEXT"] = 5381] = "OpIsHelperInvocationEXT";
        Op[Op["OpSubgroupShuffleINTEL"] = 5571] = "OpSubgroupShuffleINTEL";
        Op[Op["OpSubgroupShuffleDownINTEL"] = 5572] = "OpSubgroupShuffleDownINTEL";
        Op[Op["OpSubgroupShuffleUpINTEL"] = 5573] = "OpSubgroupShuffleUpINTEL";
        Op[Op["OpSubgroupShuffleXorINTEL"] = 5574] = "OpSubgroupShuffleXorINTEL";
        Op[Op["OpSubgroupBlockReadINTEL"] = 5575] = "OpSubgroupBlockReadINTEL";
        Op[Op["OpSubgroupBlockWriteINTEL"] = 5576] = "OpSubgroupBlockWriteINTEL";
        Op[Op["OpSubgroupImageBlockReadINTEL"] = 5577] = "OpSubgroupImageBlockReadINTEL";
        Op[Op["OpSubgroupImageBlockWriteINTEL"] = 5578] = "OpSubgroupImageBlockWriteINTEL";
        Op[Op["OpSubgroupImageMediaBlockReadINTEL"] = 5580] = "OpSubgroupImageMediaBlockReadINTEL";
        Op[Op["OpSubgroupImageMediaBlockWriteINTEL"] = 5581] = "OpSubgroupImageMediaBlockWriteINTEL";
        Op[Op["OpUCountLeadingZerosINTEL"] = 5585] = "OpUCountLeadingZerosINTEL";
        Op[Op["OpUCountTrailingZerosINTEL"] = 5586] = "OpUCountTrailingZerosINTEL";
        Op[Op["OpAbsISubINTEL"] = 5587] = "OpAbsISubINTEL";
        Op[Op["OpAbsUSubINTEL"] = 5588] = "OpAbsUSubINTEL";
        Op[Op["OpIAddSatINTEL"] = 5589] = "OpIAddSatINTEL";
        Op[Op["OpUAddSatINTEL"] = 5590] = "OpUAddSatINTEL";
        Op[Op["OpIAverageINTEL"] = 5591] = "OpIAverageINTEL";
        Op[Op["OpUAverageINTEL"] = 5592] = "OpUAverageINTEL";
        Op[Op["OpIAverageRoundedINTEL"] = 5593] = "OpIAverageRoundedINTEL";
        Op[Op["OpUAverageRoundedINTEL"] = 5594] = "OpUAverageRoundedINTEL";
        Op[Op["OpISubSatINTEL"] = 5595] = "OpISubSatINTEL";
        Op[Op["OpUSubSatINTEL"] = 5596] = "OpUSubSatINTEL";
        Op[Op["OpIMul32x16INTEL"] = 5597] = "OpIMul32x16INTEL";
        Op[Op["OpUMul32x16INTEL"] = 5598] = "OpUMul32x16INTEL";
        Op[Op["OpFunctionPointerINTEL"] = 5600] = "OpFunctionPointerINTEL";
        Op[Op["OpFunctionPointerCallINTEL"] = 5601] = "OpFunctionPointerCallINTEL";
        Op[Op["OpDecorateString"] = 5632] = "OpDecorateString";
        Op[Op["OpDecorateStringGOOGLE"] = 5632] = "OpDecorateStringGOOGLE";
        Op[Op["OpMemberDecorateString"] = 5633] = "OpMemberDecorateString";
        Op[Op["OpMemberDecorateStringGOOGLE"] = 5633] = "OpMemberDecorateStringGOOGLE";
        Op[Op["OpVmeImageINTEL"] = 5699] = "OpVmeImageINTEL";
        Op[Op["OpTypeVmeImageINTEL"] = 5700] = "OpTypeVmeImageINTEL";
        Op[Op["OpTypeAvcImePayloadINTEL"] = 5701] = "OpTypeAvcImePayloadINTEL";
        Op[Op["OpTypeAvcRefPayloadINTEL"] = 5702] = "OpTypeAvcRefPayloadINTEL";
        Op[Op["OpTypeAvcSicPayloadINTEL"] = 5703] = "OpTypeAvcSicPayloadINTEL";
        Op[Op["OpTypeAvcMcePayloadINTEL"] = 5704] = "OpTypeAvcMcePayloadINTEL";
        Op[Op["OpTypeAvcMceResultINTEL"] = 5705] = "OpTypeAvcMceResultINTEL";
        Op[Op["OpTypeAvcImeResultINTEL"] = 5706] = "OpTypeAvcImeResultINTEL";
        Op[Op["OpTypeAvcImeResultSingleReferenceStreamoutINTEL"] = 5707] = "OpTypeAvcImeResultSingleReferenceStreamoutINTEL";
        Op[Op["OpTypeAvcImeResultDualReferenceStreamoutINTEL"] = 5708] = "OpTypeAvcImeResultDualReferenceStreamoutINTEL";
        Op[Op["OpTypeAvcImeSingleReferenceStreaminINTEL"] = 5709] = "OpTypeAvcImeSingleReferenceStreaminINTEL";
        Op[Op["OpTypeAvcImeDualReferenceStreaminINTEL"] = 5710] = "OpTypeAvcImeDualReferenceStreaminINTEL";
        Op[Op["OpTypeAvcRefResultINTEL"] = 5711] = "OpTypeAvcRefResultINTEL";
        Op[Op["OpTypeAvcSicResultINTEL"] = 5712] = "OpTypeAvcSicResultINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultInterBaseMultiReferencePenaltyINTEL"] = 5713] = "OpSubgroupAvcMceGetDefaultInterBaseMultiReferencePenaltyINTEL";
        Op[Op["OpSubgroupAvcMceSetInterBaseMultiReferencePenaltyINTEL"] = 5714] = "OpSubgroupAvcMceSetInterBaseMultiReferencePenaltyINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultInterShapePenaltyINTEL"] = 5715] = "OpSubgroupAvcMceGetDefaultInterShapePenaltyINTEL";
        Op[Op["OpSubgroupAvcMceSetInterShapePenaltyINTEL"] = 5716] = "OpSubgroupAvcMceSetInterShapePenaltyINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultInterDirectionPenaltyINTEL"] = 5717] = "OpSubgroupAvcMceGetDefaultInterDirectionPenaltyINTEL";
        Op[Op["OpSubgroupAvcMceSetInterDirectionPenaltyINTEL"] = 5718] = "OpSubgroupAvcMceSetInterDirectionPenaltyINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultIntraLumaShapePenaltyINTEL"] = 5719] = "OpSubgroupAvcMceGetDefaultIntraLumaShapePenaltyINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultInterMotionVectorCostTableINTEL"] = 5720] = "OpSubgroupAvcMceGetDefaultInterMotionVectorCostTableINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultHighPenaltyCostTableINTEL"] = 5721] = "OpSubgroupAvcMceGetDefaultHighPenaltyCostTableINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultMediumPenaltyCostTableINTEL"] = 5722] = "OpSubgroupAvcMceGetDefaultMediumPenaltyCostTableINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultLowPenaltyCostTableINTEL"] = 5723] = "OpSubgroupAvcMceGetDefaultLowPenaltyCostTableINTEL";
        Op[Op["OpSubgroupAvcMceSetMotionVectorCostFunctionINTEL"] = 5724] = "OpSubgroupAvcMceSetMotionVectorCostFunctionINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultIntraLumaModePenaltyINTEL"] = 5725] = "OpSubgroupAvcMceGetDefaultIntraLumaModePenaltyINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultNonDcLumaIntraPenaltyINTEL"] = 5726] = "OpSubgroupAvcMceGetDefaultNonDcLumaIntraPenaltyINTEL";
        Op[Op["OpSubgroupAvcMceGetDefaultIntraChromaModeBasePenaltyINTEL"] = 5727] = "OpSubgroupAvcMceGetDefaultIntraChromaModeBasePenaltyINTEL";
        Op[Op["OpSubgroupAvcMceSetAcOnlyHaarINTEL"] = 5728] = "OpSubgroupAvcMceSetAcOnlyHaarINTEL";
        Op[Op["OpSubgroupAvcMceSetSourceInterlacedFieldPolarityINTEL"] = 5729] = "OpSubgroupAvcMceSetSourceInterlacedFieldPolarityINTEL";
        Op[Op["OpSubgroupAvcMceSetSingleReferenceInterlacedFieldPolarityINTEL"] = 5730] = "OpSubgroupAvcMceSetSingleReferenceInterlacedFieldPolarityINTEL";
        Op[Op["OpSubgroupAvcMceSetDualReferenceInterlacedFieldPolaritiesINTEL"] = 5731] = "OpSubgroupAvcMceSetDualReferenceInterlacedFieldPolaritiesINTEL";
        Op[Op["OpSubgroupAvcMceConvertToImePayloadINTEL"] = 5732] = "OpSubgroupAvcMceConvertToImePayloadINTEL";
        Op[Op["OpSubgroupAvcMceConvertToImeResultINTEL"] = 5733] = "OpSubgroupAvcMceConvertToImeResultINTEL";
        Op[Op["OpSubgroupAvcMceConvertToRefPayloadINTEL"] = 5734] = "OpSubgroupAvcMceConvertToRefPayloadINTEL";
        Op[Op["OpSubgroupAvcMceConvertToRefResultINTEL"] = 5735] = "OpSubgroupAvcMceConvertToRefResultINTEL";
        Op[Op["OpSubgroupAvcMceConvertToSicPayloadINTEL"] = 5736] = "OpSubgroupAvcMceConvertToSicPayloadINTEL";
        Op[Op["OpSubgroupAvcMceConvertToSicResultINTEL"] = 5737] = "OpSubgroupAvcMceConvertToSicResultINTEL";
        Op[Op["OpSubgroupAvcMceGetMotionVectorsINTEL"] = 5738] = "OpSubgroupAvcMceGetMotionVectorsINTEL";
        Op[Op["OpSubgroupAvcMceGetInterDistortionsINTEL"] = 5739] = "OpSubgroupAvcMceGetInterDistortionsINTEL";
        Op[Op["OpSubgroupAvcMceGetBestInterDistortionsINTEL"] = 5740] = "OpSubgroupAvcMceGetBestInterDistortionsINTEL";
        Op[Op["OpSubgroupAvcMceGetInterMajorShapeINTEL"] = 5741] = "OpSubgroupAvcMceGetInterMajorShapeINTEL";
        Op[Op["OpSubgroupAvcMceGetInterMinorShapeINTEL"] = 5742] = "OpSubgroupAvcMceGetInterMinorShapeINTEL";
        Op[Op["OpSubgroupAvcMceGetInterDirectionsINTEL"] = 5743] = "OpSubgroupAvcMceGetInterDirectionsINTEL";
        Op[Op["OpSubgroupAvcMceGetInterMotionVectorCountINTEL"] = 5744] = "OpSubgroupAvcMceGetInterMotionVectorCountINTEL";
        Op[Op["OpSubgroupAvcMceGetInterReferenceIdsINTEL"] = 5745] = "OpSubgroupAvcMceGetInterReferenceIdsINTEL";
        Op[Op["OpSubgroupAvcMceGetInterReferenceInterlacedFieldPolaritiesINTEL"] = 5746] = "OpSubgroupAvcMceGetInterReferenceInterlacedFieldPolaritiesINTEL";
        Op[Op["OpSubgroupAvcImeInitializeINTEL"] = 5747] = "OpSubgroupAvcImeInitializeINTEL";
        Op[Op["OpSubgroupAvcImeSetSingleReferenceINTEL"] = 5748] = "OpSubgroupAvcImeSetSingleReferenceINTEL";
        Op[Op["OpSubgroupAvcImeSetDualReferenceINTEL"] = 5749] = "OpSubgroupAvcImeSetDualReferenceINTEL";
        Op[Op["OpSubgroupAvcImeRefWindowSizeINTEL"] = 5750] = "OpSubgroupAvcImeRefWindowSizeINTEL";
        Op[Op["OpSubgroupAvcImeAdjustRefOffsetINTEL"] = 5751] = "OpSubgroupAvcImeAdjustRefOffsetINTEL";
        Op[Op["OpSubgroupAvcImeConvertToMcePayloadINTEL"] = 5752] = "OpSubgroupAvcImeConvertToMcePayloadINTEL";
        Op[Op["OpSubgroupAvcImeSetMaxMotionVectorCountINTEL"] = 5753] = "OpSubgroupAvcImeSetMaxMotionVectorCountINTEL";
        Op[Op["OpSubgroupAvcImeSetUnidirectionalMixDisableINTEL"] = 5754] = "OpSubgroupAvcImeSetUnidirectionalMixDisableINTEL";
        Op[Op["OpSubgroupAvcImeSetEarlySearchTerminationThresholdINTEL"] = 5755] = "OpSubgroupAvcImeSetEarlySearchTerminationThresholdINTEL";
        Op[Op["OpSubgroupAvcImeSetWeightedSadINTEL"] = 5756] = "OpSubgroupAvcImeSetWeightedSadINTEL";
        Op[Op["OpSubgroupAvcImeEvaluateWithSingleReferenceINTEL"] = 5757] = "OpSubgroupAvcImeEvaluateWithSingleReferenceINTEL";
        Op[Op["OpSubgroupAvcImeEvaluateWithDualReferenceINTEL"] = 5758] = "OpSubgroupAvcImeEvaluateWithDualReferenceINTEL";
        Op[Op["OpSubgroupAvcImeEvaluateWithSingleReferenceStreaminINTEL"] = 5759] = "OpSubgroupAvcImeEvaluateWithSingleReferenceStreaminINTEL";
        Op[Op["OpSubgroupAvcImeEvaluateWithDualReferenceStreaminINTEL"] = 5760] = "OpSubgroupAvcImeEvaluateWithDualReferenceStreaminINTEL";
        Op[Op["OpSubgroupAvcImeEvaluateWithSingleReferenceStreamoutINTEL"] = 5761] = "OpSubgroupAvcImeEvaluateWithSingleReferenceStreamoutINTEL";
        Op[Op["OpSubgroupAvcImeEvaluateWithDualReferenceStreamoutINTEL"] = 5762] = "OpSubgroupAvcImeEvaluateWithDualReferenceStreamoutINTEL";
        Op[Op["OpSubgroupAvcImeEvaluateWithSingleReferenceStreaminoutINTEL"] = 5763] = "OpSubgroupAvcImeEvaluateWithSingleReferenceStreaminoutINTEL";
        Op[Op["OpSubgroupAvcImeEvaluateWithDualReferenceStreaminoutINTEL"] = 5764] = "OpSubgroupAvcImeEvaluateWithDualReferenceStreaminoutINTEL";
        Op[Op["OpSubgroupAvcImeConvertToMceResultINTEL"] = 5765] = "OpSubgroupAvcImeConvertToMceResultINTEL";
        Op[Op["OpSubgroupAvcImeGetSingleReferenceStreaminINTEL"] = 5766] = "OpSubgroupAvcImeGetSingleReferenceStreaminINTEL";
        Op[Op["OpSubgroupAvcImeGetDualReferenceStreaminINTEL"] = 5767] = "OpSubgroupAvcImeGetDualReferenceStreaminINTEL";
        Op[Op["OpSubgroupAvcImeStripSingleReferenceStreamoutINTEL"] = 5768] = "OpSubgroupAvcImeStripSingleReferenceStreamoutINTEL";
        Op[Op["OpSubgroupAvcImeStripDualReferenceStreamoutINTEL"] = 5769] = "OpSubgroupAvcImeStripDualReferenceStreamoutINTEL";
        Op[Op["OpSubgroupAvcImeGetStreamoutSingleReferenceMajorShapeMotionVectorsINTEL"] = 5770] = "OpSubgroupAvcImeGetStreamoutSingleReferenceMajorShapeMotionVectorsINTEL";
        Op[Op["OpSubgroupAvcImeGetStreamoutSingleReferenceMajorShapeDistortionsINTEL"] = 5771] = "OpSubgroupAvcImeGetStreamoutSingleReferenceMajorShapeDistortionsINTEL";
        Op[Op["OpSubgroupAvcImeGetStreamoutSingleReferenceMajorShapeReferenceIdsINTEL"] = 5772] = "OpSubgroupAvcImeGetStreamoutSingleReferenceMajorShapeReferenceIdsINTEL";
        Op[Op["OpSubgroupAvcImeGetStreamoutDualReferenceMajorShapeMotionVectorsINTEL"] = 5773] = "OpSubgroupAvcImeGetStreamoutDualReferenceMajorShapeMotionVectorsINTEL";
        Op[Op["OpSubgroupAvcImeGetStreamoutDualReferenceMajorShapeDistortionsINTEL"] = 5774] = "OpSubgroupAvcImeGetStreamoutDualReferenceMajorShapeDistortionsINTEL";
        Op[Op["OpSubgroupAvcImeGetStreamoutDualReferenceMajorShapeReferenceIdsINTEL"] = 5775] = "OpSubgroupAvcImeGetStreamoutDualReferenceMajorShapeReferenceIdsINTEL";
        Op[Op["OpSubgroupAvcImeGetBorderReachedINTEL"] = 5776] = "OpSubgroupAvcImeGetBorderReachedINTEL";
        Op[Op["OpSubgroupAvcImeGetTruncatedSearchIndicationINTEL"] = 5777] = "OpSubgroupAvcImeGetTruncatedSearchIndicationINTEL";
        Op[Op["OpSubgroupAvcImeGetUnidirectionalEarlySearchTerminationINTEL"] = 5778] = "OpSubgroupAvcImeGetUnidirectionalEarlySearchTerminationINTEL";
        Op[Op["OpSubgroupAvcImeGetWeightingPatternMinimumMotionVectorINTEL"] = 5779] = "OpSubgroupAvcImeGetWeightingPatternMinimumMotionVectorINTEL";
        Op[Op["OpSubgroupAvcImeGetWeightingPatternMinimumDistortionINTEL"] = 5780] = "OpSubgroupAvcImeGetWeightingPatternMinimumDistortionINTEL";
        Op[Op["OpSubgroupAvcFmeInitializeINTEL"] = 5781] = "OpSubgroupAvcFmeInitializeINTEL";
        Op[Op["OpSubgroupAvcBmeInitializeINTEL"] = 5782] = "OpSubgroupAvcBmeInitializeINTEL";
        Op[Op["OpSubgroupAvcRefConvertToMcePayloadINTEL"] = 5783] = "OpSubgroupAvcRefConvertToMcePayloadINTEL";
        Op[Op["OpSubgroupAvcRefSetBidirectionalMixDisableINTEL"] = 5784] = "OpSubgroupAvcRefSetBidirectionalMixDisableINTEL";
        Op[Op["OpSubgroupAvcRefSetBilinearFilterEnableINTEL"] = 5785] = "OpSubgroupAvcRefSetBilinearFilterEnableINTEL";
        Op[Op["OpSubgroupAvcRefEvaluateWithSingleReferenceINTEL"] = 5786] = "OpSubgroupAvcRefEvaluateWithSingleReferenceINTEL";
        Op[Op["OpSubgroupAvcRefEvaluateWithDualReferenceINTEL"] = 5787] = "OpSubgroupAvcRefEvaluateWithDualReferenceINTEL";
        Op[Op["OpSubgroupAvcRefEvaluateWithMultiReferenceINTEL"] = 5788] = "OpSubgroupAvcRefEvaluateWithMultiReferenceINTEL";
        Op[Op["OpSubgroupAvcRefEvaluateWithMultiReferenceInterlacedINTEL"] = 5789] = "OpSubgroupAvcRefEvaluateWithMultiReferenceInterlacedINTEL";
        Op[Op["OpSubgroupAvcRefConvertToMceResultINTEL"] = 5790] = "OpSubgroupAvcRefConvertToMceResultINTEL";
        Op[Op["OpSubgroupAvcSicInitializeINTEL"] = 5791] = "OpSubgroupAvcSicInitializeINTEL";
        Op[Op["OpSubgroupAvcSicConfigureSkcINTEL"] = 5792] = "OpSubgroupAvcSicConfigureSkcINTEL";
        Op[Op["OpSubgroupAvcSicConfigureIpeLumaINTEL"] = 5793] = "OpSubgroupAvcSicConfigureIpeLumaINTEL";
        Op[Op["OpSubgroupAvcSicConfigureIpeLumaChromaINTEL"] = 5794] = "OpSubgroupAvcSicConfigureIpeLumaChromaINTEL";
        Op[Op["OpSubgroupAvcSicGetMotionVectorMaskINTEL"] = 5795] = "OpSubgroupAvcSicGetMotionVectorMaskINTEL";
        Op[Op["OpSubgroupAvcSicConvertToMcePayloadINTEL"] = 5796] = "OpSubgroupAvcSicConvertToMcePayloadINTEL";
        Op[Op["OpSubgroupAvcSicSetIntraLumaShapePenaltyINTEL"] = 5797] = "OpSubgroupAvcSicSetIntraLumaShapePenaltyINTEL";
        Op[Op["OpSubgroupAvcSicSetIntraLumaModeCostFunctionINTEL"] = 5798] = "OpSubgroupAvcSicSetIntraLumaModeCostFunctionINTEL";
        Op[Op["OpSubgroupAvcSicSetIntraChromaModeCostFunctionINTEL"] = 5799] = "OpSubgroupAvcSicSetIntraChromaModeCostFunctionINTEL";
        Op[Op["OpSubgroupAvcSicSetBilinearFilterEnableINTEL"] = 5800] = "OpSubgroupAvcSicSetBilinearFilterEnableINTEL";
        Op[Op["OpSubgroupAvcSicSetSkcForwardTransformEnableINTEL"] = 5801] = "OpSubgroupAvcSicSetSkcForwardTransformEnableINTEL";
        Op[Op["OpSubgroupAvcSicSetBlockBasedRawSkipSadINTEL"] = 5802] = "OpSubgroupAvcSicSetBlockBasedRawSkipSadINTEL";
        Op[Op["OpSubgroupAvcSicEvaluateIpeINTEL"] = 5803] = "OpSubgroupAvcSicEvaluateIpeINTEL";
        Op[Op["OpSubgroupAvcSicEvaluateWithSingleReferenceINTEL"] = 5804] = "OpSubgroupAvcSicEvaluateWithSingleReferenceINTEL";
        Op[Op["OpSubgroupAvcSicEvaluateWithDualReferenceINTEL"] = 5805] = "OpSubgroupAvcSicEvaluateWithDualReferenceINTEL";
        Op[Op["OpSubgroupAvcSicEvaluateWithMultiReferenceINTEL"] = 5806] = "OpSubgroupAvcSicEvaluateWithMultiReferenceINTEL";
        Op[Op["OpSubgroupAvcSicEvaluateWithMultiReferenceInterlacedINTEL"] = 5807] = "OpSubgroupAvcSicEvaluateWithMultiReferenceInterlacedINTEL";
        Op[Op["OpSubgroupAvcSicConvertToMceResultINTEL"] = 5808] = "OpSubgroupAvcSicConvertToMceResultINTEL";
        Op[Op["OpSubgroupAvcSicGetIpeLumaShapeINTEL"] = 5809] = "OpSubgroupAvcSicGetIpeLumaShapeINTEL";
        Op[Op["OpSubgroupAvcSicGetBestIpeLumaDistortionINTEL"] = 5810] = "OpSubgroupAvcSicGetBestIpeLumaDistortionINTEL";
        Op[Op["OpSubgroupAvcSicGetBestIpeChromaDistortionINTEL"] = 5811] = "OpSubgroupAvcSicGetBestIpeChromaDistortionINTEL";
        Op[Op["OpSubgroupAvcSicGetPackedIpeLumaModesINTEL"] = 5812] = "OpSubgroupAvcSicGetPackedIpeLumaModesINTEL";
        Op[Op["OpSubgroupAvcSicGetIpeChromaModeINTEL"] = 5813] = "OpSubgroupAvcSicGetIpeChromaModeINTEL";
        Op[Op["OpSubgroupAvcSicGetPackedSkcLumaCountThresholdINTEL"] = 5814] = "OpSubgroupAvcSicGetPackedSkcLumaCountThresholdINTEL";
        Op[Op["OpSubgroupAvcSicGetPackedSkcLumaSumThresholdINTEL"] = 5815] = "OpSubgroupAvcSicGetPackedSkcLumaSumThresholdINTEL";
        Op[Op["OpSubgroupAvcSicGetInterRawSadsINTEL"] = 5816] = "OpSubgroupAvcSicGetInterRawSadsINTEL";
        Op[Op["OpLoopControlINTEL"] = 5887] = "OpLoopControlINTEL";
        Op[Op["OpReadPipeBlockingINTEL"] = 5946] = "OpReadPipeBlockingINTEL";
        Op[Op["OpWritePipeBlockingINTEL"] = 5947] = "OpWritePipeBlockingINTEL";
        Op[Op["OpFPGARegINTEL"] = 5949] = "OpFPGARegINTEL";
        Op[Op["OpRayQueryGetRayTMinKHR"] = 6016] = "OpRayQueryGetRayTMinKHR";
        Op[Op["OpRayQueryGetRayFlagsKHR"] = 6017] = "OpRayQueryGetRayFlagsKHR";
        Op[Op["OpRayQueryGetIntersectionTKHR"] = 6018] = "OpRayQueryGetIntersectionTKHR";
        Op[Op["OpRayQueryGetIntersectionInstanceCustomIndexKHR"] = 6019] = "OpRayQueryGetIntersectionInstanceCustomIndexKHR";
        Op[Op["OpRayQueryGetIntersectionInstanceIdKHR"] = 6020] = "OpRayQueryGetIntersectionInstanceIdKHR";
        Op[Op["OpRayQueryGetIntersectionInstanceShaderBindingTableRecordOffsetKHR"] = 6021] = "OpRayQueryGetIntersectionInstanceShaderBindingTableRecordOffsetKHR";
        Op[Op["OpRayQueryGetIntersectionGeometryIndexKHR"] = 6022] = "OpRayQueryGetIntersectionGeometryIndexKHR";
        Op[Op["OpRayQueryGetIntersectionPrimitiveIndexKHR"] = 6023] = "OpRayQueryGetIntersectionPrimitiveIndexKHR";
        Op[Op["OpRayQueryGetIntersectionBarycentricsKHR"] = 6024] = "OpRayQueryGetIntersectionBarycentricsKHR";
        Op[Op["OpRayQueryGetIntersectionFrontFaceKHR"] = 6025] = "OpRayQueryGetIntersectionFrontFaceKHR";
        Op[Op["OpRayQueryGetIntersectionCandidateAABBOpaqueKHR"] = 6026] = "OpRayQueryGetIntersectionCandidateAABBOpaqueKHR";
        Op[Op["OpRayQueryGetIntersectionObjectRayDirectionKHR"] = 6027] = "OpRayQueryGetIntersectionObjectRayDirectionKHR";
        Op[Op["OpRayQueryGetIntersectionObjectRayOriginKHR"] = 6028] = "OpRayQueryGetIntersectionObjectRayOriginKHR";
        Op[Op["OpRayQueryGetWorldRayDirectionKHR"] = 6029] = "OpRayQueryGetWorldRayDirectionKHR";
        Op[Op["OpRayQueryGetWorldRayOriginKHR"] = 6030] = "OpRayQueryGetWorldRayOriginKHR";
        Op[Op["OpRayQueryGetIntersectionObjectToWorldKHR"] = 6031] = "OpRayQueryGetIntersectionObjectToWorldKHR";
        Op[Op["OpRayQueryGetIntersectionWorldToObjectKHR"] = 6032] = "OpRayQueryGetIntersectionWorldToObjectKHR";
        Op[Op["OpAtomicFAddEXT"] = 6035] = "OpAtomicFAddEXT";
        Op[Op["OpMax"] = 2147483647] = "OpMax";
    })(Op || (Op = {}));

    var ExtendedDecorations;
    (function (ExtendedDecorations) {
        // Marks if a buffer block is re-packed, i.e. member declaration might be subject to PhysicalTypeID remapping and padding.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationBufferBlockRepacked"] = 0] = "SPIRVCrossDecorationBufferBlockRepacked";
        // A type in a buffer block might be declared with a different physical type than the logical type.
        // If this is not set, PhysicalTypeID == the SPIR-V type as declared.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationPhysicalTypeID"] = 1] = "SPIRVCrossDecorationPhysicalTypeID";
        // Marks if the physical type is to be declared with tight packing rules, i.e. packed_floatN on MSL and friends.
        // If this is set, PhysicalTypeID might also be set. It can be set to same as logical type if all we're doing
        // is converting float3 to packed_float3 for example.
        // If this is marked on a struct, it means the struct itself must use only Packed types for all its members.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationPhysicalTypePacked"] = 2] = "SPIRVCrossDecorationPhysicalTypePacked";
        // The padding in bytes before declaring this struct member.
        // If used on a struct type, marks the target size of a struct.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationPaddingTarget"] = 3] = "SPIRVCrossDecorationPaddingTarget";
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationInterfaceMemberIndex"] = 4] = "SPIRVCrossDecorationInterfaceMemberIndex";
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationInterfaceOrigID"] = 5] = "SPIRVCrossDecorationInterfaceOrigID";
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationResourceIndexPrimary"] = 6] = "SPIRVCrossDecorationResourceIndexPrimary";
        // Used for decorations like resource indices for samplers when part of combined image samplers.
        // A variable might need to hold two resource indices in this case.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationResourceIndexSecondary"] = 7] = "SPIRVCrossDecorationResourceIndexSecondary";
        // Used for resource indices for multiplanar images when part of combined image samplers.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationResourceIndexTertiary"] = 8] = "SPIRVCrossDecorationResourceIndexTertiary";
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationResourceIndexQuaternary"] = 9] = "SPIRVCrossDecorationResourceIndexQuaternary";
        // Marks a buffer block for using explicit offsets (GLSL/HLSL).
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationExplicitOffset"] = 10] = "SPIRVCrossDecorationExplicitOffset";
        // Apply to a variable in the Input storage class; marks it as holding the base group passed to vkCmdDispatchBase(),
        // or the base vertex and instance indices passed to vkCmdDrawIndexed().
        // In MSL, this is used to adjust the WorkgroupId and GlobalInvocationId variables in compute shaders,
        // and to hold the BaseVertex and BaseInstance variables in vertex shaders.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationBuiltInDispatchBase"] = 11] = "SPIRVCrossDecorationBuiltInDispatchBase";
        // Apply to a variable that is a function parameter; marks it as being a "dynamic"
        // combined image-sampler. In MSL, this is used when a function parameter might hold
        // either a regular combined image-sampler or one that has an attached sampler
        // Y'CbCr conversion.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationDynamicImageSampler"] = 12] = "SPIRVCrossDecorationDynamicImageSampler";
        // Apply to a variable in the Input storage class; marks it as holding the size of the stage
        // input grid.
        // In MSL, this is used to hold the vertex and instance counts in a tessellation pipeline
        // vertex shader.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationBuiltInStageInputSize"] = 13] = "SPIRVCrossDecorationBuiltInStageInputSize";
        // Apply to any access chain of a tessellation I/O variable; stores the type of the sub-object
        // that was chained to, as recorded in the input variable itself. This is used in case the pointer
        // is itself used as the base of an access chain, to calculate the original type of the sub-object
        // chained to, in case a swizzle needs to be applied. This should not happen normally with valid
        // SPIR-V, but the MSL backend can change the type of input variables, necessitating the
        // addition of swizzles to keep the generated code compiling.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationTessIOOriginalInputTypeID"] = 14] = "SPIRVCrossDecorationTessIOOriginalInputTypeID";
        // Apply to any access chain of an interface variable used with pull-model interpolation, where the variable is a
        // vector but the resulting pointer is a scalar; stores the component index that is to be accessed by the chain.
        // This is used when emitting calls to interpolation functions on the chain in MSL: in this case, the component
        // must be applied to the result, since pull-model interpolants in MSL cannot be swizzled directly, but the
        // results of interpolation can.
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationInterpolantComponentExpr"] = 15] = "SPIRVCrossDecorationInterpolantComponentExpr";
        ExtendedDecorations[ExtendedDecorations["SPIRVCrossDecorationCount"] = 16] = "SPIRVCrossDecorationCount";
    })(ExtendedDecorations || (ExtendedDecorations = {}));
    var MetaDecorationExtended = /** @class */ (function () {
        function MetaDecorationExtended() {
            this.flags = new Bitset();
            this.values = new Uint32Array(ExtendedDecorations.SPIRVCrossDecorationCount);
        }
        return MetaDecorationExtended;
    }());
    var MetaDecoration = /** @class */ (function () {
        function MetaDecoration() {
            this.decoration_flags = new Bitset();
            this.builtin_type = BuiltIn.BuiltInMax;
            this.location = 0;
            this.component = 0;
            this.set = 0;
            this.binding = 0;
            this.offset = 0;
            this.xfb_buffer = 0;
            this.xfb_stride = 0;
            this.stream = 0;
            this.array_stride = 0;
            this.matrix_stride = 0;
            this.input_attachment = 0;
            this.spec_id = 0;
            this.index = 0;
            this.fp_rounding_mode = FPRoundingMode.FPRoundingModeMax;
            this.builtin = false;
            this.extended = new MetaDecorationExtended();
        }
        return MetaDecoration;
    }());
    var Meta = /** @class */ (function () {
        function Meta() {
            this.decoration = new MetaDecoration();
            // Intentionally not a SmallVector. Decoration is large and somewhat rare.
            this.members = [];
            this.decoration_word_offset = [];
            // For SPV_GOOGLE_hlsl_functionality1.
            this.hlsl_is_magic_counter_buffer = false;
            // ID for the sibling counter buffer.
            this.hlsl_magic_counter_buffer = 0;
        }
        return Meta;
    }());

    // this just wraps a value that we can share. Only useful for primitives.
    // this allows us to alias an object property. Only useful for primitives.
    var MemberPointer = /** @class */ (function () {
        function MemberPointer(owner, propName) {
            this.owner = owner;
            this.propName = propName;
        }
        MemberPointer.prototype.get = function () {
            return this.owner[this.propName];
        };
        MemberPointer.prototype.set = function (value) {
            this.owner[this.propName] = value;
        };
        return MemberPointer;
    }());

    var IVariant = /** @class */ (function () {
        function IVariant() {
            this.self = 0;
        }
        IVariant.prototype.clone = function (pool) {
            var p = (pool);
            var c = p.allocate(this);
            defaultCopy(this, c);
            return c;
        };
        return IVariant;
    }());

    var SPIRVariable = /** @class */ (function (_super) {
        __extends(SPIRVariable, _super);
        function SPIRVariable(param0) {
            var _this = _super.call(this) || this;
            _this.basetype = 0;
            _this.storage = StorageClass.StorageClassGeneric;
            _this.decoration = 0;
            _this.initializer = 0;
            _this.basevariable = 0;
            _this.compat_builtin = false;
            // If a variable is shadowed, we only statically assign to it
            // and never actually emit a statement for it.
            // When we read the variable as an expression, just forward
            // shadowed_id as the expression.
            _this.statically_assigned = false;
            _this.static_expression = 0;
            // Temporaries which can remain forwarded as long as this variable is not modified.
            _this.dependees = [];
            _this.forwardable = true;
            _this.deferred_declaration = false;
            _this.phi_variable = false;
            // Used to deal with SPIRBlockPhi variable flushes. See flush_phi().
            _this.allocate_temporary_copy = false;
            _this.remapped_variable = false;
            _this.remapped_components = 0;
            // The block which dominates all access to this variable.
            _this.dominator = 0;
            // If true, this variable is a loop variable, when accessing the variable
            // outside a loop,
            // we should statically forward it.
            _this.loop_variable = false;
            // Set to true while we're inside the for loop.
            _this.loop_variable_enable = false;
            _this.parameter = null;
            if (param0 instanceof SPIRVariable)
                defaultCopy(_this, param0);
            else
                _this.basetype = param0;
            return _this;
        }
        SPIRVariable.type = Types.TypeVariable;
        return SPIRVariable;
    }(IVariant));

    var SPIRTypeBaseType;
    (function (SPIRTypeBaseType) {
        SPIRTypeBaseType[SPIRTypeBaseType["Unknown"] = 0] = "Unknown";
        SPIRTypeBaseType[SPIRTypeBaseType["Void"] = 1] = "Void";
        SPIRTypeBaseType[SPIRTypeBaseType["Boolean"] = 2] = "Boolean";
        SPIRTypeBaseType[SPIRTypeBaseType["SByte"] = 3] = "SByte";
        SPIRTypeBaseType[SPIRTypeBaseType["UByte"] = 4] = "UByte";
        SPIRTypeBaseType[SPIRTypeBaseType["Short"] = 5] = "Short";
        SPIRTypeBaseType[SPIRTypeBaseType["UShort"] = 6] = "UShort";
        SPIRTypeBaseType[SPIRTypeBaseType["Int"] = 7] = "Int";
        SPIRTypeBaseType[SPIRTypeBaseType["UInt"] = 8] = "UInt";
        SPIRTypeBaseType[SPIRTypeBaseType["Int64"] = 9] = "Int64";
        SPIRTypeBaseType[SPIRTypeBaseType["UInt64"] = 10] = "UInt64";
        SPIRTypeBaseType[SPIRTypeBaseType["AtomicCounter"] = 11] = "AtomicCounter";
        SPIRTypeBaseType[SPIRTypeBaseType["Half"] = 12] = "Half";
        SPIRTypeBaseType[SPIRTypeBaseType["Float"] = 13] = "Float";
        SPIRTypeBaseType[SPIRTypeBaseType["Double"] = 14] = "Double";
        SPIRTypeBaseType[SPIRTypeBaseType["Struct"] = 15] = "Struct";
        SPIRTypeBaseType[SPIRTypeBaseType["Image"] = 16] = "Image";
        SPIRTypeBaseType[SPIRTypeBaseType["SampledImage"] = 17] = "SampledImage";
        SPIRTypeBaseType[SPIRTypeBaseType["Sampler"] = 18] = "Sampler";
        SPIRTypeBaseType[SPIRTypeBaseType["AccelerationStructure"] = 19] = "AccelerationStructure";
        SPIRTypeBaseType[SPIRTypeBaseType["RayQuery"] = 20] = "RayQuery";
        // Keep internal types at the end.
        SPIRTypeBaseType[SPIRTypeBaseType["ControlPointArray"] = 21] = "ControlPointArray";
        SPIRTypeBaseType[SPIRTypeBaseType["Interpolant"] = 22] = "Interpolant";
        SPIRTypeBaseType[SPIRTypeBaseType["Char"] = 23] = "Char";
    })(SPIRTypeBaseType || (SPIRTypeBaseType = {}));
    var SPIRTypeImageType = /** @class */ (function () {
        function SPIRTypeImageType() {
        }
        SPIRTypeImageType.prototype.clone = function () { return defaultClone(SPIRTypeImageType, this); };
        SPIRTypeImageType.prototype.equals = function (b) {
            return this.type === b.type && this.dim === b.dim && this.depth === b.depth && this.arrayed === b.arrayed &&
                this.ms === b.ms && this.sampled === b.sampled && this.format === b.format && this.access === b.access;
        };
        return SPIRTypeImageType;
    }());
    var SPIRType = /** @class */ (function (_super) {
        __extends(SPIRType, _super);
        function SPIRType(other) {
            var _this = _super.call(this) || this;
            // Scalar/vector/matrix support.
            _this.basetype = SPIRTypeBaseType.Unknown;
            _this.width = 0;
            _this.vecsize = 1;
            _this.columns = 1;
            // Arrays, support array of arrays by having a vector of array sizes.
            _this.array = [];
            // Array elements can be either specialization constants or specialization ops.
            // This array determines how to interpret the array size.
            // If an element is true, the element is a literal,
            // otherwise, it's an expression, which must be resolved on demand.
            // The actual size is not really known until runtime.
            _this.array_size_literal = [];
            // Pointers
            // Keep track of how many pointer layers we have.
            _this.pointer_depth = 0;
            _this.pointer = false;
            _this.forward_pointer = false;
            _this.storage = StorageClass.StorageClassGeneric;
            _this.member_types = [];
            // If member order has been rewritten to handle certain scenarios with Offset,
            // allow codegen to rewrite the index.
            _this.member_type_index_redirection = [];
            _this.image = new SPIRTypeImageType();
            // Structs can be declared multiple times if they are used as part of interface blocks.
            // We want to detect this so that we only emit the struct definition once.
            // Since we cannot rely on OpName to be equal, we need to figure out aliases.
            _this.type_alias = 0;
            // Denotes the type which this type is based on.
            // Allows the backend to traverse how a complex type is built up during access chains.
            _this.parent_type = 0;
            // Used in backends to avoid emitting members with conflicting names.
            _this.member_name_cache = new Set();
            if (other)
                defaultCopy(_this, other);
            return _this;
        }
        SPIRType.type = Types.TypeType;
        return SPIRType;
    }(IVariant));

    var u = new DataView(new ArrayBuffer(4));
    // like a union
    var SPIRConstantConstant = /** @class */ (function () {
        function SPIRConstantConstant() {
            this.value = new ArrayBuffer(16);
            this._dataView = new DataView(this.value);
        }
        Object.defineProperty(SPIRConstantConstant.prototype, "u32", {
            get: function () {
                return this._dataView.getUint32(0);
            },
            set: function (value) {
                this._dataView.setUint32(0, value);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SPIRConstantConstant.prototype, "i32", {
            get: function () {
                return this._dataView.getInt32(0);
            },
            set: function (value) {
                this._dataView.setInt32(0, value);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SPIRConstantConstant.prototype, "f32", {
            get: function () {
                return this._dataView.getFloat32(0);
            },
            set: function (value) {
                this._dataView.setFloat32(0, value);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SPIRConstantConstant.prototype, "u64", {
            get: function () {
                return this._dataView.getBigUint64(0);
            },
            set: function (value) {
                this._dataView.setBigUint64(0, value);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SPIRConstantConstant.prototype, "i64", {
            get: function () {
                return this._dataView.getBigInt64(0);
            },
            set: function (value) {
                this._dataView.setBigInt64(0, value);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SPIRConstantConstant.prototype, "f64", {
            get: function () {
                return this._dataView.getFloat64(0);
            },
            set: function (value) {
                this._dataView.setFloat64(0, value);
            },
            enumerable: false,
            configurable: true
        });
        SPIRConstantConstant.prototype.clone = function () {
            return defaultClone(SPIRConstantConstant, this);
        };
        return SPIRConstantConstant;
    }());
    var SPIRConstantConstantVector = /** @class */ (function () {
        function SPIRConstantConstantVector() {
            this.vecsize = 1;
            this.r = createWith(4, function () { return new SPIRConstantConstant(); });
            this.id = createWith(4, function () { return 0; });
        }
        SPIRConstantConstantVector.prototype.clone = function () {
            return defaultClone(SPIRConstantConstantVector, this);
        };
        return SPIRConstantConstantVector;
    }());
    var SPIRConstantConstantMatrix = /** @class */ (function () {
        function SPIRConstantConstantMatrix() {
            this.columns = 1;
            this.c = createWith(4, function () { return new SPIRConstantConstantVector(); });
            this.id = createWith(4, function () { return 0; });
        }
        SPIRConstantConstantMatrix.prototype.clone = function () {
            return defaultClone(SPIRConstantConstantMatrix, this);
        };
        return SPIRConstantConstantMatrix;
    }());
    var SPIRConstant = /** @class */ (function (_super) {
        __extends(SPIRConstant, _super);
        function SPIRConstant() {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var _this = _super.call(this) || this;
            _this.constant_type = 0;
            _this.m = new SPIRConstantConstantMatrix();
            // If this constant is a specialization constant (i.e. created with OpSpecConstant*).
            _this.specialization = false;
            // If this constant is used as an array length which creates specialization restrictions on some backends.
            _this.is_used_as_array_length = false;
            // If true, this is a LUT, and should always be declared in the outer scope.
            _this.is_used_as_lut = false;
            // Non-Vulkan GLSL, HLSL and sometimes MSL emits defines for each specialization constant,
            // and uses them to initialize the constant. This allows the user
            // to still be able to specialize the value by supplying corresponding
            // preprocessor directives before compiling the shader.
            _this.specialization_constant_macro_name = "";
            // default constructor
            if (args.length === 0)
                return _this;
            if (args.length === 1) {
                if (args[0] instanceof SPIRConstant)
                    defaultCopy(args[0], _this);
                else
                    _this._construct(args[0]);
            }
            else if (typeof args[1] === "bigint")
                _this._constructScalar64(args[0], args[1], args[2]);
            else if (typeof args[1] === "number")
                _this._constructScalar32(args[0], args[1], args[2]);
            else if (typeof args[1][0] === "number")
                _this._constructArray(args[0], args[1], args[2], args[3]);
            else
                _this._constructVecMat(args[0], args[1], args[2], args[3]);
            return _this;
        }
        SPIRConstant.prototype.f16_to_f32 = function (u16_value) {
            // Based on the GLM implementation.
            var s = (u16_value >> 15) & 0x1;
            var e = (u16_value >> 10) & 0x1f;
            var m = (u16_value >> 0) & 0x3ff;
            if (e === 0) {
                if (m === 0) {
                    u.setUint32(0, s << 31);
                    return u.getFloat32(0);
                }
                else {
                    while ((m & 0x400) === 0) {
                        m <<= 1;
                        e--;
                    }
                    e++;
                    m &= ~0x400;
                }
            }
            else if (e === 31) {
                if (m === 0) {
                    u.setUint32(0, (s << 31) | 0x7f800000);
                    return u.getFloat32(0);
                }
                else {
                    u.setUint32(0, (s << 31) | 0x7f800000 | (m << 13));
                    return u.getFloat32(0);
                }
            }
            e += 127 - 15;
            m <<= 13;
            u.setUint32(0, (s << 31) | (e << 23) | m);
            return u.getFloat32(0);
        };
        SPIRConstant.prototype.specialization_constant_id = function (col, row) {
            if (row === undefined)
                return this.m.id[col];
            else
                return this.m.c[col].id[row];
        };
        SPIRConstant.prototype.scalar = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.m.c[col].r[row].u32;
        };
        SPIRConstant.prototype.scalar_i16 = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.m.c[col].r[row].u32 & 0xffff;
        };
        SPIRConstant.prototype.scalar_u16 = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.m.c[col].r[row].u32 & 0xffff;
        };
        SPIRConstant.prototype.scalar_i8 = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.m.c[col].r[row].u32 & 0xff;
        };
        SPIRConstant.prototype.scalar_u8 = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.m.c[col].r[row].u32 & 0xff;
        };
        SPIRConstant.prototype.scalar_f16 = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.f16_to_f32(this.scalar_u16(col, row));
        };
        SPIRConstant.prototype.scalar_f32 = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.m.c[col].r[row].f32;
        };
        SPIRConstant.prototype.scalar_i32 = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.m.c[col].r[row].i32;
        };
        SPIRConstant.prototype.scalar_f64 = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.m.c[col].r[row].f64;
        };
        SPIRConstant.prototype.scalar_i64 = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.m.c[col].r[row].i64;
        };
        SPIRConstant.prototype.scalar_u64 = function (col, row) {
            if (col === void 0) { col = 0; }
            if (row === void 0) { row = 0; }
            return this.m.c[col].r[row].u64;
        };
        SPIRConstant.prototype.vector = function () {
            return this.m.c[0];
        };
        SPIRConstant.prototype.vector_size = function () {
            return this.m.c[0].vecsize;
        };
        SPIRConstant.prototype.columns = function () {
            return this.m.columns;
        };
        SPIRConstant.prototype.make_null = function (constant_type) {
            this.m = new SPIRConstantConstantMatrix();
            this.m.columns = constant_type.columns;
            for (var _i = 0, _a = this.m.c; _i < _a.length; _i++) {
                var c = _a[_i];
                c.vecsize = constant_type.vecsize;
            }
        };
        SPIRConstant.prototype.constant_is_null = function () {
            if (this.specialization)
                return false;
            if (this.subconstants.length !== 0)
                return false;
            for (var col = 0; col < this.columns(); col++)
                for (var row = 0; row < this.vector_size(); row++)
                    if (this.scalar_u64(col, row) !== BigInt(0))
                        return false;
            return true;
        };
        SPIRConstant.prototype._construct = function (constant_type) {
            this.constant_type = constant_type;
        };
        SPIRConstant.prototype._constructArray = function (constant_type, elements, num_elements, specialized) {
            this.constant_type = constant_type;
            this.specialization = specialized;
            this.subconstants = elements;
        };
        // Construct scalar (32-bit).
        SPIRConstant.prototype._constructScalar32 = function (constant_type, v0, specialized) {
            this.constant_type = constant_type;
            this.specialization = specialized;
            this.m.c[0].r[0].u32 = v0;
            this.m.c[0].vecsize = 1;
            this.m.columns = 1;
        };
        // Construct scalar (64-bit).
        SPIRConstant.prototype._constructScalar64 = function (constant_type, v0, specialized) {
            this.constant_type = constant_type;
            this.specialization = specialized;
            this.m.c[0].r[0].u64 = v0;
            this.m.c[0].vecsize = 1;
            this.m.columns = 1;
        };
        // Construct vectors and matrices.
        SPIRConstant.prototype._constructVecMat = function (constant_type, vector_elements, num_elements, specialized) {
            this.constant_type = constant_type;
            this.specialization = specialized;
            var matrix = vector_elements[0].m.c[0].vecsize > 1;
            if (matrix) {
                this.m.columns = num_elements;
                for (var i = 0; i < num_elements; i++) {
                    this.m.c[i] = vector_elements[i].m.c[0];
                    if (vector_elements[i].specialization)
                        this.m.id[i] = vector_elements[i].self;
                }
            }
            else {
                this.m.c[0].vecsize = num_elements;
                this.m.columns = 1;
                for (var i = 0; i < num_elements; i++) {
                    this.m.c[0].r[i] = vector_elements[i].m.c[0].r[0];
                    if (vector_elements[i].specialization)
                        this.m.c[0].id[i] = vector_elements[i].self;
                }
            }
        };
        SPIRConstant.type = Types.TypeConstant;
        return SPIRConstant;
    }(IVariant));

    var SPIRConstantOp = /** @class */ (function (_super) {
        __extends(SPIRConstantOp, _super);
        function SPIRConstantOp(param0, op, args) {
            var _this = _super.call(this) || this;
            _this.arguments = [];
            if (param0 instanceof SPIRConstantOp) {
                defaultCopy(_this, param0);
            }
            else {
                _this.basetype = param0;
                _this.opcode = op;
                _this.arguments = args.slice();
            }
            return _this;
        }
        SPIRConstantOp.type = Types.TypeConstantOp;
        return SPIRConstantOp;
    }(IVariant));

    var ObjectPoolBase = /** @class */ (function () {
        function ObjectPoolBase() {
        }
        return ObjectPoolBase;
    }());

    // TODO: Actually use an object pool instead of relying on garbage collection
    //  doing it like this for now because we don't have destructors
    var ObjectPool = /** @class */ (function (_super) {
        __extends(ObjectPool, _super);
        function ObjectPool(classRef) {
            var _this = _super.call(this) || this;
            _this.classRef = classRef;
            return _this;
        }
        ObjectPool.prototype.allocate = function () {
            var _a;
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            // TODO: Keep a pool, but the problem is that disposing an out-of-scope is impossible
            return new ((_a = this.classRef).bind.apply(_a, __spreadArray([void 0], args, false)))();
        };
        ObjectPool.prototype.deallocate = function (ptr) {
            // dispose:
            // ptr->~T();
            // vacants.push_back(ptr);
        };
        ObjectPool.prototype.deallocate_opaque = function (ptr) {
            this.deallocate(ptr);
        };
        ObjectPool.prototype.clear = function () {
        };
        return ObjectPool;
    }(ObjectPoolBase));

    var SPIRVFunctionParameter = /** @class */ (function () {
        function SPIRVFunctionParameter(type, id, read_count, write_count, alias_global_variable) {
            if (type === void 0) { type = 0; }
            if (id === void 0) { id = 0; }
            if (read_count === void 0) { read_count = 0; }
            if (write_count === void 0) { write_count = 0; }
            if (alias_global_variable === void 0) { alias_global_variable = false; }
            this.type = type;
            this.id = id;
            this.read_count = read_count;
            this.write_count = write_count;
            this.alias_global_variable = alias_global_variable;
        }
        SPIRVFunctionParameter.prototype.clone = function () {
            return defaultClone(SPIRVFunctionParameter, this);
        };
        return SPIRVFunctionParameter;
    }());
    // When calling a function, and we're remapping separate image samplers,
    // resolve these arguments into combined image samplers and pass them
    // as additional arguments in this order.
    // It gets more complicated as functions can pull in their own globals
    // and combine them with parameters,
    // so we need to distinguish if something is local parameter index
    // or a global ID.
    var SPIRFunctionCombinedImageSamplerParameter = /** @class */ (function () {
        function SPIRFunctionCombinedImageSamplerParameter(id, image_id, sampler_id, global_image, global_sampler, depth) {
            if (id === void 0) { id = 0; }
            if (image_id === void 0) { image_id = 0; }
            if (sampler_id === void 0) { sampler_id = 0; }
            if (global_image === void 0) { global_image = false; }
            if (global_sampler === void 0) { global_sampler = false; }
            if (depth === void 0) { depth = false; }
            this.id = id;
            this.image_id = image_id;
            this.sampler_id = sampler_id;
            this.global_image = global_image;
            this.global_sampler = global_sampler;
            this.depth = depth;
        }
        SPIRFunctionCombinedImageSamplerParameter.prototype.clone = function () {
            return defaultClone(SPIRFunctionCombinedImageSamplerParameter, this);
        };
        return SPIRFunctionCombinedImageSamplerParameter;
    }());
    var SPIRVFunctionEntryLine = /** @class */ (function () {
        function SPIRVFunctionEntryLine() {
            this.file_id = 0;
            this.line_literal = 0;
        }
        SPIRVFunctionEntryLine.prototype.clone = function () {
            return defaultClone(SPIRVFunctionEntryLine, this);
        };
        return SPIRVFunctionEntryLine;
    }());
    var SPIRFunction = /** @class */ (function (_super) {
        __extends(SPIRFunction, _super);
        function SPIRFunction(param0, function_type) {
            var _this = _super.call(this) || this;
            _this.arguments = [];
            // Can be used by backends to add magic arguments.
            // Currently used by combined image/sampler implementation.
            _this.shadow_arguments = [];
            _this.local_variables = [];
            _this.entry_block = 0;
            _this.blocks = [];
            _this.combined_parameters = [];
            _this.entry_line = new SPIRVFunctionEntryLine();
            // Hooks to be run when the function returns.
            // Mostly used for lowering internal data structures onto flattened structures.
            // Need to defer this, because they might rely on things which change during compilation.
            // Intentionally not a small vector, this one is rare, and std::function can be large.
            _this.fixup_hooks_out = [];
            // Hooks to be run when the function begins.
            // Mostly used for populating internal data structures from flattened structures.
            // Need to defer this, because they might rely on things which change during compilation.
            // Intentionally not a small vector, this one is rare, and std::function can be large.
            _this.fixup_hooks_in = [];
            // On function entry, make sure to copy a constant array into thread addr space to work around
            // the case where we are passing a constant array by value to a function on backends which do not
            // consider arrays value types.
            _this.constant_arrays_needed_on_stack = [];
            _this.active = false;
            _this.flush_undeclared = true;
            _this.do_combined_parameters = true;
            if (param0 instanceof SPIRFunction)
                defaultCopy(_this, param0);
            else {
                _this.return_type = param0;
                _this.function_type = function_type;
            }
            return _this;
        }
        SPIRFunction.prototype.add_local_variable = function (id) {
            this.local_variables.push(id);
        };
        SPIRFunction.prototype.add_parameter = function (parameter_type, id, alias_global_variable) {
            if (alias_global_variable === void 0) { alias_global_variable = false; }
            // Arguments are read-only until proven otherwise.
            this.arguments.push(new SPIRVFunctionParameter(parameter_type, id, 0, 0, alias_global_variable));
        };
        SPIRFunction.type = Types.TypeFunction;
        return SPIRFunction;
    }(IVariant));

    var SPIRFunctionPrototype = /** @class */ (function (_super) {
        __extends(SPIRFunctionPrototype, _super);
        function SPIRFunctionPrototype(param0) {
            var _this = _super.call(this) || this;
            _this.parameter_types = [];
            if (param0 instanceof SPIRFunctionPrototype)
                defaultCopy(_this, param0);
            else
                _this.return_type = param0;
            return _this;
        }
        SPIRFunctionPrototype.type = Types.TypeFunctionPrototype;
        return SPIRFunctionPrototype;
    }(IVariant));

    var SPIRBlockTerminator;
    (function (SPIRBlockTerminator) {
        SPIRBlockTerminator[SPIRBlockTerminator["Unknown"] = 0] = "Unknown";
        SPIRBlockTerminator[SPIRBlockTerminator["Direct"] = 1] = "Direct";
        SPIRBlockTerminator[SPIRBlockTerminator["Select"] = 2] = "Select";
        SPIRBlockTerminator[SPIRBlockTerminator["MultiSelect"] = 3] = "MultiSelect";
        SPIRBlockTerminator[SPIRBlockTerminator["Return"] = 4] = "Return";
        SPIRBlockTerminator[SPIRBlockTerminator["Unreachable"] = 5] = "Unreachable";
        SPIRBlockTerminator[SPIRBlockTerminator["Kill"] = 6] = "Kill";
        SPIRBlockTerminator[SPIRBlockTerminator["IgnoreIntersection"] = 7] = "IgnoreIntersection";
        SPIRBlockTerminator[SPIRBlockTerminator["TerminateRay"] = 8] = "TerminateRay"; // Ray Tracing
    })(SPIRBlockTerminator || (SPIRBlockTerminator = {}));
    var SPIRBlockMerge;
    (function (SPIRBlockMerge) {
        SPIRBlockMerge[SPIRBlockMerge["MergeNone"] = 0] = "MergeNone";
        SPIRBlockMerge[SPIRBlockMerge["MergeLoop"] = 1] = "MergeLoop";
        SPIRBlockMerge[SPIRBlockMerge["MergeSelection"] = 2] = "MergeSelection";
    })(SPIRBlockMerge || (SPIRBlockMerge = {}));
    var SPIRBlockHints;
    (function (SPIRBlockHints) {
        SPIRBlockHints[SPIRBlockHints["HintNone"] = 0] = "HintNone";
        SPIRBlockHints[SPIRBlockHints["HintUnroll"] = 1] = "HintUnroll";
        SPIRBlockHints[SPIRBlockHints["HintDontUnroll"] = 2] = "HintDontUnroll";
        SPIRBlockHints[SPIRBlockHints["HintFlatten"] = 3] = "HintFlatten";
        SPIRBlockHints[SPIRBlockHints["HintDontFlatten"] = 4] = "HintDontFlatten";
    })(SPIRBlockHints || (SPIRBlockHints = {}));
    var SPIRBlockMethod;
    (function (SPIRBlockMethod) {
        SPIRBlockMethod[SPIRBlockMethod["MergeToSelectForLoop"] = 0] = "MergeToSelectForLoop";
        SPIRBlockMethod[SPIRBlockMethod["MergeToDirectForLoop"] = 1] = "MergeToDirectForLoop";
        SPIRBlockMethod[SPIRBlockMethod["MergeToSelectContinueForLoop"] = 2] = "MergeToSelectContinueForLoop";
    })(SPIRBlockMethod || (SPIRBlockMethod = {}));
    var SPIRBlockContinueBlockType;
    (function (SPIRBlockContinueBlockType) {
        SPIRBlockContinueBlockType[SPIRBlockContinueBlockType["ContinueNone"] = 0] = "ContinueNone";
        // Continue block is branchless and has at least one instruction.
        SPIRBlockContinueBlockType[SPIRBlockContinueBlockType["ForLoop"] = 1] = "ForLoop";
        // Noop continue block.
        SPIRBlockContinueBlockType[SPIRBlockContinueBlockType["WhileLoop"] = 2] = "WhileLoop";
        // Continue block is conditional.
        SPIRBlockContinueBlockType[SPIRBlockContinueBlockType["DoWhileLoop"] = 3] = "DoWhileLoop";
        // Highly unlikely that anything will use this,
        // since it is really awkward/impossible to express in GLSL.
        SPIRBlockContinueBlockType[SPIRBlockContinueBlockType["ComplexLoop"] = 4] = "ComplexLoop";
    })(SPIRBlockContinueBlockType || (SPIRBlockContinueBlockType = {}));
    var SPIRBlockPhi = /** @class */ (function () {
        function SPIRBlockPhi(local_variable, parent, function_variable) {
            if (local_variable === void 0) { local_variable = 0; }
            if (parent === void 0) { parent = 0; }
            if (function_variable === void 0) { function_variable = 0; }
            this.local_variable = local_variable;
            this.parent = parent;
            this.function_variable = function_variable;
        }
        SPIRBlockPhi.prototype.clone = function () { return defaultClone(SPIRBlockPhi, this); };
        return SPIRBlockPhi;
    }());
    var SPIRBlockCase = /** @class */ (function () {
        function SPIRBlockCase(value, block) {
            if (value === void 0) { value = BigInt(0); }
            if (block === void 0) { block = 0; }
            this.value = value;
            this.block = block;
        }
        SPIRBlockCase.prototype.clone = function () { return defaultClone(SPIRBlockCase, this); };
        return SPIRBlockCase;
    }());
    var SPIRBlock = /** @class */ (function (_super) {
        __extends(SPIRBlock, _super);
        function SPIRBlock(other) {
            var _this = _super.call(this) || this;
            _this.terminator = SPIRBlockTerminator.Unknown;
            _this.merge = SPIRBlockMerge.MergeNone;
            _this.hint = SPIRBlockHints.HintNone;
            _this.next_block = 0;
            _this.merge_block = 0;
            _this.continue_block = 0;
            _this.return_value = 0; // If 0, return nothing (void).
            _this.condition = 0;
            _this.true_block = 0;
            _this.false_block = 0;
            _this.default_block = 0;
            _this.ops = [];
            // Before entering this block flush out local variables to magical "phi" variables.
            _this.phi_variables = [];
            // Declare these temporaries before beginning the block.
            // Used for handling complex continue blocks which have side effects.
            _this.declare_temporary = [];
            // Declare these temporaries, but only conditionally if this block turns out to be
            // a complex loop header.
            _this.potential_declare_temporary = [];
            _this.cases_32bit = [];
            _this.cases_64bit = [];
            // If we have tried to optimize code for this block but failed,
            // keep track of this.
            _this.disable_block_optimization = false;
            // If the continue block is complex, fallback to "dumb" for loops.
            _this.complex_continue = false;
            // Do we need a ladder variable to defer breaking out of a loop construct after a switch block?
            _this.need_ladder_break = false;
            // If marked, we have explicitly handled SPIRBlockPhi from this block, so skip any flushes related to that on a branch.
            // Used to handle an edge case with switch and case-label fallthrough where fall-through writes to SPIRBlockPhi.
            _this.ignore_phi_from_block = 0;
            // The dominating block which this block might be within.
            // Used in continue; blocks to determine if we really need to write continue.
            _this.loop_dominator = 0;
            // All access to these variables are dominated by this block,
            // so before branching anywhere we need to make sure that we declare these variables.
            _this.dominated_variables = [];
            // These are variables which should be declared in a for loop header, if we
            // fail to use a classic for-loop,
            // we remove these variables, and fall back to regular variables outside the loop.
            _this.loop_variables = [];
            // Some expressions are control-flow dependent, i.e. any instruction which relies on derivatives or
            // sub-group-like operations.
            // Make sure that we only use these expressions in the original block.
            _this.invalidate_expressions = [];
            if (other)
                defaultCopy(other, _this);
            return _this;
        }
        SPIRBlock.type = Types.TypeBlock;
        SPIRBlock.NoDominator = 0xffffffff;
        return SPIRBlock;
    }(IVariant));

    var SPIRExtensionExtension;
    (function (SPIRExtensionExtension) {
        SPIRExtensionExtension[SPIRExtensionExtension["Unsupported"] = 0] = "Unsupported";
        SPIRExtensionExtension[SPIRExtensionExtension["GLSL"] = 1] = "GLSL";
        SPIRExtensionExtension[SPIRExtensionExtension["SPV_debug_info"] = 2] = "SPV_debug_info";
        SPIRExtensionExtension[SPIRExtensionExtension["SPV_AMD_shader_ballot"] = 3] = "SPV_AMD_shader_ballot";
        SPIRExtensionExtension[SPIRExtensionExtension["SPV_AMD_shader_explicit_vertex_parameter"] = 4] = "SPV_AMD_shader_explicit_vertex_parameter";
        SPIRExtensionExtension[SPIRExtensionExtension["SPV_AMD_shader_trinary_minmax"] = 5] = "SPV_AMD_shader_trinary_minmax";
        SPIRExtensionExtension[SPIRExtensionExtension["SPV_AMD_gcn_shader"] = 6] = "SPV_AMD_gcn_shader";
    })(SPIRExtensionExtension || (SPIRExtensionExtension = {}));
    var SPIRExtension = /** @class */ (function (_super) {
        __extends(SPIRExtension, _super);
        function SPIRExtension(param0) {
            var _this = _super.call(this) || this;
            if (param0 instanceof SPIRExtension)
                defaultCopy(_this, param0);
            else
                _this.ext = param0;
            return _this;
        }
        SPIRExtension.type = Types.TypeExtension;
        return SPIRExtension;
    }(IVariant));

    var SPIRExpression = /** @class */ (function (_super) {
        __extends(SPIRExpression, _super);
        function SPIRExpression(param0, expression_type, immutable) {
            var _this = _super.call(this) || this;
            // If non-zero, prepend expression with to_expression(base_expression).
            // Used in amortizing multiple calls to to_expression()
            // where in certain cases that would quickly force a temporary when not needed.
            _this.base_expression = 0;
            _this.expression_type = 0;
            // If this expression is a forwarded load,
            // allow us to reference the original variable.
            _this.loaded_from = 0;
            // If this expression will never change, we can avoid lots of temporaries
            // in high level source.
            // An expression being immutable can be speculative,
            // it is assumed that this is true almost always.
            _this.immutable = false;
            // Before use, this expression must be transposed.
            // This is needed for targets which don't support row_major layouts.
            _this.need_transpose = false;
            // Whether or not this is an access chain expression.
            _this.access_chain = false;
            // A list of expressions which this expression depends on.
            _this.expression_dependencies = [];
            // By reading this expression, we implicitly read these expressions as well.
            // Used by access chain Store and Load since we read multiple expressions in this case.
            _this.implied_read_expressions = [];
            // The expression was emitted at a certain scope. Lets us track when an expression read means multiple reads.
            _this.emitted_loop_level = 0;
            if (param0 instanceof SPIRExpression) {
                defaultCopy(_this, param0);
            }
            else {
                _this.expression = param0;
                _this.expression_type = expression_type;
                _this.immutable = immutable;
            }
            return _this;
        }
        SPIRExpression.type = Types.TypeExpression;
        return SPIRExpression;
    }(IVariant));

    var SPIRCombinedImageSampler = /** @class */ (function (_super) {
        __extends(SPIRCombinedImageSampler, _super);
        function SPIRCombinedImageSampler(param0, image, sampler) {
            var _this = _super.call(this) || this;
            if (param0 instanceof SPIRCombinedImageSampler) {
                defaultCopy(_this, param0);
            }
            else {
                _this.combined_type = param0;
                _this.image = image;
                _this.sampler = sampler;
            }
            return _this;
        }
        SPIRCombinedImageSampler.type = Types.TypeCombinedImageSampler;
        return SPIRCombinedImageSampler;
    }(IVariant));

    var SPIRAccessChain = /** @class */ (function (_super) {
        __extends(SPIRAccessChain, _super);
        function SPIRAccessChain(param0, storage, base, dynamic_index, static_index) {
            if (param0 === void 0) { param0 = 0; }
            var _this = _super.call(this) || this;
            _this.loaded_from = 0;
            _this.matrix_stride = 0;
            _this.array_stride = 0;
            _this.row_major_matrix = false;
            _this.immutable = false;
            // By reading this expression, we implicitly read these expressions as well.
            // Used by access chain Store and Load since we read multiple expressions in this case.
            _this.implied_read_expressions = [];
            if (param0 instanceof SPIRAccessChain) {
                defaultCopy(param0, _this);
            }
            else {
                _this.basetype = param0;
                _this.base = base;
                _this.dynamic_index = dynamic_index;
                _this.static_index = static_index;
            }
            return _this;
        }
        SPIRAccessChain.type = Types.TypeAccessChain;
        return SPIRAccessChain;
    }(IVariant));

    var SPIRUndef = /** @class */ (function (_super) {
        __extends(SPIRUndef, _super);
        function SPIRUndef(param0) {
            var _this = _super.call(this) || this;
            if (param0 instanceof SPIRUndef)
                defaultCopy(_this, param0);
            else
                _this.basetype = param0;
            return _this;
        }
        SPIRUndef.type = Types.TypeUndef;
        return SPIRUndef;
    }(IVariant));

    var SPIRString = /** @class */ (function (_super) {
        __extends(SPIRString, _super);
        function SPIRString(param0) {
            var _this = _super.call(this) || this;
            if (param0 instanceof SPIRString)
                defaultCopy(_this, param0);
            else
                _this.str = param0;
            return _this;
        }
        SPIRString.type = Types.TypeString;
        return SPIRString;
    }(IVariant));

    function replaceCharAt(str, index, char) {
        return str.substring(0, index) + char + str.substring(index + 1);
    }

    // @ts-ignore
    // Meta data about blocks. The cross-compiler needs to query if a block is either of these types.
    // It is a bitset as there can be more than one tag per block.
    var BlockMetaFlagBits;
    (function (BlockMetaFlagBits) {
        BlockMetaFlagBits[BlockMetaFlagBits["BLOCK_META_LOOP_HEADER_BIT"] = 1] = "BLOCK_META_LOOP_HEADER_BIT";
        BlockMetaFlagBits[BlockMetaFlagBits["BLOCK_META_CONTINUE_BIT"] = 2] = "BLOCK_META_CONTINUE_BIT";
        BlockMetaFlagBits[BlockMetaFlagBits["BLOCK_META_LOOP_MERGE_BIT"] = 4] = "BLOCK_META_LOOP_MERGE_BIT";
        BlockMetaFlagBits[BlockMetaFlagBits["BLOCK_META_SELECTION_MERGE_BIT"] = 8] = "BLOCK_META_SELECTION_MERGE_BIT";
        BlockMetaFlagBits[BlockMetaFlagBits["BLOCK_META_MULTISELECT_MERGE_BIT"] = 16] = "BLOCK_META_MULTISELECT_MERGE_BIT";
    })(BlockMetaFlagBits || (BlockMetaFlagBits = {}));
    var Source = /** @class */ (function () {
        function Source() {
            this.version = 0;
            this.es = false;
            this.known = false;
            this.hlsl = false;
        }
        return Source;
    }());
    var LoopLock = /** @class */ (function () {
        // is normally a pointer
        function LoopLock(lock) {
            this.lock = lock;
            this.lock.set(this.lock.get() + 1);
        }
        // IMPORTANT TO CALL THIS MANUALLY SINCE WE DON'T HAVE DESTRUCTORS
        LoopLock.prototype.dispose = function () {
            this.lock.set(this.lock.get() - 1);
        };
        return LoopLock;
    }());
    var ParsedIR = /** @class */ (function () {
        function ParsedIR() {
            this.ids = [];
            // Various meta data for IDs, decorations, names, etc.
            // this is actually a Map<ID, Meta>, so we use a sparse array so we can use the same [id] syntax
            this.meta = [];
            // Holds all IDs which have a certain type.
            // This is needed so we can iterate through a specific kind of resource quickly,
            // and in-order of module declaration.
            this.ids_for_type = new Array(Types.TypeCount);
            // Special purpose lists which contain a union of types.
            // This is needed so we can declare specialization constants and structs in an interleaved fashion,
            // among other things.
            // Constants can be of struct type, and struct array sizes can use specialization constants.
            this.ids_for_constant_or_type = [];
            this.ids_for_constant_or_variable = [];
            // We need to keep track of the width the Ops that contains a type for the
            // OpSwitch instruction, since this one doesn't contains the type in the
            // instruction itself. And in some case we need to cast the condition to
            // wider types. We only need the width to do the branch fixup since the
            // type check itself can be done at runtime
            this.load_type_width = [];
            // Declared capabilities and extensions in the SPIR-V module.
            // Not really used except for reflection at the moment.
            this.declared_capabilities = [];
            this.declared_extensions = [];
            // Meta data about blocks. The cross-compiler needs to query if a block is either of these types.
            // It is a bitset as there can be more than one tag per block.
            this.block_meta = [];
            this.continue_block_to_loop_header = []; // map
            // Normally, we'd stick SPIREntryPoint in ids array, but it conflicts with SPIRFunction.
            // Entry points can therefore be seen as some sort of meta structure.
            this.entry_points = [];
            this.default_entry_point = 0;
            this.source = new Source();
            this.addressing_model = AddressingModel.AddressingModelMax;
            this.memory_model = MemoryModel.MemoryModelMax;
            this.loop_iteration_depth_hard = 0;
            this.loop_iteration_depth_soft = 0;
            this.empty_string = "";
            this.cleared_bitset = new Bitset();
            this.meta_needing_name_fixup = new Set();
            for (var i = 0; i < this.ids_for_type.length; ++i)
                this.ids_for_type[i] = [];
            // we're not using pools for now because we don't have destructors
            this.pool_group = new ObjectPoolGroup();
            this.pool_group.pools[Types.TypeType] = new ObjectPool(SPIRType);
            this.pool_group.pools[Types.TypeVariable] = new ObjectPool(SPIRVariable);
            this.pool_group.pools[Types.TypeConstant] = new ObjectPool(SPIRConstant);
            this.pool_group.pools[Types.TypeFunction] = new ObjectPool(SPIRFunction);
            this.pool_group.pools[Types.TypeFunctionPrototype] = new ObjectPool(SPIRFunctionPrototype);
            this.pool_group.pools[Types.TypeBlock] = new ObjectPool(SPIRBlock);
            this.pool_group.pools[Types.TypeExtension] = new ObjectPool(SPIRExtension);
            this.pool_group.pools[Types.TypeExpression] = new ObjectPool(SPIRExpression);
            this.pool_group.pools[Types.TypeConstantOp] = new ObjectPool(SPIRConstantOp);
            this.pool_group.pools[Types.TypeCombinedImageSampler] = new ObjectPool(SPIRCombinedImageSampler);
            this.pool_group.pools[Types.TypeAccessChain] = new ObjectPool(SPIRAccessChain);
            this.pool_group.pools[Types.TypeUndef] = new ObjectPool(SPIRUndef);
            this.pool_group.pools[Types.TypeString] = new ObjectPool(SPIRString);
        }
        // Resizes ids, meta and block_meta.
        ParsedIR.prototype.set_id_bounds = function (bounds) {
            var _this = this;
            this.ids = createWith(bounds, function () { return new Variant(_this.pool_group); });
            this.block_meta = createWith(bounds, function () { return 0; });
        };
        // Decoration handling methods.
        // Can be useful for simple "raw" reflection.
        // However, most members are here because the Parser needs most of these,
        // and might as well just have the whole suite of decoration/name handling in one place.
        ParsedIR.prototype.set_name = function (id, name) {
            var m = this.get_meta(id);
            m.decoration.alias = name;
            if (!is_valid_identifier(name) || is_reserved_identifier(name, false, false))
                this.meta_needing_name_fixup.add(id);
        };
        ParsedIR.prototype.get_name = function (id) {
            var m = this.find_meta(id);
            if (m)
                return m.decoration.alias;
            else
                return this.empty_string;
        };
        ParsedIR.prototype.set_decoration = function (id, decoration, argument) {
            if (argument === void 0) { argument = 0; }
            var dec = this.get_meta(id).decoration;
            dec.decoration_flags.set(decoration);
            switch (decoration) {
                case Decoration.DecorationBuiltIn:
                    dec.builtin = true;
                    dec.builtin_type = argument;
                    break;
                case Decoration.DecorationLocation:
                    dec.location = argument;
                    break;
                case Decoration.DecorationComponent:
                    dec.component = argument;
                    break;
                case Decoration.DecorationOffset:
                    dec.offset = argument;
                    break;
                case Decoration.DecorationXfbBuffer:
                    dec.xfb_buffer = argument;
                    break;
                case Decoration.DecorationXfbStride:
                    dec.xfb_stride = argument;
                    break;
                case Decoration.DecorationStream:
                    dec.stream = argument;
                    break;
                case Decoration.DecorationArrayStride:
                    dec.array_stride = argument;
                    break;
                case Decoration.DecorationMatrixStride:
                    dec.matrix_stride = argument;
                    break;
                case Decoration.DecorationBinding:
                    dec.binding = argument;
                    break;
                case Decoration.DecorationDescriptorSet:
                    dec.set = argument;
                    break;
                case Decoration.DecorationInputAttachmentIndex:
                    dec.input_attachment = argument;
                    break;
                case Decoration.DecorationSpecId:
                    dec.spec_id = argument;
                    break;
                case Decoration.DecorationIndex:
                    dec.index = argument;
                    break;
                case Decoration.DecorationHlslCounterBufferGOOGLE:
                    this.get_meta(id).hlsl_magic_counter_buffer = argument;
                    this.meta[argument].hlsl_is_magic_counter_buffer = true;
                    break;
                case Decoration.DecorationFPRoundingMode:
                    dec.fp_rounding_mode = argument;
                    break;
            }
        };
        ParsedIR.prototype.set_decoration_string = function (id, decoration, argument) {
            var dec = this.get_meta(id).decoration;
            dec.decoration_flags.set(decoration);
            switch (decoration) {
                case Decoration.DecorationHlslSemanticGOOGLE:
                    dec.hlsl_semantic = argument;
                    break;
            }
        };
        ParsedIR.prototype.has_decoration = function (id, decoration) {
            return this.get_decoration_bitset(id).get(decoration);
        };
        ParsedIR.prototype.get_decoration = function (id, decoration) {
            var m = this.find_meta(id);
            if (!m)
                return 0;
            var dec = m.decoration;
            if (!dec.decoration_flags.get(decoration))
                return 0;
            switch (decoration) {
                case Decoration.DecorationBuiltIn:
                    return dec.builtin_type;
                case Decoration.DecorationLocation:
                    return dec.location;
                case Decoration.DecorationComponent:
                    return dec.component;
                case Decoration.DecorationOffset:
                    return dec.offset;
                case Decoration.DecorationXfbBuffer:
                    return dec.xfb_buffer;
                case Decoration.DecorationXfbStride:
                    return dec.xfb_stride;
                case Decoration.DecorationStream:
                    return dec.stream;
                case Decoration.DecorationBinding:
                    return dec.binding;
                case Decoration.DecorationDescriptorSet:
                    return dec.set;
                case Decoration.DecorationInputAttachmentIndex:
                    return dec.input_attachment;
                case Decoration.DecorationSpecId:
                    return dec.spec_id;
                case Decoration.DecorationArrayStride:
                    return dec.array_stride;
                case Decoration.DecorationMatrixStride:
                    return dec.matrix_stride;
                case Decoration.DecorationIndex:
                    return dec.index;
                case Decoration.DecorationFPRoundingMode:
                    return dec.fp_rounding_mode;
                default:
                    return 1;
            }
        };
        ParsedIR.prototype.get_decoration_string = function (id, decoration) {
            var m = this.find_meta(id);
            if (!m)
                return this.empty_string;
            var dec = m.decoration;
            if (!dec.decoration_flags.get(decoration))
                return this.empty_string;
            switch (decoration) {
                case Decoration.DecorationHlslSemanticGOOGLE:
                    return dec.hlsl_semantic;
                default:
                    return this.empty_string;
            }
        };
        ParsedIR.prototype.get_decoration_bitset = function (id) {
            var m = this.find_meta(id);
            if (m) {
                var dec = m.decoration;
                return dec.decoration_flags;
            }
            else
                return this.cleared_bitset;
        };
        ParsedIR.prototype.unset_decoration = function (id, decoration) {
            var dec = this.get_meta(id).decoration;
            dec.decoration_flags.clear(decoration);
            switch (decoration) {
                case Decoration.DecorationBuiltIn:
                    dec.builtin = false;
                    break;
                case Decoration.DecorationLocation:
                    dec.location = 0;
                    break;
                case Decoration.DecorationComponent:
                    dec.component = 0;
                    break;
                case Decoration.DecorationOffset:
                    dec.offset = 0;
                    break;
                case Decoration.DecorationXfbBuffer:
                    dec.xfb_buffer = 0;
                    break;
                case Decoration.DecorationXfbStride:
                    dec.xfb_stride = 0;
                    break;
                case Decoration.DecorationStream:
                    dec.stream = 0;
                    break;
                case Decoration.DecorationBinding:
                    dec.binding = 0;
                    break;
                case Decoration.DecorationDescriptorSet:
                    dec.set = 0;
                    break;
                case Decoration.DecorationInputAttachmentIndex:
                    dec.input_attachment = 0;
                    break;
                case Decoration.DecorationSpecId:
                    dec.spec_id = 0;
                    break;
                case Decoration.DecorationHlslSemanticGOOGLE:
                    dec.hlsl_semantic = "";
                    break;
                case Decoration.DecorationFPRoundingMode:
                    dec.fp_rounding_mode = FPRoundingMode.FPRoundingModeMax;
                    break;
                case Decoration.DecorationHlslCounterBufferGOOGLE: {
                    var meta = this.get_meta(id);
                    var counter = meta.hlsl_magic_counter_buffer;
                    if (counter) {
                        this.meta[counter].hlsl_is_magic_counter_buffer = false;
                        meta.hlsl_magic_counter_buffer = 0;
                    }
                    break;
                }
            }
        };
        ParsedIR.prototype.resize_members = function (members, len) {
            var old = members.length;
            members.length = len;
            for (var i = old; i < len; ++i) {
                members[i] = new MetaDecoration();
            }
        };
        // Decoration handling methods (for members of a struct).
        ParsedIR.prototype.set_member_name = function (id, index, name) {
            var m = this.get_meta(id);
            this.resize_members(m.members, Math.max(m.members.length, index + 1));
            m.members[index].alias = name;
            if (!is_valid_identifier(name) || is_reserved_identifier(name, true, false))
                this.meta_needing_name_fixup.add(id);
        };
        ParsedIR.prototype.get_member_name = function (id, index) {
            var m = this.find_meta(id);
            if (m) {
                if (index >= m.members.length)
                    return this.empty_string;
                return m.members[index].alias;
            }
            else
                return this.empty_string;
        };
        ParsedIR.prototype.set_member_decoration = function (id, index, decoration, argument) {
            if (argument === void 0) { argument = 0; }
            // 5 = size_t(index) + 1
            var m = this.get_meta(id);
            this.resize_members(m.members, Math.max(m.members.length, index + 1));
            var dec = m.members[index];
            dec.decoration_flags.set(decoration);
            switch (decoration) {
                case Decoration.DecorationBuiltIn:
                    dec.builtin = true;
                    dec.builtin_type = argument;
                    break;
                case Decoration.DecorationLocation:
                    dec.location = argument;
                    break;
                case Decoration.DecorationComponent:
                    dec.component = argument;
                    break;
                case Decoration.DecorationBinding:
                    dec.binding = argument;
                    break;
                case Decoration.DecorationOffset:
                    dec.offset = argument;
                    break;
                case Decoration.DecorationXfbBuffer:
                    dec.xfb_buffer = argument;
                    break;
                case Decoration.DecorationXfbStride:
                    dec.xfb_stride = argument;
                    break;
                case Decoration.DecorationStream:
                    dec.stream = argument;
                    break;
                case Decoration.DecorationSpecId:
                    dec.spec_id = argument;
                    break;
                case Decoration.DecorationMatrixStride:
                    dec.matrix_stride = argument;
                    break;
                case Decoration.DecorationIndex:
                    dec.index = argument;
                    break;
            }
        };
        ParsedIR.prototype.set_member_decoration_string = function (id, index, decoration, argument) {
            var m = this.get_meta(id);
            // 5 = size_t(index) + 1)
            this.resize_members(m.members, Math.max(m.members.length, index + 1));
            var dec = m.members[index];
            dec.decoration_flags.set(decoration);
            switch (decoration) {
                case Decoration.DecorationHlslSemanticGOOGLE:
                    dec.hlsl_semantic = argument;
                    break;
            }
        };
        ParsedIR.prototype.get_member_decoration = function (id, index, decoration) {
            var m = this.find_meta(id);
            if (!m)
                return 0;
            if (index >= m.members.length)
                return 0;
            var dec = m.members[index];
            if (!dec.decoration_flags.get(decoration))
                return 0;
            switch (decoration) {
                case Decoration.DecorationBuiltIn:
                    return dec.builtin_type;
                case Decoration.DecorationLocation:
                    return dec.location;
                case Decoration.DecorationComponent:
                    return dec.component;
                case Decoration.DecorationBinding:
                    return dec.binding;
                case Decoration.DecorationOffset:
                    return dec.offset;
                case Decoration.DecorationXfbBuffer:
                    return dec.xfb_buffer;
                case Decoration.DecorationXfbStride:
                    return dec.xfb_stride;
                case Decoration.DecorationStream:
                    return dec.stream;
                case Decoration.DecorationSpecId:
                    return dec.spec_id;
                case Decoration.DecorationIndex:
                    return dec.index;
                default:
                    return 1;
            }
        };
        ParsedIR.prototype.get_member_decoration_string = function (id, index, decoration) {
            var m = this.find_meta(id);
            if (m) {
                if (!this.has_member_decoration(id, index, decoration))
                    return this.empty_string;
                var dec = m.members[index];
                switch (decoration) {
                    case Decoration.DecorationHlslSemanticGOOGLE:
                        return dec.hlsl_semantic;
                    default:
                        return this.empty_string;
                }
            }
            else
                return this.empty_string;
        };
        ParsedIR.prototype.has_member_decoration = function (id, index, decoration) {
            return this.get_member_decoration_bitset(id, index, false).get(decoration);
        };
        ParsedIR.prototype.get_member_decoration_bitset = function (id, index, clone) {
            var m = this.find_meta(id);
            if (m) {
                if (index >= m.members.length)
                    return this.cleared_bitset.clone();
                return m.members[index].decoration_flags;
            }
            else
                return this.cleared_bitset.clone();
        };
        ParsedIR.prototype.unset_member_decoration = function (id, index, decoration) {
            var m = this.get_meta(id);
            if (index >= m.members.length)
                return;
            var dec = m.members[index];
            dec.decoration_flags.clear(decoration);
            switch (decoration) {
                case Decoration.DecorationBuiltIn:
                    dec.builtin = false;
                    break;
                case Decoration.DecorationLocation:
                    dec.location = 0;
                    break;
                case Decoration.DecorationComponent:
                    dec.component = 0;
                    break;
                case Decoration.DecorationOffset:
                    dec.offset = 0;
                    break;
                case Decoration.DecorationXfbBuffer:
                    dec.xfb_buffer = 0;
                    break;
                case Decoration.DecorationXfbStride:
                    dec.xfb_stride = 0;
                    break;
                case Decoration.DecorationStream:
                    dec.stream = 0;
                    break;
                case Decoration.DecorationSpecId:
                    dec.spec_id = 0;
                    break;
                case Decoration.DecorationHlslSemanticGOOGLE:
                    dec.hlsl_semantic = "";
                    break;
            }
        };
        ParsedIR.prototype.mark_used_as_array_length = function (id) {
            switch (this.ids[id].get_type()) {
                case Types.TypeConstant:
                    this.get(SPIRConstant, id).is_used_as_array_length = true;
                    break;
                case Types.TypeConstantOp:
                    {
                        var cop = this.get(SPIRConstantOp, id);
                        if (cop.opcode === Op.OpCompositeExtract)
                            this.mark_used_as_array_length(cop.arguments[0]);
                        else if (cop.opcode === Op.OpCompositeInsert) {
                            this.mark_used_as_array_length(cop.arguments[0]);
                            this.mark_used_as_array_length(cop.arguments[1]);
                        }
                        else
                            for (var _i = 0, _a = cop.arguments; _i < _a.length; _i++) {
                                var arg_id = _a[_i];
                                this.mark_used_as_array_length(arg_id);
                            }
                        break;
                    }
                case Types.TypeUndef:
                    break;
                default:
                    throw new Error("Shouldn't reach this branch");
            }
        };
        ParsedIR.prototype.increase_bound_by = function (incr_amount) {
            var curr_bound = this.ids.length;
            var new_bound = curr_bound + incr_amount;
            this.ids.length += incr_amount;
            for (var i = 0; i < incr_amount; i++)
                // original is: ids.emplace_back(pool_group.get());
                // which calls the constructor for Variant with the pointer to pool_group
                this.ids[i] = new Variant(this.pool_group);
            this.block_meta.length = new_bound;
            return curr_bound;
        };
        ParsedIR.prototype.get_buffer_block_flags = function (var_) {
            var type = this.get(SPIRType, var_.basetype);
            if (type.basetype !== SPIRTypeBaseType.Struct) {
                throw new Error("Assertion failure");
            }
            // Some flags like non-writable, non-readable are actually found
            // as member decorations. If all members have a decoration set, propagate
            // the decoration up as a regular variable decoration.
            var base_flags;
            var m = this.find_meta(var_.self);
            if (m)
                base_flags = m.decoration.decoration_flags;
            if (type.member_types.length === 0)
                return base_flags.clone() || new Bitset();
            var all_members_flags = this.get_buffer_block_type_flags(type);
            base_flags.merge_or(all_members_flags);
            return base_flags.clone() || new Bitset();
        };
        ParsedIR.prototype.get_buffer_block_type_flags = function (type) {
            if (type.member_types.length === 0)
                return new Bitset();
            var all_members_flags = this.get_member_decoration_bitset(type.self, 0);
            for (var i = 1; i < type.member_types.length; i++)
                all_members_flags.merge_and(this.get_member_decoration_bitset(type.self, i, false));
            return all_members_flags;
        };
        ParsedIR.prototype.add_typed_id = function (type, id) {
            if (this.loop_iteration_depth_hard !== 0)
                throw new Error("Cannot add typed ID while looping over it.");
            var _id = this.ids[id];
            if (this.loop_iteration_depth_soft !== 0) {
                if (!_id.empty())
                    throw new Error("Cannot override IDs when loop is soft locked.");
            }
            if (_id.empty() || _id.get_type() !== type) {
                switch (type) {
                    case Types.TypeConstant:
                        this.ids_for_constant_or_variable.push(id);
                        this.ids_for_constant_or_type.push(id);
                        break;
                    case Types.TypeVariable:
                        this.ids_for_constant_or_variable.push(id);
                        break;
                    case Types.TypeType:
                    case Types.TypeConstantOp:
                        this.ids_for_constant_or_type.push(id);
                        break;
                }
            }
            if (_id.empty()) {
                this.ids_for_type[type].push(id);
            }
            else if (_id.get_type() !== type) {
                this.remove_typed_id(_id.get_type(), id);
                this.ids_for_type[type].push(id);
            }
        };
        ParsedIR.prototype.remove_typed_id = function (type, id) {
            removeAllElements(this.ids_for_type[type], id);
        };
        // This must be held while iterating over a type ID array.
        // It is undefined if someone calls set<>() while we're iterating over a data structure, so we must
        // make sure that this case is avoided.
        // If we have a hard lock, it is an error to call set<>(), and an exception is thrown.
        // If we have a soft lock, we silently ignore any additions to the typed arrays.
        // This should only be used for physical ID remapping where we need to create an ID, but we will never
        // care about iterating over them.
        ParsedIR.prototype.create_loop_hard_lock = function () {
            return new LoopLock(new MemberPointer(this, "loop_iteration_depth_hard"));
        };
        ParsedIR.prototype.create_loop_soft_lock = function () {
            return new LoopLock(new MemberPointer(this, "loop_iteration_depth_soft"));
        };
        ParsedIR.prototype.for_each_typed_id = function (classRef, op) {
            var loop_lock = this.create_loop_hard_lock();
            for (var _i = 0, _a = this.ids_for_type[classRef.type]; _i < _a.length; _i++) {
                var id = _a[_i];
                if (this.ids[id].get_type() === classRef.type)
                    op(id, this.get(classRef, id));
            }
            loop_lock.dispose();
        };
        ParsedIR.prototype.reset_all_of_type = function (type) {
            if (typeof type !== "number") {
                this.reset_all_of_type(type.type);
                return;
            }
            for (var _i = 0, _a = this.ids_for_type[type]; _i < _a.length; _i++) {
                var id = _a[_i];
                if (this.ids[id].get_type() === type)
                    this.ids[id].reset();
            }
            this.ids_for_type[type] = [];
        };
        ParsedIR.prototype.get_meta = function (id) {
            if (!this.meta[id])
                this.meta[id] = new Meta();
            return this.meta[id];
        };
        ParsedIR.prototype.find_meta = function (id) {
            return this.meta[id];
        };
        ParsedIR.prototype.get_empty_string = function () {
            return this.empty_string;
        };
        ParsedIR.prototype.make_constant_null = function (id, type, add_to_typed_id_set) {
            var constant_type = this.get(SPIRType, type);
            if (constant_type.pointer) {
                if (add_to_typed_id_set)
                    this.add_typed_id(Types.TypeConstant, id);
                var constant = variant_set(SPIRConstant, this.ids[id], type);
                constant.self = id;
                constant.make_null(constant_type);
            }
            else if (constant_type.array.length !== 0) {
                console.assert(constant_type.parent_type);
                var parent_id = this.increase_bound_by(1);
                this.make_constant_null(parent_id, constant_type.parent_type, add_to_typed_id_set);
                // if (!constant_type.array_size_literal.length)
                //     throw new Error("Array size of OpConstantNull must be a literal.");
                var elements = [];
                for (var i = 0; i < constant_type.array.length; i++)
                    elements[i] = parent_id;
                if (add_to_typed_id_set)
                    this.add_typed_id(Types.TypeConstant, id);
                variant_set(SPIRConstant, this.ids[id], type, elements, elements.length, false).self = id;
            }
            else if (constant_type.member_types.length !== 0) {
                var member_ids = this.increase_bound_by(constant_type.member_types.length);
                var elements = [];
                for (var i = 0; i < constant_type.member_types.length; i++) {
                    this.make_constant_null(member_ids + i, constant_type.member_types[i], add_to_typed_id_set);
                    elements[i] = member_ids + i;
                }
                if (add_to_typed_id_set)
                    this.add_typed_id(Types.TypeConstant, id);
                variant_set(SPIRConstant, this.ids[id], type, elements, elements.length, false).self = id;
            }
            else {
                if (add_to_typed_id_set)
                    this.add_typed_id(Types.TypeConstant, id);
                var constant = variant_set(SPIRConstant, this.ids[id], type);
                constant.self = id;
                constant.make_null(constant_type);
            }
        };
        ParsedIR.prototype.fixup_reserved_names = function () {
            for (var it = this.meta_needing_name_fixup.values(), id = null; (id = it.next().value);) {
                var m = this.get_meta(id);
                m.decoration.alias = sanitize_identifier(m.decoration.alias, false, false);
                for (var _i = 0, _a = m.members; _i < _a.length; _i++) {
                    var memb = _a[_i];
                    memb.alias = sanitize_identifier(memb.alias, true, false);
                }
            }
            this.meta_needing_name_fixup.clear();
        };
        ParsedIR.prototype.get_spirv_version = function () {
            return this.spirv[1];
        };
        ParsedIR.prototype.get = function (classRef, id) {
            return variant_get(classRef, this.ids[id]);
        };
        return ParsedIR;
    }());
    function sanitize_underscores(str) {
        // Compact adjacent underscores to make it valid.
        return str.replace(/_+/g, "_");
        /*let dst = 0;
        let src = dst;
        let saw_underscore = false;
        while (src !== str.length)
        {
            let is_underscore = str.charAt(src) === '_';
            if (saw_underscore && is_underscore)
            {
                src++;
            }
            else
            {
                if (dst !== src) {
                    str = str.substring(0, dst) + str.charAt(src) + str.substring(dst + 1);
                }
                dst++;
                src++;
                saw_underscore = is_underscore;
            }
        }
        return str.substring(0, dst);*/
    }
    function sanitize_identifier(name, member, allow_reserved_prefixes) {
        if (!is_valid_identifier(name))
            name = ensure_valid_identifier(name);
        if (is_reserved_identifier(name, member, allow_reserved_prefixes))
            name = make_unreserved_identifier(name);
        return name;
    }
    // Roll our own versions of these functions to avoid potential locale shenanigans.
    function is_alpha(c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    }
    function is_numeric(c) {
        return c >= '0' && c <= '9';
    }
    function is_alphanumeric(c) {
        return is_alpha(c) || is_numeric(c);
    }
    function is_valid_identifier(name) {
        if (name === "")
            return true;
        if (is_numeric(name[0]))
            return false;
        for (var i = 0; i < name.length; ++i) {
            var c = name.charAt(i);
            if (!is_alphanumeric(c) && c !== '_')
                return false;
        }
        var saw_underscore = false;
        // Two underscores in a row is not a valid identifier either.
        // Technically reserved, but it's easier to treat it as invalid.
        for (var i = 0; i < name.length; ++i) {
            var c = name.charAt(i);
            var is_underscore = c === '_';
            if (is_underscore && saw_underscore)
                return false;
            saw_underscore = is_underscore;
        }
        return true;
    }
    function is_reserved_prefix(name) {
        var sub = name.substring(0, 3);
        // Generic reserved identifiers used by the implementation.
        return sub === "gl_" || sub === "spv";
        // Ignore this case for now, might rewrite internal code to always use spv prefix.
        //name.substring(0, 11) === "SPIRV_Cross"
    }
    function is_reserved_identifier(name, member, allow_reserved_prefixes) {
        if (!allow_reserved_prefixes && is_reserved_prefix(name))
            return true;
        if (member) {
            // Reserved member identifiers come in one form:
            // _m[0-9]+$.
            if (name.length < 3)
                return false;
            if (name.substring(0, 2) === "_m")
                return false;
            var index = 2;
            while (index < name.length && is_numeric(name[index]))
                index++;
            return index === name.length;
        }
        else {
            // Reserved non-member identifiers come in two forms:
            // _[0-9]+$, used for temporaries which map directly to a SPIR-V ID.
            // _[0-9]+_, used for auxillary temporaries which derived from a SPIR-V ID.
            if (name.length < 2)
                return false;
            if (name.charAt(0) !== '_' || !is_numeric(name.charAt(1)))
                return false;
            var index = 2;
            while (index < name.length && is_numeric(name[index]))
                index++;
            return index === name.length || (index < name.length && name[index] === '_');
        }
    }
    function ensure_valid_identifier(name) {
        // Functions in glslangValidator are mangled with name(<mangled> stuff.
        // Normally, we would never see '(' in any legal identifiers, so just strip them out.
        var str = name.substring(0, name.indexOf('('));
        if (str.length === 0)
            return str;
        if (is_numeric(str.charAt(0)))
            str = '_' + str.substring(1);
        for (var i = 0; i < str.length; ++i) {
            var c = str.charAt(i);
            if (!is_alphanumeric(c) && c !== '_') {
                // replace with c
                str = replaceCharAt(str, i, '_');
            }
        }
        return sanitize_underscores(str);
    }
    function make_unreserved_identifier(name) {
        if (is_reserved_prefix(name))
            return "_RESERVED_IDENTIFIER_FIXUP_" + name;
        else
            return "_RESERVED_IDENTIFIER_FIXUP" + name;
    }

    var Instruction = /** @class */ (function () {
        function Instruction() {
            this.op = 0;
            this.count = 0;
            // If offset is 0 (not a valid offset into the instruction stream),
            // we have an instruction stream which is embedded in the object.
            this.offset = 0;
            this.length = 0;
        }
        Instruction.prototype.is_embedded = function () {
            return this.offset === 0;
        };
        return Instruction;
    }());
    /** @class */ ((function (_super) {
        __extends(EmbeddedInstruction, _super);
        function EmbeddedInstruction() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.ops = [];
            return _this;
        }
        return EmbeddedInstruction;
    })(Instruction));

    var Pair = /** @class */ (function () {
        function Pair(first, second) {
            this.first = first;
            this.second = second;
        }
        Pair.prototype.equals = function (b) {
            return this.first === b.first && this.second === b.second;
        };
        Pair.prototype.clone = function () {
            var c = new Pair();
            defaultCopy(this, c);
            return c;
        };
        return Pair;
    }());

    var SPIREntryPointWorkgroupSize = /** @class */ (function () {
        function SPIREntryPointWorkgroupSize() {
            this.x = 0;
            this.y = 0;
            this.z = 0;
            this.constant = 0; // Workgroup size can be expressed as a constant/spec-constant instead.
        }
        SPIREntryPointWorkgroupSize.prototype.clone = function () { return defaultClone(SPIREntryPointWorkgroupSize, this); };
        return SPIREntryPointWorkgroupSize;
    }());
    // SPIREntryPoint is not a variant since its IDs are used to decorate OpFunction,
    // so in order to avoid conflicts, we can't stick them in the ids array.
    var SPIREntryPoint = /** @class */ (function () {
        function SPIREntryPoint(self, execution_model, entry_name) {
            this.self = 0;
            this.interface_variables = [];
            this.flags = new Bitset();
            this.workgroup_size = new SPIREntryPointWorkgroupSize();
            this.invocations = 0;
            this.output_vertices = 0;
            this.model = ExecutionModel.ExecutionModelMax;
            this.geometry_passthrough = false;
            this.self = self;
            this.name = entry_name;
            this.orig_name = entry_name;
            this.model = execution_model;
        }
        return SPIREntryPoint;
    }());

    var Parser = /** @class */ (function () {
        function Parser(spirv) {
            this.ir = new ParsedIR();
            // This must be an ordered data structure so we always pick the same type aliases.
            this.global_struct_cache = [];
            this.forward_pointer_fixups = [];
            this.ir.spirv = spirv;
        }
        Parser.prototype.get_parsed_ir = function () {
            return this.ir;
        };
        Parser.prototype.parse = function () {
            var _this = this;
            var spirv = this.ir.spirv;
            var len = spirv.length;
            if (len < 5)
                throw new Error("SPIRV file too small.");
            var s = spirv;
            // Endian-swap if we need to (for web: we don't, actually).
            if (s[0] === swap_endian(MagicNumber)) {
                transform(s, function (c) { return swap_endian(c); });
                console.log("swapped");
            }
            if (s[0] !== MagicNumber || !is_valid_spirv_version(s[1]))
                throw new Error("Invalid SPIRV format.");
            var bound = s[3];
            var MaximumNumberOfIDs = 0x3fffff;
            if (bound > MaximumNumberOfIDs)
                throw new Error("ID bound exceeds limit of 0x3fffff.");
            this.ir.set_id_bounds(bound);
            var offset = 5;
            var instructions = [];
            while (offset < len) {
                var instr = new Instruction();
                instr.op = spirv[offset] & 0xffff;
                instr.count = (spirv[offset] >> 16) & 0xffff;
                if (instr.count === 0)
                    throw new Error("SPIR-V instructions cannot consume 0 words. Invalid SPIR-V file.");
                instr.offset = offset + 1;
                instr.length = instr.count - 1;
                offset += instr.count;
                if (offset > spirv.length)
                    throw new Error("SPIR-V instruction goes out of bounds.");
                instructions.push(instr);
            }
            instructions.forEach(function (i) { return _this.parseInstruction(i); });
            this.forward_pointer_fixups.forEach(function (fixup) {
                var target = _this.get(SPIRType, fixup.first);
                var source = _this.get(SPIRType, fixup.second);
                target.member_types = source.member_types;
                target.basetype = source.basetype;
                target.self = source.self;
            });
            this.forward_pointer_fixups = [];
            if (this.current_function)
                throw new Error("Function was not terminated.");
            if (this.current_block)
                throw new Error("Block was not terminated.");
            if (this.ir.default_entry_point === 0)
                throw new Error("There is no entry point in the SPIR-V module.");
        };
        Parser.prototype.parseInstruction = function (instruction) {
            var ops = this.stream(instruction);
            var op = instruction.op;
            var ir = this.ir;
            var length = instruction.length;
            switch (op) {
                case Op.OpSourceContinued:
                case Op.OpSourceExtension:
                case Op.OpNop:
                case Op.OpModuleProcessed:
                    break;
                case Op.OpString: {
                    this.set(SPIRString, ops[0], extract_string(ir.spirv, instruction.offset + 1));
                    break;
                }
                case Op.OpMemoryModel:
                    ir.addressing_model = ops[0];
                    ir.memory_model = ops[1];
                    break;
                case Op.OpSource: {
                    var lang = ops[0];
                    switch (lang) {
                        case SourceLanguage.SourceLanguageESSL:
                            ir.source.es = true;
                            ir.source.version = ops[1];
                            ir.source.known = true;
                            ir.source.hlsl = false;
                            break;
                        case SourceLanguage.SourceLanguageGLSL:
                            ir.source.es = false;
                            ir.source.version = ops[1];
                            ir.source.known = true;
                            ir.source.hlsl = false;
                            break;
                        case SourceLanguage.SourceLanguageHLSL:
                            // For purposes of cross-compiling, this is GLSL 450.
                            ir.source.es = false;
                            ir.source.version = 450;
                            ir.source.known = true;
                            ir.source.hlsl = true;
                            break;
                        default:
                            ir.source.known = false;
                            break;
                    }
                    break;
                }
                case Op.OpUndef: {
                    var result_type = ops[0];
                    var id = ops[1];
                    this.set(SPIRUndef, id, result_type);
                    if (this.current_block)
                        this.current_block.ops.push(instruction);
                    break;
                }
                case Op.OpCapability: {
                    var cap = ops[0];
                    if (cap === Capability.CapabilityKernel)
                        throw new Error("Kernel capability not supported.");
                    ir.declared_capabilities.push(ops[0]);
                    break;
                }
                case Op.OpExtension: {
                    var ext = extract_string(ir.spirv, instruction.offset);
                    ir.declared_extensions.push(ext);
                    break;
                }
                case Op.OpExtInstImport: {
                    var id = ops[0];
                    var ext = extract_string(ir.spirv, instruction.offset + 1);
                    if (ext === "GLSL.std.450")
                        this.set(SPIRExtension, id, SPIRExtensionExtension.GLSL);
                    else if (ext === "DebugInfo")
                        this.set(SPIRExtension, id, SPIRExtensionExtension.SPV_debug_info);
                    else if (ext === "SPV_AMD_shader_ballot")
                        this.set(SPIRExtension, id, SPIRExtensionExtension.SPV_AMD_shader_ballot);
                    else if (ext === "SPV_AMD_shader_explicit_vertex_parameter")
                        this.set(SPIRExtension, id, SPIRExtensionExtension.SPV_AMD_shader_explicit_vertex_parameter);
                    else if (ext === "SPV_AMD_shader_trinary_minmax")
                        this.set(SPIRExtension, id, SPIRExtensionExtension.SPV_AMD_shader_trinary_minmax);
                    else if (ext === "SPV_AMD_gcn_shader")
                        this.set(SPIRExtension, id, SPIRExtensionExtension.SPV_AMD_gcn_shader);
                    else
                        this.set(SPIRExtension, id, SPIRExtensionExtension.Unsupported);
                    // Other SPIR-V extensions which have ExtInstrs are currently not supported.
                    break;
                }
                case Op.OpExtInst: {
                    // The SPIR-V debug information extended instructions might come at global scope.
                    if (this.current_block)
                        this.current_block.ops.push(instruction);
                    break;
                }
                case Op.OpEntryPoint: {
                    var e = new SPIREntryPoint(ops[1], (ops[0]), extract_string(ir.spirv, instruction.offset + 2));
                    ir.entry_points[ops[1]] = e;
                    // Strings need nul-terminator and consume the whole word.
                    var strlen_words = (e.name.length + 1 + 3) >> 2;
                    for (var i = strlen_words + 2; i < instruction.length; i++)
                        e.interface_variables.push(ops[i]);
                    // Set the name of the entry point in case OpName is not provided later.
                    ir.set_name(ops[1], e.name);
                    // If we don't have an entry, make the first one our "default".
                    if (!ir.default_entry_point)
                        ir.default_entry_point = ops[1];
                    break;
                }
                case Op.OpExecutionMode: {
                    var execution = ir.entry_points[ops[0]];
                    var mode = (ops[1]);
                    execution.flags.set(mode);
                    switch (mode) {
                        case ExecutionMode.ExecutionModeInvocations:
                            execution.invocations = ops[2];
                            break;
                        case ExecutionMode.ExecutionModeLocalSize:
                            execution.workgroup_size.x = ops[2];
                            execution.workgroup_size.y = ops[3];
                            execution.workgroup_size.z = ops[4];
                            break;
                        case ExecutionMode.ExecutionModeOutputVertices:
                            execution.output_vertices = ops[2];
                            break;
                    }
                    break;
                }
                case Op.OpName: {
                    var id = ops[0];
                    ir.set_name(id, extract_string(ir.spirv, instruction.offset + 1));
                    break;
                }
                case Op.OpMemberName: {
                    var id = ops[0];
                    var member = ops[1];
                    ir.set_member_name(id, member, extract_string(ir.spirv, instruction.offset + 2));
                    break;
                }
                case Op.OpDecorationGroup: {
                    // Noop, this simply means an ID should be a collector of decorations.
                    // The meta array is already a flat array of decorations which will contain the relevant decorations.
                    break;
                }
                case Op.OpGroupDecorate: {
                    var group_id_1 = ops[0];
                    var decorations = ir.get_meta(group_id_1).decoration;
                    var flags = decorations.decoration_flags;
                    var _loop_1 = function (i) {
                        var target = ops[i];
                        flags.for_each_bit(function (bit) {
                            var decoration = bit;
                            if (decoration_is_string(decoration)) {
                                ir.set_decoration_string(target, decoration, ir.get_decoration_string(group_id_1, decoration));
                            }
                            else {
                                ir.get_meta(target).decoration_word_offset[decoration] =
                                    ir.get_meta(group_id_1).decoration_word_offset[decoration];
                                ir.set_decoration(target, decoration, ir.get_decoration(group_id_1, decoration));
                            }
                        });
                    };
                    // Copies decorations from one ID to another. Only copy decorations which are set in the group,
                    // i.e., we cannot just copy the meta structure directly.
                    for (var i = 1; i < length; i++) {
                        _loop_1(i);
                    }
                    break;
                }
                case Op.OpGroupMemberDecorate: {
                    var group_id_2 = ops[0];
                    var flags = ir.get_meta(group_id_2).decoration.decoration_flags;
                    var _loop_2 = function (i) {
                        var target = ops[i];
                        var index = ops[i + 1];
                        flags.for_each_bit(function (bit) {
                            var decoration = bit;
                            if (decoration_is_string(decoration))
                                ir.set_member_decoration_string(target, index, decoration, ir.get_decoration_string(group_id_2, decoration));
                            else
                                ir.set_member_decoration(target, index, decoration, ir.get_decoration(group_id_2, decoration));
                        });
                    };
                    // Copies decorations from one ID to another. Only copy decorations which are set in the group,
                    // i.e., we cannot just copy the meta structure directly.
                    for (var i = 1; i + 1 < length; i += 2) {
                        _loop_2(i);
                    }
                    break;
                }
                case Op.OpDecorate:
                case Op.OpDecorateId: {
                    // OpDecorateId technically supports an array of arguments, but our only supported decorations are single uint,
                    // so merge decorate and decorate-id here.
                    var id = ops[0];
                    var decoration = ops[1];
                    if (length >= 3) {
                        // uint32_t(&ops[2] - ir.spirv.data())
                        // this is just the offset of ops[2] into the spirv data array
                        ir.get_meta(id).decoration_word_offset[decoration] = instruction.offset + 2;
                        ir.set_decoration(id, decoration, ops[2]);
                    }
                    else
                        ir.set_decoration(id, decoration);
                    break;
                }
                case Op.OpDecorateStringGOOGLE: {
                    var id = ops[0];
                    var decoration = ops[1];
                    ir.set_decoration_string(id, decoration, extract_string(ir.spirv, instruction.offset + 2));
                    break;
                }
                case Op.OpMemberDecorate: {
                    var id = ops[0];
                    var member = ops[1];
                    var decoration = ops[2];
                    if (length >= 4)
                        ir.set_member_decoration(id, member, decoration, ops[3]);
                    else
                        ir.set_member_decoration(id, member, decoration);
                    break;
                }
                case Op.OpMemberDecorateStringGOOGLE: {
                    var id = ops[0];
                    var member = ops[1];
                    var decoration = ops[2];
                    ir.set_member_decoration_string(id, member, decoration, extract_string(ir.spirv, instruction.offset + 3));
                    break;
                }
                // Build up basic types.
                case Op.OpTypeVoid: {
                    var id = ops[0];
                    var type = this.set(SPIRType, id);
                    type.basetype = SPIRTypeBaseType.Void;
                    break;
                }
                case Op.OpTypeBool: {
                    var id = ops[0];
                    var type = this.set(SPIRType, id);
                    type.basetype = SPIRTypeBaseType.Boolean;
                    type.width = 1;
                    break;
                }
                case Op.OpTypeFloat: {
                    var id = ops[0];
                    var width = ops[1];
                    var type = this.set(SPIRType, id);
                    if (width === 64)
                        type.basetype = SPIRTypeBaseType.Double;
                    else if (width === 32)
                        type.basetype = SPIRTypeBaseType.Float;
                    else if (width === 16)
                        type.basetype = SPIRTypeBaseType.Half;
                    else
                        throw new Error("Unrecognized bit-width of floating point type.");
                    type.width = width;
                    break;
                }
                case Op.OpTypeInt: {
                    var id = ops[0];
                    var width = ops[1];
                    var signedness = ops[2] !== 0;
                    var type = this.set(SPIRType, id);
                    type.basetype = signedness ? to_signed_basetype(width) : to_unsigned_basetype(width);
                    type.width = width;
                    break;
                }
                // Build composite types by "inheriting".
                // NOTE: The self member is also copied! For pointers and array modifiers this is a good thing
                // since we can refer to decorations on pointee classes which is needed for UBO/SSBO, I/O blocks in geometry/tess etc.
                case Op.OpTypeVector: {
                    var id = ops[0];
                    var vecsize = ops[2];
                    var base = this.get(SPIRType, ops[1]);
                    var vecbase = this.set(SPIRType, id);
                    defaultCopy(base, vecbase);
                    vecbase.vecsize = vecsize;
                    vecbase.self = id;
                    vecbase.parent_type = ops[1];
                    break;
                }
                case Op.OpTypeMatrix: {
                    var id = ops[0];
                    var colcount = ops[2];
                    var base = this.get(SPIRType, ops[1]);
                    var matrixbase = this.set(SPIRType, id);
                    defaultCopy(base, matrixbase);
                    matrixbase.columns = colcount;
                    matrixbase.self = id;
                    matrixbase.parent_type = ops[1];
                    break;
                }
                case Op.OpTypeArray: {
                    var id = ops[0];
                    var arraybase = this.set(SPIRType, id);
                    var tid = ops[1];
                    var base = this.get(SPIRType, tid);
                    defaultCopy(base, arraybase);
                    arraybase.parent_type = tid;
                    var cid = ops[2];
                    ir.mark_used_as_array_length(cid);
                    var c = this.maybe_get(SPIRConstant, cid);
                    var literal = c && !c.specialization;
                    // We're copying type information into Array types, so we'll need a fixup for any physical pointer
                    // references.
                    if (base.forward_pointer)
                        this.forward_pointer_fixups.push(new Pair(id, tid));
                    arraybase.array_size_literal.push(literal);
                    arraybase.array.push(literal ? c.scalar() : cid);
                    // Do NOT set arraybase.self!
                    break;
                }
                case Op.OpTypeRuntimeArray: {
                    var id = ops[0];
                    var base = this.get(SPIRType, ops[1]);
                    var arraybase = this.set(SPIRType, id);
                    // We're copying type information into Array types, so we'll need a fixup for any physical pointer
                    // references.
                    if (base.forward_pointer)
                        this.forward_pointer_fixups.push(new Pair(id, ops[1]));
                    defaultCopy(base, arraybase);
                    arraybase.array.push(0);
                    arraybase.array_size_literal.push(true);
                    arraybase.parent_type = ops[1];
                    // Do NOT set arraybase.self!
                    break;
                }
                case Op.OpTypeImage: {
                    var id = ops[0];
                    var type = this.set(SPIRType, id);
                    type.basetype = SPIRTypeBaseType.Image;
                    type.image.type = ops[1];
                    type.image.dim = (ops[2]);
                    type.image.depth = ops[3] === 1;
                    type.image.arrayed = ops[4] !== 0;
                    type.image.ms = ops[5] !== 0;
                    type.image.sampled = ops[6];
                    type.image.format = (ops[7]);
                    type.image.access = (length >= 9) ? (ops[8]) : AccessQualifier.AccessQualifierMax;
                    break;
                }
                case Op.OpTypeSampledImage: {
                    var id = ops[0];
                    var imagetype = ops[1];
                    var type = this.set(SPIRType, id);
                    defaultCopy(this.get(SPIRType, imagetype), type);
                    type.basetype = SPIRTypeBaseType.SampledImage;
                    type.self = id;
                    break;
                }
                case Op.OpTypeSampler: {
                    var id = ops[0];
                    var type = this.set(SPIRType, id);
                    type.basetype = SPIRTypeBaseType.Sampler;
                    break;
                }
                case Op.OpTypePointer: {
                    var id = ops[0];
                    // Very rarely, we might receive a FunctionPrototype here.
                    // We won't be able to compile it, but we shouldn't crash when parsing.
                    // We should be able to reflect.
                    var base = this.maybe_get(SPIRType, ops[2]);
                    var ptrbase = this.set(SPIRType, id);
                    if (base)
                        defaultCopy(base, ptrbase);
                    ptrbase.pointer = true;
                    ptrbase.pointer_depth++;
                    ptrbase.storage = (ops[1]);
                    if (ptrbase.storage === StorageClass.StorageClassAtomicCounter)
                        ptrbase.basetype = SPIRTypeBaseType.AtomicCounter;
                    if (base && base.forward_pointer)
                        this.forward_pointer_fixups.push(new Pair(id, ops[2]));
                    ptrbase.parent_type = ops[2];
                    // Do NOT set ptrbase.self!
                    break;
                }
                case Op.OpTypeForwardPointer: {
                    var id = ops[0];
                    var ptrbase = this.set(SPIRType, id);
                    ptrbase.pointer = true;
                    ptrbase.pointer_depth++;
                    ptrbase.storage = (ops[1]);
                    ptrbase.forward_pointer = true;
                    if (ptrbase.storage === StorageClass.StorageClassAtomicCounter)
                        ptrbase.basetype = SPIRTypeBaseType.AtomicCounter;
                    break;
                }
                case Op.OpTypeStruct: {
                    var id = ops[0];
                    var type = this.set(SPIRType, id);
                    type.basetype = SPIRTypeBaseType.Struct;
                    for (var i = 1; i < length; i++)
                        type.member_types.push(ops[i]);
                    // Check if we have seen this struct type before, with just different
                    // decorations.
                    //
                    // Add workaround for issue #17 as well by looking at OpName for the struct
                    // types, which we shouldn't normally do.
                    // We should not normally have to consider type aliases like this to begin with
                    // however ... glslang issues #304, #307 cover this.
                    // For stripped names, never consider struct type aliasing.
                    // We risk declaring the same struct multiple times, but type-punning is not allowed
                    // so this is safe.
                    var consider_aliasing = ir.get_name(type.self).length === 0;
                    if (consider_aliasing) {
                        for (var _i = 0, _a = this.global_struct_cache; _i < _a.length; _i++) {
                            var other = _a[_i];
                            if (ir.get_name(type.self) === ir.get_name(other) &&
                                this.types_are_logically_equivalent(type, this.get(SPIRType, other))) {
                                type.type_alias = other;
                                break;
                            }
                        }
                        if (type.type_alias === 0)
                            this.global_struct_cache.push(id);
                    }
                    break;
                }
                case Op.OpTypeFunction:
                    {
                        var id = ops[0];
                        var ret = ops[1];
                        var func = this.set(SPIRFunctionPrototype, id, ret);
                        for (var i = 2; i < length; i++)
                            func.parameter_types.push(ops[i]);
                        break;
                    }
                case Op.OpTypeAccelerationStructureKHR:
                    {
                        var id = ops[0];
                        var type = this.set(SPIRType, id);
                        type.basetype = SPIRTypeBaseType.AccelerationStructure;
                        break;
                    }
                case Op.OpTypeRayQueryKHR:
                    {
                        var id = ops[0];
                        var type = this.set(SPIRType, id);
                        type.basetype = SPIRTypeBaseType.RayQuery;
                        break;
                    }
                // Variable declaration
                // All variables are essentially pointers with a storage qualifier.
                case Op.OpVariable:
                    {
                        var type = ops[0];
                        var id = ops[1];
                        var storage = (ops[2]);
                        var initializer = length === 4 ? ops[3] : 0;
                        if (storage === StorageClass.StorageClassFunction) {
                            if (!this.current_function)
                                throw new Error("No function currently in scope");
                            this.current_function.add_local_variable(id);
                        }
                        this.set(SPIRVariable, id, type, storage, initializer);
                        break;
                    }
                // OpPhi
                // OpPhi is a fairly magical opcode.
                // It selects temporary variables based on which parent block we *came from*.
                // In high-level languages we can "de-SSA" by creating a function local, and flush out temporaries to this function-local
                // variable to emulate SSA Phi.
                case Op.OpPhi:
                    {
                        if (!this.current_function)
                            throw new Error("No function currently in scope");
                        if (!this.current_block)
                            throw new Error("No block currently in scope");
                        var result_type = ops[0];
                        var id = ops[1];
                        // Instead of a temporary, create a new function-wide temporary with this ID instead.
                        var var_ = this.set(SPIRVariable, id, result_type, StorageClass.StorageClassFunction);
                        var_.phi_variable = true;
                        this.current_function.add_local_variable(id);
                        for (var i = 2; i + 2 <= length; i += 2)
                            this.current_block.phi_variables.push(new SPIRBlockPhi(ops[i], ops[i + 1], id));
                        break;
                    }
                // Constants
                case Op.OpSpecConstant:
                case Op.OpConstant:
                    {
                        var id = ops[1];
                        var type = this.get(SPIRType, ops[0]);
                        if (type.width > 32) {
                            this.set(SPIRConstant, id, ops[0], bigintFrom(ops[3], ops[2]), op === Op.OpSpecConstant);
                        }
                        else
                            this.set(SPIRConstant, id, ops[0], ops[2], op === Op.OpSpecConstant);
                        break;
                    }
                case Op.OpSpecConstantFalse:
                case Op.OpConstantFalse:
                    {
                        this.set(SPIRConstant, ops[1], ops[0], 0, op === Op.OpSpecConstantFalse);
                        break;
                    }
                case Op.OpSpecConstantTrue:
                case Op.OpConstantTrue:
                    {
                        this.set(SPIRConstant, ops[1], ops[0], 1, op === Op.OpSpecConstantTrue);
                        break;
                    }
                case Op.OpConstantNull:
                    {
                        ir.make_constant_null(ops[1], ops[0], true);
                        break;
                    }
                case Op.OpSpecConstantComposite:
                case Op.OpConstantComposite:
                    {
                        var id = ops[1];
                        var type = ops[0];
                        var ctype = this.get(SPIRType, type);
                        // We can have constants which are structs and arrays.
                        // In this case, our SPIRConstant will be a list of other SPIRConstant ids which we
                        // can refer to.
                        if (ctype.basetype === SPIRTypeBaseType.Struct || ctype.array.length !== 0) {
                            var elements = ops.slice(2);
                            this.set(SPIRConstant, id, type, elements, length - 2, op === Op.OpSpecConstantComposite);
                        }
                        else {
                            var elements = length - 2;
                            if (elements > 4)
                                throw new Error("OpConstantComposite only supports 1, 2, 3 and 4 elements.");
                            var remapped_constant_ops = createWith(4, function () { return new SPIRConstant(); });
                            var c = new Array(4);
                            for (var i = 0; i < elements; i++) {
                                // Specialization constants operations can also be part of this.
                                // We do not know their value, so any attempt to query SPIRConstant later
                                // will fail. We can only propagate the ID of the expression and use to_expression on it.
                                var constant_op = this.maybe_get(SPIRConstantOp, ops[2 + i]);
                                var undef_op = this.maybe_get(SPIRUndef, ops[2 + i]);
                                if (constant_op) {
                                    if (op === Op.OpConstantComposite)
                                        throw new Error("Specialization constant operation used in OpConstantComposite.");
                                    remapped_constant_ops[i].make_null(this.get(SPIRType, constant_op.basetype));
                                    remapped_constant_ops[i].self = constant_op.self;
                                    remapped_constant_ops[i].constant_type = constant_op.basetype;
                                    remapped_constant_ops[i].specialization = true;
                                    c[i] = remapped_constant_ops[i];
                                }
                                else if (undef_op) {
                                    // Undefined, just pick 0.
                                    remapped_constant_ops[i].make_null(this.get(SPIRType, undef_op.basetype));
                                    remapped_constant_ops[i].constant_type = undef_op.basetype;
                                    c[i] = remapped_constant_ops[i];
                                }
                                else
                                    c[i] = this.get(SPIRConstant, ops[2 + i]);
                            }
                            this.set(SPIRConstant, id, type, c, elements, op === Op.OpSpecConstantComposite);
                        }
                        break;
                    }
                // Functions
                case Op.OpFunction:
                    {
                        var res = ops[0];
                        var id = ops[1];
                        // Control
                        var type = ops[3];
                        if (this.current_function)
                            throw new Error("Must end a function before starting a new one!");
                        this.current_function = this.set(SPIRFunction, id, res, type);
                        break;
                    }
                case Op.OpFunctionParameter:
                    {
                        var type = ops[0];
                        var id = ops[1];
                        if (!this.current_function)
                            throw new Error("Must be in a function!");
                        this.current_function.add_parameter(type, id);
                        this.set(SPIRVariable, id, type, StorageClass.StorageClassFunction);
                        break;
                    }
                case Op.OpFunctionEnd:
                    {
                        if (this.current_block) {
                            // Very specific error message, but seems to come up quite often.
                            throw new Error("Cannot end a function before ending the current block.\n" +
                                "Likely cause: If this SPIR-V was created from glslang HLSL, make sure the entry point is valid.");
                        }
                        this.current_function = null;
                        break;
                    }
                // Blocks
                case Op.OpLabel:
                    {
                        // OpLabel always starts a block.
                        if (!this.current_function)
                            throw new Error("Blocks cannot exist outside functions!");
                        var id = ops[0];
                        this.current_function.blocks.push(id);
                        if (!this.current_function.entry_block)
                            this.current_function.entry_block = id;
                        if (this.current_block)
                            throw new Error("Cannot start a block before ending the current block.");
                        this.current_block = this.set(SPIRBlock, id);
                        break;
                    }
                // Branch instructions end blocks.
                case Op.OpBranch:
                    {
                        if (!this.current_block)
                            throw new Error("Trying to end a non-existing block.");
                        var target = ops[0];
                        var current_block = this.current_block;
                        current_block.terminator = SPIRBlockTerminator.Direct;
                        current_block.next_block = target;
                        this.current_block = null;
                        break;
                    }
                case Op.OpBranchConditional:
                    {
                        if (!this.current_block)
                            throw new Error("Trying to end a non-existing block.");
                        var current_block = this.current_block;
                        current_block.condition = ops[0];
                        current_block.true_block = ops[1];
                        current_block.false_block = ops[2];
                        current_block.terminator = SPIRBlockTerminator.Select;
                        if (current_block.true_block === current_block.false_block) {
                            // Bogus conditional, translate to a direct branch.
                            // Avoids some ugly edge cases later when analyzing CFGs.
                            // There are some super jank cases where the merge block is different from the true/false,
                            // and later branches can "break" out of the selection construct this way.
                            // This is complete nonsense, but CTS hits this case.
                            // In this scenario, we should see the selection construct as more of a Switch with one default case.
                            // The problem here is that this breaks any attempt to break out of outer switch statements,
                            // but it's theoretically solvable if this ever comes up using the ladder breaking system ...
                            if (current_block.true_block !== current_block.next_block && current_block.merge === SPIRBlockMerge.MergeSelection) {
                                var ids = ir.increase_bound_by(2);
                                var type = new SPIRType();
                                type.basetype = SPIRTypeBaseType.Int;
                                type.width = 32;
                                this.set(SPIRType, ids, type);
                                var c = this.set(SPIRConstant, ids + 1, ids);
                                current_block.condition = c.self;
                                current_block.default_block = current_block.true_block;
                                current_block.terminator = SPIRBlockTerminator.MultiSelect;
                                ir.block_meta[current_block.next_block] &= ~BlockMetaFlagBits.BLOCK_META_SELECTION_MERGE_BIT;
                                ir.block_meta[current_block.next_block] |= BlockMetaFlagBits.BLOCK_META_MULTISELECT_MERGE_BIT;
                            }
                            else {
                                ir.block_meta[current_block.next_block] &= ~BlockMetaFlagBits.BLOCK_META_SELECTION_MERGE_BIT;
                                current_block.next_block = current_block.true_block;
                                current_block.condition = 0;
                                current_block.true_block = 0;
                                current_block.false_block = 0;
                                current_block.merge_block = 0;
                                current_block.merge = SPIRBlockMerge.MergeNone;
                                current_block.terminator = SPIRBlockTerminator.Direct;
                            }
                        }
                        this.current_block = null;
                        break;
                    }
                case Op.OpSwitch:
                    {
                        var current_block = this.current_block;
                        if (!current_block)
                            throw new Error("Trying to end a non-existing block.");
                        current_block.terminator = SPIRBlockTerminator.MultiSelect;
                        current_block.condition = ops[0];
                        current_block.default_block = ops[1];
                        var remaining_ops = length - 2;
                        if ((remaining_ops % 2) === 0) {
                            for (var i = 2; i + 2 <= length; i += 2)
                                current_block.cases_32bit.push(new SPIRBlockCase(BigInt(ops[i]), ops[i + 1]));
                        }
                        if ((remaining_ops % 3) === 0) {
                            for (var i = 2; i + 3 <= length; i += 3) {
                                current_block.cases_64bit.push(new SPIRBlockCase(bigintFrom(ops[i + 1], ops[i]), ops[i + 2]));
                            }
                        }
                        // If we jump to next block, make it break instead since we're inside a switch case block at that point.
                        ir.block_meta[current_block.next_block] |= BlockMetaFlagBits.BLOCK_META_MULTISELECT_MERGE_BIT;
                        this.current_block = null;
                        break;
                    }
                case Op.OpKill:
                    {
                        if (!this.current_block)
                            throw new Error("Trying to end a non-existing block.");
                        this.current_block.terminator = SPIRBlockTerminator.Kill;
                        this.current_block = null;
                        break;
                    }
                case Op.OpTerminateRayKHR:
                    // NV variant is not a terminator.
                    if (!this.current_block)
                        throw new Error("Trying to end a non-existing block.");
                    this.current_block.terminator = SPIRBlockTerminator.TerminateRay;
                    this.current_block = null;
                    break;
                case Op.OpIgnoreIntersectionKHR:
                    // NV variant is not a terminator.
                    if (!this.current_block)
                        throw new Error("Trying to end a non-existing block.");
                    this.current_block.terminator = SPIRBlockTerminator.IgnoreIntersection;
                    this.current_block = null;
                    break;
                case Op.OpReturn:
                    {
                        if (!this.current_block)
                            throw new Error("Trying to end a non-existing block.");
                        this.current_block.terminator = SPIRBlockTerminator.Return;
                        this.current_block = null;
                        break;
                    }
                case Op.OpReturnValue:
                    {
                        var current_block = this.current_block;
                        if (!current_block)
                            throw new Error("Trying to end a non-existing block.");
                        current_block.terminator = SPIRBlockTerminator.Return;
                        current_block.return_value = ops[0];
                        this.current_block = null;
                        break;
                    }
                case Op.OpUnreachable:
                    {
                        if (!this.current_block)
                            throw new Error("Trying to end a non-existing block.");
                        this.current_block.terminator = SPIRBlockTerminator.Unreachable;
                        this.current_block = null;
                        break;
                    }
                case Op.OpSelectionMerge:
                    {
                        var current_block = this.current_block;
                        if (!current_block)
                            throw new Error("Trying to modify a non-existing block.");
                        current_block.next_block = ops[0];
                        current_block.merge = SPIRBlockMerge.MergeSelection;
                        ir.block_meta[current_block.next_block] |= BlockMetaFlagBits.BLOCK_META_SELECTION_MERGE_BIT;
                        if (length >= 2) {
                            if (ops[1] & SelectionControlMask.SelectionControlFlattenMask)
                                current_block.hint = SPIRBlockHints.HintFlatten;
                            else if (ops[1] & SelectionControlMask.SelectionControlDontFlattenMask)
                                current_block.hint = SPIRBlockHints.HintDontFlatten;
                        }
                        break;
                    }
                case Op.OpLoopMerge:
                    {
                        var current_block = this.current_block;
                        if (!current_block)
                            throw new Error("Trying to modify a non-existing block.");
                        current_block.merge_block = ops[0];
                        current_block.continue_block = ops[1];
                        current_block.merge = SPIRBlockMerge.MergeLoop;
                        ir.block_meta[current_block.self] |= BlockMetaFlagBits.BLOCK_META_LOOP_HEADER_BIT;
                        ir.block_meta[current_block.merge_block] |= BlockMetaFlagBits.BLOCK_META_LOOP_MERGE_BIT;
                        ir.continue_block_to_loop_header[current_block.continue_block] = current_block.self;
                        // Don't add loop headers to continue blocks,
                        // which would make it impossible branch into the loop header since
                        // they are treated as continues.
                        if (current_block.continue_block !== current_block.self)
                            ir.block_meta[current_block.continue_block] |= BlockMetaFlagBits.BLOCK_META_CONTINUE_BIT;
                        if (length >= 3) {
                            if (ops[2] & LoopControlMask.LoopControlUnrollMask)
                                current_block.hint = SPIRBlockHints.HintUnroll;
                            else if (ops[2] & LoopControlMask.LoopControlDontUnrollMask)
                                current_block.hint = SPIRBlockHints.HintDontUnroll;
                        }
                        break;
                    }
                case Op.OpSpecConstantOp:
                    {
                        if (length < 3)
                            throw new Error("OpSpecConstantOp not enough arguments.");
                        var result_type = ops[0];
                        var id = ops[1];
                        var spec_op = (ops[2]);
                        this.set(SPIRConstantOp, id, result_type, spec_op, ops.slice(3));
                        break;
                    }
                case Op.OpLine:
                    {
                        var current_block = this.current_block;
                        // OpLine might come at global scope, but we don't care about those since they will not be declared in any
                        // meaningful correct order.
                        // Ignore all OpLine directives which live outside a function.
                        if (current_block)
                            current_block.ops.push(instruction);
                        // Line directives may arrive before first OpLabel.
                        // Treat this as the line of the function declaration,
                        // so warnings for arguments can propagate properly.
                        var current_function = this.current_function;
                        if (current_function) {
                            // Store the first one we find and emit it before creating the function prototype.
                            if (current_function.entry_line.file_id === 0) {
                                current_function.entry_line.file_id = ops[0];
                                current_function.entry_line.line_literal = ops[1];
                            }
                        }
                        break;
                    }
                case Op.OpNoLine:
                    {
                        // OpNoLine might come at global scope.
                        if (this.current_block)
                            this.current_block.ops.push(instruction);
                        break;
                    }
                // Actual opcodes.
                default:
                    if (length >= 2) {
                        var type = this.maybe_get(SPIRType, ops[0]);
                        if (type) {
                            ir.load_type_width[ops[1]] = type.width;
                        }
                    }
                    if (!this.current_block)
                        throw new Error("Currently no block to insert opcode.");
                    this.current_block.ops.push(instruction);
                    break;
            }
        };
        Parser.prototype.stream = function (instr) {
            if (instr.length === 0)
                return null;
            if (instr.offset + instr.length > this.ir.spirv.length)
                throw new Error("Compiler::stream() out of range.");
            return this.ir.spirv.slice(instr.offset, instr.offset + instr.length);
        };
        Parser.prototype.set = function (classRef, id) {
            var args = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                args[_i - 2] = arguments[_i];
            }
            this.ir.add_typed_id(classRef.type, id);
            var v = variant_set.apply(void 0, __spreadArray([classRef, this.ir.ids[id]], args, false));
            v.self = id;
            return v;
        };
        Parser.prototype.get = function (classRef, id) {
            return variant_get(classRef, this.ir.ids[id]);
        };
        Parser.prototype.maybe_get = function (classRef, id) {
            if (this.ir.ids[id].get_type() === classRef.type)
                return this.get(classRef, id);
            else
                return null;
        };
        Parser.prototype.types_are_logically_equivalent = function (a, b) {
            if (a.basetype !== b.basetype)
                return false;
            if (a.width !== b.width)
                return false;
            if (a.vecsize !== b.vecsize)
                return false;
            if (a.columns !== b.columns)
                return false;
            if (!equals(a.array, b.array))
                return false;
            if (a.basetype === SPIRTypeBaseType.Image || a.basetype === SPIRTypeBaseType.SampledImage) {
                if (!a.image.equals(b.image))
                    return false;
            }
            if (!equals(a.member_types, b.member_types))
                return false;
            var member_types = a.member_types.length;
            for (var i = 0; i < member_types; i++) {
                if (!this.types_are_logically_equivalent(this.get(SPIRType, a.member_types[i]), this.get(SPIRType, b.member_types[i])))
                    return false;
            }
            return true;
        };
        return Parser;
    }());
    function swap_endian(v) {
        return ((v >> 24) & 0x000000ff) | ((v >> 8) & 0x0000ff00) | ((v << 8) & 0x00ff0000) | ((v << 24) & 0xff000000);
    }
    function is_valid_spirv_version(version) {
        switch (version) {
            // Allow v99 since it tends to just work.
            case 99:
            case 0x10000: // SPIR-V 1.0
            case 0x10100: // SPIR-V 1.1
            case 0x10200: // SPIR-V 1.2
            case 0x10300: // SPIR-V 1.3
            case 0x10400: // SPIR-V 1.4
            case 0x10500: // SPIR-V 1.5
                return true;
            default:
                return false;
        }
    }
    function extract_string(spirv, offset) {
        var ret = "";
        for (var i = offset; i < spirv.length; i++) {
            var w = spirv[i];
            for (var j = 0; j < 4; j++, w >>= 8) {
                var c = w & 0xff;
                if (c === 0)
                    return ret;
                ret = ret + String.fromCharCode(c);
            }
        }
        throw new Error("String was not terminated before EOF");
    }
    function decoration_is_string(decoration) {
        switch (decoration) {
            case Decoration.DecorationHlslSemanticGOOGLE:
                return true;
            default:
                return false;
        }
    }
    function to_signed_basetype(width) {
        switch (width) {
            case 8:
                return SPIRTypeBaseType.SByte;
            case 16:
                return SPIRTypeBaseType.Short;
            case 32:
                return SPIRTypeBaseType.Int;
            case 64:
                return SPIRTypeBaseType.Int64;
            default:
                throw new Error("Invalid bit width.");
        }
    }
    function to_unsigned_basetype(width) {
        switch (width) {
            case 8:
                return SPIRTypeBaseType.UByte;
            case 16:
                return SPIRTypeBaseType.UShort;
            case 32:
                return SPIRTypeBaseType.UInt;
            case 64:
                return SPIRTypeBaseType.UInt64;
            default:
                throw new Error("Invalid bit width.");
        }
    }

    var EntryPoint = /** @class */ (function () {
        function EntryPoint(name, model) {
            this.name = name;
            this.execution_model = model;
        }
        return EntryPoint;
    }());

    var OpcodeHandler = /** @class */ (function () {
        function OpcodeHandler() {
        }
        OpcodeHandler.prototype.handle_terminator = function (_) {
            return true;
        };
        OpcodeHandler.prototype.follow_function_call = function (_) {
            return true;
        };
        OpcodeHandler.prototype.set_current_block = function (_) {
        };
        // Called after returning from a function or when entering a block,
        // can be called multiple times per block,
        // while set_current_block is only called on block entry.
        OpcodeHandler.prototype.rearm_current_block = function (_) {
        };
        OpcodeHandler.prototype.begin_function_scope = function (_, __) {
            return true;
        };
        OpcodeHandler.prototype.end_function_scope = function (_, __) {
            return true;
        };
        return OpcodeHandler;
    }());

    var DummySamplerForCombinedImageHandler = /** @class */ (function (_super) {
        __extends(DummySamplerForCombinedImageHandler, _super);
        function DummySamplerForCombinedImageHandler(compiler) {
            var _this = _super.call(this) || this;
            _this.need_dummy_sampler = false;
            _this.compiler = compiler;
            return _this;
        }
        DummySamplerForCombinedImageHandler.prototype.handle = function (opcode, args, length) {
            if (this.need_dummy_sampler) {
                // No need to traverse further, we know the result.
                return false;
            }
            var compiler = this.compiler;
            switch (opcode) {
                case Op.OpLoad:
                    {
                        if (length < 3)
                            return false;
                        var result_type = args[0];
                        var type = compiler.get(SPIRType, result_type);
                        var separate_image = type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1 && type.image.dim !== Dim.DimBuffer;
                        // If not separate image, don't bother.
                        if (!separate_image)
                            return true;
                        var id = args[1];
                        var ptr = args[2];
                        compiler.set(SPIRExpression, id, "", result_type, true);
                        compiler.register_read(id, ptr, true);
                        break;
                    }
                case Op.OpImageFetch:
                case Op.OpImageQuerySizeLod:
                case Op.OpImageQuerySize:
                case Op.OpImageQueryLevels:
                case Op.OpImageQuerySamples:
                    {
                        // If we are fetching or querying LOD from a plain OpTypeImage, we must pre-combine with our dummy sampler.
                        var var_ = compiler.maybe_get_backing_variable(args[2]);
                        if (var_) {
                            var type = compiler.get(SPIRType, var_.basetype);
                            if (type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1 && type.image.dim !== Dim.DimBuffer)
                                this.need_dummy_sampler = true;
                        }
                        break;
                    }
                case Op.OpInBoundsAccessChain:
                case Op.OpAccessChain:
                case Op.OpPtrAccessChain:
                    {
                        if (length < 3)
                            return false;
                        var result_type = args[0];
                        var type = compiler.get(SPIRType, result_type);
                        var separate_image = type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1 && type.image.dim !== Dim.DimBuffer;
                        if (!separate_image)
                            return true;
                        var id = args[1];
                        var ptr = args[2];
                        compiler.set(SPIRExpression, id, "", result_type, true);
                        compiler.register_read(id, ptr, true);
                        // Other backends might use SPIRAccessChain for this later.
                        compiler.ir.ids[id].set_allow_type_rewrite();
                        break;
                    }
            }
            return true;
        };
        return DummySamplerForCombinedImageHandler;
    }(OpcodeHandler));

    var GLSLstd450;
    (function (GLSLstd450) {
        GLSLstd450[GLSLstd450["GLSLstd450Bad"] = 0] = "GLSLstd450Bad";
        GLSLstd450[GLSLstd450["GLSLstd450Round"] = 1] = "GLSLstd450Round";
        GLSLstd450[GLSLstd450["GLSLstd450RoundEven"] = 2] = "GLSLstd450RoundEven";
        GLSLstd450[GLSLstd450["GLSLstd450Trunc"] = 3] = "GLSLstd450Trunc";
        GLSLstd450[GLSLstd450["GLSLstd450FAbs"] = 4] = "GLSLstd450FAbs";
        GLSLstd450[GLSLstd450["GLSLstd450SAbs"] = 5] = "GLSLstd450SAbs";
        GLSLstd450[GLSLstd450["GLSLstd450FSign"] = 6] = "GLSLstd450FSign";
        GLSLstd450[GLSLstd450["GLSLstd450SSign"] = 7] = "GLSLstd450SSign";
        GLSLstd450[GLSLstd450["GLSLstd450Floor"] = 8] = "GLSLstd450Floor";
        GLSLstd450[GLSLstd450["GLSLstd450Ceil"] = 9] = "GLSLstd450Ceil";
        GLSLstd450[GLSLstd450["GLSLstd450Fract"] = 10] = "GLSLstd450Fract";
        GLSLstd450[GLSLstd450["GLSLstd450Radians"] = 11] = "GLSLstd450Radians";
        GLSLstd450[GLSLstd450["GLSLstd450Degrees"] = 12] = "GLSLstd450Degrees";
        GLSLstd450[GLSLstd450["GLSLstd450Sin"] = 13] = "GLSLstd450Sin";
        GLSLstd450[GLSLstd450["GLSLstd450Cos"] = 14] = "GLSLstd450Cos";
        GLSLstd450[GLSLstd450["GLSLstd450Tan"] = 15] = "GLSLstd450Tan";
        GLSLstd450[GLSLstd450["GLSLstd450Asin"] = 16] = "GLSLstd450Asin";
        GLSLstd450[GLSLstd450["GLSLstd450Acos"] = 17] = "GLSLstd450Acos";
        GLSLstd450[GLSLstd450["GLSLstd450Atan"] = 18] = "GLSLstd450Atan";
        GLSLstd450[GLSLstd450["GLSLstd450Sinh"] = 19] = "GLSLstd450Sinh";
        GLSLstd450[GLSLstd450["GLSLstd450Cosh"] = 20] = "GLSLstd450Cosh";
        GLSLstd450[GLSLstd450["GLSLstd450Tanh"] = 21] = "GLSLstd450Tanh";
        GLSLstd450[GLSLstd450["GLSLstd450Asinh"] = 22] = "GLSLstd450Asinh";
        GLSLstd450[GLSLstd450["GLSLstd450Acosh"] = 23] = "GLSLstd450Acosh";
        GLSLstd450[GLSLstd450["GLSLstd450Atanh"] = 24] = "GLSLstd450Atanh";
        GLSLstd450[GLSLstd450["GLSLstd450Atan2"] = 25] = "GLSLstd450Atan2";
        GLSLstd450[GLSLstd450["GLSLstd450Pow"] = 26] = "GLSLstd450Pow";
        GLSLstd450[GLSLstd450["GLSLstd450Exp"] = 27] = "GLSLstd450Exp";
        GLSLstd450[GLSLstd450["GLSLstd450Log"] = 28] = "GLSLstd450Log";
        GLSLstd450[GLSLstd450["GLSLstd450Exp2"] = 29] = "GLSLstd450Exp2";
        GLSLstd450[GLSLstd450["GLSLstd450Log2"] = 30] = "GLSLstd450Log2";
        GLSLstd450[GLSLstd450["GLSLstd450Sqrt"] = 31] = "GLSLstd450Sqrt";
        GLSLstd450[GLSLstd450["GLSLstd450InverseSqrt"] = 32] = "GLSLstd450InverseSqrt";
        GLSLstd450[GLSLstd450["GLSLstd450Determinant"] = 33] = "GLSLstd450Determinant";
        GLSLstd450[GLSLstd450["GLSLstd450MatrixInverse"] = 34] = "GLSLstd450MatrixInverse";
        GLSLstd450[GLSLstd450["GLSLstd450Modf"] = 35] = "GLSLstd450Modf";
        GLSLstd450[GLSLstd450["GLSLstd450ModfStruct"] = 36] = "GLSLstd450ModfStruct";
        GLSLstd450[GLSLstd450["GLSLstd450FMin"] = 37] = "GLSLstd450FMin";
        GLSLstd450[GLSLstd450["GLSLstd450UMin"] = 38] = "GLSLstd450UMin";
        GLSLstd450[GLSLstd450["GLSLstd450SMin"] = 39] = "GLSLstd450SMin";
        GLSLstd450[GLSLstd450["GLSLstd450FMax"] = 40] = "GLSLstd450FMax";
        GLSLstd450[GLSLstd450["GLSLstd450UMax"] = 41] = "GLSLstd450UMax";
        GLSLstd450[GLSLstd450["GLSLstd450SMax"] = 42] = "GLSLstd450SMax";
        GLSLstd450[GLSLstd450["GLSLstd450FClamp"] = 43] = "GLSLstd450FClamp";
        GLSLstd450[GLSLstd450["GLSLstd450UClamp"] = 44] = "GLSLstd450UClamp";
        GLSLstd450[GLSLstd450["GLSLstd450SClamp"] = 45] = "GLSLstd450SClamp";
        GLSLstd450[GLSLstd450["GLSLstd450FMix"] = 46] = "GLSLstd450FMix";
        GLSLstd450[GLSLstd450["GLSLstd450IMix"] = 47] = "GLSLstd450IMix";
        GLSLstd450[GLSLstd450["GLSLstd450Step"] = 48] = "GLSLstd450Step";
        GLSLstd450[GLSLstd450["GLSLstd450SmoothStep"] = 49] = "GLSLstd450SmoothStep";
        GLSLstd450[GLSLstd450["GLSLstd450Fma"] = 50] = "GLSLstd450Fma";
        GLSLstd450[GLSLstd450["GLSLstd450Frexp"] = 51] = "GLSLstd450Frexp";
        GLSLstd450[GLSLstd450["GLSLstd450FrexpStruct"] = 52] = "GLSLstd450FrexpStruct";
        GLSLstd450[GLSLstd450["GLSLstd450Ldexp"] = 53] = "GLSLstd450Ldexp";
        GLSLstd450[GLSLstd450["GLSLstd450PackSnorm4x8"] = 54] = "GLSLstd450PackSnorm4x8";
        GLSLstd450[GLSLstd450["GLSLstd450PackUnorm4x8"] = 55] = "GLSLstd450PackUnorm4x8";
        GLSLstd450[GLSLstd450["GLSLstd450PackSnorm2x16"] = 56] = "GLSLstd450PackSnorm2x16";
        GLSLstd450[GLSLstd450["GLSLstd450PackUnorm2x16"] = 57] = "GLSLstd450PackUnorm2x16";
        GLSLstd450[GLSLstd450["GLSLstd450PackHalf2x16"] = 58] = "GLSLstd450PackHalf2x16";
        GLSLstd450[GLSLstd450["GLSLstd450PackDouble2x32"] = 59] = "GLSLstd450PackDouble2x32";
        GLSLstd450[GLSLstd450["GLSLstd450UnpackSnorm2x16"] = 60] = "GLSLstd450UnpackSnorm2x16";
        GLSLstd450[GLSLstd450["GLSLstd450UnpackUnorm2x16"] = 61] = "GLSLstd450UnpackUnorm2x16";
        GLSLstd450[GLSLstd450["GLSLstd450UnpackHalf2x16"] = 62] = "GLSLstd450UnpackHalf2x16";
        GLSLstd450[GLSLstd450["GLSLstd450UnpackSnorm4x8"] = 63] = "GLSLstd450UnpackSnorm4x8";
        GLSLstd450[GLSLstd450["GLSLstd450UnpackUnorm4x8"] = 64] = "GLSLstd450UnpackUnorm4x8";
        GLSLstd450[GLSLstd450["GLSLstd450UnpackDouble2x32"] = 65] = "GLSLstd450UnpackDouble2x32";
        GLSLstd450[GLSLstd450["GLSLstd450Length"] = 66] = "GLSLstd450Length";
        GLSLstd450[GLSLstd450["GLSLstd450Distance"] = 67] = "GLSLstd450Distance";
        GLSLstd450[GLSLstd450["GLSLstd450Cross"] = 68] = "GLSLstd450Cross";
        GLSLstd450[GLSLstd450["GLSLstd450Normalize"] = 69] = "GLSLstd450Normalize";
        GLSLstd450[GLSLstd450["GLSLstd450FaceForward"] = 70] = "GLSLstd450FaceForward";
        GLSLstd450[GLSLstd450["GLSLstd450Reflect"] = 71] = "GLSLstd450Reflect";
        GLSLstd450[GLSLstd450["GLSLstd450Refract"] = 72] = "GLSLstd450Refract";
        GLSLstd450[GLSLstd450["GLSLstd450FindILsb"] = 73] = "GLSLstd450FindILsb";
        GLSLstd450[GLSLstd450["GLSLstd450FindSMsb"] = 74] = "GLSLstd450FindSMsb";
        GLSLstd450[GLSLstd450["GLSLstd450FindUMsb"] = 75] = "GLSLstd450FindUMsb";
        GLSLstd450[GLSLstd450["GLSLstd450InterpolateAtCentroid"] = 76] = "GLSLstd450InterpolateAtCentroid";
        GLSLstd450[GLSLstd450["GLSLstd450InterpolateAtSample"] = 77] = "GLSLstd450InterpolateAtSample";
        GLSLstd450[GLSLstd450["GLSLstd450InterpolateAtOffset"] = 78] = "GLSLstd450InterpolateAtOffset";
        GLSLstd450[GLSLstd450["GLSLstd450NMin"] = 79] = "GLSLstd450NMin";
        GLSLstd450[GLSLstd450["GLSLstd450NMax"] = 80] = "GLSLstd450NMax";
        GLSLstd450[GLSLstd450["GLSLstd450NClamp"] = 81] = "GLSLstd450NClamp";
        GLSLstd450[GLSLstd450["GLSLstd450Count"] = 82] = "GLSLstd450Count";
    })(GLSLstd450 || (GLSLstd450 = {}));
    var PlsFormat;
    (function (PlsFormat) {
        PlsFormat[PlsFormat["PlsNone"] = 0] = "PlsNone";
        PlsFormat[PlsFormat["PlsR11FG11FB10F"] = 1] = "PlsR11FG11FB10F";
        PlsFormat[PlsFormat["PlsR32F"] = 2] = "PlsR32F";
        PlsFormat[PlsFormat["PlsRG16F"] = 3] = "PlsRG16F";
        PlsFormat[PlsFormat["PlsRGB10A2"] = 4] = "PlsRGB10A2";
        PlsFormat[PlsFormat["PlsRGBA8"] = 5] = "PlsRGBA8";
        PlsFormat[PlsFormat["PlsRG16"] = 6] = "PlsRG16";
        PlsFormat[PlsFormat["PlsRGBA8I"] = 7] = "PlsRGBA8I";
        PlsFormat[PlsFormat["PlsRG16I"] = 8] = "PlsRG16I";
        PlsFormat[PlsFormat["PlsRGB10A2UI"] = 9] = "PlsRGB10A2UI";
        PlsFormat[PlsFormat["PlsRGBA8UI"] = 10] = "PlsRGBA8UI";
        PlsFormat[PlsFormat["PlsRG16UI"] = 11] = "PlsRG16UI";
        PlsFormat[PlsFormat["PlsR32UI"] = 12] = "PlsR32UI";
    })(PlsFormat || (PlsFormat = {}));
    // Can be overriden by subclass backends for trivial things which
    // shouldn't need polymorphism.
    var BackendVariations = /** @class */ (function () {
        function BackendVariations() {
            this.discard_literal = "discard";
            this.demote_literal = "demote";
            this.null_pointer_literal = "";
            this.float_literal_suffix = false;
            this.double_literal_suffix = true;
            this.uint32_t_literal_suffix = true;
            this.long_long_literal_suffix = false;
            this.basic_int_type = "int";
            this.basic_uint_type = "uint";
            this.basic_int8_type = "int8_t";
            this.basic_uint8_type = "uint8_t";
            this.basic_int16_type = "int16_t";
            this.basic_uint16_type = "uint16_t";
            this.int16_t_literal_suffix = "s";
            this.uint16_t_literal_suffix = "us";
            this.nonuniform_qualifier = "nonuniformEXT";
            this.boolean_mix_function = "mix";
            this.swizzle_is_function = false;
            this.shared_is_implied = false;
            this.unsized_array_supported = true;
            this.explicit_struct_type = false;
            this.use_initializer_list = false;
            this.use_typed_initializer_list = false;
            this.can_declare_struct_inline = true;
            this.can_declare_arrays_inline = true;
            this.native_row_major_matrix = true;
            this.use_constructor_splatting = true;
            this.allow_precision_qualifiers = false;
            this.can_swizzle_scalar = false;
            this.force_gl_in_out_block = false;
            this.can_return_array = true;
            this.allow_truncated_access_chain = false;
            this.supports_extensions = false;
            this.supports_empty_struct = false;
            this.array_is_value_type = true;
            this.buffer_offset_array_is_value_type = true;
            this.comparison_image_samples_scalar = false;
            this.native_pointers = false;
            this.support_small_type_sampling_result = false;
            this.support_case_fallthrough = true;
            this.use_array_constructor = false;
            this.needs_row_major_load_workaround = false;
            this.support_pointer_to_pointer = false;
            this.support_precise_qualifier = false;
            this.support_64bit_switch = false;
            this.workgroup_size_is_hidden = false;
        }
        return BackendVariations;
    }());

    var InterfaceVariableAccessHandler = /** @class */ (function (_super) {
        __extends(InterfaceVariableAccessHandler, _super);
        function InterfaceVariableAccessHandler(compiler, variables) {
            var _this = _super.call(this) || this;
            _this.compiler = compiler;
            _this.variables = variables;
            return _this;
        }
        InterfaceVariableAccessHandler.prototype.handle = function (opcode, args, length) {
            var compiler = this.compiler;
            var variables = this.variables;
            var variable = 0;
            var offset = 0;
            switch (opcode) {
                // Need this first, otherwise, GCC complains about unhandled switch statements.
                default:
                    break;
                case Op.OpFunctionCall:
                    {
                        // Invalid SPIR-V.
                        if (length < 3)
                            return false;
                        var count = length - 3;
                        offset += 3;
                        for (var i = 0; i < count; i++) {
                            var var_ = compiler.maybe_get(SPIRVariable, args[offset + i]);
                            if (var_ && storage_class_is_interface(var_.storage))
                                variables.add(args[offset + i]);
                        }
                        break;
                    }
                case Op.OpSelect:
                    {
                        // Invalid SPIR-V.
                        if (length < 5)
                            return false;
                        var count = length - 3;
                        offset += 3;
                        for (var i = 0; i < count; i++) {
                            var var_ = compiler.maybe_get(SPIRVariable, args[offset + i]);
                            if (var_ && storage_class_is_interface(var_.storage))
                                variables.add(args[offset + i]);
                        }
                        break;
                    }
                case Op.OpPhi:
                    {
                        // Invalid SPIR-V.
                        if (length < 2)
                            return false;
                        var count = length - 2;
                        offset += 2;
                        for (var i = 0; i < count; i += 2) {
                            var var_ = compiler.maybe_get(SPIRVariable, args[offset + i]);
                            if (var_ && storage_class_is_interface(var_.storage))
                                variables.add(args[offset + i]);
                        }
                        break;
                    }
                case Op.OpAtomicStore:
                case Op.OpStore:
                    // Invalid SPIR-V.
                    if (length < 1)
                        return false;
                    variable = args[offset];
                    break;
                case Op.OpCopyMemory:
                    {
                        if (length < 2)
                            return false;
                        var var_ = compiler.maybe_get(SPIRVariable, args[offset]);
                        if (var_ && storage_class_is_interface(var_.storage))
                            variables.add(args[offset]);
                        var_ = compiler.maybe_get(SPIRVariable, args[offset + 1]);
                        if (var_ && storage_class_is_interface(var_.storage))
                            variables.add(args[offset + 1]);
                        break;
                    }
                case Op.OpExtInst:
                    {
                        if (length < 5)
                            return false;
                        var extension_set = compiler.get(SPIRExtension, args[offset + 2]);
                        switch (extension_set.ext) {
                            case SPIRExtensionExtension.GLSL:
                                {
                                    var op = (args[offset + 3]);
                                    switch (op) {
                                        case GLSLstd450.GLSLstd450InterpolateAtCentroid:
                                        case GLSLstd450.GLSLstd450InterpolateAtSample:
                                        case GLSLstd450.GLSLstd450InterpolateAtOffset:
                                            {
                                                var var_ = compiler.maybe_get(SPIRVariable, args[offset + 4]);
                                                if (var_ && storage_class_is_interface(var_.storage))
                                                    variables.add(args[offset + 4]);
                                                break;
                                            }
                                        case GLSLstd450.GLSLstd450Modf:
                                        case GLSLstd450.GLSLstd450Fract:
                                            {
                                                var var_ = compiler.maybe_get(SPIRVariable, args[offset + 5]);
                                                if (var_ && storage_class_is_interface(var_.storage))
                                                    variables.add(args[offset + 5]);
                                                break;
                                            }
                                    }
                                    break;
                                }
                            case SPIRExtensionExtension.SPV_AMD_shader_explicit_vertex_parameter:
                                {
                                    var InterpolateAtVertexAMD = 1;
                                    var op = args[offset + 3];
                                    switch (op) {
                                        case InterpolateAtVertexAMD:
                                            {
                                                var var_ = compiler.maybe_get(SPIRVariable, args[offset + 4]);
                                                if (var_ && storage_class_is_interface(var_.storage))
                                                    variables.add(args[offset + 4]);
                                                break;
                                            }
                                    }
                                    break;
                                }
                        }
                        break;
                    }
                case Op.OpAccessChain:
                case Op.OpInBoundsAccessChain:
                case Op.OpPtrAccessChain:
                case Op.OpLoad:
                case Op.OpCopyObject:
                case Op.OpImageTexelPointer:
                case Op.OpAtomicLoad:
                case Op.OpAtomicExchange:
                case Op.OpAtomicCompareExchange:
                case Op.OpAtomicCompareExchangeWeak:
                case Op.OpAtomicIIncrement:
                case Op.OpAtomicIDecrement:
                case Op.OpAtomicIAdd:
                case Op.OpAtomicISub:
                case Op.OpAtomicSMin:
                case Op.OpAtomicUMin:
                case Op.OpAtomicSMax:
                case Op.OpAtomicUMax:
                case Op.OpAtomicAnd:
                case Op.OpAtomicOr:
                case Op.OpAtomicXor:
                case Op.OpArrayLength:
                    // Invalid SPIR-V.
                    if (length < 3)
                        return false;
                    variable = args[offset + 2];
                    break;
            }
            if (variable) {
                var var_ = compiler.maybe_get(SPIRVariable, variable);
                if (var_ && storage_class_is_interface(var_.storage))
                    variables.add(variable);
            }
            return true;
        };
        return InterfaceVariableAccessHandler;
    }(OpcodeHandler));
    function storage_class_is_interface(storage) {
        switch (storage) {
            case StorageClass.StorageClassInput:
            case StorageClass.StorageClassOutput:
            case StorageClass.StorageClassUniform:
            case StorageClass.StorageClassUniformConstant:
            case StorageClass.StorageClassAtomicCounter:
            case StorageClass.StorageClassPushConstant:
            case StorageClass.StorageClassStorageBuffer:
                return true;
            default:
                return false;
        }
    }

    var Resource = /** @class */ (function () {
        function Resource(id, type_id, base_type_id, name) {
            // The declared name (OpName) of the resource.
            // For Buffer blocks, the name actually reflects the externally
            // visible Block name.
            //
            // This name can be retrieved again by using either
            // get_name(id) or get_name(base_type_id) depending if it's a buffer block or not.
            //
            // This name can be an empty string in which case get_fallback_name(id) can be
            // used which obtains a suitable fallback identifier for an ID.
            this.name = "";
            this.id = id;
            this.type_id = type_id;
            this.base_type_id = base_type_id;
            this.name = name;
        }
        return Resource;
    }());
    var ShaderResources = /** @class */ (function () {
        function ShaderResources() {
            this.uniform_buffers = [];
            this.storage_buffers = [];
            this.stage_inputs = [];
            this.stage_outputs = [];
            this.subpass_inputs = [];
            this.storage_images = [];
            this.sampled_images = [];
            this.atomic_counters = [];
            this.acceleration_structures = [];
            // There can only be one push constant block,
            // but keep the vector in case this restriction is lifted in the future.
            this.push_constant_buffers = [];
            // For Vulkan GLSL and HLSL source,
            // these correspond to separate texture2D and samplers respectively.
            this.separate_images = [];
            this.separate_samplers = [];
            this.builtin_inputs = [];
            this.builtin_outputs = [];
        }
        return ShaderResources;
    }());

    var CombinedImageSampler = /** @class */ (function () {
        function CombinedImageSampler(combined_id, image_id, sampler_id) {
            this.combined_id = combined_id;
            this.image_id = image_id;
            this.sampler_id = sampler_id;
        }
        return CombinedImageSampler;
    }());

    var CombinedImageSamplerHandler = /** @class */ (function (_super) {
        __extends(CombinedImageSamplerHandler, _super);
        function CombinedImageSamplerHandler(compiler) {
            var _this = _super.call(this) || this;
            // Each function in the call stack needs its own remapping for parameters so we can deduce which global variable each texture/sampler the parameter is statically bound to.
            // this is a stack of a map (Sparse array)
            _this.parameter_remapping = [];
            _this.functions = [];
            _this.compiler = compiler;
            return _this;
        }
        CombinedImageSamplerHandler.prototype.handle = function (opcode, args, length) {
            var compiler = this.compiler;
            // We need to figure out where samplers and images are loaded from, so do only the bare bones compilation we need.
            var is_fetch = false;
            switch (opcode) {
                case Op.OpLoad: {
                    if (length < 3)
                        return false;
                    var result_type = args[0];
                    var type = compiler.get(SPIRType, result_type);
                    var separate_image = type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1;
                    var separate_sampler = type.basetype === SPIRTypeBaseType.Sampler;
                    // If not separate image or sampler, don't bother.
                    if (!separate_image && !separate_sampler)
                        return true;
                    var id = args[1];
                    var ptr = args[2];
                    compiler.set(SPIRExpression, id, "", result_type, true);
                    compiler.register_read(id, ptr, true);
                    return true;
                }
                case Op.OpInBoundsAccessChain:
                case Op.OpAccessChain:
                case Op.OpPtrAccessChain: {
                    if (length < 3)
                        return false;
                    // Technically, it is possible to have arrays of textures and arrays of samplers and combine them, but this becomes essentially
                    // impossible to implement, since we don't know which concrete sampler we are accessing.
                    // One potential way is to create a combinatorial explosion where N textures and M samplers are combined into N * M sampler2Ds,
                    // but this seems ridiculously complicated for a problem which is easy to work around.
                    // Checking access chains like this assumes we don't have samplers or textures inside uniform structs, but this makes no sense.
                    var result_type = args[0];
                    var type = compiler.get(SPIRType, result_type);
                    var separate_image = type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1;
                    var separate_sampler = type.basetype === SPIRTypeBaseType.Sampler;
                    if (separate_sampler)
                        throw new Error("Attempting to use arrays or structs of separate samplers. This is not possible" +
                            " to statically remap to plain GLSL.");
                    if (separate_image) {
                        var id = args[1];
                        var ptr = args[2];
                        compiler.set(SPIRExpression, id, "", result_type, true);
                        compiler.register_read(id, ptr, true);
                    }
                    return true;
                }
                case Op.OpImageFetch:
                case Op.OpImageQuerySizeLod:
                case Op.OpImageQuerySize:
                case Op.OpImageQueryLevels:
                case Op.OpImageQuerySamples: {
                    // If we are fetching from a plain OpTypeImage or querying LOD, we must pre-combine with our dummy sampler.
                    var var_ = compiler.maybe_get_backing_variable(args[2]);
                    if (!var_)
                        return true;
                    var type = compiler.get(SPIRType, var_.basetype);
                    if (type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1 && type.image.dim !== Dim.DimBuffer) {
                        if (compiler.dummy_sampler_id === 0)
                            throw new Error("texelFetch without sampler was found, but no dummy sampler has been created" +
                                " with build_dummy_sampler_for_combined_images().");
                        // Do it outside.
                        is_fetch = true;
                        break;
                    }
                    return true;
                }
                case Op.OpSampledImage:
                    // Do it outside.
                    break;
                default:
                    return true;
            }
            // Registers sampler2D calls used in case they are parameters so
            // that their callees know which combined image samplers to propagate down the call stack.
            if (this.functions.length !== 0) {
                var callee = this.functions[this.functions.length - 1];
                if (callee.do_combined_parameters) {
                    var image_id_1 = args[2];
                    var image = compiler.maybe_get_backing_variable(image_id_1);
                    if (image)
                        image_id_1 = image.self;
                    var sampler_id_1 = is_fetch ? compiler.dummy_sampler_id : args[3];
                    var sampler = compiler.maybe_get_backing_variable(sampler_id_1);
                    if (sampler)
                        sampler_id_1 = sampler.self;
                    var combined_id = args[1];
                    var combined_type = compiler.get(SPIRType, args[0]);
                    this.register_combined_image_sampler(callee, combined_id, image_id_1, sampler_id_1, combined_type.image.depth);
                }
            }
            // For function calls, we need to remap IDs which are function parameters into global variables.
            // This information is statically known from the current place in the call stack.
            // Function parameters are not necessarily pointers, so if we don't have a backing variable, remapping will know
            // which backing variable the image/sample came from.
            var image_id = this.remap_parameter(args[2]);
            var sampler_id = is_fetch ? compiler.dummy_sampler_id : this.remap_parameter(args[3]);
            var element = compiler.combined_image_samplers.find(function (combined) {
                return combined.image_id == image_id && combined.sampler_id == sampler_id;
            });
            if (!element) {
                var sampled_type = void 0;
                var combined_module_id = void 0;
                if (is_fetch) {
                    // Have to invent the sampled image type.
                    sampled_type = compiler.ir.increase_bound_by(1);
                    var type_1 = compiler.set(SPIRType, sampled_type);
                    defaultCopy(compiler.expression_type(args[2]), type_1);
                    type_1.self = sampled_type;
                    type_1.basetype = SPIRTypeBaseType.SampledImage;
                    type_1.image.depth = false;
                    combined_module_id = 0;
                }
                else {
                    sampled_type = args[0];
                    combined_module_id = args[1];
                }
                var id = compiler.ir.increase_bound_by(2);
                var type_id = id + 0;
                var combined_id = id + 1;
                // Make a new type, pointer to OpTypeSampledImage, so we can make a variable of this type.
                // We will probably have this type lying around, but it doesn't hurt to make duplicates for internal purposes.
                var type = compiler.set(SPIRType, type_id);
                var base = compiler.get(SPIRType, sampled_type);
                defaultCopy(base, type);
                type.pointer = true;
                type.storage = StorageClass.StorageClassUniformConstant;
                type.parent_type = type_id;
                // Build new variable.
                compiler.set(SPIRVariable, combined_id, type_id, StorageClass.StorageClassUniformConstant, 0);
                // Inherit RelaxedPrecision (and potentially other useful flags if deemed relevant).
                // If any of OpSampledImage, underlying image or sampler are marked, inherit the decoration.
                var relaxed_precision = (sampler_id && compiler.has_decoration(sampler_id, Decoration.DecorationRelaxedPrecision)) ||
                    (image_id && compiler.has_decoration(image_id, Decoration.DecorationRelaxedPrecision)) ||
                    (combined_module_id && compiler.has_decoration(combined_module_id, Decoration.DecorationRelaxedPrecision));
                if (relaxed_precision)
                    compiler.set_decoration(combined_id, Decoration.DecorationRelaxedPrecision);
                // Propagate the array type for the original image as well.
                var var_ = compiler.maybe_get_backing_variable(image_id);
                if (var_) {
                    var parent_type = compiler.get(SPIRType, var_.basetype);
                    type.array = parent_type.array;
                    type.array_size_literal = parent_type.array_size_literal;
                }
                compiler.combined_image_samplers.push(new CombinedImageSampler(combined_id, image_id, sampler_id));
            }
            return true;
        };
        CombinedImageSamplerHandler.prototype.begin_function_scope = function (args, length) {
            if (length < 3)
                return false;
            var callee = this.compiler.get(SPIRFunction, args[2]);
            args = args.slice(3);
            length -= 3;
            this.push_remap_parameters(callee, args, length);
            this.functions.push(callee);
            return true;
        };
        CombinedImageSamplerHandler.prototype.end_function_scope = function (args, length) {
            if (length < 3)
                return false;
            var functions = this.functions;
            var compiler = this.compiler;
            var callee = compiler.get(SPIRFunction, args[2]);
            args = args.slice(3);
            // There are two types of cases we have to handle,
            // a callee might call sampler2D(texture2D, sampler) directly where
            // one or more parameters originate from parameters.
            // Alternatively, we need to provide combined image samplers to our callees,
            // and in this case we need to add those as well.
            this.pop_remap_parameters();
            // Our callee has now been processed at least once.
            // No point in doing it again.
            callee.do_combined_parameters = false;
            var params = functions.pop().combined_parameters;
            if (functions.length === 0)
                return true;
            var caller = functions[functions.length - 1];
            if (caller.do_combined_parameters) {
                for (var _i = 0, params_1 = params; _i < params_1.length; _i++) {
                    var param = params_1[_i];
                    var image_id = param.global_image ? param.image_id : (args[param.image_id]);
                    var sampler_id = param.global_sampler ? param.sampler_id : (args[param.sampler_id]);
                    var i = compiler.maybe_get_backing_variable(image_id);
                    var s = compiler.maybe_get_backing_variable(sampler_id);
                    if (i)
                        image_id = i.self;
                    if (s)
                        sampler_id = s.self;
                    this.register_combined_image_sampler(caller, 0, image_id, sampler_id, param.depth);
                }
            }
            return true;
        };
        CombinedImageSamplerHandler.prototype.remap_parameter = function (id) {
            var var_ = this.compiler.maybe_get_backing_variable(id);
            if (var_)
                id = var_.self;
            var parameter_remapping = this.parameter_remapping;
            if (parameter_remapping.length === 0)
                return id;
            var remapping = parameter_remapping[parameter_remapping.length - 1];
            var elm = remapping[id];
            if (elm !== undefined)
                return elm;
            else
                return id;
        };
        CombinedImageSamplerHandler.prototype.push_remap_parameters = function (func, args, length) {
            // If possible, pipe through a remapping table so that parameters know
            // which variables they actually bind to in this scope.
            // original is map<uint, uint>
            var remapping = [];
            for (var i = 0; i < length; i++)
                remapping[func.arguments[i].id] = this.remap_parameter(args[i]);
            this.parameter_remapping.push(remapping);
        };
        CombinedImageSamplerHandler.prototype.pop_remap_parameters = function () {
            this.parameter_remapping.pop();
        };
        CombinedImageSamplerHandler.prototype.register_combined_image_sampler = function (caller, combined_module_id, image_id, sampler_id, depth) {
            // We now have a texture ID and a sampler ID which will either be found as a global
            // or a parameter in our own function. If both are global, they will not need a parameter,
            // otherwise, add it to our list.
            var param = new SPIRFunctionCombinedImageSamplerParameter(0, image_id, sampler_id, true, true, depth);
            var texture_itr = caller.arguments.find(function (p) { return p.id === image_id; });
            var sampler_itr = caller.arguments.find(function (p) { return p.id === sampler_id; });
            if (texture_itr) {
                param.global_image = false;
                param.image_id = caller.arguments.indexOf(texture_itr);
            }
            if (sampler_itr) {
                param.global_sampler = false;
                param.sampler_id = caller.arguments.indexOf(sampler_itr);
            }
            if (param.global_image && param.global_sampler)
                return;
            var itr = caller.combined_parameters.find(function (p) {
                return param.image_id == p.image_id && param.sampler_id == p.sampler_id &&
                    param.global_image == p.global_image && param.global_sampler == p.global_sampler;
            });
            var compiler = this.compiler;
            if (!itr) {
                var id = compiler.ir.increase_bound_by(3);
                var type_id = id;
                var ptr_type_id = id + 1;
                var combined_id = id + 2;
                var base = compiler.expression_type(image_id);
                var type = compiler.set(SPIRType, type_id);
                var ptr_type = compiler.set(SPIRType, ptr_type_id);
                defaultCopy(base, type);
                type.self = type_id;
                type.basetype = SPIRTypeBaseType.SampledImage;
                type.pointer = false;
                type.storage = StorageClass.StorageClassGeneric;
                type.image.depth = depth;
                defaultCopy(type, ptr_type);
                ptr_type.pointer = true;
                ptr_type.storage = StorageClass.StorageClassUniformConstant;
                ptr_type.parent_type = type_id;
                // Build new variable.
                compiler.set(SPIRVariable, combined_id, ptr_type_id, StorageClass.StorageClassFunction, 0);
                // Inherit RelaxedPrecision.
                // If any of OpSampledImage, underlying image or sampler are marked, inherit the decoration.
                var relaxed_precision = compiler.has_decoration(sampler_id, Decoration.DecorationRelaxedPrecision) ||
                    compiler.has_decoration(image_id, Decoration.DecorationRelaxedPrecision) ||
                    (combined_module_id && compiler.has_decoration(combined_module_id, Decoration.DecorationRelaxedPrecision));
                if (relaxed_precision)
                    compiler.set_decoration(combined_id, Decoration.DecorationRelaxedPrecision);
                param.id = combined_id;
                compiler.set_name(combined_id, "SPIRV_Cross_Combined" + compiler.to_name(image_id) + compiler.to_name(sampler_id));
                caller.combined_parameters.push(param);
                caller.shadow_arguments.push(new SPIRVFunctionParameter(ptr_type_id, combined_id, 0, 0, true));
            }
        };
        return CombinedImageSamplerHandler;
    }(OpcodeHandler));

    var CFG = /** @class */ (function () {
        function CFG(compiler, func) {
            this.preceding_edges = []; // std::unordered_map<uint32_t, SmallVector<uint32_t>>
            this.succeeding_edges = []; // std::unordered_map<uint32_t, SmallVector<uint32_t>>
            this.immediate_dominators = []; // std::unordered_map<uint32_t, uint32_t>
            this.visit_order = []; // std::unordered_map<uint32_t, VisitOrder>
            this.post_order = []; // SmallVector<uint32_t>
            this.empty_vector = []; // SmallVector<uint32_t>
            this.compiler = compiler;
            this.func = func;
        }
        CFG.prototype.get_compiler = function () {
            return this.compiler;
        };
        CFG.prototype.get_function = function () {
            return this.func;
        };
        CFG.prototype.get_immediate_dominator = function (block) {
            var itr_second = this.immediate_dominators[block];
            if (itr_second)
                return itr_second;
            else
                return 0;
        };
        CFG.prototype.get_visit_order = function (block) {
            var itr_second = this.visit_order[block];
            console.assert(itr_second);
            var v = itr_second.get();
            console.assert(v > 0);
            return v;
        };
        CFG.prototype.find_common_dominator = function (a, b) {
            while (a !== b) {
                if (this.get_visit_order(a) < this.get_visit_order(b))
                    a = this.get_immediate_dominator(a);
                else
                    b = this.get_immediate_dominator(b);
            }
            return a;
        };
        CFG.prototype.get_preceding_edges = function (block) {
            var itr_second = this.preceding_edges[block];
            return itr_second || this.empty_vector;
        };
        CFG.prototype.get_succeeding_edges = function (block) {
            var itr_second = this.succeeding_edges[block];
            return itr_second || this.empty_vector;
        };
        CFG.prototype.walk_from = function (seen_blocks, block, op) {
            if (seen_blocks.has(block))
                return;
            seen_blocks.add(block);
            if (op(block)) {
                for (var _i = 0, _a = this.get_succeeding_edges(block); _i < _a.length; _i++) {
                    var b = _a[_i];
                    this.walk_from(seen_blocks, b, op);
                }
            }
        };
        CFG.prototype.find_loop_dominator = function (block_id) {
            while (block_id !== SPIRBlock.NoDominator) {
                var itr_second = this.preceding_edges[block_id];
                if (!itr_second)
                    return SPIRBlock.NoDominator;
                if (itr_second.length === 0)
                    return SPIRBlock.NoDominator;
                var pred_block_id = SPIRBlock.NoDominator;
                var ignore_loop_header = false;
                // If we are a merge block, go directly to the header block.
                // Only consider a loop dominator if we are branching from inside a block to a loop header.
                // NOTE: In the CFG we forced an edge from header to merge block always to support variable scopes properly.
                for (var _i = 0, itr_second_1 = itr_second; _i < itr_second_1.length; _i++) {
                    var pred = itr_second_1[_i];
                    var pred_block = this.compiler.get(SPIRBlock, pred);
                    if (pred_block.merge == SPIRBlockMerge.MergeLoop && pred_block.merge_block == (block_id)) {
                        pred_block_id = pred;
                        ignore_loop_header = true;
                        break;
                    }
                    else if (pred_block.merge == SPIRBlockMerge.MergeSelection && pred_block.next_block == (block_id)) {
                        pred_block_id = pred;
                        break;
                    }
                }
                // No merge block means we can just pick any edge. Loop headers dominate the inner loop, so any path we
                // take will lead there.
                if (pred_block_id == SPIRBlock.NoDominator)
                    pred_block_id = itr_second[0];
                block_id = pred_block_id;
                if (!ignore_loop_header && block_id) {
                    var block = this.compiler.get(SPIRBlock, block_id);
                    if (block.merge == SPIRBlockMerge.MergeLoop)
                        return block_id;
                }
            }
            return block_id;
        };
        return CFG;
    }());

    var CFGBuilder = /** @class */ (function (_super) {
        __extends(CFGBuilder, _super);
        function CFGBuilder(compiler) {
            var _this = _super.call(this) || this;
            // original is map
            _this.function_cfgs = [];
            _this.compiler = compiler;
            return _this;
        }
        CFGBuilder.prototype.handle = function (opcode, args, length) {
            return true;
        };
        CFGBuilder.prototype.follow_function_call = function (func) {
            if (!this.function_cfgs[func.self]) {
                this.function_cfgs[func.self] = new CFG(this.compiler, func);
                return true;
            }
            else
                return false;
        };
        return CFGBuilder;
    }(OpcodeHandler));

    // creates an element if it does not exist, similar to a C++ map
    // pass in 0 for number map
    function maplike_get(classRef, map, id) {
        if (!map[id]) {
            map[id] = classRef === 0 ? classRef : new classRef();
        }
        return map[id];
    }

    var AnalyzeVariableScopeAccessHandler = /** @class */ (function (_super) {
        __extends(AnalyzeVariableScopeAccessHandler, _super);
        function AnalyzeVariableScopeAccessHandler(compiler, entry) {
            var _this = _super.call(this) || this;
            _this.accessed_variables_to_block = []; // std::unordered_map<uint32_t, std::unordered_set<uint32_t>>
            _this.accessed_temporaries_to_block = []; // std::unordered_map<uint32_t, std::unordered_set<uint32_t>>
            _this.result_id_to_type = []; // std::unordered_map<uint32_t, uint32_t>;
            _this.complete_write_variables_to_block = []; // std::unordered_map<uint32_t, std::unordered_set<uint32_t>>
            _this.partial_write_variables_to_block = []; // std::unordered_map<uint32_t, std::unordered_set<uint32_t>>
            _this.access_chain_expressions = new Set(); // std::unordered_set<uint32_t>
            // Access chains used in multiple blocks mean hoisting all the variables used to construct the access chain as not all backends can use pointers.
            _this.access_chain_children = []; // std::unordered_map<uint32_t, std::unordered_set<uint32_t>>
            _this.current_block = null;
            _this.compiler = compiler;
            _this.entry = entry;
            return _this;
        }
        AnalyzeVariableScopeAccessHandler.prototype.follow_function_call = function (_) {
            return false;
        };
        AnalyzeVariableScopeAccessHandler.prototype.set_current_block = function (block) {
            var _this = this;
            var compiler = this.compiler;
            this.current_block = block;
            // If we're branching to a block which uses OpPhi, in GLSL
            // this will be a variable write when we branch,
            // so we need to track access to these variables as well to
            // have a complete picture.
            var test_phi = function (to) {
                var next = compiler.get(SPIRBlock, to);
                for (var _i = 0, _a = next.phi_variables; _i < _a.length; _i++) {
                    var phi = _a[_i];
                    if (phi.parent === block.self) {
                        maplike_get(Set, _this.accessed_variables_to_block, phi.function_variable).add(block.self);
                        maplike_get(Set, _this.accessed_variables_to_block, phi.function_variable).add(next.self);
                        _this.notify_variable_access(phi.local_variable, block.self);
                    }
                }
            };
            switch (block.terminator) {
                case SPIRBlockTerminator.Direct:
                    this.notify_variable_access(block.condition, block.self);
                    test_phi(block.next_block);
                    break;
                case SPIRBlockTerminator.Select:
                    this.notify_variable_access(block.condition, block.self);
                    test_phi(block.true_block);
                    test_phi(block.false_block);
                    break;
                case SPIRBlockTerminator.MultiSelect: {
                    this.notify_variable_access(block.condition, block.self);
                    var cases = compiler.get_case_list(block);
                    for (var _i = 0, cases_1 = cases; _i < cases_1.length; _i++) {
                        var target = cases_1[_i];
                        test_phi(target.block);
                    }
                    if (block.default_block)
                        test_phi(block.default_block);
                    break;
                }
            }
        };
        AnalyzeVariableScopeAccessHandler.prototype.notify_variable_access = function (id, block) {
            var _this = this;
            if (id == 0)
                return;
            // Access chains used in multiple blocks mean hoisting all the variables used to construct the access chain as not all backends can use pointers.
            var itr_second = this.access_chain_children[id];
            if (itr_second)
                itr_second.forEach(function (child_id) { return _this.notify_variable_access(child_id, block); });
            if (this.id_is_phi_variable(id))
                maplike_get(Set, this.accessed_variables_to_block, id).add(block);
            else if (this.id_is_potential_temporary(id))
                maplike_get(Set, this.accessed_temporaries_to_block, id).add(block);
        };
        AnalyzeVariableScopeAccessHandler.prototype.id_is_phi_variable = function (id) {
            if (id >= this.compiler.get_current_id_bound())
                return false;
            var var_ = this.compiler.maybe_get(SPIRVariable, id);
            return var_ && var_.phi_variable;
        };
        AnalyzeVariableScopeAccessHandler.prototype.id_is_potential_temporary = function (id) {
            if (id >= this.compiler.get_current_id_bound())
                return false;
            // Temporaries are not created before we start emitting code.
            return this.compiler.ir.ids[id].empty() || (this.compiler.ir.ids[id].get_type() === Types.TypeExpression);
        };
        AnalyzeVariableScopeAccessHandler.prototype.handle = function (op, args, length) {
            var compiler = this.compiler;
            // Keep track of the types of temporaries, so we can hoist them out as necessary.
            var result = { result_type: 0, result_id: 0 };
            if (compiler.instruction_to_result_type(result, op, args, length))
                this.result_id_to_type[result.result_id] = result.result_type;
            switch (op) {
                case Op.OpStore: {
                    if (length < 2)
                        return false;
                    var ptr = args[0];
                    var var_ = compiler.maybe_get_backing_variable(ptr);
                    // If we store through an access chain, we have a partial write.
                    if (var_) {
                        maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                        if (var_.self == ptr)
                            maplike_get(Set, this.complete_write_variables_to_block, var_.self).add(this.current_block.self);
                        else
                            maplike_get(Set, this.partial_write_variables_to_block, var_.self).add(this.current_block.self);
                    }
                    // args[0] might be an access chain we have to track use of.
                    this.notify_variable_access(args[0], this.current_block.self);
                    // Might try to store a Phi variable here.
                    this.notify_variable_access(args[1], this.current_block.self);
                    break;
                }
                case Op.OpAccessChain:
                case Op.OpInBoundsAccessChain:
                case Op.OpPtrAccessChain: {
                    if (length < 3)
                        return false;
                    // Access chains used in multiple blocks mean hoisting all the variables used to construct the access chain as not all backends can use pointers.
                    var ptr = args[2];
                    var var_ = this.compiler.maybe_get(SPIRVariable, ptr);
                    if (var_) {
                        maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                        maplike_get(Set, this.access_chain_children, args[1]).add(var_.self);
                    }
                    // args[2] might be another access chain we have to track use of.
                    for (var i = 2; i < length; i++) {
                        this.notify_variable_access(args[i], this.current_block.self);
                        maplike_get(Set, this.access_chain_children, args[1]).add(args[i]);
                    }
                    // Also keep track of the access chain pointer itself.
                    // In exceptionally rare cases, we can end up with a case where
                    // the access chain is generated in the loop body, but is consumed in continue block.
                    // This means we need complex loop workarounds, and we must detect this via CFG analysis.
                    this.notify_variable_access(args[1], this.current_block.self);
                    // The result of an access chain is a fixed expression and is not really considered a temporary.
                    var e = compiler.set(SPIRExpression, args[1], "", args[0], true);
                    var backing_variable = compiler.maybe_get_backing_variable(ptr);
                    e.loaded_from = backing_variable ? (backing_variable.self) : (0);
                    // Other backends might use SPIRAccessChain for this later.
                    compiler.ir.ids[args[1]].set_allow_type_rewrite();
                    this.access_chain_expressions.add(args[1]);
                    break;
                }
                case Op.OpCopyMemory: {
                    if (length < 2)
                        return false;
                    var lhs = args[0];
                    var rhs = args[1];
                    var var_ = compiler.maybe_get_backing_variable(lhs);
                    // If we store through an access chain, we have a partial write.
                    if (var_) {
                        maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                        if (var_.self == lhs)
                            maplike_get(Set, this.complete_write_variables_to_block, var_.self).add(this.current_block.self);
                        else
                            maplike_get(Set, this.partial_write_variables_to_block, var_.self).add(this.current_block.self);
                    }
                    // args[0:1] might be access chains we have to track use of.
                    for (var i = 0; i < 2; i++)
                        this.notify_variable_access(args[i], this.current_block.self);
                    var_ = compiler.maybe_get_backing_variable(rhs);
                    if (var_)
                        maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                    break;
                }
                case Op.OpCopyObject: {
                    if (length < 3)
                        return false;
                    var var_ = compiler.maybe_get_backing_variable(args[2]);
                    if (var_)
                        maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                    // Might be an access chain which we have to keep track of.
                    this.notify_variable_access(args[1], this.current_block.self);
                    if (this.access_chain_expressions.has(args[2]))
                        this.access_chain_expressions.add(args[1]);
                    // Might try to copy a Phi variable here.
                    this.notify_variable_access(args[2], this.current_block.self);
                    break;
                }
                case Op.OpLoad: {
                    if (length < 3)
                        return false;
                    var ptr = args[2];
                    var var_ = compiler.maybe_get_backing_variable(ptr);
                    if (var_)
                        maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                    // Loaded value is a temporary.
                    this.notify_variable_access(args[1], this.current_block.self);
                    // Might be an access chain we have to track use of.
                    this.notify_variable_access(args[2], this.current_block.self);
                    break;
                }
                case Op.OpFunctionCall: {
                    if (length < 3)
                        return false;
                    // Return value may be a temporary.
                    if (compiler.get_type(args[0]).basetype !== SPIRTypeBaseType.Void)
                        this.notify_variable_access(args[1], this.current_block.self);
                    length -= 3;
                    args = args.slice(3);
                    for (var i = 0; i < length; i++) {
                        var var_ = compiler.maybe_get_backing_variable(args[i]);
                        if (var_) {
                            maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                            // Assume we can get partial writes to this variable.
                            maplike_get(Set, this.partial_write_variables_to_block, var_.self).add(this.current_block.self);
                        }
                        // Cannot easily prove if argument we pass to a function is completely written.
                        // Usually, functions write to a dummy variable,
                        // which is then copied to in full to the real argument.
                        // Might try to copy a Phi variable here.
                        this.notify_variable_access(args[i], this.current_block.self);
                    }
                    break;
                }
                case Op.OpSelect: {
                    // In case of variable pointers, we might access a variable here.
                    // We cannot prove anything about these accesses however.
                    for (var i = 1; i < length; i++) {
                        if (i >= 3) {
                            var var_ = compiler.maybe_get_backing_variable(args[i]);
                            if (var_) {
                                maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                                // Assume we can get partial writes to this variable.
                                maplike_get(Set, this.partial_write_variables_to_block, var_.self).add(this.current_block.self);
                            }
                        }
                        // Might try to copy a Phi variable here.
                        this.notify_variable_access(args[i], this.current_block.self);
                    }
                    break;
                }
                case Op.OpExtInst: {
                    for (var i = 4; i < length; i++)
                        this.notify_variable_access(args[i], this.current_block.self);
                    this.notify_variable_access(args[1], this.current_block.self);
                    var extension_set = args[2];
                    if (compiler.get(SPIRExtension, extension_set).ext === SPIRExtensionExtension.GLSL) {
                        var op_450 = (args[3]);
                        switch (op_450) {
                            case GLSLstd450.GLSLstd450Modf:
                            case GLSLstd450.GLSLstd450Frexp: {
                                var ptr = args[5];
                                var var_ = compiler.maybe_get_backing_variable(ptr);
                                if (var_) {
                                    maplike_get(Set, this.accessed_variables_to_block, var_.self).add(this.current_block.self);
                                    if (var_.self == ptr)
                                        maplike_get(Set, this.complete_write_variables_to_block, var_.self).add(this.current_block.self);
                                    else
                                        maplike_get(Set, this.partial_write_variables_to_block, var_.self).add(this.current_block.self);
                                }
                                break;
                            }
                        }
                    }
                    break;
                }
                case Op.OpArrayLength:
                    // Only result is a temporary.
                    this.notify_variable_access(args[1], this.current_block.self);
                    break;
                case Op.OpLine:
                case Op.OpNoLine:
                    // Uses literals, but cannot be a phi variable or temporary, so ignore.
                    break;
                // Atomics shouldn't be able to access function-local variables.
                // Some GLSL builtins access a pointer.
                case Op.OpCompositeInsert:
                case Op.OpVectorShuffle:
                    // Specialize for opcode which contains literals.
                    for (var i = 1; i < 4; i++)
                        this.notify_variable_access(args[i], this.current_block.self);
                    break;
                case Op.OpCompositeExtract:
                    // Specialize for opcode which contains literals.
                    for (var i = 1; i < 3; i++)
                        this.notify_variable_access(args[i], this.current_block.self);
                    break;
                case Op.OpImageWrite:
                    for (var i = 0; i < length; i++) {
                        // Argument 3 is a literal.
                        if (i != 3)
                            this.notify_variable_access(args[i], this.current_block.self);
                    }
                    break;
                case Op.OpImageSampleImplicitLod:
                case Op.OpImageSampleExplicitLod:
                case Op.OpImageSparseSampleImplicitLod:
                case Op.OpImageSparseSampleExplicitLod:
                case Op.OpImageSampleProjImplicitLod:
                case Op.OpImageSampleProjExplicitLod:
                case Op.OpImageSparseSampleProjImplicitLod:
                case Op.OpImageSparseSampleProjExplicitLod:
                case Op.OpImageFetch:
                case Op.OpImageSparseFetch:
                case Op.OpImageRead:
                case Op.OpImageSparseRead:
                    for (var i = 1; i < length; i++) {
                        // Argument 4 is a literal.
                        if (i != 4)
                            this.notify_variable_access(args[i], this.current_block.self);
                    }
                    break;
                case Op.OpImageSampleDrefImplicitLod:
                case Op.OpImageSampleDrefExplicitLod:
                case Op.OpImageSparseSampleDrefImplicitLod:
                case Op.OpImageSparseSampleDrefExplicitLod:
                case Op.OpImageSampleProjDrefImplicitLod:
                case Op.OpImageSampleProjDrefExplicitLod:
                case Op.OpImageSparseSampleProjDrefImplicitLod:
                case Op.OpImageSparseSampleProjDrefExplicitLod:
                case Op.OpImageGather:
                case Op.OpImageSparseGather:
                case Op.OpImageDrefGather:
                case Op.OpImageSparseDrefGather:
                    for (var i = 1; i < length; i++) {
                        // Argument 5 is a literal.
                        if (i != 5)
                            this.notify_variable_access(args[i], this.current_block.self);
                    }
                    break;
                default: {
                    // Rather dirty way of figuring out where Phi variables are used.
                    // As long as only IDs are used, we can scan through instructions and try to find any evidence that
                    // the ID of a variable has been used.
                    // There are potential false positives here where a literal is used in-place of an ID,
                    // but worst case, it does not affect the correctness of the compile.
                    // Exhaustive analysis would be better here, but it's not worth it for now.
                    for (var i = 0; i < length; i++)
                        this.notify_variable_access(args[i], this.current_block.self);
                    break;
                }
            }
            return true;
        };
        AnalyzeVariableScopeAccessHandler.prototype.handle_terminator = function (block) {
            switch (block.terminator) {
                case SPIRBlockTerminator.Return:
                    if (block.return_value)
                        this.notify_variable_access(block.return_value, block.self);
                    break;
                case SPIRBlockTerminator.Select:
                case SPIRBlockTerminator.MultiSelect:
                    this.notify_variable_access(block.condition, block.self);
                    break;
            }
            return true;
        };
        return AnalyzeVariableScopeAccessHandler;
    }(OpcodeHandler));

    var DominatorBuilder = /** @class */ (function () {
        function DominatorBuilder(cfg) {
            this.dominator = 0;
            this.cfg = cfg;
        }
        DominatorBuilder.prototype.add_block = function (block) {
            if (!this.cfg.get_immediate_dominator(block)) {
                // Unreachable block via the CFG, we will never emit this code anyways.
                return;
            }
            if (!this.dominator) {
                this.dominator = block;
                return;
            }
            if (block !== this.dominator)
                this.dominator = this.cfg.find_common_dominator(block, this.dominator);
        };
        DominatorBuilder.prototype.get_dominator = function () {
            return this.dominator;
        };
        DominatorBuilder.prototype.lift_continue_block_dominator = function () {
            // It is possible for a continue block to be the dominator of a variable is only accessed inside the while block of a do-while loop.
            // We cannot safely declare variables inside a continue block, so move any variable declared
            // in a continue block to the entry block to simplify.
            // It makes very little sense for a continue block to ever be a dominator, so fall back to the simplest
            // solution.
            if (!this.dominator)
                return;
            var cfg = this.cfg;
            var block = cfg.get_compiler().get(SPIRBlock, this.dominator);
            var post_order = cfg.get_visit_order(this.dominator);
            // If we are branching to a block with a higher post-order traversal index (continue blocks), we have a problem
            // since we cannot create sensible GLSL code for this, fallback to entry block.
            var back_edge_dominator = false;
            switch (block.terminator) {
                case SPIRBlockTerminator.Direct:
                    if (cfg.get_visit_order(block.next_block) > post_order)
                        back_edge_dominator = true;
                    break;
                case SPIRBlockTerminator.Select:
                    if (cfg.get_visit_order(block.true_block) > post_order)
                        back_edge_dominator = true;
                    if (cfg.get_visit_order(block.false_block) > post_order)
                        back_edge_dominator = true;
                    break;
                case SPIRBlockTerminator.MultiSelect:
                    {
                        var cases = cfg.get_compiler().get_case_list(block);
                        for (var _i = 0, cases_1 = cases; _i < cases_1.length; _i++) {
                            var target = cases_1[_i];
                            if (cfg.get_visit_order(target.block) > post_order)
                                back_edge_dominator = true;
                        }
                        if (block.default_block && cfg.get_visit_order(block.default_block) > post_order)
                            back_edge_dominator = true;
                        break;
                    }
            }
            if (back_edge_dominator)
                this.dominator = cfg.get_function().entry_block;
        };
        return DominatorBuilder;
    }());

    var StaticExpressionAccessHandler = /** @class */ (function (_super) {
        __extends(StaticExpressionAccessHandler, _super);
        function StaticExpressionAccessHandler(compiler, variable_id) {
            var _this = _super.call(this) || this;
            _this.static_expression = 0;
            _this.write_count = 0;
            _this.variable_id = variable_id;
            return _this;
        }
        StaticExpressionAccessHandler.prototype.follow_function_call = function (_) {
            return false;
        };
        StaticExpressionAccessHandler.prototype.handle = function (opcode, args, length) {
            switch (opcode) {
                case Op.OpStore:
                    if (length < 2)
                        return false;
                    if (args[0] === this.variable_id) {
                        this.static_expression = args[1];
                        this.write_count++;
                    }
                    break;
                case Op.OpLoad:
                    if (length < 3)
                        return false;
                    if (args[2] == this.variable_id && this.static_expression === 0) // Tried to read from variable before it
                        // was initialized.
                        return false;
                    break;
                case Op.OpAccessChain:
                case Op.OpInBoundsAccessChain:
                case Op.OpPtrAccessChain:
                    if (length < 3)
                        return false;
                    if (args[2] === this.variable_id) // If we try to access chain our candidate variable before we store to
                        // it, bail.
                        return false;
                    break;
            }
            return true;
        };
        return StaticExpressionAccessHandler;
    }(OpcodeHandler));

    var Compiler = /** @class */ (function () {
        function Compiler(parsedIR) {
            // Marks variables which have global scope and variables which can alias with other variables
            // (SSBO, image load store, etc)
            this.global_variables = [];
            this.aliased_variables = [];
            this.current_loop_level = 0;
            this.active_interface_variables = new Set();
            this.check_active_interface_variables = false;
            this.is_force_recompile = false;
            this.combined_image_samplers = [];
            this.forced_temporaries = new Set();
            this.forwarded_temporaries = new Set();
            this.suppressed_usage_tracking = new Set();
            this.hoisted_temporaries = new Set();
            this.forced_invariant_temporaries = new Set();
            this.declared_block_names = [];
            this.set_ir(parsedIR);
        }
        // Gets the identifier (OpName) of an ID. If not defined, an empty string will be returned.
        Compiler.prototype.get_name = function (id) {
            return this.ir.get_name(id);
        };
        // Applies a decoration to an ID. Effectively injects OpDecorate.
        Compiler.prototype.set_decoration = function (id, decoration, argument) {
            if (argument === void 0) { argument = 0; }
            this.ir.set_decoration(id, decoration, argument);
        };
        Compiler.prototype.set_decoration_string = function (id, decoration, argument) {
            this.ir.set_decoration_string(id, decoration, argument);
        };
        // Overrides the identifier OpName of an ID.
        // Identifiers beginning with underscores or identifiers which contain double underscores
        // are reserved by the implementation.
        Compiler.prototype.set_name = function (id, name) {
            this.ir.set_name(id, name);
        };
        // Gets a bitmask for the decorations which are applied to ID.
        // I.e. (1ull << spv::DecorationFoo) | (1ull << spv::DecorationBar)
        Compiler.prototype.get_decoration_bitset = function (id) {
            return this.ir.get_decoration_bitset(id);
        };
        // Returns a set of all global variables which are statically accessed
        // by the control flow graph from the current entry point.
        // Only variables which change the interface for a shader are returned, that is,
        // variables with storage class of Input, Output, Uniform, UniformConstant, PushConstant and AtomicCounter
        // storage classes are returned.
        //
        // To use the returned set as the filter for which variables are used during compilation,
        // this set can be moved to set_enabled_interface_variables().
        Compiler.prototype.get_active_interface_variables = function () {
            var _this = this;
            // Traverse the call graph and find all interface variables which are in use.
            var ir = this.ir;
            var variables = new Set();
            var handler = new InterfaceVariableAccessHandler(this, variables);
            this.traverse_all_reachable_opcodes(this.get(SPIRFunction, ir.default_entry_point), handler);
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                if (var_.storage !== StorageClass.StorageClassOutput)
                    return;
                if (!_this.interface_variable_exists_in_entry_point(var_.self))
                    return;
                // An output variable which is just declared (but uninitialized) might be read by subsequent stages
                // so we should force-enable these outputs,
                // since compilation will fail if a subsequent stage attempts to read from the variable in question.
                // Also, make sure we preserve output variables which are only initialized, but never accessed by any code.
                if (var_.initializer !== 0 || _this.get_execution_model() !== ExecutionModel.ExecutionModelFragment)
                    variables.add(var_.self);
            });
            // If we needed to create one, we'll need it.
            if (this.dummy_sampler_id)
                variables.add(this.dummy_sampler_id);
            return variables;
        };
        // Sets the interface variables which are used during compilation.
        // By default, all variables are used.
        // Once set, compile() will only consider the set in active_variables.
        Compiler.prototype.set_enabled_interface_variables = function (active_variables) {
            this.active_interface_variables = active_variables;
            this.check_active_interface_variables = true;
        };
        Compiler.prototype.get_shader_resources = function (active_variables) {
            var _this = this;
            var res = new ShaderResources();
            var ir = this.ir;
            var ssbo_instance_name = this.reflection_ssbo_instance_name_is_significant();
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                var type = _this.get(SPIRType, var_.basetype);
                // It is possible for uniform storage classes to be passed as function parameters, so detect
                // that. To detect function parameters, check of StorageClass of variable is function scope.
                if (var_.storage === StorageClass.StorageClassFunction || !type.pointer)
                    return;
                if (active_variables && !active_variables.has(var_.self))
                    return;
                // In SPIR-V 1.4 and up, every global must be present in the entry point interface list,
                // not just IO variables.
                var active_in_entry_point = true;
                if (ir.get_spirv_version() < 0x10400) {
                    if (var_.storage === StorageClass.StorageClassInput || var_.storage === StorageClass.StorageClassOutput)
                        active_in_entry_point = _this.interface_variable_exists_in_entry_point(var_.self);
                }
                else
                    active_in_entry_point = _this.interface_variable_exists_in_entry_point(var_.self);
                if (!active_in_entry_point)
                    return;
                var is_builtin = _this.is_builtin_variable(var_);
                if (is_builtin) {
                    if (var_.storage !== StorageClass.StorageClassInput && var_.storage !== StorageClass.StorageClassOutput)
                        return;
                    var list = var_.storage === StorageClass.StorageClassInput ? res.builtin_inputs : res.builtin_outputs;
                    var resource = void 0;
                    if (_this.has_decoration(type.self, Decoration.DecorationBlock)) {
                        resource.resource = new Resource(var_.self, var_.basetype, type.self, _this.get_remapped_declared_block_name(var_.self, false));
                        for (var i = 0; i < type.member_types.length; i++) {
                            resource.value_type_id = type.member_types[i];
                            resource.builtin = _this.get_member_decoration(type.self, i, Decoration.DecorationBuiltIn);
                            list.push(resource);
                        }
                    }
                    else {
                        var strip_array = !_this.has_decoration(var_.self, Decoration.DecorationPatch) && (_this.get_execution_model() === ExecutionModel.ExecutionModelTessellationControl ||
                            (_this.get_execution_model() === ExecutionModel.ExecutionModelTessellationEvaluation &&
                                var_.storage === StorageClass.StorageClassInput));
                        resource.resource = new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self));
                        if (strip_array && type.array.length > 0)
                            resource.value_type_id = _this.get_variable_data_type(var_).parent_type;
                        else
                            resource.value_type_id = _this.get_variable_data_type_id(var_);
                        console.assert(resource.value_type_id);
                        resource.builtin = _this.get_decoration(var_.self, Decoration.DecorationBuiltIn);
                        list.push(resource);
                    }
                    return;
                }
                // Input
                if (var_.storage === StorageClass.StorageClassInput) {
                    if (_this.has_decoration(type.self, Decoration.DecorationBlock)) {
                        res.stage_inputs.push(new Resource(var_.self, var_.basetype, type.self, _this.get_remapped_declared_block_name(var_.self, false)));
                    }
                    else
                        res.stage_inputs.push(new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self)));
                }
                // Subpass inputs
                else if (var_.storage === StorageClass.StorageClassUniformConstant && type.image.dim === Dim.DimSubpassData) {
                    res.subpass_inputs.push(new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self)));
                }
                // Outputs
                else if (var_.storage === StorageClass.StorageClassOutput) {
                    if (_this.has_decoration(type.self, Decoration.DecorationBlock)) {
                        res.stage_outputs.push(new Resource(var_.self, var_.basetype, type.self, _this.get_remapped_declared_block_name(var_.self, false)));
                    }
                    else
                        res.stage_outputs.push(new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self)));
                }
                // UBOs
                else if (type.storage === StorageClass.StorageClassUniform && _this.has_decoration(type.self, Decoration.DecorationBlock)) {
                    res.uniform_buffers.push(new Resource(var_.self, var_.basetype, type.self, _this.get_remapped_declared_block_name(var_.self, false)));
                }
                // Old way to declare SSBOs.
                else if (type.storage === StorageClass.StorageClassUniform && _this.has_decoration(type.self, Decoration.DecorationBufferBlock)) {
                    res.storage_buffers.push(new Resource(var_.self, var_.basetype, type.self, _this.get_remapped_declared_block_name(var_.self, ssbo_instance_name)));
                }
                // Modern way to declare SSBOs.
                else if (type.storage === StorageClass.StorageClassStorageBuffer) {
                    res.storage_buffers.push(new Resource(var_.self, var_.basetype, type.self, _this.get_remapped_declared_block_name(var_.self, ssbo_instance_name)));
                }
                // Push constant blocks
                else if (type.storage === StorageClass.StorageClassPushConstant) {
                    // There can only be one push constant block, but keep the vector in case this restriction is lifted
                    // in the future.
                    res.push_constant_buffers.push(new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self)));
                }
                // Images
                else if (type.storage === StorageClass.StorageClassUniformConstant && type.basetype === SPIRTypeBaseType.Image &&
                    type.image.sampled === 2) {
                    res.storage_images.push(new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self)));
                }
                // Separate images
                else if (type.storage === StorageClass.StorageClassUniformConstant && type.basetype === SPIRTypeBaseType.Image &&
                    type.image.sampled === 1) {
                    res.separate_images.push(new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self)));
                }
                // Separate samplers
                else if (type.storage === StorageClass.StorageClassUniformConstant && type.basetype === SPIRTypeBaseType.Sampler) {
                    res.separate_samplers.push(new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self)));
                }
                // Textures
                else if (type.storage === StorageClass.StorageClassUniformConstant && type.basetype === SPIRTypeBaseType.SampledImage) {
                    res.sampled_images.push(new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self)));
                }
                // Atomic counters
                else if (type.storage === StorageClass.StorageClassAtomicCounter) {
                    res.atomic_counters.push(new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self)));
                }
                // Acceleration structures
                else if (type.storage === StorageClass.StorageClassUniformConstant && type.basetype === SPIRTypeBaseType.AccelerationStructure) {
                    res.acceleration_structures.push(new Resource(var_.self, var_.basetype, type.self, _this.get_name(var_.self)));
                }
            });
            return res;
        };
        // Remapped variables are considered built-in variables and a backend will
        // not emit a declaration for this variable.
        // This is mostly useful for making use of builtins which are dependent on extensions.
        Compiler.prototype.set_remapped_variable_state = function (id, remap_enable) {
            this.get(SPIRVariable, id).remapped_variable = remap_enable;
        };
        Compiler.prototype.get_remapped_variable_state = function (id) {
            return this.get(SPIRVariable, id).remapped_variable;
        };
        // For subpassInput variables which are remapped to plain variables,
        // the number of components in the remapped
        // variable must be specified as the backing type of subpass inputs are opaque.
        Compiler.prototype.set_subpass_input_remapped_components = function (id, components) {
            this.get(SPIRVariable, id).remapped_components = components;
        };
        Compiler.prototype.get_subpass_input_remapped_components = function (id) {
            return this.get(SPIRVariable, id).remapped_components;
        };
        // All operations work on the current entry point.
        // Entry points can be swapped out with set_entry_point().
        // Entry points should be set right after the constructor completes as some reflection functions traverse the graph from the entry point.
        // Resource reflection also depends on the entry point.
        // By default, the current entry point is set to the first OpEntryPoint which appears in the SPIR-V module.
        // Some shader languages restrict the names that can be given to entry points, and the
        // corresponding backend will automatically rename an entry point name, during the call
        // to compile() if it is illegal. For example, the common entry point name main() is
        // illegal in MSL, and is renamed to an alternate name by the MSL backend.
        // Given the original entry point name contained in the SPIR-V, this function returns
        // the name, as updated by the backend during the call to compile(). If the name is not
        // illegal, and has not been renamed, or if this function is called before compile(),
        // this function will simply return the same name.
        // New variants of entry point query and reflection.
        // Names for entry points in the SPIR-V module may alias if they belong to different execution models.
        // To disambiguate, we must pass along with the entry point names the execution model.
        Compiler.prototype.get_entry_points_and_stages = function () {
            var entries = [];
            this.ir.entry_points.forEach(function (entry) {
                return entries.push(new EntryPoint(entry.orig_name, entry.model));
            });
            return entries;
        };
        Compiler.prototype.set_entry_point = function (name, model) {
            var entry = this.get_entry_point(name, model);
            this.ir.default_entry_point = entry.self;
        };
        // Renames an entry point from old_name to new_name.
        // If old_name is currently selected as the current entry point, it will continue to be the current entry point,
        // albeit with a new name.
        // get_entry_points() is essentially invalidated at this point.
        Compiler.prototype.rename_entry_point = function (old_name, new_name, model) {
            var entry = this.get_entry_point(old_name, model);
            entry.orig_name = new_name;
            entry.name = new_name;
        };
        Compiler.prototype.get_entry_point = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var ir = this.ir;
            if (args.length === 0) {
                return ir.entry_points[ir.default_entry_point];
            }
            else {
                var entry = ir.entry_points.find(function (entry) { return entry.orig_name === args[0] && entry.model === args[1]; });
                if (!entry)
                    throw new Error("Entry point does not exist.");
                return entry;
            }
        };
        Compiler.prototype.get_execution_model = function () {
            return this.get_entry_point().model;
        };
        // Analyzes all OpImageFetch (texelFetch) opcodes and checks if there are instances where
        // said instruction is used without a combined image sampler.
        // GLSL targets do not support the use of texelFetch without a sampler.
        // To workaround this, we must inject a dummy sampler which can be used to form a sampler2D at the call-site of
        // texelFetch as necessary.
        //
        // This must be called before build_combined_image_samplers().
        // build_combined_image_samplers() may refer to the ID returned by this method if the returned ID is non-zero.
        // The return value will be the ID of a sampler object if a dummy sampler is necessary, or 0 if no sampler object
        // is required.
        //
        // If the returned ID is non-zero, it can be decorated with set/bindings as desired before calling compile().
        // Calling this function also invalidates get_active_interface_variables(), so this should be called
        // before that function.
        Compiler.prototype.build_dummy_sampler_for_combined_images = function () {
            var handler = new DummySamplerForCombinedImageHandler(this);
            this.traverse_all_reachable_opcodes(this.get(SPIRFunction, this.ir.default_entry_point), handler);
            var ir = this.ir;
            if (handler.need_dummy_sampler) {
                var offset = ir.increase_bound_by(3);
                var type_id = offset;
                var ptr_type_id = offset + 1;
                var var_id = offset + 2;
                var sampler = this.set(SPIRType, type_id);
                sampler.basetype = SPIRTypeBaseType.Sampler;
                var ptr_sampler = this.set(SPIRType, ptr_type_id);
                defaultCopy(sampler, ptr_sampler);
                ptr_sampler.self = type_id;
                ptr_sampler.storage = StorageClass.StorageClassUniformConstant;
                ptr_sampler.pointer = true;
                ptr_sampler.parent_type = type_id;
                this.set(SPIRVariable, var_id, ptr_type_id, StorageClass.StorageClassUniformConstant, 0);
                this.set_name(var_id, "SPIRV_Cross_DummySampler");
                this.dummy_sampler_id = var_id;
                return var_id;
            }
            else
                return 0;
        };
        // Analyzes all separate image and samplers used from the currently selected entry point,
        // and re-routes them all to a combined image sampler instead.
        // This is required to "support" separate image samplers in targets which do not natively support
        // this feature, like GLSL/ESSL.
        //
        // This must be called before compile() if such remapping is desired.
        // This call will add new sampled images to the SPIR-V,
        // so it will appear in reflection if get_shader_resources() is called after build_combined_image_samplers.
        //
        // If any image/sampler remapping was found, no separate image/samplers will appear in the decompiled output,
        // but will still appear in reflection.
        //
        // The resulting samplers will be void of any decorations like name, descriptor sets and binding points,
        // so this can be added before compile() if desired.
        //
        // Combined image samplers originating from this set are always considered active variables.
        // Arrays of separate samplers are not supported, but arrays of separate images are supported.
        // Array of images + sampler -> Array of combined image samplers.
        Compiler.prototype.build_combined_image_samplers = function () {
            this.ir.for_each_typed_id(SPIRFunction, function (_, func) {
                func.combined_parameters = [];
                func.shadow_arguments = [];
                func.do_combined_parameters = true;
            });
            this.combined_image_samplers = [];
            var handler = new CombinedImageSamplerHandler(this);
            this.traverse_all_reachable_opcodes(this.get(SPIRFunction, this.ir.default_entry_point), handler);
        };
        // Gets a remapping for the combined image samplers.
        Compiler.prototype.get_combined_image_samplers = function () {
            return this.combined_image_samplers;
        };
        // Set a new variable type remap callback.
        // The type remapping is designed to allow global interface variable to assume more special types.
        // A typical example here is to remap sampler2D into samplerExternalOES, which currently isn't supported
        // directly by SPIR-V.
        //
        // In compile() while emitting code,
        // for every variable that is declared, including function parameters, the callback will be called
        // and the API user has a chance to change the textual representation of the type used to declare the variable.
        // The API user can detect special patterns in names to guide the remapping.
        Compiler.prototype.set_variable_type_remap_callback = function (cb) {
            this.variable_remap_callback = cb;
        };
        Compiler.prototype.get_current_id_bound = function () {
            return this.ir.ids.length;
        };
        Compiler.prototype.stream = function (instr) {
            // If we're not going to use any arguments, just return nullptr.
            // We want to avoid case where we return an out of range pointer
            // that trips debug assertions on some platforms.
            if (!instr.length)
                return null;
            if (instr.is_embedded()) {
                var embedded = (instr);
                console.assert(embedded.ops.length === instr.length);
                return new Uint32Array(embedded.ops);
            }
            else {
                if (instr.offset + instr.length > this.ir.spirv.length)
                    throw new Error("Compiler::stream() out of range.");
                return this.ir.spirv.slice(instr.offset, instr.offset + instr.length);
            }
        };
        Compiler.prototype.force_recompile = function () {
            this.is_force_recompile = true;
        };
        Compiler.prototype.is_forcing_recompilation = function () {
            return this.is_force_recompile;
        };
        Compiler.prototype.clear_force_recompile = function () {
            this.is_force_recompile = false;
        };
        // For proper multiple entry point support, allow querying if an Input or Output
        // variable is part of that entry points interface.
        Compiler.prototype.interface_variable_exists_in_entry_point = function (id) {
            var var_ = this.get(SPIRVariable, id);
            var ir = this.ir;
            if (ir.get_spirv_version() < 0x10400) {
                if (var_.storage !== StorageClass.StorageClassInput &&
                    var_.storage !== StorageClass.StorageClassOutput &&
                    var_.storage !== StorageClass.StorageClassUniformConstant)
                    throw new Error("Only Input, Output variables and Uniform constants are part of a shader linking" +
                        " interface.");
                // This is to avoid potential problems with very old glslang versions which did
                // not emit input/output interfaces properly.
                // We can assume they only had a single entry point, and single entry point
                // shaders could easily be assumed to use every interface variable anyways.
                if (count(ir.entry_points) <= 1)
                    return true;
            }
            // In SPIR-V 1.4 and later, all global resource variables must be present.
            var execution = this.get_entry_point();
            return execution.interface_variables.indexOf(id) >= 0;
        };
        Compiler.prototype.set_ir = function (ir) {
            this.ir = ir;
            this.parse_fixup();
        };
        Compiler.prototype.parse_fixup = function () {
            var ir = this.ir;
            // Figure out specialization constants for work group sizes.
            for (var _i = 0, _a = ir.ids_for_constant_or_variable; _i < _a.length; _i++) {
                var id_ = _a[_i];
                var id = ir.ids[id_];
                if (id.get_type() === Types.TypeConstant) {
                    var c = id.get(SPIRConstant);
                    if (ir.get_meta(c.self).decoration.builtin && ir.get_meta(c.self).decoration.builtin_type === BuiltIn.BuiltInWorkgroupSize) {
                        // In current SPIR-V, there can be just one constant like this.
                        // All entry points will receive the constant value.
                        for (var _b = 0, _c = ir.entry_points; _b < _c.length; _b++) {
                            var entry = _c[_b];
                            entry.workgroup_size.constant = c.self;
                            entry.workgroup_size.x = c.scalar(0, 0);
                            entry.workgroup_size.y = c.scalar(0, 1);
                            entry.workgroup_size.z = c.scalar(0, 2);
                        }
                    }
                }
                else if (id.get_type() === Types.TypeVariable) {
                    var var_ = id.get(SPIRVariable);
                    if (var_.storage === StorageClass.StorageClassPrivate ||
                        var_.storage === StorageClass.StorageClassWorkgroup ||
                        var_.storage === StorageClass.StorageClassOutput)
                        this.global_variables.push(var_.self);
                    if (this.variable_storage_is_aliased(var_))
                        this.aliased_variables.push(var_.self);
                }
            }
        };
        Compiler.prototype.variable_storage_is_aliased = function (v) {
            var type = this.get(SPIRType, v.basetype);
            var ssbo = v.storage === StorageClass.StorageClassStorageBuffer ||
                this.ir.get_meta(type.self).decoration.decoration_flags.get(Decoration.DecorationBufferBlock);
            var image = type.basetype === SPIRTypeBaseType.Image;
            var counter = type.basetype === SPIRTypeBaseType.AtomicCounter;
            var buffer_reference = type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT;
            var is_restrict;
            if (ssbo)
                is_restrict = this.ir.get_buffer_block_flags(v).get(Decoration.DecorationRestrict);
            else
                is_restrict = this.has_decoration(v.self, Decoration.DecorationRestrict);
            return !is_restrict && (ssbo || image || counter || buffer_reference);
        };
        Compiler.prototype.set_initializers = function (e) {
            if (e instanceof SPIRExpression)
                e.emitted_loop_level = this.current_loop_level;
        };
        // If our IDs are out of range here as part of opcodes, throw instead of
        // undefined behavior.
        Compiler.prototype.set = function (classRef, id) {
            var args = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                args[_i - 2] = arguments[_i];
            }
            this.ir.add_typed_id(classRef.type, id);
            var var_ = variant_set.apply(void 0, __spreadArray([classRef, this.ir.ids[id]], args, false));
            var_.self = id;
            this.set_initializers(var_);
            return var_;
        };
        Compiler.prototype.get = function (classRef, id) {
            return variant_get(classRef, this.ir.ids[id]);
        };
        Compiler.prototype.has_decoration = function (id, decoration) {
            return this.ir.has_decoration(id, decoration);
        };
        // Gets the value for decorations which take arguments.
        // If the decoration is a boolean (i.e. spv::DecorationNonWritable),
        // 1 will be returned.
        // If decoration doesn't exist or decoration is not recognized,
        // 0 will be returned.
        Compiler.prototype.get_decoration = function (id, decoration) {
            return this.ir.get_decoration(id, decoration);
        };
        Compiler.prototype.get_decoration_string = function (id, decoration) {
            return this.ir.get_decoration_string(id, decoration);
        };
        // Removes the decoration for an ID.
        Compiler.prototype.unset_decoration = function (id, decoration) {
            this.ir.unset_decoration(id, decoration);
        };
        // Gets the SPIR-V type associated with ID.
        // Mostly used with Resource::type_id and Resource::base_type_id to parse the underlying type of a resource.
        Compiler.prototype.get_type = function (id) {
            return this.get(SPIRType, id);
        };
        // If get_name() of a Block struct is an empty string, get the fallback name.
        // This needs to be per-variable as multiple variables can use the same block type.
        Compiler.prototype.get_block_fallback_name = function (id) {
            var var_ = this.get(SPIRVariable, id);
            if (this.get_name(id) === "")
                return "_" + this.get(SPIRType, var_.basetype).self + "_" + id;
            else
                return this.get_name(id);
        };
        // Given an OpTypeStruct in ID, obtain the identifier for member number "index".
        // This may be an empty string.
        Compiler.prototype.get_member_name = function (id, index) {
            return this.ir.get_member_name(id, index);
        };
        // Given an OpTypeStruct in ID, obtain the OpMemberDecoration for member number "index".
        Compiler.prototype.get_member_decoration = function (id, index, decoration) {
            return this.ir.get_member_decoration(id, index, decoration);
        };
        Compiler.prototype.get_member_decoration_string = function (id, index, decoration) {
            return this.ir.get_member_decoration_string(id, index, decoration);
        };
        // Sets the member identifier for OpTypeStruct ID, member number "index".
        Compiler.prototype.set_member_name = function (id, index, name) {
            this.ir.set_member_name(id, index, name);
        };
        // Returns the qualified member identifier for OpTypeStruct ID, member number "index",
        // or an empty string if no qualified alias exists
        Compiler.prototype.get_member_qualified_name = function (type_id, index) {
            var m = this.ir.find_meta(type_id);
            if (m && index < m.members.length)
                return m.members[index].qualified_alias;
            else
                return this.ir.get_empty_string();
        };
        // Gets the decoration mask for a member of a struct, similar to get_decoration_mask.
        Compiler.prototype.get_member_decoration_bitset = function (id, index) {
            return this.ir.get_member_decoration_bitset(id, index);
        };
        // Returns whether the decoration has been applied to a member of a struct.
        Compiler.prototype.has_member_decoration = function (id, index, decoration) {
            return this.ir.has_member_decoration(id, index, decoration);
        };
        // Similar to set_decoration, but for struct members.
        Compiler.prototype.set_member_decoration = function (id, index, decoration, argument) {
            if (argument === void 0) { argument = 0; }
            this.ir.set_member_decoration(id, index, decoration, argument);
        };
        Compiler.prototype.set_member_decoration_string = function (id, index, decoration, argument) {
            this.ir.set_member_decoration_string(id, index, decoration, argument);
        };
        // Unsets a member decoration, similar to unset_decoration.
        Compiler.prototype.unset_member_decoration = function (id, index, decoration) {
            this.ir.unset_member_decoration(id, index, decoration);
        };
        // Gets the fallback name for a member, similar to get_fallback_name.
        Compiler.prototype.get_fallback_member_name = function (index) {
            return "_" + index;
        };
        Compiler.prototype.maybe_get = function (classRef, id) {
            var ir = this.ir;
            if (id >= ir.ids.length)
                return null;
            else if (ir.ids[id].get_type() === classRef.type)
                return this.get(classRef, id);
            else
                return null;
        };
        // Gets the id of SPIR-V type underlying the given type_id, which might be a pointer.
        Compiler.prototype.get_pointee_type_id = function (type_id) {
            var p_type = this.get(SPIRType, type_id);
            if (p_type.pointer) {
                console.assert(p_type.parent_type);
                type_id = p_type.parent_type;
            }
            return type_id;
        };
        // Gets the SPIR-V type underlying the given type, which might be a pointer.
        Compiler.prototype.get_pointee_type = function (type) {
            var p_type = type;
            if (p_type.pointer) {
                console.assert(p_type.parent_type);
                p_type = this.get(SPIRType, p_type.parent_type);
            }
            return p_type;
        };
        // Gets the ID of the SPIR-V type underlying a variable.
        Compiler.prototype.get_variable_data_type_id = function (var_) {
            if (var_.phi_variable)
                return var_.basetype;
            return this.get_pointee_type_id(var_.basetype);
        };
        // Gets the SPIR-V type underlying a variable.
        Compiler.prototype.get_variable_data_type = function (var_) {
            return this.get(SPIRType, this.get_variable_data_type_id(var_));
        };
        Compiler.prototype.is_immutable = function (id) {
            var ir = this.ir;
            if (ir.ids[id].get_type() === Types.TypeVariable) {
                var var_ = this.get(SPIRVariable, id);
                // Anything we load from the UniformConstant address space is guaranteed to be immutable.
                var pointer_to_const = var_.storage === StorageClass.StorageClassUniformConstant;
                return pointer_to_const || var_.phi_variable || !this.expression_is_lvalue(id);
            }
            else if (ir.ids[id].get_type() === Types.TypeAccessChain)
                return this.get(SPIRAccessChain, id).immutable;
            else if (ir.ids[id].get_type() === Types.TypeExpression)
                return this.get(SPIRExpression, id).immutable;
            else if (ir.ids[id].get_type() === Types.TypeConstant ||
                ir.ids[id].get_type() === Types.TypeConstantOp ||
                ir.ids[id].get_type() === Types.TypeUndef)
                return true;
            else
                return false;
        };
        Compiler.prototype.maybe_get_backing_variable = function (chain) {
            var var_ = this.maybe_get(SPIRVariable, chain);
            if (!var_) {
                var cexpr = this.maybe_get(SPIRExpression, chain);
                if (cexpr)
                    var_ = this.maybe_get(SPIRVariable, cexpr.loaded_from);
                var access_chain = this.maybe_get(SPIRAccessChain, chain);
                if (access_chain)
                    var_ = this.maybe_get(SPIRVariable, access_chain.loaded_from);
            }
            return var_;
        };
        Compiler.prototype.to_name = function (id, allow_alias) {
            if (allow_alias === void 0) { allow_alias = true; }
            var ir = this.ir;
            if (allow_alias && ir.ids[id].get_type() === Types.TypeType) {
                // If this type is a simple alias, emit the
                // name of the original type instead.
                // We don't want to override the meta alias
                // as that can be overridden by the reflection APIs after parse.
                var type = this.get(SPIRType, id);
                if (type.type_alias) {
                    // If the alias master has been specially packed, we will have emitted a clean variant as well,
                    // so skip the name aliasing here.
                    if (!this.has_extended_decoration(type.type_alias, ExtendedDecorations.SPIRVCrossDecorationBufferBlockRepacked))
                        return this.to_name(type.type_alias);
                }
            }
            var alias = ir.get_name(id);
            if (!alias || alias === "")
                return "_" + id;
            else
                return alias;
        };
        Compiler.prototype.is_builtin_variable = function (var_) {
            var m = this.ir.find_meta(var_.self);
            if (var_.compat_builtin || (m && m.decoration.builtin))
                return true;
            else
                return this.is_builtin_type(this.get(SPIRType, var_.basetype));
        };
        Compiler.prototype.is_builtin_type = function (type) {
            var type_meta = this.ir.find_meta(type.self);
            // We can have builtin structs as well. If one member of a struct is builtin, the struct must also be builtin.
            if (type_meta)
                for (var _i = 0, _a = type_meta.members; _i < _a.length; _i++) {
                    var m = _a[_i];
                    if (m.builtin)
                        return true;
                }
            return false;
        };
        Compiler.prototype.expression_type_id = function (id) {
            switch (this.ir.ids[id].get_type()) {
                case Types.TypeVariable:
                    return this.get(SPIRVariable, id).basetype;
                case Types.TypeExpression:
                    return this.get(SPIRExpression, id).expression_type;
                case Types.TypeConstant:
                    return this.get(SPIRConstant, id).constant_type;
                case Types.TypeConstantOp:
                    return this.get(SPIRConstantOp, id).basetype;
                case Types.TypeUndef:
                    return this.get(SPIRUndef, id).basetype;
                case Types.TypeCombinedImageSampler:
                    return this.get(SPIRCombinedImageSampler, id).combined_type;
                case Types.TypeAccessChain:
                    return this.get(SPIRAccessChain, id).basetype;
                default:
                    throw new Error("Cannot resolve expression type.");
            }
        };
        Compiler.prototype.expression_type = function (id) {
            return this.get(SPIRType, this.expression_type_id(id));
        };
        Compiler.prototype.expression_is_lvalue = function (id) {
            var type = this.expression_type(id);
            switch (type.basetype) {
                case SPIRTypeBaseType.SampledImage:
                case SPIRTypeBaseType.Image:
                case SPIRTypeBaseType.Sampler:
                    return false;
                default:
                    return true;
            }
        };
        Compiler.prototype.register_read = function (expr, chain, forwarded) {
            var e = this.get(SPIRExpression, expr);
            var var_ = this.maybe_get_backing_variable(chain);
            if (var_) {
                e.loaded_from = var_.self;
                // If the backing variable is immutable, we do not need to depend on the variable.
                if (forwarded && !this.is_immutable(var_.self))
                    var_.dependees.push(e.self);
                // If we load from a parameter, make sure we create "inout" if we also write to the parameter.
                // The default is "in" however, so we never invalidate our compilation by reading.
                if (var_ && var_.parameter)
                    var_.parameter.read_count++;
            }
        };
        Compiler.prototype.is_continue = function (next) {
            return (this.ir.block_meta[next] & BlockMetaFlagBits.BLOCK_META_CONTINUE_BIT) !== 0;
        };
        Compiler.prototype.is_single_block_loop = function (next) {
            var block = this.get(SPIRBlock, next);
            return block.merge == SPIRBlockMerge.MergeLoop && block.continue_block === (next);
        };
        Compiler.prototype.traverse_all_reachable_opcodes = function (param0, handler) {
            if (param0 instanceof SPIRFunction) {
                for (var _i = 0, _a = param0.blocks; _i < _a.length; _i++) {
                    var block_1 = _a[_i];
                    if (!this.traverse_all_reachable_opcodes(this.get(SPIRBlock, block_1), handler))
                        return false;
                }
                return true;
            }
            var block = param0;
            handler.set_current_block(block);
            handler.rearm_current_block(block);
            // Ideally, perhaps traverse the CFG instead of all blocks in order to eliminate dead blocks,
            // but this shouldn't be a problem in practice unless the SPIR-V is doing insane things like recursing
            // inside dead blocks ...
            for (var _b = 0, _c = block.ops; _b < _c.length; _b++) {
                var i = _c[_b];
                var ops = this.stream(i);
                var op = (i.op);
                if (!handler.handle(op, ops, i.length))
                    return false;
                if (op === Op.OpFunctionCall) {
                    var func = this.get(SPIRFunction, ops[2]);
                    if (handler.follow_function_call(func)) {
                        if (!handler.begin_function_scope(ops, i.length))
                            return false;
                        if (!this.traverse_all_reachable_opcodes(this.get(SPIRFunction, ops[2]), handler))
                            return false;
                        if (!handler.end_function_scope(ops, i.length))
                            return false;
                        handler.rearm_current_block(block);
                    }
                }
            }
            if (!handler.handle_terminator(block))
                return false;
            return true;
        };
        Compiler.prototype.build_function_control_flow_graphs_and_analyze = function () {
            var _this = this;
            var ir = this.ir;
            var handler = new CFGBuilder(this);
            handler.function_cfgs[ir.default_entry_point] = new CFG(this, this.get(SPIRFunction, ir.default_entry_point));
            this.traverse_all_reachable_opcodes(this.get(SPIRFunction, ir.default_entry_point), handler);
            var function_cfgs = this.function_cfgs = handler.function_cfgs;
            var single_function = count(function_cfgs) <= 1;
            function_cfgs.forEach(function (f, i) {
                var func = _this.get(SPIRFunction, i);
                var scope_handler = new AnalyzeVariableScopeAccessHandler(_this, func);
                _this.analyze_variable_scope(func, scope_handler);
                _this.find_function_local_luts(func, scope_handler, single_function);
                // Check if we can actually use the loop variables we found in analyze_variable_scope.
                // To use multiple initializers, we need the same type and qualifiers.
                for (var _i = 0, _a = func.blocks; _i < _a.length; _i++) {
                    var block = _a[_i];
                    var b = _this.get(SPIRBlock, block);
                    if (b.loop_variables.length < 2)
                        continue;
                    var flags = _this.get_decoration_bitset(b.loop_variables[0]);
                    var type = _this.get(SPIRVariable, b.loop_variables[0]).basetype;
                    var invalid_initializers = false;
                    for (var _b = 0, _c = b.loop_variables; _b < _c.length; _b++) {
                        var loop_variable = _c[_b];
                        if (flags !== _this.get_decoration_bitset(loop_variable) ||
                            type !== _this.get(SPIRVariable, b.loop_variables[0]).basetype) {
                            invalid_initializers = true;
                            break;
                        }
                    }
                    if (invalid_initializers) {
                        for (var _d = 0, _e = b.loop_variables; _d < _e.length; _d++) {
                            var loop_variable = _e[_d];
                            _this.get(SPIRVariable, loop_variable).loop_variable = false;
                        }
                        b.loop_variables = [];
                    }
                }
            });
        };
        // variable_to_blocks = map<uint32_t, set<uint32_t>>
        // complete_write_blocks = map<uint32_t, set<uint32_t>>
        Compiler.prototype.analyze_parameter_preservation = function (entry, cfg, variable_to_blocks, complete_write_blocks) {
            for (var _i = 0, _a = entry.arguments; _i < _a.length; _i++) {
                var arg = _a[_i];
                // Non-pointers are always inputs.
                var type = this.get(SPIRType, arg.type);
                if (!type.pointer)
                    continue;
                // Opaque argument types are always in
                var potential_preserve = void 0;
                switch (type.basetype) {
                    case SPIRTypeBaseType.Sampler:
                    case SPIRTypeBaseType.Image:
                    case SPIRTypeBaseType.SampledImage:
                    case SPIRTypeBaseType.AtomicCounter:
                        potential_preserve = false;
                        break;
                    default:
                        potential_preserve = true;
                        break;
                }
                if (!potential_preserve)
                    continue;
                if (!variable_to_blocks.hasOwnProperty(arg.id)) {
                    // Variable is never accessed.
                    continue;
                }
                // We have accessed a variable, but there was no complete writes to that variable.
                // We deduce that we must preserve the argument.
                if (!complete_write_blocks.hasOwnProperty(arg.id)) {
                    arg.read_count++;
                    continue;
                }
                var itrSecond = complete_write_blocks[arg.id];
                // If there is a path through the CFG where no block completely writes to the variable, the variable will be in an undefined state
                // when the function returns. We therefore need to implicitly preserve the variable in case there are writers in the function.
                // Major case here is if a function is
                // void foo(int &var) { if (cond) var = 10; }
                // Using read/write counts, we will think it's just an out variable, but it really needs to be inout,
                // because if we don't write anything whatever we put into the function must return back to the caller.
                var visit_cache = new Set();
                if (exists_unaccessed_path_to_return(cfg, entry.entry_block, itrSecond, visit_cache))
                    arg.read_count++;
            }
        };
        Compiler.prototype.analyze_variable_scope = function (entry, handler) {
            var _this = this;
            // First, we map out all variable access within a function.
            // Essentially a map of block -> { variables accessed in the basic block }
            this.traverse_all_reachable_opcodes(entry, handler);
            var ir = this.ir;
            var cfg = this.function_cfgs[entry.self];
            // Analyze if there are parameters which need to be implicitly preserved with an "in" qualifier.
            this.analyze_parameter_preservation(entry, cfg, handler.accessed_variables_to_block, handler.complete_write_variables_to_block);
            // unordered_map<uint32_t, uint32_t>
            var potential_loop_variables = [];
            // Find the loop dominator block for each block.
            for (var _i = 0, _a = entry.blocks; _i < _a.length; _i++) {
                var block_id = _a[_i];
                var block = this.get(SPIRBlock, block_id);
                var itrSecond = ir.continue_block_to_loop_header[block_id];
                if (itrSecond !== undefined && itrSecond !== block_id) {
                    // Continue block might be unreachable in the CFG, but we still like to know the loop dominator.
                    // Edge case is when continue block is also the loop header, don't set the dominator in this case.
                    block.loop_dominator = itrSecond;
                }
                else {
                    var loop_dominator = cfg.find_loop_dominator(block_id);
                    if (loop_dominator != block_id)
                        block.loop_dominator = loop_dominator;
                    else
                        block.loop_dominator = SPIRBlock.NoDominator;
                }
            }
            // For each variable which is statically accessed.
            handler.accessed_variables_to_block.forEach(function (varSecond, varFirst) {
                // Only deal with variables which are considered local variables in this function.
                if (entry.local_variables.indexOf((varFirst)) < 0)
                    return;
                var builder = new DominatorBuilder(cfg);
                var blocks = varSecond;
                var type = _this.expression_type(varFirst);
                // Figure out which block is dominating all accesses of those variables.
                blocks.forEach(function (block) {
                    // If we're accessing a variable inside a continue block, this variable might be a loop variable.
                    // We can only use loop variables with scalars, as we cannot track static expressions for vectors.
                    if (_this.is_continue(block)) {
                        // Potentially awkward case to check for.
                        // We might have a variable inside a loop, which is touched by the continue block,
                        // but is not actually a loop variable.
                        // The continue block is dominated by the inner part of the loop, which does not make sense in high-level
                        // language output because it will be declared before the body,
                        // so we will have to lift the dominator up to the relevant loop header instead.
                        builder.add_block(ir.continue_block_to_loop_header[block]);
                        // Arrays or structs cannot be loop variables.
                        if (type.vecsize == 1 && type.columns == 1 && type.basetype !== SPIRTypeBaseType.Struct && type.array.length === 0) {
                            // The variable is used in multiple continue blocks, this is not a loop
                            // candidate, signal that by setting block to -1u.
                            var potential = maplike_get(0, potential_loop_variables, varFirst);
                            if (potential === 0)
                                potential_loop_variables[varFirst] = block;
                            else
                                potential_loop_variables[varFirst] = ~0;
                        }
                    }
                    builder.add_block(block);
                });
                builder.lift_continue_block_dominator();
                // Add it to a per-block list of variables.
                var dominating_block = builder.get_dominator();
                // For variables whose dominating block is inside a loop, there is a risk that these variables
                // actually need to be preserved across loop iterations. We can express this by adding
                // a "read" access to the loop header.
                // In the dominating block, we must see an OpStore or equivalent as the first access of an OpVariable.
                // Should that fail, we look for the outermost loop header and tack on an access there.
                // Phi nodes cannot have this problem.
                if (dominating_block) {
                    var variable = _this.get(SPIRVariable, varFirst);
                    if (!variable.phi_variable) {
                        var block = _this.get(SPIRBlock, dominating_block);
                        var preserve = _this.may_read_undefined_variable_in_block(block, varFirst);
                        if (preserve) {
                            // Find the outermost loop scope.
                            while (block.loop_dominator != (SPIRBlock.NoDominator))
                                block = _this.get(SPIRBlock, block.loop_dominator);
                            if (block.self != dominating_block) {
                                builder.add_block(block.self);
                                dominating_block = builder.get_dominator();
                            }
                        }
                    }
                }
                // If all blocks here are dead code, this will be 0, so the variable in question
                // will be completely eliminated.
                if (dominating_block) {
                    var block = _this.get(SPIRBlock, dominating_block);
                    block.dominated_variables.push(varFirst);
                    _this.get(SPIRVariable, varFirst).dominator = dominating_block;
                }
            });
            handler.accessed_temporaries_to_block.forEach(function (varSecond, varFirst) {
                if (!handler.result_id_to_type.hasOwnProperty(varFirst)) {
                    // We found a false positive ID being used, ignore.
                    // This should probably be an assert.
                    return;
                }
                var itrSecond = handler.result_id_to_type[varFirst];
                // There is no point in doing domination analysis for opaque types.
                var type = _this.get(SPIRType, itrSecond);
                if (_this.type_is_opaque_value(type))
                    return;
                var builder = new DominatorBuilder(cfg);
                var force_temporary = false;
                var used_in_header_hoisted_continue_block = false;
                // Figure out which block is dominating all accesses of those temporaries.
                var blocks = varSecond;
                blocks.forEach(function (block) {
                    builder.add_block(block);
                    if (blocks.size !== 1 && _this.is_continue(block)) {
                        // The risk here is that inner loop can dominate the continue block.
                        // Any temporary we access in the continue block must be declared before the loop.
                        // This is moot for complex loops however.
                        var loop_header_block = _this.get(SPIRBlock, ir.continue_block_to_loop_header[block]);
                        console.assert(loop_header_block.merge == SPIRBlockMerge.MergeLoop);
                        builder.add_block(loop_header_block.self);
                        used_in_header_hoisted_continue_block = true;
                    }
                });
                var dominating_block = builder.get_dominator();
                if (blocks.size !== 1 && _this.is_single_block_loop(dominating_block)) {
                    // Awkward case, because the loop header is also the continue block,
                    // so hoisting to loop header does not help.
                    force_temporary = true;
                }
                if (dominating_block) {
                    // If we touch a variable in the dominating block, this is the expected setup.
                    // SPIR-V normally mandates this, but we have extra cases for temporary use inside loops.
                    var first_use_is_dominator = blocks.has(dominating_block);
                    if (!first_use_is_dominator || force_temporary) {
                        if (handler.access_chain_expressions.has(varFirst)) {
                            // Exceptionally rare case.
                            // We cannot declare temporaries of access chains (except on MSL perhaps with pointers).
                            // Rather than do that, we force the indexing expressions to be declared in the right scope by
                            // tracking their usage to that end. There is no temporary to hoist.
                            // However, we still need to observe declaration order of the access chain.
                            if (used_in_header_hoisted_continue_block) {
                                // For this scenario, we used an access chain inside a continue block where we also registered an access to header block.
                                // This is a problem as we need to declare an access chain properly first with full definition.
                                // We cannot use temporaries for these expressions,
                                // so we must make sure the access chain is declared ahead of time.
                                // Force a complex for loop to deal with this.
                                // TODO: Out-of-order declaring for loops where continue blocks are emitted last might be another option.
                                var loop_header_block = _this.get(SPIRBlock, dominating_block);
                                console.assert(loop_header_block.merge === SPIRBlockMerge.MergeLoop);
                                loop_header_block.complex_continue = true;
                            }
                        }
                        else {
                            // This should be very rare, but if we try to declare a temporary inside a loop,
                            // and that temporary is used outside the loop as well (spirv-opt inliner likes this)
                            // we should actually emit the temporary outside the loop.
                            _this.hoisted_temporaries.add(varFirst);
                            _this.forced_temporaries.add(varFirst);
                            var block_temporaries = _this.get(SPIRBlock, dominating_block).declare_temporary;
                            block_temporaries.push(new Pair(handler.result_id_to_type[varFirst], varFirst));
                        }
                    }
                    else if (blocks.size > 1) {
                        // Keep track of the temporary as we might have to declare this temporary.
                        // This can happen if the loop header dominates a temporary, but we have a complex fallback loop.
                        // In this case, the header is actually inside the for (;;) {} block, and we have problems.
                        // What we need to do is hoist the temporaries outside the for (;;) {} block in case the header block
                        // declares the temporary.
                        var block_temporaries = _this.get(SPIRBlock, dominating_block).potential_declare_temporary;
                        block_temporaries.push(new Pair(handler.result_id_to_type[varFirst], varFirst));
                    }
                }
            });
            var seen_blocks = new Set();
            // Now, try to analyze whether or not these variables are actually loop variables.
            potential_loop_variables.forEach(function (loop_variable_second, loop_variable_first) {
                var var_ = _this.get(SPIRVariable, loop_variable_first);
                var dominator = var_.dominator;
                var block = loop_variable_second;
                // The variable was accessed in multiple continue blocks, ignore.
                if (block === (~0) || block === (0))
                    return;
                // Dead code.
                if (dominator === (0))
                    return;
                var header = 0;
                // Find the loop header for this block if we are a continue block.
                {
                    if (ir.continue_block_to_loop_header.hasOwnProperty(block)) {
                        header = ir.continue_block_to_loop_header[block];
                    }
                    else if (_this.get(SPIRBlock, block).continue_block == block) {
                        // Also check for self-referential continue block.
                        header = block;
                    }
                }
                console.assert(header);
                var header_block = _this.get(SPIRBlock, header);
                var blocks = maplike_get(Set, handler.accessed_variables_to_block, loop_variable_first);
                // If a loop variable is not used before the loop, it's probably not a loop variable.
                var has_accessed_variable = blocks.has(header);
                // Now, there are two conditions we need to meet for the variable to be a loop variable.
                // 1. The dominating block must have a branch-free path to the loop header,
                // this way we statically know which expression should be part of the loop variable initializer.
                // Walk from the dominator, if there is one straight edge connecting
                // dominator and loop header, we statically know the loop initializer.
                var static_loop_init = true;
                while (dominator != header) {
                    if (blocks.has(dominator))
                        has_accessed_variable = true;
                    var succ = cfg.get_succeeding_edges(dominator);
                    if (succ.length !== 1) {
                        static_loop_init = false;
                        break;
                    }
                    var pred = cfg.get_preceding_edges(succ[0]);
                    if (pred.length !== 1 || pred[0] !== dominator) {
                        static_loop_init = false;
                        break;
                    }
                    dominator = succ[0];
                }
                if (!static_loop_init || !has_accessed_variable)
                    return;
                // The second condition we need to meet is that no access after the loop
                // merge can occur. Walk the CFG to see if we find anything.
                seen_blocks.clear();
                cfg.walk_from(seen_blocks, header_block.merge_block, function (walk_block) {
                    // We found a block which accesses the variable outside the loop.
                    if (blocks.has(walk_block))
                        static_loop_init = false;
                    return true;
                });
                if (!static_loop_init)
                    return;
                // We have a loop variable.
                header_block.loop_variables.push(loop_variable_first);
                // Need to sort here as variables come from an unordered container, and pushing stuff in wrong order
                // will break reproducability in regression runs.
                header_block.loop_variables.sort();
                _this.get(SPIRVariable, loop_variable_first).loop_variable = true;
            });
        };
        Compiler.prototype.find_function_local_luts = function (entry, handler, single_function) {
            var _this = this;
            var cfg = this.function_cfgs[entry.self];
            var ir = this.ir;
            // For each variable which is statically accessed.
            handler.accessed_variables_to_block.forEach(function (accessed_var_second, accessed_var_first) {
                var blocks = accessed_var_second;
                var var_ = _this.get(SPIRVariable, accessed_var_first);
                var type = _this.expression_type(accessed_var_first);
                // Only consider function local variables here.
                // If we only have a single function in our CFG, private storage is also fine,
                // since it behaves like a function local variable.
                var allow_lut = var_.storage === StorageClass.StorageClassFunction || (single_function && var_.storage === StorageClass.StorageClassPrivate);
                if (!allow_lut)
                    return;
                // We cannot be a phi variable.
                if (var_.phi_variable)
                    return;
                // Only consider arrays here.
                if (type.array.length === 0)
                    return;
                // If the variable has an initializer, make sure it is a constant expression.
                var static_constant_expression = 0;
                if (var_.initializer) {
                    if (ir.ids[var_.initializer].get_type() !== Types.TypeConstant)
                        return;
                    static_constant_expression = var_.initializer;
                    // There can be no stores to this variable, we have now proved we have a LUT.
                    if (handler.complete_write_variables_to_block.hasOwnProperty(var_.self) ||
                        handler.partial_write_variables_to_block.hasOwnProperty(var_.self))
                        return;
                }
                else {
                    // We can have one, and only one write to the variable, and that write needs to be a constant.
                    // No partial writes allowed.
                    if (handler.partial_write_variables_to_block.hasOwnProperty(var_.self))
                        return;
                    var itr_second = handler.complete_write_variables_to_block[var_.self];
                    // No writes?
                    if (!itr_second)
                        return;
                    // We write to the variable in more than one block.
                    var write_blocks = itr_second;
                    if (write_blocks.size != 1)
                        return;
                    // The write needs to happen in the dominating block.
                    var builder_1 = new DominatorBuilder(cfg);
                    blocks.forEach(function (block) { return builder_1.add_block(block); });
                    var dominator = builder_1.get_dominator();
                    // The complete write happened in a branch or similar, cannot deduce static expression.
                    if (write_blocks.has(dominator))
                        return;
                    // Find the static expression for this variable.
                    var static_expression_handler = new StaticExpressionAccessHandler(_this, var_.self);
                    _this.traverse_all_reachable_opcodes(_this.get(SPIRBlock, dominator), static_expression_handler);
                    // We want one, and exactly one write
                    if (static_expression_handler.write_count != 1 || static_expression_handler.static_expression == 0)
                        return;
                    // Is it a constant expression?
                    if (ir.ids[static_expression_handler.static_expression].get_type() != Types.TypeConstant)
                        return;
                    // We found a LUT!
                    static_constant_expression = static_expression_handler.static_expression;
                }
                _this.get(SPIRConstant, static_constant_expression).is_used_as_lut = true;
                var_.static_expression = static_constant_expression;
                var_.statically_assigned = true;
                var_.remapped_variable = true;
            });
        };
        Compiler.prototype.may_read_undefined_variable_in_block = function (block, var_) {
            for (var _i = 0, _a = block.ops; _i < _a.length; _i++) {
                var op = _a[_i];
                var ops = this.stream(op);
                switch (op.op) {
                    case Op.OpStore:
                    case Op.OpCopyMemory:
                        if (ops[0] === var_)
                            return false;
                        break;
                    case Op.OpAccessChain:
                    case Op.OpInBoundsAccessChain:
                    case Op.OpPtrAccessChain:
                        // Access chains are generally used to partially read and write. It's too hard to analyze
                        // if all constituents are written fully before continuing, so just assume it's preserved.
                        // This is the same as the parameter preservation analysis.
                        if (ops[2] === var_)
                            return true;
                        break;
                    case Op.OpSelect:
                        // Variable pointers.
                        // We might read before writing.
                        if (ops[3] === var_ || ops[4] === var_)
                            return true;
                        break;
                    case Op.OpPhi: {
                        // Variable pointers.
                        // We might read before writing.
                        if (op.length < 2)
                            break;
                        var count_1 = op.length - 2;
                        for (var i = 0; i < count_1; i += 2)
                            if (ops[i + 2] === var_)
                                return true;
                        break;
                    }
                    case Op.OpCopyObject:
                    case Op.OpLoad:
                        if (ops[2] === var_)
                            return true;
                        break;
                    case Op.OpFunctionCall: {
                        if (op.length < 3)
                            break;
                        // May read before writing.
                        var count_2 = op.length - 3;
                        for (var i = 0; i < count_2; i++)
                            if (ops[i + 3] === var_)
                                return true;
                        break;
                    }
                }
            }
            // Not accessed somehow, at least not in a usual fashion.
            // It's likely accessed in a branch, so assume we must preserve.
            return true;
        };
        Compiler.prototype.instruction_to_result_type = function (result, op, args, length) {
            // Most instructions follow the pattern of <result-type> <result-id> <arguments>.
            // There are some exceptions.
            switch (op) {
                case Op.OpStore:
                case Op.OpCopyMemory:
                case Op.OpCopyMemorySized:
                case Op.OpImageWrite:
                case Op.OpAtomicStore:
                case Op.OpAtomicFlagClear:
                case Op.OpEmitStreamVertex:
                case Op.OpEndStreamPrimitive:
                case Op.OpControlBarrier:
                case Op.OpMemoryBarrier:
                case Op.OpGroupWaitEvents:
                case Op.OpRetainEvent:
                case Op.OpReleaseEvent:
                case Op.OpSetUserEventStatus:
                case Op.OpCaptureEventProfilingInfo:
                case Op.OpCommitReadPipe:
                case Op.OpCommitWritePipe:
                case Op.OpGroupCommitReadPipe:
                case Op.OpGroupCommitWritePipe:
                case Op.OpLine:
                case Op.OpNoLine:
                    return false;
                default:
                    if (length > 1 && this.maybe_get(SPIRType, args[0]) !== null) {
                        result.result_type = args[0];
                        result.result_id = args[1];
                        return true;
                    }
                    else
                        return false;
            }
        };
        Compiler.prototype.has_extended_decoration = function (id, decoration) {
            var m = this.ir.find_meta(id);
            if (!m)
                return false;
            var dec = m.decoration;
            return dec.extended.flags.get(decoration);
        };
        Compiler.prototype.type_is_opaque_value = function (type) {
            return !type.pointer && (type.basetype === SPIRTypeBaseType.SampledImage || type.basetype === SPIRTypeBaseType.Image ||
                type.basetype === SPIRTypeBaseType.Sampler);
        };
        Compiler.prototype.reflection_ssbo_instance_name_is_significant = function () {
            var _this = this;
            var ir = this.ir;
            if (ir.source.known) {
                // UAVs from HLSL source tend to be declared in a way where the type is reused
                // but the instance name is significant, and that's the name we should report.
                // For GLSL, SSBOs each have their own block type as that's how GLSL is written.
                return ir.source.hlsl;
            }
            var ssbo_type_ids = new Set();
            var aliased_ssbo_types = false;
            // If we don't have any OpSource information, we need to perform some shaky heuristics.
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                var type = _this.get(SPIRType, var_.basetype);
                if (!type.pointer || var_.storage === StorageClass.StorageClassFunction)
                    return;
                var ssbo = var_.storage === StorageClass.StorageClassStorageBuffer ||
                    (var_.storage === StorageClass.StorageClassUniform && _this.has_decoration(type.self, Decoration.DecorationBufferBlock));
                if (ssbo) {
                    if (ssbo_type_ids.has(type.self))
                        aliased_ssbo_types = true;
                    else
                        ssbo_type_ids.add(type.self);
                }
            });
            // If the block name is aliased, assume we have HLSL-style UAV declarations.
            return aliased_ssbo_types;
        };
        Compiler.prototype.get_remapped_declared_block_name = function (id, fallback_prefer_instance_name) {
            var itr = this.declared_block_names[id];
            if (itr) {
                return itr;
            }
            else {
                var var_ = this.get(SPIRVariable, id);
                if (fallback_prefer_instance_name) {
                    return this.to_name(var_.self);
                }
                else {
                    var type = this.get(SPIRType, var_.basetype);
                    var type_meta = this.ir.find_meta(type.self);
                    var block_name = type_meta ? type_meta.decoration.alias : null;
                    return (!block_name || block_name === "") ? this.get_block_fallback_name(id) : block_name;
                }
            }
        };
        Compiler.prototype.type_is_block_like = function (type) {
            if (type.basetype != SPIRTypeBaseType.Struct)
                return false;
            if (this.has_decoration(type.self, Decoration.DecorationBlock) || this.has_decoration(type.self, Decoration.DecorationBufferBlock)) {
                return true;
            }
            // Block-like types may have Offset decorations.
            for (var i = 0; i < type.member_types.length; i++)
                if (this.has_member_decoration(type.self, i, Decoration.DecorationOffset))
                    return true;
            return false;
        };
        Compiler.prototype.get_case_list = function (block) {
            var ir = this.ir;
            var width = 0;
            var constant;
            var var_;
            // First we check if we can get the type directly from the block.condition
            // since it can be a SPIRConstant or a SPIRVariable.
            if ((constant = this.maybe_get(SPIRConstant, block.condition))) {
                var type = this.get(SPIRType, constant.constant_type);
                width = type.width;
            }
            else if ((var_ = this.maybe_get(SPIRVariable, block.condition))) {
                var type = this.get(SPIRType, var_.basetype);
                width = type.width;
            }
            else {
                var search = ir.load_type_width[block.condition];
                if (search) {
                    throw new Error("Use of undeclared variable on a switch statement.");
                }
                width = search;
            }
            if (width > 32)
                return block.cases_64bit;
            return block.cases_32bit;
        };
        return Compiler;
    }());
    function exists_unaccessed_path_to_return(cfg, block, blocks, visit_cache) {
        // This block accesses the variable.
        if (blocks.has(block))
            return false;
        // We are at the end of the CFG.
        if (cfg.get_succeeding_edges(block).length === 0)
            return true;
        // If any of our successors have a path to the end, there exists a path from block.
        for (var _i = 0, _a = cfg.get_succeeding_edges(block); _i < _a.length; _i++) {
            var succ = _a[_i];
            if (visit_cache.has(succ)) {
                if (exists_unaccessed_path_to_return(cfg, succ, blocks, visit_cache))
                    return true;
                visit_cache.add(succ);
            }
        }
        return false;
    }

    var LocationComponentPair = /** @class */ (function () {
        function LocationComponentPair(location, component) {
            this.location = location;
            this.component = component;
        }
        return LocationComponentPair;
    }());

    var GLSLVertexOptions = /** @class */ (function () {
        function GLSLVertexOptions() {
            // "Vertex-like shader" here is any shader stage that can write BuiltInPosition.
            // GLSL: In vertex-like shaders, rewrite [0, w] depth (Vulkan/D3D style) to [-w, w] depth (GL style).
            // MSL: In vertex-like shaders, rewrite [-w, w] depth (GL style) to [0, w] depth.
            // HLSL: In vertex-like shaders, rewrite [-w, w] depth (GL style) to [0, w] depth.
            this.fixup_clipspace = false;
            // In vertex-like shaders, inverts gl_Position.y or equivalent.
            this.flip_vert_y = false;
            // GLSL only, for HLSL version of this option, see CompilerHLSL.
            // If true, the backend will assume that InstanceIndex will need to apply
            // a base instance offset. Set to false if you know you will never use base instance
            // functionality as it might remove some internal uniforms.
            this.support_nonzero_base_instance = true;
        }
        return GLSLVertexOptions;
    }());

    var GLSLPrecision;
    (function (GLSLPrecision) {
        GLSLPrecision[GLSLPrecision["DontCare"] = 0] = "DontCare";
        GLSLPrecision[GLSLPrecision["Lowp"] = 1] = "Lowp";
        GLSLPrecision[GLSLPrecision["Mediump"] = 2] = "Mediump";
        GLSLPrecision[GLSLPrecision["Highp"] = 3] = "Highp";
    })(GLSLPrecision || (GLSLPrecision = {}));

    var GLSLFragmentOptions = /** @class */ (function () {
        function GLSLFragmentOptions() {
            // Add precision mediump float in ES targets when emitting GLES source.
            // Add precision highp int in ES targets when emitting GLES source.
            this.default_float_precision = GLSLPrecision.Mediump;
            this.default_int_precision = GLSLPrecision.Highp;
        }
        return GLSLFragmentOptions;
    }());

    var GLSLOptions = /** @class */ (function () {
        function GLSLOptions() {
            // The shading language version. Corresponds to #version $VALUE.
            this.version = 450;
            // Emit the OpenGL ES shading language instead of desktop OpenGL.
            this.es = false;
            // Debug option to always emit temporary variables for all expressions.
            this.force_temporary = false;
            // If true, gl_PerVertex is explicitly redeclared in vertex, geometry and tessellation shaders.
            // The members of gl_PerVertex is determined by which built-ins are declared by the shader.
            // This option is ignored in ES versions, as redeclaration in ES is not required, and it depends on a different extension
            // (EXT_shader_io_blocks) which makes things a bit more fuzzy.
            this.separate_shader_objects = false;
            // Flattens multidimensional arrays, e.g. float foo[a][b][c] into single-dimensional arrays,
            // e.g. float foo[a * b * c].
            // This function does not change the actual SPIRType of any object.
            // Only the generated code, including declarations of interface variables are changed to be single array dimension.
            this.flatten_multidimensional_arrays = false;
            // For older desktop GLSL targets than version 420, the
            // GL_ARB_shading_language_420pack extensions is used to be able to support
            // layout(binding) on UBOs and samplers.
            // If disabled on older targets, binding decorations will be stripped.
            this.enable_420pack_extension = true;
            // In non-Vulkan GLSL, emit push constant blocks as UBOs rather than plain uniforms.
            this.emit_push_constant_as_uniform_buffer = false;
            // Always emit uniform blocks as plain uniforms, regardless of the GLSL version, even when UBOs are supported.
            // Does not apply to shader storage or push constant blocks.
            this.emit_uniform_buffer_as_plain_uniforms = false;
            // Emit OpLine directives if present in the module.
            // May not correspond exactly to original source, but should be a good approximation.
            this.emit_line_directives = false;
            // In cases where readonly/writeonly decoration are not used at all,
            // we try to deduce which qualifier(s) we should actually used, since actually emitting
            // read-write decoration is very rare, and older glslang/HLSL compilers tend to just emit readwrite as a matter of fact.
            // The default (true) is to enable automatic deduction for these cases, but if you trust the decorations set
            // by the SPIR-V, it's recommended to set this to false.
            this.enable_storage_image_qualifier_deduction = true;
            // On some targets (WebGPU), uninitialized variables are banned.
            // If this is enabled, all variables (temporaries, Private, Function)
            // which would otherwise be uninitialized will now be initialized to 0 instead.
            this.force_zero_initialized_variables = false;
            // In GLSL, force use of I/O block flattening, similar to
            // what happens on legacy GLSL targets for blocks and structs.
            this.force_flattened_io_blocks = false;
            // If non-zero, controls layout(num_views = N) in; in GL_OVR_multiview2.
            this.ovr_multiview_view_count = 0;
            this.vertex = new GLSLVertexOptions();
            this.fragment = new GLSLFragmentOptions();
        }
        return GLSLOptions;
    }());

    var CompilerGLSL = /** @class */ (function (_super) {
        __extends(CompilerGLSL, _super);
        function CompilerGLSL(parsedIR) {
            var _this = _super.call(this, parsedIR) || this;
            _this.backend = new BackendVariations();
            _this.flattened_buffer_blocks = new Set();
            _this.forced_extensions = [];
            // GL_EXT_shader_framebuffer_fetch support.
            _this.subpass_to_framebuffer_fetch_attachment = [];
            _this.inout_color_attachments = [];
            _this.masked_output_locations = new Set();
            _this.masked_output_builtins = new Set();
            _this.options = new GLSLOptions();
            _this.current_locale_radix_character = ".";
            _this.init();
            return _this;
        }
        CompilerGLSL.prototype.remap_pixel_local_storage = function (inputs, outputs) {
            this.pls_inputs = inputs;
            this.pls_outputs = outputs;
            this.remap_pls_variables();
        };
        // Redirect a subpassInput reading from input_attachment_index to instead load its value from
        // the color attachment at location = color_location. Requires ESSL.
        // If coherent, uses GL_EXT_shader_framebuffer_fetch, if not, uses noncoherent variant.
        CompilerGLSL.prototype.remap_ext_framebuffer_fetch = function (input_attachment_index, color_location, coherent) {
            this.subpass_to_framebuffer_fetch_attachment.push(new Pair(input_attachment_index, color_location));
            this.inout_color_attachments.push(new Pair(color_location, coherent));
        };
        CompilerGLSL.prototype.get_common_options = function () {
            return this.options;
        };
        // Adds an extension which is required to run this shader, e.g.
        // require_extension("GL_KHR_my_extension");
        CompilerGLSL.prototype.require_extension = function (ext) {
            if (!this.has_extension(ext))
                this.forced_extensions.push(ext);
        };
        // Legacy GLSL compatibility method.
        // Takes a uniform or push constant variable and flattens it into a (i|u)vec4 array[N]; array instead.
        // For this to work, all types in the block must be the same basic type, e.g. mixing vec2 and vec4 is fine, but
        // mixing int and float is not.
        // The name of the uniform array will be the same as the interface block name.
        CompilerGLSL.prototype.flatten_buffer_block = function (id) {
            var var_ = this.get(SPIRVariable, id);
            var type = this.get(SPIRType, var_.basetype);
            var name = this.to_name(type.self, false);
            var flags = this.ir.meta[type.self].decoration.decoration_flags;
            if (type.array.length > 0)
                throw new Error(name + " is an array of UBOs.");
            if (type.basetype !== SPIRTypeBaseType.Struct)
                throw new Error(name + " is not a struct.");
            if (!flags.get(Decoration.DecorationBlock))
                throw new Error(name + " is not a block.");
            if (type.member_types.length === 0)
                throw new Error(name + " is an empty struct.");
            this.flattened_buffer_blocks.add(id);
        };
        // If a shader output is active in this stage, but inactive in a subsequent stage,
        // this can be signalled here. This can be used to work around certain cross-stage matching problems
        // which plagues MSL and HLSL in certain scenarios.
        // An output which matches one of these will not be emitted in stage output interfaces, but rather treated as a private
        // variable.
        // This option is only meaningful for MSL and HLSL, since GLSL matches by location directly.
        // Masking builtins only takes effect if the builtin in question is part of the stage output interface.
        CompilerGLSL.prototype.mask_stage_output_by_location = function (location, component) {
            this.masked_output_locations.add(new LocationComponentPair(location, component));
        };
        CompilerGLSL.prototype.mask_stage_output_by_builtin = function (builtin) {
            this.masked_output_builtins.add(builtin);
        };
        CompilerGLSL.prototype.has_extension = function (ext) {
            return this.forced_extensions.indexOf(ext) >= 0;
        };
        CompilerGLSL.prototype.require_extension_internal = function (ext) {
            if (this.backend.supports_extensions && !this.has_extension(ext)) {
                this.forced_extensions.push(ext);
                this.force_recompile();
            }
        };
        CompilerGLSL.prototype.is_legacy = function () {
            var options = this.options;
            return (options.es && options.version < 300) || (!options.es && options.version < 130);
        };
        CompilerGLSL.prototype.is_legacy_es = function () {
            var options = this.options;
            return options.es && options.version < 300;
        };
        CompilerGLSL.prototype.is_legacy_desktop = function () {
            var options = this.options;
            return !options.es && options.version < 130;
        };
        CompilerGLSL.prototype.remap_pls_variables = function () {
            for (var _i = 0, _a = this.pls_inputs; _i < _a.length; _i++) {
                var input = _a[_i];
                var var_ = this.get(SPIRVariable, input.id);
                var input_is_target = false;
                if (var_.storage === StorageClass.StorageClassUniformConstant) {
                    var type = this.get(SPIRType, var_.basetype);
                    input_is_target = type.image.dim === Dim.DimSubpassData;
                }
                if (var_.storage !== StorageClass.StorageClassInput && !input_is_target)
                    throw new Error("Can only use in and target variables for PLS inputs.");
                var_.remapped_variable = true;
            }
            for (var _b = 0, _c = this.pls_outputs; _b < _c.length; _b++) {
                var output = _c[_b];
                var var_ = this.get(SPIRVariable, output.id);
                if (var_.storage !== StorageClass.StorageClassOutput)
                    throw new Error("Can only use out variables for PLS outputs.");
                var_.remapped_variable = true;
            }
        };
        CompilerGLSL.prototype.init = function () {
            var ir = this.ir;
            var options = this.options;
            if (ir.source.known) {
                options.es = ir.source.es;
                options.version = ir.source.version;
            }
        };
        CompilerGLSL.prototype.compile = function () {
            var ir = this.ir;
            var options = this.options;
            var backend = this.backend;
            ir.fixup_reserved_names();
            // if (!options.vulkan_semantics)
            // {
            // only NV_gpu_shader5 supports divergent indexing on OpenGL, and it does so without extra qualifiers
            backend.nonuniform_qualifier = "";
            backend.needs_row_major_load_workaround = true;
            // }
            backend.allow_precision_qualifiers = /*options.vulkan_semantics ||*/ options.es;
            backend.force_gl_in_out_block = true;
            backend.supports_extensions = true;
            backend.use_array_constructor = true;
            backend.workgroup_size_is_hidden = true;
            backend.support_precise_qualifier = (!options.es && options.version >= 400) || (options.es && options.version >= 320);
            if (this.is_legacy_es())
                backend.support_case_fallthrough = false;
            // Scan the SPIR-V to find trivial uses of extensions.
            this.fixup_type_alias();
            this.reorder_type_alias();
            this.build_function_control_flow_graphs_and_analyze();
            /*find_static_extensions();
            fixup_image_load_store_access();
            update_active_builtins();
            analyze_image_and_sampler_usage();
            analyze_interlocked_resource_usage();
            if (!inout_color_attachments.empty())
                emit_inout_fragment_outputs_copy_to_subpass_inputs();

            // Shaders might cast unrelated data to pointers of non-block types.
            // Find all such instances and make sure we can cast the pointers to a synthesized block type.
            if (ir.addressing_model == AddressingModelPhysicalStorageBuffer64EXT)
                analyze_non_block_pointer_types();

            uint32_t;
            pass_count = 0;
            do {
                if (pass_count >= 3)
                    SPIRV_CROSS_THROW("Over 3 compilation loops detected. Must be a bug!");

                reset();

                buffer.reset();

                emit_header();
                emit_resources();
                emit_extension_workarounds(get_execution_model());

                emit_function(get<SPIRFunction>(ir.default_entry_point), Bitset());

                pass_count++;
            } while (is_forcing_recompilation());

            // Implement the interlocked wrapper function at the end.
            // The body was implemented in lieu of main().
            if (interlocked_is_complex) {
                statement("void main()");
                begin_scope();
                statement("// Interlocks were used in a way not compatible with GLSL, this is very slow.");
                statement("SPIRV_Cross_beginInvocationInterlock();");
                statement("spvMainInterlockedBody();");
                statement("SPIRV_Cross_endInvocationInterlock();");
                end_scope();
            }

            // Entry point in GLSL is always main().
            get_entry_point().name = "main";

            return buffer.str();*/
            return "";
        };
        CompilerGLSL.prototype.fixup_type_alias = function () {
            var _this = this;
            var ir = this.ir;
            // Due to how some backends work, the "master" type of type_alias must be a block-like type if it exists.
            ir.for_each_typed_id(SPIRType, function (self, type) {
                if (!type.type_alias)
                    return;
                if (_this.has_decoration(type.self, Decoration.DecorationBlock) || _this.has_decoration(type.self, Decoration.DecorationBufferBlock)) {
                    // Top-level block types should never alias anything else.
                    type.type_alias = 0;
                }
                else if (_this.type_is_block_like(type) && type.self === (self)) {
                    // A block-like type is any type which contains Offset decoration, but not top-level blocks,
                    // i.e. blocks which are placed inside buffers.
                    // Become the master.
                    ir.for_each_typed_id(SPIRType, function (other_id, other_type) {
                        if (other_id == self)
                            return;
                        if (other_type.type_alias == type.type_alias)
                            other_type.type_alias = self;
                    });
                    _this.get(SPIRType, type.type_alias).type_alias = self;
                    type.type_alias = 0;
                }
            });
        };
        CompilerGLSL.prototype.reorder_type_alias = function () {
            var ir = this.ir;
            // Reorder declaration of types so that the master of the type alias is always emitted first.
            // We need this in case a type B depends on type A (A must come before in the vector), but A is an alias of a type Abuffer, which
            // means declaration of A doesn't happen (yet), and order would be B, ABuffer and not ABuffer, B. Fix this up here.
            var loop_lock = ir.create_loop_hard_lock();
            var type_ids = ir.ids_for_type[Types.TypeType];
            for (var _i = 0, type_ids_1 = type_ids; _i < type_ids_1.length; _i++) {
                var alias_itr = type_ids_1[_i];
                var type = this.get(SPIRType, alias_itr);
                if (type.type_alias !== (0) &&
                    !this.has_extended_decoration(type.type_alias, ExtendedDecorations.SPIRVCrossDecorationBufferBlockRepacked)) {
                    // We will skip declaring this type, so make sure the type_alias type comes before.
                    var master_itr = type_ids.indexOf((type.type_alias));
                    console.assert(master_itr >= 0);
                    if (alias_itr < master_itr) {
                        // Must also swap the type order for the constant-type joined array.
                        var joined_types = ir.ids_for_constant_or_type;
                        var alt_alias_itr = joined_types.indexOf(alias_itr);
                        var alt_master_itr = joined_types.indexOf(master_itr);
                        console.assert(alt_alias_itr >= 0);
                        console.assert(alt_master_itr >= 0);
                        swap(joined_types, alias_itr, master_itr);
                        swap(joined_types, alt_alias_itr, alt_master_itr);
                    }
                }
            }
            loop_lock.dispose();
        };
        return CompilerGLSL;
    }(Compiler));
    function swap(arr, a, b) {
        var t = a[a];
        arr[a] = arr[b];
        arr[b] = t;
    }

    function rename_interface_variable(compiler, resources, location, name) {
        for (var _i = 0, resources_1 = resources; _i < resources_1.length; _i++) {
            var v = resources_1[_i];
            if (!compiler.has_decoration(v.id, Decoration.DecorationLocation))
                continue;
            var loc = compiler.get_decoration(v.id, Decoration.DecorationLocation);
            if (loc != location)
                continue;
            var type = compiler.get_type(v.base_type_id);
            // This is more of a friendly variant. If we need to rename interface variables, we might have to rename
            // structs as well and make sure all the names match up.
            if (type.basetype == SPIRTypeBaseType.Struct) {
                compiler.set_name(v.base_type_id, "SPIRV_Cross_Interface_Location" + location);
                for (var i = 0; i < type.member_types.length; i++)
                    compiler.set_member_name(v.base_type_id, i, "InterfaceMember" + i);
            }
            compiler.set_name(v.id, name);
        }
    }
    function inherit_combined_sampler_bindings(compiler) {
        var samplers = compiler.get_combined_image_samplers();
        for (var _i = 0, samplers_1 = samplers; _i < samplers_1.length; _i++) {
            var s = samplers_1[_i];
            if (compiler.has_decoration(s.image_id, Decoration.DecorationDescriptorSet)) {
                var set = compiler.get_decoration(s.image_id, Decoration.DecorationDescriptorSet);
                compiler.set_decoration(s.combined_id, Decoration.DecorationDescriptorSet, set);
            }
            if (compiler.has_decoration(s.image_id, Decoration.DecorationBinding)) {
                var binding = compiler.get_decoration(s.image_id, Decoration.DecorationBinding);
                compiler.set_decoration(s.combined_id, Decoration.DecorationBinding, binding);
            }
        }
    }

    var PlsRemap = /** @class */ (function () {
        function PlsRemap(id, format) {
            this.id = id;
            this.format = format;
        }
        return PlsRemap;
    }());

    function stage_to_execution_model(stage) {
        if (stage === "vert")
            return ExecutionModel.ExecutionModelVertex;
        else if (stage === "frag")
            return ExecutionModel.ExecutionModelFragment;
        else if (stage === "comp")
            return ExecutionModel.ExecutionModelGLCompute;
        else if (stage === "tesc")
            return ExecutionModel.ExecutionModelTessellationControl;
        else if (stage === "tese")
            return ExecutionModel.ExecutionModelTessellationEvaluation;
        else if (stage === "geom")
            return ExecutionModel.ExecutionModelGeometry;
        else
            throw new Error("Invalid stage!");
    }
    function compile_iteration(args, spirv_file) {
        var spirv_parser = new Parser(spirv_file);
        spirv_parser.parse();
        var compiler = new CompilerGLSL(spirv_parser.get_parsed_ir());
        if (args.variable_type_remaps.length !== 0) {
            var remap_cb = function (type, name, out) {
                for (var _i = 0, _a = args.variable_type_remaps; _i < _a.length; _i++) {
                    var remap = _a[_i];
                    if (name === remap.variable_name)
                        ;
                }
            };
            compiler.set_variable_type_remap_callback(remap_cb);
        }
        for (var _i = 0, _a = args.masked_stage_outputs; _i < _a.length; _i++) {
            var masked = _a[_i];
            compiler.mask_stage_output_by_location(masked.first, masked.second);
        }
        for (var _b = 0, _c = args.masked_stage_builtins; _b < _c.length; _b++) {
            var masked = _c[_b];
            compiler.mask_stage_output_by_builtin(masked);
        }
        for (var _d = 0, _e = args.entry_point_rename; _d < _e.length; _d++) {
            var rename = _e[_d];
            compiler.rename_entry_point(rename.old_name, rename.new_name, rename.execution_model);
        }
        var entry_points = compiler.get_entry_points_and_stages();
        var entry_point = args.entry;
        var model = ExecutionModel.ExecutionModelMax;
        if (args.entry_stage && args.entry_stage.length > 0) {
            model = stage_to_execution_model(args.entry_stage);
            if (!entry_point || entry_point === "") {
                // Just use the first entry point with this stage.
                for (var _f = 0, entry_points_1 = entry_points; _f < entry_points_1.length; _f++) {
                    var e = entry_points_1[_f];
                    if (e.execution_model === model) {
                        entry_point = e.name;
                        break;
                    }
                }
                if (!entry_point) {
                    throw new Error("Could not find an entry point with stage: ".concat(args.entry_stage));
                }
            }
            else {
                // Make sure both stage and name exists.
                var exists = false;
                for (var _g = 0, entry_points_2 = entry_points; _g < entry_points_2.length; _g++) {
                    var e = entry_points_2[_g];
                    if (e.execution_model === model && e.name === entry_point) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    throw new Error("Could not find an entry point %s with stage: ".concat(args.entry_stage));
                }
            }
        }
        else if (entry_point && entry_point !== "") {
            // Make sure there is just one entry point with this name, or the stage
            // is ambiguous.
            var stage_count = 0;
            for (var _h = 0, entry_points_3 = entry_points; _h < entry_points_3.length; _h++) {
                var e = entry_points_3[_h];
                if (e.name === entry_point) {
                    stage_count++;
                    model = e.execution_model;
                }
            }
            if (stage_count === 0) {
                throw new Error("There is no entry point with name: ".concat(entry_point));
            }
            else if (stage_count > 1) {
                throw new Error("There is more than one entry point with name: ".concat(entry_point, ". Use --stage."));
            }
        }
        if (entry_point && entry_point !== "")
            compiler.set_entry_point(entry_point, model);
        if (!args.set_version && !compiler.get_common_options().version) {
            throw new Error("Didn't specify GLSL version and SPIR-V did not specify language.");
        }
        var opts = compiler.get_common_options();
        if (args.set_version)
            opts.version = args.version;
        if (args.set_es)
            opts.es = args.es;
        opts.force_temporary = args.force_temporary;
        opts.separate_shader_objects = args.sso;
        opts.flatten_multidimensional_arrays = args.flatten_multidimensional_arrays;
        opts.enable_420pack_extension = args.use_420pack_extension;
        opts.vertex.fixup_clipspace = args.fixup;
        opts.vertex.flip_vert_y = args.yflip;
        opts.vertex.support_nonzero_base_instance = args.support_nonzero_baseinstance;
        opts.emit_push_constant_as_uniform_buffer = args.glsl_emit_push_constant_as_ubo;
        opts.emit_uniform_buffer_as_plain_uniforms = args.glsl_emit_ubo_as_plain_uniforms;
        opts.force_flattened_io_blocks = args.glsl_force_flattened_io_blocks;
        opts.ovr_multiview_view_count = args.glsl_ovr_multiview_view_count;
        opts.emit_line_directives = args.emit_line_directives;
        opts.enable_storage_image_qualifier_deduction = args.enable_storage_image_qualifier_deduction;
        opts.force_zero_initialized_variables = args.force_zero_initialized_variables;
        for (var _j = 0, _k = args.glsl_ext_framebuffer_fetch; _j < _k.length; _j++) {
            var fetch_1 = _k[_j];
            compiler.remap_ext_framebuffer_fetch(fetch_1.first, fetch_1.second, !args.glsl_ext_framebuffer_fetch_noncoherent);
        }
        var res;
        if (args.remove_unused) {
            var active = compiler.get_active_interface_variables();
            res = compiler.get_shader_resources(active);
            compiler.set_enabled_interface_variables(active);
        }
        else
            res = compiler.get_shader_resources();
        if (args.flatten_ubo) {
            for (var _l = 0, _m = res.uniform_buffers; _l < _m.length; _l++) {
                var ubo = _m[_l];
                compiler.flatten_buffer_block(ubo.id);
            }
            for (var _o = 0, _p = res.push_constant_buffers; _o < _p.length; _o++) {
                var ubo = _p[_o];
                compiler.flatten_buffer_block(ubo.id);
            }
        }
        var pls_inputs = remap_pls(args.pls_in, res.stage_inputs, res.subpass_inputs);
        var pls_outputs = remap_pls(args.pls_out, res.stage_outputs, null);
        compiler.remap_pixel_local_storage(pls_inputs, pls_outputs);
        for (var _q = 0, _r = args.extensions; _q < _r.length; _q++) {
            var ext = _r[_q];
            compiler.require_extension(ext);
        }
        for (var _s = 0, _t = args.remaps; _s < _t.length; _s++) {
            var remap = _t[_s];
            if (remap_generic(compiler, res.stage_inputs, remap))
                continue;
            if (remap_generic(compiler, res.stage_outputs, remap))
                continue;
            if (remap_generic(compiler, res.subpass_inputs, remap))
                continue;
        }
        for (var _u = 0, _v = args.interface_variable_renames; _u < _v.length; _u++) {
            var rename = _v[_u];
            if (rename.storageClass === StorageClass.StorageClassInput)
                rename_interface_variable(compiler, res.stage_inputs, rename.location, rename.variable_name);
            else if (rename.storageClass == StorageClass.StorageClassOutput)
                rename_interface_variable(compiler, res.stage_outputs, rename.location, rename.variable_name);
            else {
                throw new Error("error at --rename-interface-variable <in|out> ...");
            }
        }
        {
            compiler.build_combined_image_samplers();
            if (args.combined_samplers_inherit_bindings)
                inherit_combined_sampler_bindings(compiler);
            // Give the remapped combined samplers new names.
            for (var _w = 0, _x = compiler.get_combined_image_samplers(); _w < _x.length; _w++) {
                var remap = _x[_w];
                compiler.set_name(remap.combined_id, "SPIRV_Cross_Combined" + compiler.get_name(remap.image_id) +
                    compiler.get_name(remap.sampler_id));
            }
        }
        var ret = compiler.compile();
        /*if (args.dump_resources)
        {
            compiler->update_active_builtins();
            print_resources(*compiler, res);
            print_push_constant_resources(*compiler, res.push_constant_buffers);
            print_spec_constants(*compiler);
            print_capabilities_and_extensions(*compiler);
        }*/
        return ret;
    }
    function remap_generic(compiler, resources, remap) {
        var elm = resources.find(function (res) { return res.name === remap.src_name; });
        if (elm) {
            compiler.set_remapped_variable_state(elm.id, true);
            compiler.set_name(elm.id, remap.dst_name);
            compiler.set_subpass_input_remapped_components(elm.id, remap.components);
            return true;
        }
        else
            return false;
    }
    function remap_pls(pls_variables, resources, secondary_resources) {
        var ret = [];
        for (var _i = 0, pls_variables_1 = pls_variables; _i < pls_variables_1.length; _i++) {
            var pls = pls_variables_1[_i];
            var found = false;
            for (var _a = 0, resources_1 = resources; _a < resources_1.length; _a++) {
                var res = resources_1[_a];
                if (res.name === pls.name) {
                    ret.push(new PlsRemap(res.id, pls.format));
                    found = true;
                    break;
                }
            }
            if (!found && secondary_resources) {
                for (var _b = 0, secondary_resources_1 = secondary_resources; _b < secondary_resources_1.length; _b++) {
                    var res = secondary_resources_1[_b];
                    if (res.name === pls.name) {
                        ret.push(new PlsRemap(res.id, pls.format));
                        found = true;
                        break;
                    }
                }
            }
            if (!found)
                throw new Error("Did not find stage input/output/target with name ".concat(pls.name));
        }
        return ret;
    }

    exports.Version = void 0;
    (function (Version) {
        Version[Version["WebGL1"] = 100] = "WebGL1";
        Version[Version["WebGL2"] = 300] = "WebGL2";
    })(exports.Version || (exports.Version = {}));
    function compile(data, version) {
        var args = new Args();
        args.version = version;
        args.set_version = true;
        args.es = true;
        args.set_es = true;
        var spirv_file = new Uint32Array(data);
        if (args.reflect && args.reflect !== "") {
            throw new Error("Reflection not yet supported!");
        }
        return compile_iteration(args, spirv_file);
    }

    exports.compile = compile;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
