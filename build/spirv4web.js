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
            // For composites which are constant arrays, etc.
            // should be ConstantID[]
            _this.subconstants = new Uint32Array();
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
    function convert_to_string(value, int64_type, long_long_literal_suffix) {
        // ignore radix char as JS always uses .
        if (int64_type === undefined)
            return value.toString();
        return value.toString() + (long_long_literal_suffix ? "ll" : "l");
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
            return this.get_member_decoration_bitset(id, index).get(decoration);
        };
        ParsedIR.prototype.get_member_decoration_bitset = function (id, index) {
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
                base_flags = m.decoration.decoration_flags.clone();
            else
                base_flags = new Bitset();
            if (type.member_types.length === 0)
                return (base_flags === null || base_flags === void 0 ? void 0 : base_flags.clone()) || new Bitset();
            var all_members_flags = this.get_buffer_block_type_flags(type);
            base_flags.merge_or(all_members_flags);
            return base_flags;
        };
        ParsedIR.prototype.get_buffer_block_type_flags = function (type) {
            if (type.member_types.length === 0)
                return new Bitset();
            // make sure we're not overriding anything, so clone
            var all_members_flags = this.get_member_decoration_bitset(type.self, 0).clone();
            for (var i = 1; i < type.member_types.length; i++)
                all_members_flags.merge_and(this.get_member_decoration_bitset(type.self, i));
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
                m.decoration.alias = ParsedIR.sanitize_identifier(m.decoration.alias, false, false);
                for (var _i = 0, _a = m.members; _i < _a.length; _i++) {
                    var memb = _a[_i];
                    memb.alias = ParsedIR.sanitize_identifier(memb.alias, true, false);
                }
            }
            this.meta_needing_name_fixup.clear();
        };
        ParsedIR.sanitize_identifier = function (name, member, allow_reserved_prefixes) {
            if (!is_valid_identifier(name))
                name = ensure_valid_identifier(name);
            if (is_reserved_identifier(name, member, allow_reserved_prefixes))
                name = make_unreserved_identifier(name);
            return name;
        };
        ParsedIR.sanitize_underscores = function (str) {
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
        };
        ParsedIR.is_globally_reserved_identifier = function (str, allow_reserved_prefixes) {
            return is_reserved_identifier(str, false, allow_reserved_prefixes);
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
        ParsedIR.prototype.get_spirv_version = function () {
            return this.spirv[1];
        };
        ParsedIR.prototype.get = function (classRef, id) {
            return variant_get(classRef, this.ids[id]);
        };
        return ParsedIR;
    }());
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
        return ParsedIR.sanitize_underscores(str);
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
            this.id_x = 0;
            this.id_y = 0;
            this.id_z = 0;
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
                    type.basetype = signedness ? to_signed_basetype$1(width) : to_unsigned_basetype$1(width);
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
    function to_signed_basetype$1(width) {
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
    function to_unsigned_basetype$1(width) {
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
                            if (var_ && storage_class_is_interface$1(var_.storage))
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
                            if (var_ && storage_class_is_interface$1(var_.storage))
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
                            if (var_ && storage_class_is_interface$1(var_.storage))
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
                        if (var_ && storage_class_is_interface$1(var_.storage))
                            variables.add(args[offset]);
                        var_ = compiler.maybe_get(SPIRVariable, args[offset + 1]);
                        if (var_ && storage_class_is_interface$1(var_.storage))
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
                                                if (var_ && storage_class_is_interface$1(var_.storage))
                                                    variables.add(args[offset + 4]);
                                                break;
                                            }
                                        case GLSLstd450.GLSLstd450Modf:
                                        case GLSLstd450.GLSLstd450Fract:
                                            {
                                                var var_ = compiler.maybe_get(SPIRVariable, args[offset + 5]);
                                                if (var_ && storage_class_is_interface$1(var_.storage))
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
                                                if (var_ && storage_class_is_interface$1(var_.storage))
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
                if (var_ && storage_class_is_interface$1(var_.storage))
                    variables.add(variable);
            }
            return true;
        };
        return InterfaceVariableAccessHandler;
    }(OpcodeHandler));
    function storage_class_is_interface$1(storage) {
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
    var BuiltInResource = /** @class */ (function () {
        function BuiltInResource() {
        }
        return BuiltInResource;
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
        CFG.prototype.node_terminates_control_flow_in_sub_graph = function (from, to) {
            // Walk backwards, starting from "to" block.
            // Only follow pred edges if they have a 1:1 relationship, or a merge relationship.
            // If we cannot find a path to "from", we must assume that to is inside control flow in some way.
            var compiler = this.compiler;
            var from_block = compiler.get(SPIRBlock, from);
            var ignore_block_id = 0;
            if (from_block.merge === SPIRBlockMerge.MergeLoop)
                ignore_block_id = from_block.merge_block;
            while (to != from) {
                var pred_itr_second = this.preceding_edges[to];
                if (!pred_itr_second)
                    return false;
                var builder = new DominatorBuilder(this);
                for (var _i = 0, pred_itr_second_1 = pred_itr_second; _i < pred_itr_second_1.length; _i++) {
                    var edge = pred_itr_second_1[_i];
                    builder.add_block(edge);
                }
                var dominator = builder.get_dominator();
                if (dominator === 0)
                    return false;
                var dom = compiler.get(SPIRBlock, dominator);
                var true_path_ignore = false;
                var false_path_ignore = false;
                if (ignore_block_id && dom.terminator === SPIRBlockTerminator.Select) {
                    var true_block = compiler.get(SPIRBlock, dom.true_block);
                    var false_block = compiler.get(SPIRBlock, dom.false_block);
                    var ignore_block = compiler.get(SPIRBlock, ignore_block_id);
                    true_path_ignore = compiler.execution_is_branchless(true_block, ignore_block);
                    false_path_ignore = compiler.execution_is_branchless(false_block, ignore_block);
                }
                if ((dom.merge === SPIRBlockMerge.MergeSelection && dom.next_block == to) ||
                    (dom.merge === SPIRBlockMerge.MergeLoop && dom.merge_block == to) ||
                    (dom.terminator == SPIRBlockTerminator.Direct && dom.next_block == to) ||
                    (dom.terminator == SPIRBlockTerminator.Select && dom.true_block == to && false_path_ignore) ||
                    (dom.terminator == SPIRBlockTerminator.Select && dom.false_block == to && true_path_ignore)) {
                    // Allow walking selection constructs if the other branch reaches out of a loop construct.
                    // It cannot be in-scope anymore.
                    to = dominator;
                }
                else
                    return false;
            }
            return true;
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

    var ActiveBuiltinHandler = /** @class */ (function (_super) {
        __extends(ActiveBuiltinHandler, _super);
        function ActiveBuiltinHandler(compiler) {
            var _this = _super.call(this) || this;
            _this.compiler = compiler;
            return _this;
        }
        ActiveBuiltinHandler.prototype.handle = function (opcode, args, length) {
            return false;
        };
        ActiveBuiltinHandler.prototype.handle_builtin = function (type, builtin, decoration_flags) {
            // If used, we will need to explicitly declare a new array size for these builtins.
            if (builtin === BuiltIn.BuiltInClipDistance) {
                if (!type.array_size_literal[0])
                    throw new Error("Array size for ClipDistance must be a literal.");
                var array_size = type.array[0];
                if (array_size === 0)
                    throw new Error("Array size for ClipDistance must not be unsized.");
                this.compiler.clip_distance_count = array_size;
            }
            else if (builtin === BuiltIn.BuiltInCullDistance) {
                if (!type.array_size_literal[0])
                    throw new Error("Array size for CullDistance must be a literal.");
                var array_size = type.array[0];
                if (array_size === 0)
                    throw new Error("Array size for CullDistance must not be unsized.");
                this.compiler.cull_distance_count = array_size;
            }
            else if (builtin === BuiltIn.BuiltInPosition) {
                if (decoration_flags.get(Decoration.DecorationInvariant))
                    this.compiler.position_invariant = true;
            }
        };
        ActiveBuiltinHandler.prototype.add_if_builtin_or_block = function (id) {
            this.add_if_builtin(id, true);
        };
        ActiveBuiltinHandler.prototype.add_if_builtin = function (id, allow_blocks) {
            // Only handle plain variables here.
            // Builtins which are part of a block are handled in AccessChain.
            // If allow_blocks is used however, this is to handle initializers of blocks,
            // which implies that all members are written to.
            if (allow_blocks === void 0) { allow_blocks = false; }
            var compiler = this.compiler;
            var var_ = compiler.maybe_get(SPIRVariable, id);
            var m = compiler.ir.find_meta(id);
            if (var_ && m) {
                var type = compiler.get(SPIRType, var_.basetype);
                var decorations = m.decoration;
                var flags = type.storage == StorageClass.StorageClassInput ?
                    compiler.active_input_builtins : compiler.active_output_builtins;
                if (decorations.builtin) {
                    flags.set(decorations.builtin_type);
                    this.handle_builtin(type, decorations.builtin_type, decorations.decoration_flags);
                }
                else if (allow_blocks && compiler.has_decoration(type.self, Decoration.DecorationBlock)) {
                    var member_count = type.member_types.length;
                    for (var i = 0; i < member_count; i++) {
                        if (compiler.has_member_decoration(type.self, i, Decoration.DecorationBuiltIn)) {
                            var member_type = compiler.get(SPIRType, type.member_types[i]);
                            var builtin = (compiler.get_member_decoration(type.self, i, Decoration.DecorationBuiltIn));
                            flags.set(builtin);
                            this.handle_builtin(member_type, builtin, compiler.get_member_decoration_bitset(type.self, i));
                        }
                    }
                }
            }
        };
        return ActiveBuiltinHandler;
    }(OpcodeHandler));

    var CombinedImageSamplerDrefHandler = /** @class */ (function (_super) {
        __extends(CombinedImageSamplerDrefHandler, _super);
        function CombinedImageSamplerDrefHandler(compiler) {
            var _this = _super.call(this) || this;
            _this.dref_combined_samplers = new Set();
            _this.compiler = compiler;
            return _this;
        }
        CombinedImageSamplerDrefHandler.prototype.handle = function (opcode, args, length) {
            // Mark all sampled images which are used with Dref.
            switch (opcode) {
                case Op.OpImageSampleDrefExplicitLod:
                case Op.OpImageSampleDrefImplicitLod:
                case Op.OpImageSampleProjDrefExplicitLod:
                case Op.OpImageSampleProjDrefImplicitLod:
                case Op.OpImageSparseSampleProjDrefImplicitLod:
                case Op.OpImageSparseSampleDrefImplicitLod:
                case Op.OpImageSparseSampleProjDrefExplicitLod:
                case Op.OpImageSparseSampleDrefExplicitLod:
                case Op.OpImageDrefGather:
                case Op.OpImageSparseDrefGather:
                    this.dref_combined_samplers.add(args[2]);
                    return true;
            }
            return true;
        };
        return CombinedImageSamplerDrefHandler;
    }(OpcodeHandler));

    var CombinedImageSamplerUsageHandler = /** @class */ (function (_super) {
        __extends(CombinedImageSamplerUsageHandler, _super);
        function CombinedImageSamplerUsageHandler(compiler, dref_combined_samplers) {
            var _this = _super.call(this) || this;
            _this.dref_combined_samplers = new Set();
            _this.dependency_hierarchy = []; // map<uint32_t, set<uint32_t>>
            _this.comparison_ids = new Set();
            _this.need_subpass_input = false;
            _this.compiler = compiler;
            _this.dref_combined_samplers = dref_combined_samplers;
            return _this;
        }
        CombinedImageSamplerUsageHandler.prototype.begin_function_scope = function (args, length) {
            if (length < 3)
                return false;
            var func = this.compiler.get(SPIRFunction, args[2]);
            var offset = 3;
            length -= 3;
            for (var i = 0; i < length; i++) {
                var argument = func.arguments[i];
                this.add_dependency(argument.id, args[offset + i]);
            }
            return true;
        };
        CombinedImageSamplerUsageHandler.prototype.handle = function (opcode, args, length) {
            // Mark all sampled images which are used with Dref.
            switch (opcode) {
                case Op.OpImageSampleDrefExplicitLod:
                case Op.OpImageSampleDrefImplicitLod:
                case Op.OpImageSampleProjDrefExplicitLod:
                case Op.OpImageSampleProjDrefImplicitLod:
                case Op.OpImageSparseSampleProjDrefImplicitLod:
                case Op.OpImageSparseSampleDrefImplicitLod:
                case Op.OpImageSparseSampleProjDrefExplicitLod:
                case Op.OpImageSparseSampleDrefExplicitLod:
                case Op.OpImageDrefGather:
                case Op.OpImageSparseDrefGather:
                    this.dref_combined_samplers.add(args[2]);
                    return true;
            }
            return true;
        };
        CombinedImageSamplerUsageHandler.prototype.add_hierarchy_to_comparison_ids = function (id) {
            var _this = this;
            // Traverse the variable dependency hierarchy and tag everything in its path with comparison ids.
            this.comparison_ids.add(id);
            maplike_get(Set, this.dependency_hierarchy, id).forEach(function (dep_id) { return _this.add_hierarchy_to_comparison_ids(dep_id); });
        };
        CombinedImageSamplerUsageHandler.prototype.add_dependency = function (dst, src) {
            maplike_get(Set, this.dependency_hierarchy, dst).add(src);
            // Propagate up any comparison state if we're loading from one such variable.
            if (this.comparison_ids.has(src))
                this.comparison_ids.add(dst);
        };
        return CombinedImageSamplerUsageHandler;
    }(OpcodeHandler));

    var InterlockedResourceAccessPrepassHandler = /** @class */ (function (_super) {
        __extends(InterlockedResourceAccessPrepassHandler, _super);
        function InterlockedResourceAccessPrepassHandler(compiler, entry_point_id) {
            var _this = _super.call(this) || this;
            _this.interlock_function_id = 0;
            _this.current_block_id = 0;
            _this.split_function_case = false;
            _this.control_flow_interlock = false;
            _this.call_stack = [];
            _this.compiler = compiler;
            _this.call_stack.push(entry_point_id);
            return _this;
        }
        InterlockedResourceAccessPrepassHandler.prototype.rearm_current_block = function (block) {
            this.current_block_id = block.self;
        };
        InterlockedResourceAccessPrepassHandler.prototype.begin_function_scope = function (args, length) {
            if (length < 3)
                return false;
            this.call_stack.push(args[2]);
            return true;
        };
        InterlockedResourceAccessPrepassHandler.prototype.end_function_scope = function (args, length) {
            this.call_stack.pop();
            return true;
        };
        InterlockedResourceAccessPrepassHandler.prototype.handle = function (op, args, length) {
            if (op === Op.OpBeginInvocationInterlockEXT || op === Op.OpEndInvocationInterlockEXT) {
                if (this.interlock_function_id != 0 && this.interlock_function_id !== this.call_stack[this.call_stack.length - 1]) {
                    // Most complex case, we have no sensible way of dealing with this
                    // other than taking the 100% conservative approach, exit early.
                    this.split_function_case = true;
                    return false;
                }
                else {
                    var compiler = this.compiler;
                    this.interlock_function_id = this.call_stack[this.call_stack.length - 1];
                    // If this call is performed inside control flow we have a problem.
                    var cfg = compiler.get_cfg_for_function(this.interlock_function_id);
                    var from_block_id = compiler.get(SPIRFunction, this.interlock_function_id).entry_block;
                    var outside_control_flow = cfg.node_terminates_control_flow_in_sub_graph(from_block_id, this.current_block_id);
                    if (!outside_control_flow)
                        this.control_flow_interlock = true;
                }
            }
            return true;
        };
        return InterlockedResourceAccessPrepassHandler;
    }(OpcodeHandler));

    var InterlockedResourceAccessHandler = /** @class */ (function (_super) {
        __extends(InterlockedResourceAccessHandler, _super);
        function InterlockedResourceAccessHandler(compiler, entry_point_id) {
            var _this = _super.call(this) || this;
            _this.in_crit_sec = false;
            _this.interlock_function_id = 0;
            _this.split_function_case = false;
            _this.control_flow_interlock = false;
            _this.use_critical_section = false;
            _this.call_stack_is_interlocked = false;
            _this.call_stack = [];
            _this.compiler = compiler;
            _this.call_stack.push(entry_point_id);
            return _this;
        }
        InterlockedResourceAccessHandler.prototype.handle = function (opcode, args, length) {
            // Only care about critical section analysis if we have simple case.
            if (this.use_critical_section) {
                if (opcode === Op.OpBeginInvocationInterlockEXT) {
                    this.in_crit_sec = true;
                    return true;
                }
                if (opcode === Op.OpEndInvocationInterlockEXT) {
                    // End critical section--nothing more to do.
                    return false;
                }
            }
            var compiler = this.compiler;
            // We need to figure out where images and buffers are loaded from, so do only the bare bones compilation we need.
            switch (opcode) {
                case Op.OpLoad: {
                    if (length < 3)
                        return false;
                    var ptr = args[2];
                    var var_ = this.compiler.maybe_get_backing_variable(ptr);
                    // We're only concerned with buffer and image memory here.
                    if (!var_)
                        break;
                    switch (var_.storage) {
                        default:
                            break;
                        case StorageClass.StorageClassUniformConstant: {
                            var result_type = args[0];
                            var id = args[1];
                            compiler.set(SPIRExpression, id, "", result_type, true);
                            compiler.register_read(id, ptr, true);
                            break;
                        }
                        case StorageClass.StorageClassUniform:
                            // Must have BufferBlock; we only care about SSBOs.
                            if (!compiler.has_decoration(compiler.get(SPIRType, var_.basetype).self, Decoration.DecorationBufferBlock))
                                break;
                        // fallthrough
                        case StorageClass.StorageClassStorageBuffer:
                            this.access_potential_resource(var_.self);
                            break;
                    }
                    break;
                }
                case Op.OpInBoundsAccessChain:
                case Op.OpAccessChain:
                case Op.OpPtrAccessChain: {
                    if (length < 3)
                        return false;
                    var result_type = args[0];
                    var type = compiler.get(SPIRType, result_type);
                    if (type.storage == StorageClass.StorageClassUniform || type.storage == StorageClass.StorageClassUniformConstant ||
                        type.storage == StorageClass.StorageClassStorageBuffer) {
                        var id = args[1];
                        var ptr = args[2];
                        compiler.set(SPIRExpression, id, "", result_type, true);
                        compiler.register_read(id, ptr, true);
                        compiler.ir.ids[id].set_allow_type_rewrite();
                    }
                    break;
                }
                case Op.OpImageTexelPointer: {
                    if (length < 3)
                        return false;
                    var result_type = args[0];
                    var id = args[1];
                    var ptr = args[2];
                    var e = compiler.set(SPIRExpression, id, "", result_type, true);
                    var var_ = compiler.maybe_get_backing_variable(ptr);
                    if (var_)
                        e.loaded_from = var_.self;
                    break;
                }
                case Op.OpStore:
                case Op.OpImageWrite:
                case Op.OpAtomicStore: {
                    if (length < 1)
                        return false;
                    var ptr = args[0];
                    var var_ = compiler.maybe_get_backing_variable(ptr);
                    if (var_ && (var_.storage === StorageClass.StorageClassUniform || var_.storage === StorageClass.StorageClassUniformConstant ||
                        var_.storage === StorageClass.StorageClassStorageBuffer)) {
                        this.access_potential_resource(var_.self);
                    }
                    break;
                }
                case Op.OpCopyMemory: {
                    if (length < 2)
                        return false;
                    var dst = args[0];
                    var src = args[1];
                    var dst_var = compiler.maybe_get_backing_variable(dst);
                    var src_var = compiler.maybe_get_backing_variable(src);
                    if (dst_var && (dst_var.storage === StorageClass.StorageClassUniform || dst_var.storage === StorageClass.StorageClassStorageBuffer))
                        this.access_potential_resource(dst_var.self);
                    if (src_var) {
                        if (src_var.storage != StorageClass.StorageClassUniform && src_var.storage != StorageClass.StorageClassStorageBuffer)
                            break;
                        if (src_var.storage == StorageClass.StorageClassUniform &&
                            !compiler.has_decoration(compiler.get(SPIRType, src_var.basetype).self, Decoration.DecorationBufferBlock)) {
                            break;
                        }
                        this.access_potential_resource(src_var.self);
                    }
                    break;
                }
                case Op.OpImageRead:
                case Op.OpAtomicLoad: {
                    if (length < 3)
                        return false;
                    var ptr = args[2];
                    var var_ = compiler.maybe_get_backing_variable(ptr);
                    // We're only concerned with buffer and image memory here.
                    if (!var_)
                        break;
                    switch (var_.storage) {
                        default:
                            break;
                        case StorageClass.StorageClassUniform:
                            // Must have BufferBlock; we only care about SSBOs.
                            if (!compiler.has_decoration(compiler.get(SPIRType, var_.basetype).self, Decoration.DecorationBufferBlock))
                                break;
                        // fallthrough
                        case StorageClass.StorageClassUniformConstant:
                        case StorageClass.StorageClassStorageBuffer:
                            this.access_potential_resource(var_.self);
                            break;
                    }
                    break;
                }
                case Op.OpAtomicExchange:
                case Op.OpAtomicCompareExchange:
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
                case Op.OpAtomicXor: {
                    if (length < 3)
                        return false;
                    var ptr = args[2];
                    var var_ = compiler.maybe_get_backing_variable(ptr);
                    if (var_ && (var_.storage == StorageClass.StorageClassUniform || var_.storage == StorageClass.StorageClassUniformConstant ||
                        var_.storage == StorageClass.StorageClassStorageBuffer)) {
                        this.access_potential_resource(var_.self);
                    }
                    break;
                }
            }
            return true;
        };
        InterlockedResourceAccessHandler.prototype.begin_function_scope = function (args, length) {
            if (length < 3)
                return false;
            if (args[2] === this.interlock_function_id)
                this.call_stack_is_interlocked = true;
            this.call_stack.push(args[2]);
            return true;
        };
        InterlockedResourceAccessHandler.prototype.end_function_scope = function (args, length) {
            if (this.call_stack[this.call_stack.length - 1] === this.interlock_function_id)
                this.call_stack_is_interlocked = false;
            this.call_stack.pop();
            return true;
        };
        InterlockedResourceAccessHandler.prototype.access_potential_resource = function (id) {
            if ((this.use_critical_section && this.in_crit_sec) || (this.control_flow_interlock && this.call_stack_is_interlocked) ||
                this.split_function_case) {
                this.compiler.interlocked_resources.add(id);
            }
        };
        return InterlockedResourceAccessHandler;
    }(OpcodeHandler));

    var PhysicalBlockMeta = /** @class */ (function () {
        function PhysicalBlockMeta() {
            this.alignment = 0;
        }
        return PhysicalBlockMeta;
    }());

    var PhysicalStorageBufferPointerHandler = /** @class */ (function (_super) {
        __extends(PhysicalStorageBufferPointerHandler, _super);
        function PhysicalStorageBufferPointerHandler(compiler) {
            var _this = _super.call(this) || this;
            _this.non_block_types = new Set();
            _this.physical_block_type_meta = []; // map<uint32_t, PhysicalBlockMeta>
            _this.access_chain_to_physical_block = []; // map<uint32_t, PhysicalBlockMeta *>
            _this.compiler = compiler;
            return _this;
        }
        PhysicalStorageBufferPointerHandler.prototype.handle = function (op, args, length) {
            // When a BDA pointer comes to life, we need to keep a mapping of SSA ID -> type ID for the pointer type.
            // For every load and store, we'll need to be able to look up the type ID being accessed and mark any alignment
            // requirements.
            switch (op) {
                case Op.OpConvertUToPtr:
                case Op.OpBitcast:
                case Op.OpCompositeExtract:
                    // Extract can begin a new chain if we had a struct or array of pointers as input.
                    // We don't begin chains before we have a pure scalar pointer.
                    this.setup_meta_chain(args[0], args[1]);
                    break;
                case Op.OpAccessChain:
                case Op.OpInBoundsAccessChain:
                case Op.OpPtrAccessChain:
                case Op.OpCopyObject:
                    {
                        var itr_second = this.access_chain_to_physical_block[args[2]];
                        if (itr_second)
                            this.access_chain_to_physical_block[args[1]] = itr_second;
                        break;
                    }
                case Op.OpLoad:
                    {
                        this.setup_meta_chain(args[0], args[1]);
                        if (length >= 4)
                            this.mark_aligned_access(args[2], args.slice(3), length - 3);
                        break;
                    }
                case Op.OpStore:
                    {
                        if (length >= 3)
                            this.mark_aligned_access(args[0], args.slice(3), length - 2);
                        break;
                    }
            }
            return true;
        };
        PhysicalStorageBufferPointerHandler.prototype.mark_aligned_access = function (id, args, length) {
            var mask = args[0];
            var offset = 0;
            length--;
            if (length && (mask & MemoryAccessMask.MemoryAccessVolatileMask) != 0) {
                offset++;
                length--;
            }
            if (length && (mask & MemoryAccessMask.MemoryAccessAlignedMask) != 0) {
                var alignment = args[offset];
                var meta = this.find_block_meta(id);
                // This makes the assumption that the application does not rely on insane edge cases like:
                // Bind buffer with ADDR = 8, use block offset of 8 bytes, load/store with 16 byte alignment.
                // If we emit the buffer with alignment = 16 here, the first element at offset = 0 should
                // actually have alignment of 8 bytes, but this is too theoretical and awkward to support.
                // We could potentially keep track of any offset in the access chain, but it's
                // practically impossible for high level compilers to emit code like that,
                // so deducing overall alignment requirement based on maximum observed Alignment value is probably fine.
                if (meta && alignment > meta.alignment)
                    meta.alignment = alignment;
            }
        };
        PhysicalStorageBufferPointerHandler.prototype.find_block_meta = function (id) {
            var itr_second = this.access_chain_to_physical_block[id];
            return itr_second || null;
        };
        PhysicalStorageBufferPointerHandler.prototype.type_is_bda_block_entry = function (type_id) {
            var type = this.compiler.get(SPIRType, type_id);
            return type.storage == StorageClass.StorageClassPhysicalStorageBufferEXT && type.pointer &&
                type.pointer_depth == 1 && !this.compiler.type_is_array_of_pointers(type);
        };
        PhysicalStorageBufferPointerHandler.prototype.setup_meta_chain = function (type_id, var_id) {
            if (this.type_is_bda_block_entry(type_id)) {
                var meta = maplike_get(PhysicalBlockMeta, this.physical_block_type_meta, type_id);
                this.access_chain_to_physical_block[var_id] = meta;
                var type = this.compiler.get(SPIRType, type_id);
                if (type.basetype != SPIRTypeBaseType.Struct)
                    this.non_block_types.add(type_id);
                if (meta.alignment == 0)
                    meta.alignment = this.get_minimum_scalar_alignment(this.compiler.get_pointee_type(type));
            }
        };
        PhysicalStorageBufferPointerHandler.prototype.get_minimum_scalar_alignment = function (type) {
            if (type.storage == StorageClass.StorageClassPhysicalStorageBufferEXT)
                return 8;
            else if (type.basetype === SPIRTypeBaseType.Struct) {
                var alignment = 0;
                for (var _i = 0, _a = type.member_types; _i < _a.length; _i++) {
                    var member_type = _a[_i];
                    var member_align = this.get_minimum_scalar_alignment(this.compiler.get(SPIRType, member_type));
                    if (member_align > alignment)
                        alignment = member_align;
                }
                return alignment;
            }
            else
                return type.width / 8;
        };
        PhysicalStorageBufferPointerHandler.prototype.analyze_non_block_types_from_block = function (type) {
            for (var _i = 0, _a = type.member_types; _i < _a.length; _i++) {
                var member = _a[_i];
                var subtype = this.compiler.get(SPIRType, member);
                if (subtype.basetype !== SPIRTypeBaseType.Struct && subtype.pointer &&
                    subtype.storage === StorageClass.StorageClassPhysicalStorageBufferEXT) {
                    this.non_block_types.add(this.get_base_non_block_type_id(member));
                }
                else if (subtype.basetype === SPIRTypeBaseType.Struct && !subtype.pointer)
                    this.analyze_non_block_types_from_block(subtype);
            }
        };
        PhysicalStorageBufferPointerHandler.prototype.get_base_non_block_type_id = function (type_id) {
            var type = this.compiler.get(SPIRType, type_id);
            while (type.pointer &&
                type.storage == StorageClass.StorageClassPhysicalStorageBufferEXT &&
                !this.type_is_bda_block_entry(type_id)) {
                type_id = type.parent_type;
                type = this.compiler.get(SPIRType, type_id);
            }
            console.assert(this.type_is_bda_block_entry(type_id));
            return type_id;
        };
        return PhysicalStorageBufferPointerHandler;
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
            this.invalid_expressions = new Set();
            this.is_force_recompile = false;
            this.combined_image_samplers = [];
            this.forced_temporaries = new Set();
            this.forwarded_temporaries = new Set();
            this.suppressed_usage_tracking = new Set();
            this.hoisted_temporaries = new Set();
            this.forced_invariant_temporaries = new Set();
            this.active_input_builtins = new Bitset();
            this.active_output_builtins = new Bitset();
            this.clip_distance_count = 0;
            this.cull_distance_count = 0;
            this.position_invariant = false;
            // If a variable ID or parameter ID is found in this set, a sampler is actually a shadow/comparison sampler.
            // SPIR-V does not support this distinction, so we must keep track of this information outside the type system.
            // There might be unrelated IDs found in this set which do not correspond to actual variables.
            // This set should only be queried for the existence of samplers which are already known to be variables or parameter IDs.
            // Similar is implemented for images, as well as if subpass inputs are needed.
            this.comparison_ids = new Set();
            this.need_subpass_input = false;
            this.physical_storage_non_block_pointer_types = [];
            this.physical_storage_type_to_alignment = []; // map<uint32_t, PhysicalBlockMeta>
            // The set of all resources written while inside the critical section, if present.
            this.interlocked_resources = new Set();
            this.interlocked_is_complex = false;
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
        // I.e. (1ull << Op.DecorationFoo) | (1ull << Op.DecorationBar)
        Compiler.prototype.get_decoration_bitset = function (id) {
            return this.ir.get_decoration_bitset(id);
        };
        // Returns the effective size of a buffer block struct member.
        Compiler.prototype.get_declared_struct_member_size = function (struct_type, index) {
            if (struct_type.member_types.length === 0)
                throw new Error("Declared struct in block cannot be empty.");
            var flags = this.get_member_decoration_bitset(struct_type.self, index);
            var type = this.get(SPIRType, struct_type.member_types[index]);
            switch (type.basetype) {
                case SPIRTypeBaseType.Unknown:
                case SPIRTypeBaseType.Void:
                case SPIRTypeBaseType.Boolean: // Bools are purely logical, and cannot be used for externally visible types.
                case SPIRTypeBaseType.AtomicCounter:
                case SPIRTypeBaseType.Image:
                case SPIRTypeBaseType.SampledImage:
                case SPIRTypeBaseType.Sampler:
                    throw new Error("Querying size for object with opaque size.");
            }
            if (type.pointer && type.storage === StorageClass.StorageClassPhysicalStorageBuffer) {
                // Check if this is a top-level pointer type, and not an array of pointers.
                if (type.pointer_depth > this.get(SPIRType, type.parent_type).pointer_depth)
                    return 8;
            }
            if (type.array.length > 0) {
                // For arrays, we can use ArrayStride to get an easy check.
                var array_size_literal = type.array_size_literal[type.array_size_literal.length - 1];
                var array_size = array_size_literal ? type.array[type.array.length - 1] : this.evaluate_constant_u32(type.array[type.array.length - 1]);
                return this.type_struct_member_array_stride(struct_type, index) * array_size;
            }
            else if (type.basetype === SPIRTypeBaseType.Struct) {
                return this.get_declared_struct_size(type);
            }
            else {
                var vecsize = type.vecsize;
                var columns = type.columns;
                // Vectors.
                if (columns === 1) {
                    var component_size = type.width / 8;
                    return vecsize * component_size;
                }
                else {
                    var matrix_stride = this.type_struct_member_matrix_stride(struct_type, index);
                    // Per SPIR-V spec, matrices must be tightly packed and aligned up for vec3 accesses.
                    if (flags.get(Decoration.DecorationRowMajor))
                        return matrix_stride * vecsize;
                    else if (flags.get(Decoration.DecorationColMajor))
                        return matrix_stride * columns;
                    else
                        throw new Error("Either row-major or column-major must be declared for matrices.");
                }
            }
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
                    var resource = new BuiltInResource();
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
        Compiler.prototype.get_common_basic_type = function (type) {
            var base_type;
            if (type.basetype === SPIRTypeBaseType.Struct) {
                base_type = SPIRTypeBaseType.Unknown;
                for (var _i = 0, _a = type.member_types; _i < _a.length; _i++) {
                    var member_type = _a[_i];
                    var member_base = this.get_common_basic_type(this.get(SPIRType, member_type));
                    if (member_base === undefined)
                        return undefined;
                    if (base_type === SPIRTypeBaseType.Unknown)
                        base_type = member_base;
                    else if (base_type !== member_base)
                        return undefined;
                }
                return base_type;
            }
            else {
                base_type = type.basetype;
                return base_type;
            }
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
        // Traverses all reachable opcodes and sets active_builtins to a bitmask of all builtin variables which are accessed in the shader.
        Compiler.prototype.update_active_builtins = function () {
            var _this = this;
            var ir = this.ir;
            this.active_input_builtins.reset();
            this.active_output_builtins.reset();
            this.cull_distance_count = 0;
            this.clip_distance_count = 0;
            var handler = new ActiveBuiltinHandler(this);
            this.traverse_all_reachable_opcodes(this.get(SPIRFunction, ir.default_entry_point), handler);
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                if (var_.storage !== StorageClass.StorageClassOutput)
                    return;
                if (!_this.interface_variable_exists_in_entry_point(var_.self))
                    return;
                // Also, make sure we preserve output variables which are only initialized, but never accessed by any code.
                if (var_.initializer !== (0))
                    handler.add_if_builtin_or_block(var_.self);
            });
        };
        Compiler.prototype.has_active_builtin = function (builtin, storage) {
            var flags;
            switch (storage) {
                case StorageClass.StorageClassInput:
                    flags = this.active_input_builtins;
                    break;
                case StorageClass.StorageClassOutput:
                    flags = this.active_output_builtins;
                    break;
                default:
                    return false;
            }
            return flags.get(builtin);
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
        Compiler.prototype.execution_is_branchless = function (from, to) {
            var start = from;
            for (;;) {
                if (start.self === to.self)
                    return true;
                if (start.terminator === SPIRBlockTerminator.Direct && start.merge === SPIRBlockMerge.MergeNone)
                    start = this.get(SPIRBlock, start.next_block);
                else
                    return false;
            }
        };
        Compiler.prototype.execution_is_direct_branch = function (from, to) {
            return from.terminator === SPIRBlockTerminator.Direct && from.merge === SPIRBlockMerge.MergeNone && from.next_block === to.self;
        };
        // A variant which takes two sets of names. The secondary is only used to verify there are no collisions,
        // but the set is not updated when we have found a new name.
        // Used primarily when adding block interface names.
        Compiler.prototype.update_name_cache = function (cache_primary, cache_secondary, name) {
            if (!name) {
                // first overload
                name = cache_secondary;
                cache_secondary = cache_primary;
            }
            if (name === null)
                return;
            var find_name = function (n) {
                if (cache_primary.has(n))
                    return true;
                if (cache_primary !== cache_secondary)
                    if (cache_secondary.has(n))
                        return true;
                return false;
            };
            var insert_name = function (n) {
                cache_primary.add(n);
            };
            if (!find_name(name)) {
                insert_name(name);
                return name;
            }
            var counter = 0;
            var tmpname = name;
            var use_linked_underscore = true;
            if (tmpname === "_") {
                // We cannot just append numbers, as we will end up creating internally reserved names.
                // Make it like _0_<counter> instead.
                tmpname += "0";
            }
            else if (tmpname.charAt(tmpname.length - 1) === "_") {
                // The last_character is an underscore, so we don't need to link in underscore.
                // This would violate double underscore rules.
                use_linked_underscore = false;
            }
            // If there is a collision (very rare),
            // keep tacking on extra identifier until it's unique.
            do {
                counter++;
                name = tmpname + (use_linked_underscore ? "_" : "") + convert_to_string(counter);
            } while (find_name(name));
            insert_name(name);
            return name;
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
        Compiler.prototype.remap_variable_type_name = function (type, var_name, type_name) {
            if (this.variable_remap_callback)
                return this.variable_remap_callback(type, var_name, type_name);
            return type_name;
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
        // If the decoration is a boolean (i.e. Op.DecorationNonWritable),
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
        // If get_name() is an empty string, get the fallback name which will be used
        // instead in the disassembled source.
        Compiler.prototype.get_fallback_name = function (id) {
            return "_" + id;
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
        // Returns the effective size of a buffer block.
        Compiler.prototype.get_declared_struct_size = function (type) {
            if (type.member_types.length === 0)
                throw new Error("Declared struct in block cannot be empty.");
            // Offsets can be declared out of order, so we need to deduce the actual size
            // based on last member instead.
            var member_index = 0;
            var highest_offset = 0;
            for (var i = 0; i < type.member_types.length; i++) {
                var offset = this.type_struct_member_offset(type, i);
                if (offset > highest_offset) {
                    highest_offset = offset;
                    member_index = i;
                }
            }
            var size = this.get_declared_struct_member_size(type, member_index);
            return highest_offset + size;
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
        Compiler.prototype.get_pointee_type = function (type) {
            if (typeof type === "number") {
                return this.get_pointee_type(this.get(SPIRType, type));
            }
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
        Compiler.prototype.is_hidden_variable = function (var_, include_builtins) {
            if (include_builtins === void 0) { include_builtins = false; }
            if ((this.is_builtin_variable(var_) && !include_builtins) || var_.remapped_variable)
                return true;
            // Combined image samplers are always considered active as they are "magic" variables.
            var rs = this.combined_image_samplers.find(function (samp) { return samp.combined_id === var_.self; });
            if (rs) {
                return false;
            }
            var ir = this.ir;
            // In SPIR-V 1.4 and up we must also use the active variable interface to disable global variables
            // which are not part of the entry point.
            if (ir.get_spirv_version() >= 0x10400 && var_.storage !== StorageClass.StorageClassGeneric &&
                var_.storage !== StorageClass.StorageClassFunction && !this.interface_variable_exists_in_entry_point(var_.self)) {
                return true;
            }
            return this.check_active_interface_variables && storage_class_is_interface(var_.storage) && this.active_interface_variables.has(var_.self);
        };
        Compiler.prototype.is_member_builtin = function (type, index) {
            var type_meta = this.ir.find_meta(type.self);
            if (type_meta) {
                var memb = type_meta.members;
                if (index < memb.length && memb[index].builtin) {
                    return memb[index].builtin_type;
                }
            }
            return undefined;
        };
        Compiler.prototype.is_scalar = function (type) {
            return type.basetype !== SPIRTypeBaseType.Struct && type.vecsize === 1 && type.columns === 1;
        };
        Compiler.prototype.is_vector = function (type) {
            return type.vecsize > 1 && type.columns == 1;
        };
        Compiler.prototype.is_matrix = function (type) {
            return type.vecsize > 1 && type.columns > 1;
        };
        Compiler.prototype.is_array = function (type) {
            return type.array.length > 0;
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
            return block.merge === SPIRBlockMerge.MergeLoop && block.continue_block === (next);
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
        Compiler.prototype.analyze_image_and_sampler_usage = function () {
            var ir = this.ir;
            var dref_handler = new CombinedImageSamplerDrefHandler(this);
            this.traverse_all_reachable_opcodes(this.get(SPIRFunction, ir.default_entry_point), dref_handler);
            var handler = new CombinedImageSamplerUsageHandler(this, dref_handler.dref_combined_samplers);
            this.traverse_all_reachable_opcodes(this.get(SPIRFunction, ir.default_entry_point), handler);
            // Need to run this traversal twice. First time, we propagate any comparison sampler usage from leaf functions
            // down to main().
            // In the second pass, we can propagate up forced depth state coming from main() up into leaf functions.
            handler.dependency_hierarchy = [];
            this.traverse_all_reachable_opcodes(this.get(SPIRFunction, ir.default_entry_point), handler);
            this.comparison_ids = handler.comparison_ids;
            this.need_subpass_input = handler.need_subpass_input;
            // Forward information from separate images and samplers into combined image samplers.
            for (var _i = 0, _a = this.combined_image_samplers; _i < _a.length; _i++) {
                var combined = _a[_i];
                if (this.comparison_ids.has(combined.sampler_id))
                    this.comparison_ids.add(combined.combined_id);
            }
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
        Compiler.prototype.get_cfg_for_current_function = function () {
            console.assert(this.current_function);
            return this.get_cfg_for_function(this.current_function.self);
        };
        Compiler.prototype.get_cfg_for_function = function (id) {
            var cfg = this.function_cfgs[id];
            console.assert(cfg);
            return cfg;
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
        Compiler.prototype.analyze_non_block_pointer_types = function () {
            var _this = this;
            var ir = this.ir;
            var handler = new PhysicalStorageBufferPointerHandler(this);
            this.traverse_all_reachable_opcodes(this.get(SPIRFunction, ir.default_entry_point), handler);
            // Analyze any block declaration we have to make. It might contain
            // physical pointers to POD types which we never used, and thus never added to the list.
            // We'll need to add those pointer types to the set of types we declare.
            ir.for_each_typed_id(SPIRType, function (_, type) {
                if (_this.has_decoration(type.self, Decoration.DecorationBlock) || _this.has_decoration(type.self, Decoration.DecorationBufferBlock))
                    handler.analyze_non_block_types_from_block(type);
            });
            handler.non_block_types.forEach(function (type) {
                return _this.physical_storage_non_block_pointer_types.push(type);
            });
            this.physical_storage_non_block_pointer_types.sort();
            this.physical_storage_type_to_alignment = handler.physical_block_type_meta;
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
                    if (loop_dominator !== block_id)
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
                        if (type.vecsize === 1 && type.columns === 1 && type.basetype !== SPIRTypeBaseType.Struct && type.array.length === 0) {
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
                            while (block.loop_dominator !== (SPIRBlock.NoDominator))
                                block = _this.get(SPIRBlock, block.loop_dominator);
                            if (block.self !== dominating_block) {
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
                        console.assert(loop_header_block.merge === SPIRBlockMerge.MergeLoop);
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
                    else if (_this.get(SPIRBlock, block).continue_block === block) {
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
                while (dominator !== header) {
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
                    if (write_blocks.size !== 1)
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
                    if (static_expression_handler.write_count !== 1 || static_expression_handler.static_expression === 0)
                        return;
                    // Is it a constant expression?
                    if (ir.ids[static_expression_handler.static_expression].get_type() !== Types.TypeConstant)
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
        Compiler.prototype.analyze_interlocked_resource_usage = function () {
            if (this.get_execution_model() === ExecutionModel.ExecutionModelFragment &&
                (this.get_entry_point().flags.get(ExecutionMode.ExecutionModePixelInterlockOrderedEXT) ||
                    this.get_entry_point().flags.get(ExecutionMode.ExecutionModePixelInterlockUnorderedEXT) ||
                    this.get_entry_point().flags.get(ExecutionMode.ExecutionModeSampleInterlockOrderedEXT) ||
                    this.get_entry_point().flags.get(ExecutionMode.ExecutionModeSampleInterlockUnorderedEXT))) {
                var ir = this.ir;
                var prepass_handler = new InterlockedResourceAccessPrepassHandler(this, ir.default_entry_point);
                this.traverse_all_reachable_opcodes(this.get(SPIRFunction, ir.default_entry_point), prepass_handler);
                var handler = new InterlockedResourceAccessHandler(this, ir.default_entry_point);
                handler.interlock_function_id = prepass_handler.interlock_function_id;
                handler.split_function_case = prepass_handler.split_function_case;
                handler.control_flow_interlock = prepass_handler.control_flow_interlock;
                handler.use_critical_section = !handler.split_function_case && !handler.control_flow_interlock;
                this.traverse_all_reachable_opcodes(this.get(SPIRFunction, ir.default_entry_point), handler);
                // For GLSL. If we hit any of these cases, we have to fall back to conservative approach.
                this.interlocked_is_complex =
                    !handler.use_critical_section || handler.interlock_function_id !== ir.default_entry_point;
            }
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
        Compiler.prototype.combined_decoration_for_member = function (type, index) {
            var flags = new Bitset();
            var type_meta = this.ir.find_meta(type.self);
            if (type_meta) {
                var members = type_meta.members;
                if (index >= members.length)
                    return flags;
                var dec = members[index];
                flags.merge_or(dec.decoration_flags);
                var member_type = this.get(SPIRType, type.member_types[index]);
                // If our member type is a struct, traverse all the child members as well recursively.
                var member_childs = member_type.member_types;
                for (var i = 0; i < member_childs.length; i++) {
                    var child_member_type = this.get(SPIRType, member_childs[i]);
                    if (!child_member_type.pointer)
                        flags.merge_or(this.combined_decoration_for_member(member_type, i));
                }
            }
            return flags;
        };
        Compiler.prototype.is_desktop_only_format = function (format) {
            switch (format) {
                // Desktop-only formats
                case ImageFormat.ImageFormatR11fG11fB10f:
                case ImageFormat.ImageFormatR16f:
                case ImageFormat.ImageFormatRgb10A2:
                case ImageFormat.ImageFormatR8:
                case ImageFormat.ImageFormatRg8:
                case ImageFormat.ImageFormatR16:
                case ImageFormat.ImageFormatRg16:
                case ImageFormat.ImageFormatRgba16:
                case ImageFormat.ImageFormatR16Snorm:
                case ImageFormat.ImageFormatRg16Snorm:
                case ImageFormat.ImageFormatRgba16Snorm:
                case ImageFormat.ImageFormatR8Snorm:
                case ImageFormat.ImageFormatRg8Snorm:
                case ImageFormat.ImageFormatR8ui:
                case ImageFormat.ImageFormatRg8ui:
                case ImageFormat.ImageFormatR16ui:
                case ImageFormat.ImageFormatRgb10a2ui:
                case ImageFormat.ImageFormatR8i:
                case ImageFormat.ImageFormatRg8i:
                case ImageFormat.ImageFormatR16i:
                    return true;
            }
            return false;
        };
        Compiler.prototype.set_extended_decoration = function (id, decoration, value) {
            if (value === void 0) { value = 0; }
            var dec = maplike_get(Meta, this.ir.meta, id).decoration;
            dec.extended.flags.set(decoration);
            dec.extended.values[decoration] = value;
        };
        Compiler.prototype.get_extended_decoration = function (id, decoration) {
            var m = this.ir.find_meta(id);
            if (!m)
                return 0;
            var dec = m.decoration;
            if (!dec.extended.flags.get(decoration))
                return get_default_extended_decoration(decoration);
            return dec.extended.values[decoration];
        };
        Compiler.prototype.has_extended_decoration = function (id, decoration) {
            var m = this.ir.find_meta(id);
            if (!m)
                return false;
            var dec = m.decoration;
            return dec.extended.flags.get(decoration);
        };
        Compiler.prototype.set_extended_member_decoration = function (type, index, decoration, value) {
            if (value === void 0) { value = 0; }
            var members = maplike_get(Meta, this.ir.meta, type).members;
            if (index === members.length) {
                members.push(new MetaDecoration());
            }
            var dec = members[index];
            dec.extended.flags.set(decoration);
            dec.extended.values[decoration] = value;
        };
        Compiler.prototype.get_extended_member_decoration = function (type, index, decoration) {
            var m = this.ir.find_meta(type);
            if (!m)
                return 0;
            if (index >= m.members.length)
                return 0;
            var dec = m.members[index];
            if (!dec.extended.flags.get(decoration))
                return get_default_extended_decoration(decoration);
            return dec.extended.values[decoration];
        };
        Compiler.prototype.has_extended_member_decoration = function (type, index, decoration) {
            var m = this.ir.find_meta(type);
            if (!m)
                return false;
            if (index >= m.members.length)
                return false;
            var dec = m.members[index];
            return dec.extended.flags.get(decoration);
        };
        Compiler.prototype.unset_extended_member_decoration = function (type, index, decoration) {
            var members = maplike_get(Meta, this.ir.meta, type).members;
            if (index === members.length) {
                members.push(new MetaDecoration());
            }
            var dec = members[index];
            dec.extended.flags.clear(decoration);
            dec.extended.values[decoration] = 0;
        };
        Compiler.prototype.type_is_array_of_pointers = function (type) {
            if (!type.pointer)
                return false;
            // If parent type has same pointer depth, we must have an array of pointers.
            return type.pointer_depth === this.get(SPIRType, type.parent_type).pointer_depth;
        };
        Compiler.prototype.type_is_opaque_value = function (type) {
            return !type.pointer && (type.basetype === SPIRTypeBaseType.SampledImage || type.basetype === SPIRTypeBaseType.Image ||
                type.basetype === SPIRTypeBaseType.Sampler);
        };
        Compiler.prototype.is_depth_image = function (type, id) {
            return (type.image.depth && type.image.format === ImageFormat.ImageFormatUnknown) || this.comparison_ids.has(id);
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
        // API for querying buffer objects.
        // The type passed in here should be the base type of a resource, i.e.
        // get_type(resource.base_type_id)
        // as decorations are set in the basic Block type.
        // The type passed in here must have these decorations set, or an exception is raised.
        // Only UBOs and SSBOs or sub-structs which are part of these buffer types will have these decorations set.
        Compiler.prototype.type_struct_member_offset = function (type, index) {
            var type_meta = this.ir.find_meta(type.self);
            if (type_meta) {
                // Decoration must be set in valid SPIR-V, otherwise throw.
                var dec = type_meta.members[index];
                if (dec.decoration_flags.get(Decoration.DecorationOffset))
                    return dec.offset;
                else
                    throw new Error("Struct member does not have Offset set.");
            }
            else
                throw new Error("Struct member does not have Offset set.");
        };
        Compiler.prototype.type_struct_member_array_stride = function (type, index) {
            var type_meta = this.ir.find_meta(type.self);
            if (type_meta) {
                // Decoration must be set in valid SPIR-V, otherwise throw.
                // ArrayStride is part of the array type not OpMemberDecorate.
                var dec = type_meta.decoration;
                if (dec.decoration_flags.get(Decoration.DecorationArrayStride))
                    return dec.array_stride;
                else
                    throw new Error("Struct member does not have ArrayStride set.");
            }
            else
                throw new Error("Struct member does not have ArrayStride set.");
        };
        Compiler.prototype.type_struct_member_matrix_stride = function (type, index) {
            var type_meta = this.ir.find_meta(type.self);
            if (type_meta) {
                // Decoration must be set in valid SPIR-V, otherwise throw.
                // MatrixStride is part of OpMemberDecorate.
                var dec = type_meta.members[index];
                if (dec.decoration_flags.get(Decoration.DecorationMatrixStride))
                    return dec.matrix_stride;
                else
                    throw new Error("Struct member does not have MatrixStride set.");
            }
            else
                throw new Error("Struct member does not have MatrixStride set.");
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
            if (type.basetype !== SPIRTypeBaseType.Struct)
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
        Compiler.prototype.evaluate_spec_constant_u32 = function (spec) {
            var _this = this;
            var result_type = this.get(SPIRType, spec.basetype);
            if (result_type.basetype !== SPIRTypeBaseType.UInt && result_type.basetype !== SPIRTypeBaseType.Int &&
                result_type.basetype !== SPIRTypeBaseType.Boolean) {
                throw new Error("Only 32-bit integers and booleans are currently supported when evaluating specialization constants.");
            }
            if (!this.is_scalar(result_type))
                throw new Error("Spec constant evaluation must be a scalar.\n");
            var value = 0;
            var eval_u32 = function (id) {
                var type = _this.expression_type(id);
                if (type.basetype !== SPIRTypeBaseType.UInt && type.basetype !== SPIRTypeBaseType.Int && type.basetype !== SPIRTypeBaseType.Boolean) {
                    throw new Error("Only 32-bit integers and booleans are currently supported when evaluating specialization constants.");
                }
                if (!_this.is_scalar(type))
                    throw new Error("Spec constant evaluation must be a scalar.");
                var c = _this.maybe_get(SPIRConstant, id);
                if (c)
                    return c.scalar();
                else
                    return _this.evaluate_spec_constant_u32(_this.get(SPIRConstantOp, id));
            };
            // Support the basic opcodes which are typically used when computing array sizes.
            switch (spec.opcode) {
                case Op.OpIAdd:
                    value = eval_u32(spec.arguments[0]) + eval_u32(spec.arguments[1]);
                    break;
                case Op.OpISub:
                    value = eval_u32(spec.arguments[0]) - eval_u32(spec.arguments[1]);
                    break;
                case Op.OpIMul:
                    value = eval_u32(spec.arguments[0]) * eval_u32(spec.arguments[1]);
                    break;
                case Op.OpBitwiseAnd:
                    value = eval_u32(spec.arguments[0]) & eval_u32(spec.arguments[1]);
                    break;
                case Op.OpBitwiseOr:
                    value = eval_u32(spec.arguments[0]) | eval_u32(spec.arguments[1]);
                    break;
                case Op.OpBitwiseXor:
                    value = eval_u32(spec.arguments[0]) ^ eval_u32(spec.arguments[1]);
                    break;
                case Op.OpLogicalAnd:
                    value = eval_u32(spec.arguments[0]) & eval_u32(spec.arguments[1]);
                    break;
                case Op.OpLogicalOr:
                    value = eval_u32(spec.arguments[0]) | eval_u32(spec.arguments[1]);
                    break;
                case Op.OpShiftLeftLogical:
                    value = eval_u32(spec.arguments[0]) << eval_u32(spec.arguments[1]);
                    break;
                case Op.OpShiftRightLogical:
                case Op.OpShiftRightArithmetic:
                    value = eval_u32(spec.arguments[0]) >> eval_u32(spec.arguments[1]);
                    break;
                case Op.OpLogicalEqual:
                case Op.OpIEqual:
                    value = eval_u32(spec.arguments[0]) == eval_u32(spec.arguments[1]) ? 1 : 0;
                    break;
                case Op.OpLogicalNotEqual:
                case Op.OpINotEqual:
                    value = eval_u32(spec.arguments[0]) != eval_u32(spec.arguments[1]) ? 1 : 0;
                    break;
                case Op.OpULessThan:
                case Op.OpSLessThan:
                    value = eval_u32(spec.arguments[0]) < eval_u32(spec.arguments[1]) ? 1 : 0;
                    break;
                case Op.OpULessThanEqual:
                case Op.OpSLessThanEqual:
                    value = eval_u32(spec.arguments[0]) <= eval_u32(spec.arguments[1]) ? 1 : 0;
                    break;
                case Op.OpUGreaterThan:
                case Op.OpSGreaterThan:
                    value = eval_u32(spec.arguments[0]) > eval_u32(spec.arguments[1]) ? 1 : 0;
                    break;
                case Op.OpUGreaterThanEqual:
                case Op.OpSGreaterThanEqual:
                    value = eval_u32(spec.arguments[0]) >= eval_u32(spec.arguments[1]) ? 1 : 0;
                    break;
                case Op.OpLogicalNot:
                    value = eval_u32(spec.arguments[0]) ? 0 : 1;
                    break;
                case Op.OpNot:
                    value = ~eval_u32(spec.arguments[0]);
                    break;
                case Op.OpSNegate:
                    value = -eval_u32(spec.arguments[0]);
                    break;
                case Op.OpSelect:
                    value = eval_u32(spec.arguments[0]) ? eval_u32(spec.arguments[1]) : eval_u32(spec.arguments[2]);
                    break;
                case Op.OpUMod:
                case Op.OpSMod:
                case Op.OpSRem: {
                    var a = eval_u32(spec.arguments[0]);
                    var b = eval_u32(spec.arguments[1]);
                    if (b === 0)
                        throw new Error("Undefined behavior in Mod, b === 0.\n");
                    value = a % b;
                    break;
                }
                case Op.OpUDiv:
                case Op.OpSDiv: {
                    var a = eval_u32(spec.arguments[0]);
                    var b = eval_u32(spec.arguments[1]);
                    if (b === 0)
                        throw new Error("Undefined behavior in Div, b === 0.\n");
                    value = a / b;
                    break;
                }
                default:
                    throw new Error("Unsupported spec constant opcode for evaluation.\n");
            }
            return value;
        };
        Compiler.prototype.evaluate_constant_u32 = function (id) {
            var c = this.maybe_get(SPIRConstant, id);
            if (c)
                return c.scalar();
            else
                return this.evaluate_spec_constant_u32(this.get(SPIRConstantOp, id));
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
    function get_default_extended_decoration(decoration) {
        switch (decoration) {
            case ExtendedDecorations.SPIRVCrossDecorationResourceIndexPrimary:
            case ExtendedDecorations.SPIRVCrossDecorationResourceIndexSecondary:
            case ExtendedDecorations.SPIRVCrossDecorationResourceIndexTertiary:
            case ExtendedDecorations.SPIRVCrossDecorationResourceIndexQuaternary:
            case ExtendedDecorations.SPIRVCrossDecorationInterfaceMemberIndex:
                return ~0;
            default:
                return 0;
        }
    }
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
    function opcode_is_sign_invariant(opcode) {
        switch (opcode) {
            case Op.OpIEqual:
            case Op.OpINotEqual:
            case Op.OpISub:
            case Op.OpIAdd:
            case Op.OpIMul:
            case Op.OpShiftLeftLogical:
            case Op.OpBitwiseOr:
            case Op.OpBitwiseXor:
            case Op.OpBitwiseAnd:
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

    // TODO: Remove options and code referring to it that isn't relevant for WebGL
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

    var StringStream = /** @class */ (function () {
        function StringStream() {
            this._str = "";
        }
        StringStream.prototype.str = function () {
            return this._str;
        };
        StringStream.prototype.append = function () {
            var _a;
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            this._str = (_a = this._str).concat.apply(_a, args);
        };
        StringStream.prototype.reset = function () {
            this._str = "";
        };
        return StringStream;
    }());

    function type_is_floating_point(type) {
        return type.basetype === SPIRTypeBaseType.Half || type.basetype === SPIRTypeBaseType.Float || type.basetype === SPIRTypeBaseType.Double;
    }
    function type_is_integral(type) {
        return type.basetype === SPIRTypeBaseType.SByte || type.basetype === SPIRTypeBaseType.UByte || type.basetype === SPIRTypeBaseType.Short ||
            type.basetype === SPIRTypeBaseType.UShort || type.basetype === SPIRTypeBaseType.Int || type.basetype === SPIRTypeBaseType.UInt ||
            type.basetype === SPIRTypeBaseType.Int64 || type.basetype === SPIRTypeBaseType.UInt64;
    }

    var AccessChainMeta = /** @class */ (function () {
        function AccessChainMeta() {
            this.storage_physical_type = 0;
            this.need_transpose = false;
            this.storage_is_packed = false;
            this.storage_is_invariant = false;
            this.flattened_struct = false;
        }
        return AccessChainMeta;
    }());

    var AccessChainFlagBits;
    (function (AccessChainFlagBits) {
        AccessChainFlagBits[AccessChainFlagBits["ACCESS_CHAIN_INDEX_IS_LITERAL_BIT"] = 1] = "ACCESS_CHAIN_INDEX_IS_LITERAL_BIT";
        AccessChainFlagBits[AccessChainFlagBits["ACCESS_CHAIN_CHAIN_ONLY_BIT"] = 2] = "ACCESS_CHAIN_CHAIN_ONLY_BIT";
        AccessChainFlagBits[AccessChainFlagBits["ACCESS_CHAIN_PTR_CHAIN_BIT"] = 4] = "ACCESS_CHAIN_PTR_CHAIN_BIT";
        AccessChainFlagBits[AccessChainFlagBits["ACCESS_CHAIN_SKIP_REGISTER_EXPRESSION_READ_BIT"] = 8] = "ACCESS_CHAIN_SKIP_REGISTER_EXPRESSION_READ_BIT";
        AccessChainFlagBits[AccessChainFlagBits["ACCESS_CHAIN_LITERAL_MSB_FORCE_ID"] = 16] = "ACCESS_CHAIN_LITERAL_MSB_FORCE_ID";
        AccessChainFlagBits[AccessChainFlagBits["ACCESS_CHAIN_FLATTEN_ALL_MEMBERS_BIT"] = 32] = "ACCESS_CHAIN_FLATTEN_ALL_MEMBERS_BIT";
        AccessChainFlagBits[AccessChainFlagBits["ACCESS_CHAIN_FORCE_COMPOSITE_BIT"] = 64] = "ACCESS_CHAIN_FORCE_COMPOSITE_BIT";
    })(AccessChainFlagBits || (AccessChainFlagBits = {}));

    var BufferPackingStandard;
    (function (BufferPackingStandard) {
        BufferPackingStandard[BufferPackingStandard["BufferPackingStd140"] = 0] = "BufferPackingStd140";
        BufferPackingStandard[BufferPackingStandard["BufferPackingStd430"] = 1] = "BufferPackingStd430";
        BufferPackingStandard[BufferPackingStandard["BufferPackingStd140EnhancedLayout"] = 2] = "BufferPackingStd140EnhancedLayout";
        BufferPackingStandard[BufferPackingStandard["BufferPackingStd430EnhancedLayout"] = 3] = "BufferPackingStd430EnhancedLayout";
        BufferPackingStandard[BufferPackingStandard["_BufferPackingHLSLCbuffer"] = 4] = "_BufferPackingHLSLCbuffer";
        BufferPackingStandard[BufferPackingStandard["_BufferPackingHLSLCbufferPackOffset"] = 5] = "_BufferPackingHLSLCbufferPackOffset";
        BufferPackingStandard[BufferPackingStandard["BufferPackingScalar"] = 6] = "BufferPackingScalar";
        BufferPackingStandard[BufferPackingStandard["BufferPackingScalarEnhancedLayout"] = 7] = "BufferPackingScalarEnhancedLayout";
    })(BufferPackingStandard || (BufferPackingStandard = {}));

    var swizzle = [
        [".x", ".y", ".z", ".w"],
        [".xy", ".yz", ".zw"],
        [".xyz", ".yzw"],
        [""]
    ];
    var ops = [];
    ops[Op.OpSNegate] = "-";
    ops[Op.OpNot] = "~";
    ops[Op.OpIAdd] = "+";
    ops[Op.OpISub] = "-";
    ops[Op.OpIMul] = "*";
    ops[Op.OpSDiv] = "/";
    ops[Op.OpUDiv] = "/";
    ops[Op.OpUMod] = "%";
    ops[Op.OpSMod] = "%";
    ops[Op.OpShiftRightLogical] = ">>";
    ops[Op.OpShiftRightArithmetic] = ">>";
    ops[Op.OpShiftLeftLogical] = ">>";
    ops[Op.OpBitwiseOr] = "|";
    ops[Op.OpBitwiseXor] = "^";
    ops[Op.OpBitwiseAnd] = "&";
    ops[Op.OpLogicalOr] = "||";
    ops[Op.OpLogicalAnd] = "&&";
    ops[Op.OpLogicalNot] = "!";
    ops[Op.OpLogicalEqual] = "==";
    ops[Op.OpLogicalNotEqual] = "!=";
    ops[Op.OpIEqual] = "==";
    ops[Op.OpINotEqual] = "!=";
    ops[Op.OpULessThan] = "<";
    ops[Op.OpSLessThan] = "<";
    ops[Op.OpULessThanEqual] = "<=";
    ops[Op.OpSLessThanEqual] = "<=";
    ops[Op.OpUGreaterThan] = ">";
    ops[Op.OpSGreaterThan] = ">";
    ops[Op.OpSGreaterThanEqual] = ">=";
    ops[Op.OpSGreaterThanEqual] = ">=";
    var expectedVecComps = ["x", "y", "z", "w"];
    var keywords = new Set([
        "abs", "acos", "acosh", "all", "any", "asin", "asinh", "atan", "atanh",
        "atomicAdd", "atomicCompSwap", "atomicCounter", "atomicCounterDecrement", "atomicCounterIncrement",
        "atomicExchange", "atomicMax", "atomicMin", "atomicOr", "atomicXor",
        "bitCount", "bitfieldExtract", "bitfieldInsert", "bitfieldReverse",
        "ceil", "cos", "cosh", "cross", "degrees",
        "dFdx", "dFdxCoarse", "dFdxFine",
        "dFdy", "dFdyCoarse", "dFdyFine",
        "distance", "dot", "EmitStreamVertex", "EmitVertex", "EndPrimitive", "EndStreamPrimitive", "equal", "exp", "exp2",
        "faceforward", "findLSB", "findMSB", "float16BitsToInt16", "float16BitsToUint16", "floatBitsToInt", "floatBitsToUint", "floor", "fma", "fract",
        "frexp", "fwidth", "fwidthCoarse", "fwidthFine",
        "greaterThan", "greaterThanEqual", "groupMemoryBarrier",
        "imageAtomicAdd", "imageAtomicAnd", "imageAtomicCompSwap", "imageAtomicExchange", "imageAtomicMax", "imageAtomicMin", "imageAtomicOr", "imageAtomicXor",
        "imageLoad", "imageSamples", "imageSize", "imageStore", "imulExtended", "int16BitsToFloat16", "intBitsToFloat", "interpolateAtOffset", "interpolateAtCentroid", "interpolateAtSample",
        "inverse", "inversesqrt", "isinf", "isnan", "ldexp", "length", "lessThan", "lessThanEqual", "log", "log2",
        "matrixCompMult", "max", "memoryBarrier", "memoryBarrierAtomicCounter", "memoryBarrierBuffer", "memoryBarrierImage", "memoryBarrierShared",
        "min", "mix", "mod", "modf", "noise", "noise1", "noise2", "noise3", "noise4", "normalize", "not", "notEqual",
        "outerProduct", "packDouble2x32", "packHalf2x16", "packInt2x16", "packInt4x16", "packSnorm2x16", "packSnorm4x8",
        "packUint2x16", "packUint4x16", "packUnorm2x16", "packUnorm4x8", "pow",
        "radians", "reflect", "refract", "round", "roundEven", "sign", "sin", "sinh", "smoothstep", "sqrt", "step",
        "tan", "tanh", "texelFetch", "texelFetchOffset", "texture", "textureGather", "textureGatherOffset", "textureGatherOffsets",
        "textureGrad", "textureGradOffset", "textureLod", "textureLodOffset", "textureOffset", "textureProj", "textureProjGrad",
        "textureProjGradOffset", "textureProjLod", "textureProjLodOffset", "textureProjOffset", "textureQueryLevels", "textureQueryLod", "textureSamples", "textureSize",
        "transpose", "trunc", "uaddCarry", "uint16BitsToFloat16", "uintBitsToFloat", "umulExtended", "unpackDouble2x32", "unpackHalf2x16", "unpackInt2x16", "unpackInt4x16",
        "unpackSnorm2x16", "unpackSnorm4x8", "unpackUint2x16", "unpackUint4x16", "unpackUnorm2x16", "unpackUnorm4x8", "usubBorrow",
        "active", "asm", "atomic_uint", "attribute", "bool", "break", "buffer",
        "bvec2", "bvec3", "bvec4", "case", "cast", "centroid", "class", "coherent", "common", "const", "continue", "default", "discard",
        "dmat2", "dmat2x2", "dmat2x3", "dmat2x4", "dmat3", "dmat3x2", "dmat3x3", "dmat3x4", "dmat4", "dmat4x2", "dmat4x3", "dmat4x4",
        "do", "double", "dvec2", "dvec3", "dvec4", "else", "enum", "extern", "external", "false", "filter", "fixed", "flat", "float",
        "for", "fvec2", "fvec3", "fvec4", "goto", "half", "highp", "hvec2", "hvec3", "hvec4", "if", "iimage1D", "iimage1DArray",
        "iimage2D", "iimage2DArray", "iimage2DMS", "iimage2DMSArray", "iimage2DRect", "iimage3D", "iimageBuffer", "iimageCube",
        "iimageCubeArray", "image1D", "image1DArray", "image2D", "image2DArray", "image2DMS", "image2DMSArray", "image2DRect",
        "image3D", "imageBuffer", "imageCube", "imageCubeArray", "in", "inline", "inout", "input", "int", "interface", "invariant",
        "isampler1D", "isampler1DArray", "isampler2D", "isampler2DArray", "isampler2DMS", "isampler2DMSArray", "isampler2DRect",
        "isampler3D", "isamplerBuffer", "isamplerCube", "isamplerCubeArray", "ivec2", "ivec3", "ivec4", "layout", "long", "lowp",
        "mat2", "mat2x2", "mat2x3", "mat2x4", "mat3", "mat3x2", "mat3x3", "mat3x4", "mat4", "mat4x2", "mat4x3", "mat4x4", "mediump",
        "namespace", "noinline", "noperspective", "out", "output", "packed", "partition", "patch", "precise", "precision", "public", "readonly",
        "resource", "restrict", "return", "sample", "sampler1D", "sampler1DArray", "sampler1DArrayShadow",
        "sampler1DShadow", "sampler2D", "sampler2DArray", "sampler2DArrayShadow", "sampler2DMS", "sampler2DMSArray",
        "sampler2DRect", "sampler2DRectShadow", "sampler2DShadow", "sampler3D", "sampler3DRect", "samplerBuffer",
        "samplerCube", "samplerCubeArray", "samplerCubeArrayShadow", "samplerCubeShadow", "shared", "short", "sizeof", "smooth", "static",
        "struct", "subroutine", "superp", "switch", "template", "this", "true", "typedef", "uimage1D", "uimage1DArray", "uimage2D",
        "uimage2DArray", "uimage2DMS", "uimage2DMSArray", "uimage2DRect", "uimage3D", "uimageBuffer", "uimageCube",
        "uimageCubeArray", "uint", "uniform", "union", "unsigned", "usampler1D", "usampler1DArray", "usampler2D", "usampler2DArray",
        "usampler2DMS", "usampler2DMSArray", "usampler2DRect", "usampler3D", "usamplerBuffer", "usamplerCube",
        "usamplerCubeArray", "using", "uvec2", "uvec3", "uvec4", "varying", "vec2", "vec3", "vec4", "void", "volatile",
        "while", "writeonly"
    ]);
    var CompilerGLSL = /** @class */ (function (_super) {
        __extends(CompilerGLSL, _super);
        function CompilerGLSL(parsedIR) {
            var _this = _super.call(this, parsedIR) || this;
            _this.buffer = new StringStream();
            _this.options = new GLSLOptions();
            _this.local_variable_names = new Set();
            _this.resource_names = new Set();
            _this.block_input_names = new Set();
            _this.block_output_names = new Set();
            _this.block_ubo_names = new Set();
            _this.block_ssbo_names = new Set();
            _this.block_names = new Set(); // A union of all block_*_names.
            _this.function_overloads = {}; //map<string, set<uint64_t>>
            _this.preserved_aliases = []; //map<uint32_t, string>
            _this.backend = new BackendVariations();
            _this.indent = 0;
            // Ensure that we declare phi-variable copies even if the original declaration isn't deferred
            _this.flushed_phi_variables = new Set();
            _this.flattened_buffer_blocks = new Set();
            _this.flattened_structs = []; //map<uint32_t, bool>
            // Usage tracking. If a temporary is used more than once, use the temporary instead to
            // avoid AST explosion when SPIRV is generated with pure SSA and doesn't write stuff to variables.
            _this.expression_usage_counts = []; // std::unordered_map<uint32_t, uint32_t>
            _this.forced_extensions = [];
            _this.header_lines = [];
            _this.statement_count = 0;
            _this.requires_transpose_2x2 = false;
            _this.requires_transpose_3x3 = false;
            _this.requires_transpose_4x4 = false;
            // GL_EXT_shader_framebuffer_fetch support.
            _this.subpass_to_framebuffer_fetch_attachment = [];
            _this.inout_color_attachments = [];
            _this.masked_output_locations = new Set();
            _this.masked_output_builtins = new Set();
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
            var flags = maplike_get(Meta, this.ir.meta, type.self).decoration.decoration_flags;
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
        CompilerGLSL.prototype.reset = function () {
            // We do some speculative optimizations which should pretty much always work out,
            // but just in case the SPIR-V is rather weird, recompile until it's happy.
            // This typically only means one extra pass.
            this.clear_force_recompile();
            // Clear invalid expression tracking.
            this.invalid_expressions.clear();
            this.current_function = null;
            // Clear temporary usage tracking.
            this.expression_usage_counts = [];
            this.forwarded_temporaries.clear();
            this.suppressed_usage_tracking.clear();
            // Ensure that we declare phi-variable copies even if the original declaration isn't deferred
            this.flushed_phi_variables.clear();
            this.reset_name_caches();
            var ir = this.ir;
            ir.for_each_typed_id(SPIRFunction, function (_, func) {
                func.active = false;
                func.flush_undeclared = true;
            });
            ir.for_each_typed_id(SPIRVariable, function (_, var_) { return var_.dependees = []; });
            ir.reset_all_of_type(SPIRExpression);
            ir.reset_all_of_type(SPIRAccessChain);
            this.statement_count = 0;
            this.indent = 0;
            this.current_loop_level = 0;
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
        CompilerGLSL.prototype.emit_header = function () {
            var execution = this.get_entry_point();
            var options = this.options;
            // const ir = this.ir;
            // WEBGL 1 doesn't support version number
            if (options.version !== 100)
                this.statement("#version ", options.version, options.es && options.version > 100 ? " es" : "");
            if (!options.es && options.version < 420) {
                // Needed for binding = # on UBOs, etc.
                if (options.enable_420pack_extension) {
                    this.statement("#ifdef GL_ARB_shading_language_420pack");
                    this.statement("#extension GL_ARB_shading_language_420pack : require");
                    this.statement("#endif");
                }
                // Needed for: layout(early_fragment_tests) in;
                if (execution.flags.get(ExecutionMode.ExecutionModeEarlyFragmentTests))
                    this.require_extension_internal("GL_ARB_shader_image_load_store");
            }
            // Needed for: layout(post_depth_coverage) in;
            if (execution.flags.get(ExecutionMode.ExecutionModePostDepthCoverage))
                this.require_extension_internal("GL_ARB_post_depth_coverage");
            // Needed for: layout({pixel,sample}_interlock_[un]ordered) in;
            var interlock_used = execution.flags.get(ExecutionMode.ExecutionModePixelInterlockOrderedEXT) ||
                execution.flags.get(ExecutionMode.ExecutionModePixelInterlockUnorderedEXT) ||
                execution.flags.get(ExecutionMode.ExecutionModeSampleInterlockOrderedEXT) ||
                execution.flags.get(ExecutionMode.ExecutionModeSampleInterlockUnorderedEXT);
            if (interlock_used) {
                if (options.es) {
                    if (options.version < 310)
                        throw new Error("At least ESSL 3.10 required for fragment shader interlock.");
                    this.require_extension_internal("GL_NV_fragment_shader_interlock");
                }
                else {
                    if (options.version < 420)
                        this.require_extension_internal("GL_ARB_shader_image_load_store");
                    this.require_extension_internal("GL_ARB_fragment_shader_interlock");
                }
            }
            for (var _i = 0, _a = this.forced_extensions; _i < _a.length; _i++) {
                var ext = _a[_i];
                if (ext === "GL_EXT_shader_explicit_arithmetic_types_float16") {
                    // Special case, this extension has a potential fallback to another vendor extension in normal GLSL.
                    // GL_AMD_gpu_shader_half_float is a superset, so try that first.
                    this.statement("#if defined(GL_AMD_gpu_shader_half_float)");
                    this.statement("#extension GL_AMD_gpu_shader_half_float : require");
                    // if (!options.vulkan_semantics)
                    // {
                    this.statement("#elif defined(GL_NV_gpu_shader5)");
                    this.statement("#extension GL_NV_gpu_shader5 : require");
                    /*}
                    else
                    {
                        statement("#elif defined(GL_EXT_shader_explicit_arithmetic_types_float16)");
                        statement("#extension GL_EXT_shader_explicit_arithmetic_types_float16 : require");
                    }*/
                    this.statement("#else");
                    this.statement("#error No extension available for FP16.");
                    this.statement("#endif");
                }
                else if (ext === "GL_EXT_shader_explicit_arithmetic_types_int16") {
                    // if (options.vulkan_semantics)
                    //     statement("#extension GL_EXT_shader_explicit_arithmetic_types_int16 : require");
                    // else
                    // {
                    this.statement("#if defined(GL_AMD_gpu_shader_int16)");
                    this.statement("#extension GL_AMD_gpu_shader_int16 : require");
                    this.statement("#elif defined(GL_NV_gpu_shader5)");
                    this.statement("#extension GL_NV_gpu_shader5 : require");
                    this.statement("#else");
                    this.statement("#error No extension available for Int16.");
                    this.statement("#endif");
                    // }
                }
                else if (ext === "GL_ARB_post_depth_coverage") {
                    if (options.es)
                        this.statement("#extension GL_EXT_post_depth_coverage : require");
                    else {
                        this.statement("#if defined(GL_ARB_post_depth_coverge)");
                        this.statement("#extension GL_ARB_post_depth_coverage : require");
                        this.statement("#else");
                        this.statement("#extension GL_EXT_post_depth_coverage : require");
                        this.statement("#endif");
                    }
                }
                else if ( /*!options.vulkan_semantics &&*/ext === "GL_ARB_shader_draw_parameters") {
                    // Soft-enable this extension on plain GLSL.
                    this.statement("#ifdef ", ext);
                    this.statement("#extension ", ext, " : enable");
                    this.statement("#endif");
                }
                else if (ext === "GL_EXT_control_flow_attributes") {
                    // These are just hints so we can conditionally enable and fallback in the shader.
                    this.statement("#if defined(GL_EXT_control_flow_attributes)");
                    this.statement("#extension GL_EXT_control_flow_attributes : require");
                    this.statement("#define SPIRV_CROSS_FLATTEN [[flatten]]");
                    this.statement("#define SPIRV_CROSS_BRANCH [[dont_flatten]]");
                    this.statement("#define SPIRV_CROSS_UNROLL [[unroll]]");
                    this.statement("#define SPIRV_CROSS_LOOP [[dont_unroll]]");
                    this.statement("#else");
                    this.statement("#define SPIRV_CROSS_FLATTEN");
                    this.statement("#define SPIRV_CROSS_BRANCH");
                    this.statement("#define SPIRV_CROSS_UNROLL");
                    this.statement("#define SPIRV_CROSS_LOOP");
                    this.statement("#endif");
                }
                else if (ext === "GL_NV_fragment_shader_interlock") {
                    this.statement("#extension GL_NV_fragment_shader_interlock : require");
                    this.statement("#define SPIRV_Cross_beginInvocationInterlock() beginInvocationInterlockNV()");
                    this.statement("#define SPIRV_Cross_endInvocationInterlock() endInvocationInterlockNV()");
                }
                else if (ext === "GL_ARB_fragment_shader_interlock") {
                    this.statement("#ifdef GL_ARB_fragment_shader_interlock");
                    this.statement("#extension GL_ARB_fragment_shader_interlock : enable");
                    this.statement("#define SPIRV_Cross_beginInvocationInterlock() beginInvocationInterlockARB()");
                    this.statement("#define SPIRV_Cross_endInvocationInterlock() endInvocationInterlockARB()");
                    this.statement("#elif defined(GL_INTEL_fragment_shader_ordering)");
                    this.statement("#extension GL_INTEL_fragment_shader_ordering : enable");
                    this.statement("#define SPIRV_Cross_beginInvocationInterlock() beginFragmentShaderOrderingINTEL()");
                    this.statement("#define SPIRV_Cross_endInvocationInterlock()");
                    this.statement("#endif");
                }
                else
                    this.statement("#extension ", ext, " : require");
            }
            // subgroups not supported
            /*if (!options.vulkan_semantics)
            {
                const Supp = ShaderSubgroupSupportHelper;
                const result = shader_subgroup_supporter.resolve();

                for (let feature_index = 0; feature_index < Supp::FeatureCount; feature_index++)
                {
                    auto feature = static_cast<Supp::Feature>(feature_index);
                    if (!shader_subgroup_supporter.is_feature_requested(feature))
                        continue;

                    auto exts = Supp::get_candidates_for_feature(feature, result);
                    if (exts.empty())
                        continue;

                    statement("");

                    for (auto &ext : exts)
                    {
                        const char *name = Supp::get_extension_name(ext);
                        const char *extra_predicate = Supp::get_extra_required_extension_predicate(ext);
                        auto extra_names = Supp::get_extra_required_extension_names(ext);
                        statement(&ext !== &exts.front() ? "#elif" : "#if", " defined(", name, ")",
                            (*extra_predicate !== '\0' ? " && " : ""), extra_predicate);
                        for (const auto &e : extra_names)
                        statement("#extension ", e, " : enable");
                        statement("#extension ", name, " : require");
                    }

                    if (!Supp::can_feature_be_implemented_without_extensions(feature))
                    {
                        statement("#else");
                        statement("#error No extensions available to emulate requested subgroup feature.");
                    }

                    statement("#endif");
                }
            }*/
            for (var _b = 0, _c = this.header_lines; _b < _c.length; _b++) {
                var header = _c[_b];
                this.statement(header);
            }
            var inputs = [];
            var outputs = [];
            switch (execution.model) {
                case ExecutionModel.ExecutionModelVertex:
                    if (options.ovr_multiview_view_count)
                        inputs.push("num_views = " + options.ovr_multiview_view_count);
                    break;
                /*case ExecutionModelGeometry:
                    if ((execution.flags.get(ExecutionModeInvocations)) && execution.invocations !== 1)
                        inputs.push(join("invocations = ", execution.invocations));
                    if (execution.flags.get(ExecutionModeInputPoints))
                        inputs.push("points");
                    if (execution.flags.get(ExecutionModeInputLines))
                        inputs.push("lines");
                    if (execution.flags.get(ExecutionModeInputLinesAdjacency))
                        inputs.push("lines_adjacency");
                    if (execution.flags.get(ExecutionModeTriangles))
                        inputs.push("triangles");
                    if (execution.flags.get(ExecutionModeInputTrianglesAdjacency))
                        inputs.push("triangles_adjacency");

                    if (!execution.geometry_passthrough)
                    {
                        // For passthrough, these are implies and cannot be declared in shader.
                        outputs.push(join("max_vertices = ", execution.output_vertices));
                        if (execution.flags.get(ExecutionModeOutputTriangleStrip))
                            outputs.push("triangle_strip");
                        if (execution.flags.get(ExecutionModeOutputPoints))
                            outputs.push("points");
                        if (execution.flags.get(ExecutionModeOutputLineStrip))
                            outputs.push("line_strip");
                    }
                    break;

                case ExecutionModelTessellationControl:
                    if (execution.flags.get(ExecutionModeOutputVertices))
                        outputs.push(join("vertices = ", execution.output_vertices));
                    break;

                case ExecutionModelTessellationEvaluation:
                    if (execution.flags.get(ExecutionModeQuads))
                        inputs.push("quads");
                    if (execution.flags.get(ExecutionModeTriangles))
                        inputs.push("triangles");
                    if (execution.flags.get(ExecutionModeIsolines))
                        inputs.push("isolines");
                    if (execution.flags.get(ExecutionModePointMode))
                        inputs.push("point_mode");

                    if (!execution.flags.get(ExecutionModeIsolines))
                    {
                        if (execution.flags.get(ExecutionModeVertexOrderCw))
                            inputs.push("cw");
                        if (execution.flags.get(ExecutionModeVertexOrderCcw))
                            inputs.push("ccw");
                    }

                    if (execution.flags.get(ExecutionModeSpacingFractionalEven))
                        inputs.push("fractional_even_spacing");
                    if (execution.flags.get(ExecutionModeSpacingFractionalOdd))
                        inputs.push("fractional_odd_spacing");
                    if (execution.flags.get(ExecutionModeSpacingEqual))
                        inputs.push("equal_spacing");
                    break;

                case ExecutionModelGLCompute:
                {
                    if (execution.workgroup_size.constant !== 0 || execution.flags.get(ExecutionModeLocalSizeId))
                    {
                        SpecializationConstant wg_x, wg_y, wg_z;
                        get_work_group_size_specialization_constants(wg_x, wg_y, wg_z);

                        // If there are any spec constants on legacy GLSL, defer declaration, we need to set up macro
                        // declarations before we can emit the work group size.
                        if (options.vulkan_semantics ||
                            ((wg_x.id === ConstantID(0)) && (wg_y.id === ConstantID(0)) && (wg_z.id === ConstantID(0))))
                            build_workgroup_size(inputs, wg_x, wg_y, wg_z);
                    }
                    else
                    {
                        inputs.push(join("local_size_x = ", execution.workgroup_size.x));
                        inputs.push(join("local_size_y = ", execution.workgroup_size.y));
                        inputs.push(join("local_size_z = ", execution.workgroup_size.z));
                    }
                    break;
                }*/
                case ExecutionModel.ExecutionModelFragment:
                    if (options.es) {
                        switch (options.fragment.default_float_precision) {
                            case GLSLPrecision.Lowp:
                                this.statement("precision lowp float;");
                                break;
                            case GLSLPrecision.Mediump:
                                this.statement("precision mediump float;");
                                break;
                            case GLSLPrecision.Highp:
                                this.statement("precision highp float;");
                                break;
                        }
                        switch (options.fragment.default_int_precision) {
                            case GLSLPrecision.Lowp:
                                this.statement("precision lowp int;");
                                break;
                            case GLSLPrecision.Mediump:
                                this.statement("precision mediump int;");
                                break;
                            case GLSLPrecision.Highp:
                                this.statement("precision highp int;");
                                break;
                        }
                    }
                    if (execution.flags.get(ExecutionMode.ExecutionModeEarlyFragmentTests))
                        inputs.push("early_fragment_tests");
                    if (execution.flags.get(ExecutionMode.ExecutionModePostDepthCoverage))
                        inputs.push("post_depth_coverage");
                    if (interlock_used)
                        this.statement("#if defined(GL_ARB_fragment_shader_interlock)");
                    if (execution.flags.get(ExecutionMode.ExecutionModePixelInterlockOrderedEXT))
                        this.statement("layout(pixel_interlock_ordered) in;");
                    else if (execution.flags.get(ExecutionMode.ExecutionModePixelInterlockUnorderedEXT))
                        this.statement("layout(pixel_interlock_unordered) in;");
                    else if (execution.flags.get(ExecutionMode.ExecutionModeSampleInterlockOrderedEXT))
                        this.statement("layout(sample_interlock_ordered) in;");
                    else if (execution.flags.get(ExecutionMode.ExecutionModeSampleInterlockUnorderedEXT))
                        this.statement("layout(sample_interlock_unordered) in;");
                    if (interlock_used) {
                        this.statement("#elif !defined(GL_INTEL_fragment_shader_ordering)");
                        this.statement("#error Fragment Shader Interlock/Ordering extension missing!");
                        this.statement("#endif");
                    }
                    if (!options.es && execution.flags.get(ExecutionMode.ExecutionModeDepthGreater))
                        this.statement("layout(depth_greater) out float gl_FragDepth;");
                    else if (!options.es && execution.flags.get(ExecutionMode.ExecutionModeDepthLess))
                        this.statement("layout(depth_less) out float gl_FragDepth;");
                    break;
            }
            /*for (let cap of ir.declared_capabilities)
                if (cap === Capability.CapabilityRayTraversalPrimitiveCullingKHR) {
                    throw new error("Raytracing not supported");
                    this.statement("layout(primitive_culling);");
                }*/
            if (inputs.length > 0)
                this.statement("layout(", inputs.join(", "), ") in;");
            if (outputs.length > 0)
                this.statement("layout(", outputs.join(", "), ") out;");
            this.statement("");
        };
        CompilerGLSL.prototype.emit_struct_member = function (type, member_type_id, index, qualifier, base_offset) {
            if (qualifier === void 0) { qualifier = ""; }
            var membertype = this.get(SPIRType, member_type_id);
            var ir = this.ir;
            var memberflags;
            var memb = maplike_get(Meta, ir.meta, type.self).members;
            if (index < memb.length)
                memberflags = memb[index].decoration_flags;
            else
                memberflags = new Bitset();
            var qualifiers = "";
            var flags = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags;
            var is_block = flags.get(Decoration.DecorationBlock) || flags.get(Decoration.DecorationBufferBlock);
            if (is_block)
                qualifiers = this.to_interpolation_qualifiers(memberflags);
            this.statement(this.layout_for_member(type, index), qualifiers, qualifier, this.flags_to_qualifiers_glsl(membertype, memberflags), this.variable_decl(membertype, this.to_member_name(type, index)), ";");
        };
        CompilerGLSL.prototype.emit_struct_padding_target = function (_) {
        };
        CompilerGLSL.prototype.emit_buffer_block = function (var_) {
            var type = this.get(SPIRType, var_.basetype);
            var ubo_block = var_.storage === StorageClass.StorageClassUniform && this.has_decoration(type.self, Decoration.DecorationBlock);
            var options = this.options;
            if (this.flattened_buffer_blocks.has(var_.self))
                this.emit_buffer_block_flattened(var_);
            else if (this.is_legacy() || (!options.es && options.version === 130) ||
                (ubo_block && options.emit_uniform_buffer_as_plain_uniforms))
                this.emit_buffer_block_legacy(var_);
            else
                this.emit_buffer_block_native(var_);
        };
        CompilerGLSL.prototype.emit_push_constant_block = function (var_) {
            var options = this.options;
            if (this.flattened_buffer_blocks.has(var_.self))
                this.emit_buffer_block_flattened(var_);
            // else if (options.vulkan_semantics)
            //         this.emit_push_constant_block_vulkan(var_);
            else if (options.emit_push_constant_as_uniform_buffer)
                this.emit_buffer_block_native(var_);
            else
                this.emit_push_constant_block_glsl(var_);
        };
        CompilerGLSL.prototype.emit_buffer_block_legacy = function (var_) {
            var type = this.get(SPIRType, var_.basetype);
            var ir = this.ir;
            var ssbo = var_.storage === StorageClass.StorageClassStorageBuffer ||
                ir.meta[type.self].decoration.decoration_flags.get(Decoration.DecorationBufferBlock);
            if (ssbo)
                throw new Error("SSBOs not supported in legacy targets.");
            // We're emitting the push constant block as a regular struct, so disable the block qualifier temporarily.
            // Otherwise, we will end up emitting layout() qualifiers on naked structs which is not allowed.
            var block_flags = ir.meta[type.self].decoration.decoration_flags;
            var block_flag = block_flags.get(Decoration.DecorationBlock);
            block_flags.clear(Decoration.DecorationBlock);
            this.emit_struct(type);
            if (block_flag)
                block_flags.set(Decoration.DecorationBlock);
            this.emit_uniform(var_);
            this.statement("");
        };
        CompilerGLSL.prototype.emit_buffer_block_flattened = function (var_) {
            var type = this.get(SPIRType, var_.basetype);
            // Block names should never alias.
            var buffer_name = this.to_name(type.self, false);
            var buffer_size = (this.get_declared_struct_size(type) + 15) / 16;
            var basic_type = this.get_common_basic_type(type);
            if (basic_type !== undefined) {
                var tmp = new SPIRType();
                tmp.basetype = basic_type;
                tmp.vecsize = 4;
                if (basic_type !== SPIRTypeBaseType.Float && basic_type !== SPIRTypeBaseType.Int && basic_type !== SPIRTypeBaseType.UInt)
                    throw new Error("Basic types in a flattened UBO must be float, int or uint.");
                var flags = this.ir.get_buffer_block_flags(var_);
                this.statement("uniform ", this.flags_to_qualifiers_glsl(tmp, flags), this.type_to_glsl(tmp), " ", buffer_name, "[", buffer_size, "];");
            }
            else
                throw new Error("All basic types in a flattened block must be the same.");
        };
        CompilerGLSL.prototype.emit_flattened_io_block = function (var_, qual) {
            var var_type = this.get(SPIRType, var_.basetype);
            if (var_type.array.length > 0)
                throw new Error("Array of varying structs cannot be flattened to legacy-compatible varyings.");
            // Emit flattened types based on the type alias. Normally, we are never supposed to emit
            // struct declarations for aliased types.
            var type = var_type.type_alias ? this.get(SPIRType, var_type.type_alias) : var_type;
            var ir = this.ir;
            var dec = maplike_get(Meta, ir.meta, type.self).decoration;
            var old_flags = dec.decoration_flags.clone();
            // Emit the members as if they are part of a block to get all qualifiers.
            dec.decoration_flags.set(Decoration.DecorationBlock);
            type.member_name_cache.clear();
            var member_indices = [];
            member_indices.push(0);
            var basename = this.to_name(var_.self);
            var i = 0;
            for (var _i = 0, _a = type.member_types; _i < _a.length; _i++) {
                var member = _a[_i];
                this.add_member_name(type, i);
                var membertype = this.get(SPIRType, member);
                member_indices[member_indices.length - 1] = i;
                if (membertype.basetype === SPIRTypeBaseType.Struct)
                    this.emit_flattened_io_block_struct(basename, type, qual, member_indices);
                else
                    this.emit_flattened_io_block_member(basename, type, qual, member_indices);
                i++;
            }
            dec.decoration_flags = old_flags;
            // Treat this variable as fully flattened from now on.
            this.flattened_structs[var_.self] = true;
        };
        CompilerGLSL.prototype.emit_flattened_io_block_struct = function (basename, type, qual, indices) {
            var sub_indices = indices.concat();
            sub_indices.push(0);
            var member_type = type;
            for (var _i = 0, indices_1 = indices; _i < indices_1.length; _i++) {
                var index = indices_1[_i];
                member_type = this.get(SPIRType, member_type.member_types[index]);
            }
            console.assert(member_type.basetype === SPIRTypeBaseType.Struct);
            if (member_type.array.length > 0)
                throw new Error("Cannot flatten array of structs in I/O blocks.");
            for (var i = 0; i < member_type.member_types.length; i++) {
                sub_indices[sub_indices.length - 1] = i;
                if (this.get(SPIRType, member_type.member_types[i]).basetype === SPIRTypeBaseType.Struct)
                    this.emit_flattened_io_block_struct(basename, type, qual, sub_indices);
                else
                    this.emit_flattened_io_block_member(basename, type, qual, sub_indices);
            }
        };
        CompilerGLSL.prototype.emit_flattened_io_block_member = function (basename, type, qual, indices) {
            var member_type_id = type.self;
            var member_type = type;
            var parent_type = null;
            var flattened_name = basename;
            for (var _i = 0, indices_2 = indices; _i < indices_2.length; _i++) {
                var index = indices_2[_i];
                flattened_name += "_";
                flattened_name += this.to_member_name(member_type, index);
                parent_type = member_type;
                member_type_id = member_type.member_types[index];
                member_type = this.get(SPIRType, member_type_id);
            }
            console.assert(member_type.basetype !== SPIRTypeBaseType.Struct);
            // We're overriding struct member names, so ensure we do so on the primary type.
            if (parent_type.type_alias)
                parent_type = this.get(SPIRType, parent_type.type_alias);
            // Sanitize underscores because joining the two identifiers might create more than 1 underscore in a row,
            // which is not allowed.
            flattened_name = ParsedIR.sanitize_underscores(flattened_name);
            var last_index = indices[indices.length - 1];
            // Pass in the varying qualifier here so it will appear in the correct declaration order.
            // Replace member name while emitting it so it encodes both struct name and member name.
            this.get_member_name(parent_type.self, last_index);
            var member_name = this.to_member_name(parent_type, last_index);
            this.set_member_name(parent_type.self, last_index, flattened_name);
            this.emit_struct_member(parent_type, member_type_id, last_index, qual);
            // Restore member name.
            this.set_member_name(parent_type.self, last_index, member_name);
        };
        CompilerGLSL.prototype.emit_uniform = function (var_) {
            var type = this.get(SPIRType, var_.basetype);
            var options = this.options;
            if (type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 2 && type.image.dim !== Dim.DimSubpassData) {
                if (!options.es && options.version < 420)
                    this.require_extension_internal("GL_ARB_shader_image_load_store");
                else if (options.es && options.version < 310)
                    throw new Error("At least ESSL 3.10 required for shader image load store.");
            }
            this.add_resource_name(var_.self);
            this.statement(this.layout_for_variable(var_), this.variable_decl(var_), ";");
        };
        // Converts the format of the current expression from packed to unpacked,
        // by wrapping the expression in a constructor of the appropriate type.
        // GLSL does not support packed formats, so simply return the expression.
        // Subclasses that do will override.
        CompilerGLSL.prototype.unpack_expression_type = function (expr_str, _0, _1, _2, _3) {
            return expr_str;
        };
        CompilerGLSL.prototype.builtin_translates_to_nonarray = function (_) {
            return false;
        };
        CompilerGLSL.prototype.statement_inner = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            for (var i = 0; i < args.length; ++i) {
                this.buffer.append(args[i]);
                this.statement_count++;
            }
        };
        // The optional id parameter indicates the object whose type we are trying
        // to find the description for. It is optional. Most type descriptions do not
        // depend on a specific object's use of that type.
        CompilerGLSL.prototype.type_to_glsl = function (type, id) {
            if (id === void 0) { id = 0; }
            if (type.pointer && type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT && type.basetype !== SPIRTypeBaseType.Struct) {
                // Need to create a magic type name which compacts the entire type information.
                var name_1 = this.type_to_glsl(this.get_pointee_type(type));
                for (var i = 0; i < type.array.length; i++) {
                    if (type.array_size_literal[i])
                        name_1 += type.array[i] + "_";
                    else
                        name_1 += "id".concat(type.array[i], "_\"");
                }
                name_1 += "Pointer";
                return name_1;
            }
            var backend = this.backend;
            switch (type.basetype) {
                case SPIRTypeBaseType.Struct:
                    // Need OpName lookup here to get a "sensible" name for a struct.
                    if (backend.explicit_struct_type)
                        return "struct " + this.to_name(type.self);
                    else
                        return this.to_name(type.self);
                case SPIRTypeBaseType.Image:
                case SPIRTypeBaseType.SampledImage:
                    return this.image_type_glsl(type, id);
                case SPIRTypeBaseType.Sampler:
                    // The depth field is set by calling code based on the variable ID of the sampler, effectively reintroducing
                    // this distinction into the type system.
                    return this.comparison_ids.has(id) ? "samplerShadow" : "sampler";
                case SPIRTypeBaseType.AccelerationStructure:
                    // return this.ray_tracing_is_khr ? "accelerationStructureEXT" : "accelerationStructureNV";
                    throw new Error("AccelerationStructure is not supported");
                case SPIRTypeBaseType.RayQuery:
                    throw new Error("RayQuery is not supported");
                case SPIRTypeBaseType.Void:
                    return "void";
            }
            if (type.basetype === SPIRTypeBaseType.UInt && this.is_legacy())
                throw new Error("Unsigned integers are not supported on legacy targets.");
            // TODO: All below can be simplified using a lookup if we assume correct Spir-V
            if (type.vecsize === 1 && type.columns === 1) // Scalar builtin
             {
                switch (type.basetype) {
                    case SPIRTypeBaseType.Boolean:
                        return "bool";
                    case SPIRTypeBaseType.SByte:
                        return backend.basic_int8_type;
                    case SPIRTypeBaseType.UByte:
                        return backend.basic_uint8_type;
                    case SPIRTypeBaseType.Short:
                        return backend.basic_int16_type;
                    case SPIRTypeBaseType.UShort:
                        return backend.basic_uint16_type;
                    case SPIRTypeBaseType.Int:
                        return backend.basic_int_type;
                    case SPIRTypeBaseType.UInt:
                        return backend.basic_uint_type;
                    case SPIRTypeBaseType.AtomicCounter:
                        return "atomic_uint";
                    case SPIRTypeBaseType.Half:
                        return "float16_t";
                    case SPIRTypeBaseType.Float:
                        return "float";
                    case SPIRTypeBaseType.Double:
                        return "double";
                    case SPIRTypeBaseType.Int64:
                        return "int64_t";
                    case SPIRTypeBaseType.UInt64:
                        return "uint64_t";
                    default:
                        return "???";
                }
            }
            else if (type.vecsize > 1 && type.columns === 1) // Vector builtin
             {
                switch (type.basetype) {
                    case SPIRTypeBaseType.Boolean:
                        return "bvec" + type.vecsize;
                    case SPIRTypeBaseType.SByte:
                        return "i8vec" + type.vecsize;
                    case SPIRTypeBaseType.UByte:
                        return "u8vec" + type.vecsize;
                    case SPIRTypeBaseType.Short:
                        return "i16vec" + type.vecsize;
                    case SPIRTypeBaseType.UShort:
                        return "u16vec" + type.vecsize;
                    case SPIRTypeBaseType.Int:
                        return "ivec" + type.vecsize;
                    case SPIRTypeBaseType.UInt:
                        return "uvec" + type.vecsize;
                    case SPIRTypeBaseType.Half:
                        return "f16vec" + type.vecsize;
                    case SPIRTypeBaseType.Float:
                        return "vec" + type.vecsize;
                    case SPIRTypeBaseType.Double:
                        return "dvec" + type.vecsize;
                    case SPIRTypeBaseType.Int64:
                        return "i64vec" + type.vecsize;
                    case SPIRTypeBaseType.UInt64:
                        return "u64vec" + type.vecsize;
                    default:
                        return "???";
                }
            }
            else if (type.vecsize === type.columns) // Simple Matrix builtin
             {
                switch (type.basetype) {
                    case SPIRTypeBaseType.Boolean:
                        return "bmat" + type.vecsize;
                    case SPIRTypeBaseType.Int:
                        return "imat" + type.vecsize;
                    case SPIRTypeBaseType.UInt:
                        return "umat" + type.vecsize;
                    case SPIRTypeBaseType.Half:
                        return "f16mat" + type.vecsize;
                    case SPIRTypeBaseType.Float:
                        return "mat" + type.vecsize;
                    case SPIRTypeBaseType.Double:
                        return "dmat" + type.vecsize;
                    // Matrix types not supported for int64/uint64.
                    default:
                        return "???";
                }
            }
            else {
                switch (type.basetype) {
                    case SPIRTypeBaseType.Boolean:
                        return "bmat".concat(type.columns, "x").concat(type.vecsize);
                    case SPIRTypeBaseType.Int:
                        return "imat".concat(type.columns, "x").concat(type.vecsize);
                    case SPIRTypeBaseType.UInt:
                        return "umat".concat(type.columns, "x").concat(type.vecsize);
                    case SPIRTypeBaseType.Half:
                        return "f16mat".concat(type.columns, "x").concat(type.vecsize);
                    case SPIRTypeBaseType.Float:
                        return "mat".concat(type.columns, "x").concat(type.vecsize);
                    case SPIRTypeBaseType.Double:
                        return "dmat".concat(type.columns, "x").concat(type.vecsize);
                    // Matrix types not supported for int64/uint64.
                    default:
                        return "???";
                }
            }
        };
        CompilerGLSL.prototype.builtin_to_glsl = function (builtin, storage) {
            var options = this.options;
            switch (builtin) {
                case BuiltIn.BuiltInPosition:
                    return "gl_Position";
                case BuiltIn.BuiltInPointSize:
                    return "gl_PointSize";
                case BuiltIn.BuiltInClipDistance:
                    return "gl_ClipDistance";
                case BuiltIn.BuiltInCullDistance:
                    return "gl_CullDistance";
                case BuiltIn.BuiltInVertexId:
                    // if (options.vulkan_semantics)
                    //     throw new Error("Cannot implement gl_VertexID in Vulkan GLSL. This shader was created "
                    // "with GL semantics.");
                    return "gl_VertexID";
                case BuiltIn.BuiltInInstanceId:
                    /*if (options.vulkan_semantics)
                    {
                        auto model = get_entry_point().model;
                        switch (model)
                        {
                            case spv::ExecutionModelIntersectionKHR:
                            case spv::ExecutionModelAnyHitKHR:
                            case spv::ExecutionModelClosestHitKHR:
                                // gl_InstanceID is allowed in these shaders.
                                break;

                            default:
                                throw new Error("Cannot implement gl_InstanceID in Vulkan GLSL. This shader was "
                                "created with GL semantics.");
                        }
                    }*/
                    if (!options.es && options.version < 140) {
                        this.require_extension_internal("GL_ARB_draw_instanced");
                    }
                    return "gl_InstanceID";
                case BuiltIn.BuiltInVertexIndex:
                    /*if (options.vulkan_semantics)
                        return "gl_VertexIndex";
                    else*/
                    return "gl_VertexID"; // gl_VertexID already has the base offset applied.
                case BuiltIn.BuiltInInstanceIndex:
                    // if (options.vulkan_semantics)
                    //     return "gl_InstanceIndex";
                    if (!options.es && options.version < 140) {
                        this.require_extension_internal("GL_ARB_draw_instanced");
                    }
                    if (options.vertex.support_nonzero_base_instance) {
                        // if (!options.vulkan_semantics)
                        // {
                        // This is a soft-enable. We will opt-in to using gl_BaseInstanceARB if supported.
                        this.require_extension_internal("GL_ARB_shader_draw_parameters");
                        // }
                        return "(gl_InstanceID + SPIRV_Cross_BaseInstance)"; // ... but not gl_InstanceID.
                    }
                    else
                        return "gl_InstanceID";
                case BuiltIn.BuiltInPrimitiveId:
                    if (storage === StorageClass.StorageClassInput && this.get_entry_point().model === ExecutionModel.ExecutionModelGeometry)
                        return "gl_PrimitiveIDIn";
                    else
                        return "gl_PrimitiveID";
                case BuiltIn.BuiltInInvocationId:
                    return "gl_InvocationID";
                case BuiltIn.BuiltInLayer:
                    return "gl_Layer";
                case BuiltIn.BuiltInViewportIndex:
                    return "gl_ViewportIndex";
                case BuiltIn.BuiltInTessLevelOuter:
                    return "gl_TessLevelOuter";
                case BuiltIn.BuiltInTessLevelInner:
                    return "gl_TessLevelInner";
                case BuiltIn.BuiltInTessCoord:
                    return "gl_TessCoord";
                case BuiltIn.BuiltInFragCoord:
                    return "gl_FragCoord";
                case BuiltIn.BuiltInPointCoord:
                    return "gl_PointCoord";
                case BuiltIn.BuiltInFrontFacing:
                    return "gl_FrontFacing";
                case BuiltIn.BuiltInFragDepth:
                    return "gl_FragDepth";
                case BuiltIn.BuiltInNumWorkgroups:
                    return "gl_NumWorkGroups";
                case BuiltIn.BuiltInWorkgroupSize:
                    return "gl_WorkGroupSize";
                case BuiltIn.BuiltInWorkgroupId:
                    return "gl_WorkGroupID";
                case BuiltIn.BuiltInLocalInvocationId:
                    return "gl_LocalInvocationID";
                case BuiltIn.BuiltInGlobalInvocationId:
                    return "gl_GlobalInvocationID";
                case BuiltIn.BuiltInLocalInvocationIndex:
                    return "gl_LocalInvocationIndex";
                case BuiltIn.BuiltInHelperInvocation:
                    return "gl_HelperInvocation";
                case BuiltIn.BuiltInBaseVertex:
                    if (options.es)
                        throw new Error("BaseVertex not supported in ES profile.");
                    /*if (options.vulkan_semantics)
                    {
                        if (options.version < 460)
                        {
                            require_extension_internal("GL_ARB_shader_draw_parameters");
                            return "gl_BaseVertexARB";
                        }
                        return "gl_BaseVertex";
                    }*/
                    // On regular GL, this is soft-enabled and we emit ifdefs in code.
                    this.require_extension_internal("GL_ARB_shader_draw_parameters");
                    return "SPIRV_Cross_BaseVertex";
                case BuiltIn.BuiltInBaseInstance:
                    if (options.es)
                        throw new Error("BaseInstance not supported in ES profile.");
                    /*if (options.vulkan_semantics)
                    {
                        if (options.version < 460)
                        {
                            require_extension_internal("GL_ARB_shader_draw_parameters");
                            return "gl_BaseInstanceARB";
                        }
                        return "gl_BaseInstance";
                    }*/
                    // On regular GL, this is soft-enabled and we emit ifdefs in code.
                    this.require_extension_internal("GL_ARB_shader_draw_parameters");
                    return "SPIRV_Cross_BaseInstance";
                case BuiltIn.BuiltInDrawIndex:
                    if (options.es)
                        throw new Error("DrawIndex not supported in ES profile.");
                    /*if (options.vulkan_semantics)
                    {
                        if (options.version < 460)
                        {
                            require_extension_internal("GL_ARB_shader_draw_parameters");
                            return "gl_DrawIDARB";
                        }
                        return "gl_DrawID";
                    }*/
                    // On regular GL, this is soft-enabled and we emit ifdefs in code.
                    this.require_extension_internal("GL_ARB_shader_draw_parameters");
                    return "gl_DrawIDARB";
                case BuiltIn.BuiltInSampleId:
                    if (options.es && options.version < 320)
                        this.require_extension_internal("GL_OES_sample_variables");
                    if (!options.es && options.version < 400)
                        throw new Error("gl_SampleID not supported before GLSL 400.");
                    return "gl_SampleID";
                case BuiltIn.BuiltInSampleMask:
                    if (options.es && options.version < 320)
                        this.require_extension_internal("GL_OES_sample_variables");
                    if (!options.es && options.version < 400)
                        throw new Error("gl_SampleMask/gl_SampleMaskIn not supported before GLSL 400.");
                    if (storage === StorageClass.StorageClassInput)
                        return "gl_SampleMaskIn";
                    else
                        return "gl_SampleMask";
                case BuiltIn.BuiltInSamplePosition:
                    if (options.es && options.version < 320)
                        this.require_extension_internal("GL_OES_sample_variables");
                    if (!options.es && options.version < 400)
                        throw new Error("gl_SamplePosition not supported before GLSL 400.");
                    return "gl_SamplePosition";
                case BuiltIn.BuiltInViewIndex:
                    /*if (options.vulkan_semantics)
                        return "gl_ViewIndex";
                    else*/
                    return "gl_ViewID_OVR";
                case BuiltIn.BuiltInNumSubgroups:
                /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::NumSubgroups);
                return "gl_NumSubgroups";*/
                case BuiltIn.BuiltInSubgroupId:
                /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupID);
                return "gl_SubgroupID";*/
                case BuiltIn.BuiltInSubgroupSize:
                /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupSize);
                return "gl_SubgroupSize";*/
                case BuiltIn.BuiltInSubgroupLocalInvocationId:
                /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupInvocationID);
                return "gl_SubgroupInvocationID";*/
                case BuiltIn.BuiltInSubgroupEqMask:
                /*this.request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
                return "gl_SubgroupEqMask";*/
                case BuiltIn.BuiltInSubgroupGeMask:
                /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
                return "gl_SubgroupGeMask";*/
                case BuiltIn.BuiltInSubgroupGtMask:
                /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
                return "gl_SubgroupGtMask";*/
                case BuiltIn.BuiltInSubgroupLeMask:
                /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
                return "gl_SubgroupLeMask";*/
                case BuiltIn.BuiltInSubgroupLtMask:
                    /*request_subgroup_feature(ShaderSubgroupSupportHelper::SubgroupMask);
                    return "gl_SubgroupLtMask";*/
                    throw new Error("Subgroups not supported");
                case BuiltIn.BuiltInLaunchIdKHR:
                // return ray_tracing_is_khr ? "gl_LaunchIDEXT" : "gl_LaunchIDNV";
                case BuiltIn.BuiltInLaunchSizeKHR:
                // return ray_tracing_is_khr ? "gl_LaunchSizeEXT" : "gl_LaunchSizeNV";
                case BuiltIn.BuiltInWorldRayOriginKHR:
                // return ray_tracing_is_khr ? "gl_WorldRayOriginEXT" : "gl_WorldRayOriginNV";
                case BuiltIn.BuiltInWorldRayDirectionKHR:
                // return ray_tracing_is_khr ? "gl_WorldRayDirectionEXT" : "gl_WorldRayDirectionNV";
                case BuiltIn.BuiltInObjectRayOriginKHR:
                // return ray_tracing_is_khr ? "gl_ObjectRayOriginEXT" : "gl_ObjectRayOriginNV";
                case BuiltIn.BuiltInObjectRayDirectionKHR:
                // return ray_tracing_is_khr ? "gl_ObjectRayDirectionEXT" : "gl_ObjectRayDirectionNV";
                case BuiltIn.BuiltInRayTminKHR:
                // return ray_tracing_is_khr ? "gl_RayTminEXT" : "gl_RayTminNV";
                case BuiltIn.BuiltInRayTmaxKHR:
                // return ray_tracing_is_khr ? "gl_RayTmaxEXT" : "gl_RayTmaxNV";
                case BuiltIn.BuiltInInstanceCustomIndexKHR:
                // return ray_tracing_is_khr ? "gl_InstanceCustomIndexEXT" : "gl_InstanceCustomIndexNV";
                case BuiltIn.BuiltInObjectToWorldKHR:
                // return ray_tracing_is_khr ? "gl_ObjectToWorldEXT" : "gl_ObjectToWorldNV";
                case BuiltIn.BuiltInWorldToObjectKHR:
                // return ray_tracing_is_khr ? "gl_WorldToObjectEXT" : "gl_WorldToObjectNV";
                case BuiltIn.BuiltInHitTNV:
                // gl_HitTEXT is an alias of RayTMax in KHR.
                // return "gl_HitTNV";
                case BuiltIn.BuiltInHitKindKHR:
                // return ray_tracing_is_khr ? "gl_HitKindEXT" : "gl_HitKindNV";
                case BuiltIn.BuiltInIncomingRayFlagsKHR:
                    throw new Error("Raytracing not supported");
                // return ray_tracing_is_khr ? "gl_IncomingRayFlagsEXT" : "gl_IncomingRayFlagsNV";
                case BuiltIn.BuiltInBaryCoordNV: {
                    if (options.es && options.version < 320)
                        throw new Error("gl_BaryCoordNV requires ESSL 320.");
                    else if (!options.es && options.version < 450)
                        throw new Error("gl_BaryCoordNV requires GLSL 450.");
                    this.require_extension_internal("GL_NV_fragment_shader_barycentric");
                    return "gl_BaryCoordNV";
                }
                case BuiltIn.BuiltInBaryCoordNoPerspNV: {
                    if (options.es && options.version < 320)
                        throw new Error("gl_BaryCoordNoPerspNV requires ESSL 320.");
                    else if (!options.es && options.version < 450)
                        throw new Error("gl_BaryCoordNoPerspNV requires GLSL 450.");
                    this.require_extension_internal("GL_NV_fragment_shader_barycentric");
                    return "gl_BaryCoordNoPerspNV";
                }
                case BuiltIn.BuiltInFragStencilRefEXT: {
                    if (!options.es) {
                        this.require_extension_internal("GL_ARB_shader_stencil_export");
                        return "gl_FragStencilRefARB";
                    }
                    else
                        throw new Error("Stencil export not supported in GLES.");
                }
                case BuiltIn.BuiltInPrimitiveShadingRateKHR: {
                    // if (!options.vulkan_semantics)
                    throw new Error("Can only use PrimitiveShadingRateKHR in Vulkan GLSL.");
                    // require_extension_internal("GL_EXT_fragment_shading_rate");
                    // return "gl_PrimitiveShadingRateEXT";
                }
                case BuiltIn.BuiltInShadingRateKHR: {
                    // if (!options.vulkan_semantics)
                    throw new Error("Can only use ShadingRateKHR in Vulkan GLSL.");
                    // require_extension_internal("GL_EXT_fragment_shading_rate");
                    // return "gl_ShadingRateEXT";
                }
                case BuiltIn.BuiltInDeviceIndex:
                    // if (!options.vulkan_semantics)
                    throw new Error("Need Vulkan semantics for device group support.");
                // require_extension_internal("GL_EXT_device_group");
                // return "gl_DeviceIndex";
                case BuiltIn.BuiltInFullyCoveredEXT:
                    if (!options.es)
                        this.require_extension_internal("GL_NV_conservative_raster_underestimation");
                    else
                        throw new Error("Need desktop GL to use GL_NV_conservative_raster_underestimation.");
                    return "gl_FragFullyCoveredNV";
                default:
                    return "gl_BuiltIn_" + convert_to_string(builtin);
            }
        };
        CompilerGLSL.prototype.image_type_glsl = function (type, id) {
            if (id === void 0) { id = 0; }
            var imagetype = this.get(SPIRType, type.image.type);
            var res = "";
            switch (imagetype.basetype) {
                case SPIRTypeBaseType.Int:
                case SPIRTypeBaseType.Short:
                case SPIRTypeBaseType.SByte:
                    res = "i";
                    break;
                case SPIRTypeBaseType.UInt:
                case SPIRTypeBaseType.UShort:
                case SPIRTypeBaseType.UByte:
                    res = "u";
                    break;
            }
            // For half image types, we will force mediump for the sampler, and cast to f16 after any sampling operation.
            // We cannot express a true half texture type in GLSL. Neither for short integer formats for that matter.
            var options = this.options;
            /*if (type.basetype === SPIRTypeBaseType.Image && type.image.dim === Dim.DimSubpassData && options.vulkan_semantics)
                return res + "subpassInput" + (type.image.ms ? "MS" : "");
            else*/
            if (type.basetype === SPIRTypeBaseType.Image && type.image.dim === Dim.DimSubpassData &&
                this.subpass_input_is_framebuffer_fetch(id)) {
                var sampled_type = this.get(SPIRType, type.image.type);
                sampled_type.vecsize = 4;
                return this.type_to_glsl(sampled_type);
            }
            // If we're emulating subpassInput with samplers, force sampler2D
            // so we don't have to specify format.
            if (type.basetype === SPIRTypeBaseType.Image && type.image.dim !== Dim.DimSubpassData) {
                // Sampler buffers are always declared as samplerBuffer even though they might be separate images in the SPIR-V.
                if (type.image.dim === Dim.DimBuffer && type.image.sampled === 1)
                    res += "sampler";
                else
                    res += type.image.sampled === 2 ? "image" : "texture";
            }
            else
                res += "sampler";
            switch (type.image.dim) {
                case Dim.Dim1D:
                    res += "1D";
                    break;
                case Dim.Dim2D:
                    res += "2D";
                    break;
                case Dim.Dim3D:
                    res += "3D";
                    break;
                case Dim.DimCube:
                    res += "Cube";
                    break;
                case Dim.DimRect:
                    if (options.es)
                        throw new Error("Rectangle textures are not supported on OpenGL ES.");
                    if (this.is_legacy_desktop())
                        this.require_extension_internal("GL_ARB_texture_rectangle");
                    res += "2DRect";
                    break;
                case Dim.DimBuffer:
                    if (options.es && options.version < 320)
                        this.require_extension_internal("GL_EXT_texture_buffer");
                    else if (!options.es && options.version < 300)
                        this.require_extension_internal("GL_EXT_texture_buffer_object");
                    res += "Buffer";
                    break;
                case Dim.DimSubpassData:
                    res += "2D";
                    break;
                default:
                    throw new Error("Only 1D, 2D, 2DRect, 3D, Buffer, InputTarget and Cube textures supported.");
            }
            if (type.image.ms)
                res += "MS";
            if (type.image.arrayed) {
                if (this.is_legacy_desktop())
                    this.require_extension_internal("GL_EXT_texture_array");
                res += "Array";
            }
            // "Shadow" state in GLSL only exists for samplers and combined image samplers.
            if (((type.basetype === SPIRTypeBaseType.SampledImage) || (type.basetype === SPIRTypeBaseType.Sampler)) &&
                this.is_depth_image(type, id)) {
                res += "Shadow";
            }
            return res;
        };
        CompilerGLSL.prototype.constant_expression = function (c) {
            var type = this.get(SPIRType, c.constant_type);
            var backend = this.backend;
            if (type.pointer) {
                return backend.null_pointer_literal;
            }
            else if (c.subconstants.length > 0) {
                // Handles Arrays and structures.
                var res = void 0;
                // Allow Metal to use the array<T> template to make arrays a value type
                var needs_trailing_tracket = false;
                if (backend.use_initializer_list && backend.use_typed_initializer_list && type.basetype === SPIRTypeBaseType.Struct &&
                    type.array.length === 0) {
                    res = this.type_to_glsl_constructor(type) + "{ ";
                }
                else if (backend.use_initializer_list && backend.use_typed_initializer_list && backend.array_is_value_type &&
                    type.array.length > 0) {
                    res = this.type_to_glsl_constructor(type) + "({ ";
                    needs_trailing_tracket = true;
                }
                else if (backend.use_initializer_list) {
                    res = "{ ";
                }
                else {
                    res = this.type_to_glsl_constructor(type) + "(";
                }
                for (var i = 0; i < c.subconstants.length; ++i) {
                    var elem = c.subconstants[i];
                    var subc = this.get(SPIRConstant, elem);
                    if (subc.specialization)
                        res += this.to_name(elem);
                    else
                        res += this.constant_expression(subc);
                    if (i !== c.subconstants.length - 1)
                        res += ", ";
                }
                res += backend.use_initializer_list ? " }" : ")";
                if (needs_trailing_tracket)
                    res += ")";
                return res;
            }
            else if (type.basetype === SPIRTypeBaseType.Struct && type.member_types.length === 0) {
                // Metal tessellation likes empty structs which are then constant expressions.
                if (backend.supports_empty_struct)
                    return "{ }";
                else if (backend.use_typed_initializer_list)
                    return this.type_to_glsl(this.get(SPIRType, c.constant_type)) + "{ 0 }";
                else if (backend.use_initializer_list)
                    return "{ 0 }";
                else
                    return this.type_to_glsl(this.get(SPIRType, c.constant_type)) + "(0)";
            }
            else if (c.columns() === 1) {
                return this.constant_expression_vector(c, 0);
            }
            else {
                var res = this.type_to_glsl(this.get(SPIRType, c.constant_type)) + "(";
                for (var col = 0; col < c.columns(); col++) {
                    if (c.specialization_constant_id(col) !== 0)
                        res += this.to_name(c.specialization_constant_id(col));
                    else
                        res += this.constant_expression_vector(c, col);
                    if (col + 1 < c.columns())
                        res += ", ";
                }
                res += ")";
                return res;
            }
        };
        CompilerGLSL.prototype.constant_op_expression = function (cop) {
            var type = this.get(SPIRType, cop.basetype);
            var binary = false;
            var unary = false;
            var op = "";
            if (this.is_legacy() && is_unsigned_opcode(cop.opcode))
                throw new Error("Unsigned integers are not supported on legacy targets.");
            // TODO: Find a clean way to reuse emit_instruction.
            switch (cop.opcode) {
                case Op.OpSConvert:
                case Op.OpUConvert:
                case Op.OpFConvert:
                    op = this.type_to_glsl_constructor(type);
                    break;
                case Op.OpSNegate:
                case Op.OpNot:
                case Op.OpLogicalNot:
                    unary = true;
                    op = ops[cop.opcode];
                    break;
                case Op.OpIAdd:
                case Op.OpISub:
                case Op.OpIMul:
                case Op.OpSDiv:
                case Op.OpUDiv:
                case Op.OpUMod:
                case Op.OpSMod:
                case Op.OpShiftRightLogical:
                case Op.OpShiftRightArithmetic:
                case Op.OpShiftLeftLogical:
                case Op.OpBitwiseOr:
                case Op.OpBitwiseXor:
                case Op.OpBitwiseAnd:
                case Op.OpLogicalOr:
                case Op.OpLogicalAnd:
                case Op.OpLogicalEqual:
                case Op.OpLogicalNotEqual:
                case Op.OpIEqual:
                case Op.OpINotEqual:
                case Op.OpULessThan:
                case Op.OpSLessThan:
                case Op.OpULessThanEqual:
                case Op.OpSLessThanEqual:
                case Op.OpUGreaterThan:
                case Op.OpSGreaterThan:
                case Op.OpUGreaterThanEqual:
                case Op.OpSGreaterThanEqual:
                    binary = true;
                    op = ops[cop.opcode];
                    break;
                case Op.OpSRem: {
                    var op0 = cop.arguments[0];
                    var op1 = cop.arguments[1];
                    return this.to_enclosed_expression(op0) + " - " + this.to_enclosed_expression(op1) + " * (",
                        this.to_enclosed_expression(op0) + " / " + this.to_enclosed_expression(op1) + ")";
                }
                case Op.OpSelect: {
                    if (cop.arguments.length < 3)
                        throw new Error("Not enough arguments to OpSpecConstantOp.");
                    // This one is pretty annoying. It's triggered from
                    // uint(bool), int(bool) from spec constants.
                    // In order to preserve its compile-time constness in Vulkan GLSL,
                    // we need to reduce the OpSelect expression back to this simplified model.
                    // If we cannot, fail.
                    var _op = this.to_trivial_mix_op(type, cop.arguments[2], cop.arguments[1], cop.arguments[0]);
                    if (_op) {
                        op = _op;
                        // Implement as a simple cast down below.
                    }
                    else {
                        // Implement a ternary and pray the compiler understands it :)
                        return this.to_ternary_expression(type, cop.arguments[0], cop.arguments[1], cop.arguments[2]);
                    }
                    break;
                }
                case Op.OpVectorShuffle: {
                    var expr = this.type_to_glsl_constructor(type);
                    expr += "(";
                    var left_components = this.expression_type(cop.arguments[0]).vecsize;
                    var left_arg = this.to_enclosed_expression(cop.arguments[0]);
                    var right_arg = this.to_enclosed_expression(cop.arguments[1]);
                    for (var i = 2; i < cop.arguments.length; i++) {
                        var index = cop.arguments[i];
                        if (index >= left_components)
                            expr += right_arg + "." + "xyzw"[index - left_components];
                        else
                            expr += left_arg + "." + "xyzw"[index];
                        if (i + 1 < cop.arguments.length)
                            expr += ", ";
                    }
                    expr += ")";
                    return expr;
                }
                case Op.OpCompositeExtract: {
                    var expr = this.access_chain_internal(cop.arguments[0], cop.arguments.slice(1), cop.arguments.length - 1, AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT, null);
                    return expr;
                }
                case Op.OpCompositeInsert:
                    throw new Error("OpCompositeInsert spec constant op is not supported.");
                default:
                    // Some opcodes are unimplemented here, these are currently not possible to test from glslang.
                    throw new Error("Unimplemented spec constant op.");
            }
            var bit_width = 0;
            if (unary || binary || cop.opcode === Op.OpSConvert || cop.opcode === Op.OpUConvert)
                bit_width = this.expression_type(cop.arguments[0]).width;
            var input_type;
            var skip_cast_if_equal_type = opcode_is_sign_invariant(cop.opcode);
            switch (cop.opcode) {
                case Op.OpIEqual:
                case Op.OpINotEqual:
                    input_type = to_signed_basetype(bit_width);
                    break;
                case Op.OpSLessThan:
                case Op.OpSLessThanEqual:
                case Op.OpSGreaterThan:
                case Op.OpSGreaterThanEqual:
                case Op.OpSMod:
                case Op.OpSDiv:
                case Op.OpShiftRightArithmetic:
                case Op.OpSConvert:
                case Op.OpSNegate:
                    input_type = to_signed_basetype(bit_width);
                    break;
                case Op.OpULessThan:
                case Op.OpULessThanEqual:
                case Op.OpUGreaterThan:
                case Op.OpUGreaterThanEqual:
                case Op.OpUMod:
                case Op.OpUDiv:
                case Op.OpShiftRightLogical:
                case Op.OpUConvert:
                    input_type = to_unsigned_basetype(bit_width);
                    break;
                default:
                    input_type = type.basetype;
                    break;
            }
            if (binary) {
                if (cop.arguments.length < 2)
                    throw new Error("Not enough arguments to OpSpecConstantOp.");
                var props = { cast_op0: "", cast_op1: "", input_type: input_type };
                var expected_type = this.binary_op_bitcast_helper(props, cop.arguments[0], cop.arguments[1], skip_cast_if_equal_type);
                input_type = props.input_type;
                if (type.basetype !== input_type && type.basetype !== SPIRTypeBaseType.Boolean) {
                    expected_type.basetype = input_type;
                    var expr = this.bitcast_glsl_op(type, expected_type);
                    expr += "(" + props.cast_op0 + " " + op + " " + props.cast_op1 + ")";
                    return expr;
                }
                else
                    return "(" + props.cast_op0 + " " + op + " " + props.cast_op1 + ")";
            }
            else if (unary) {
                if (cop.arguments.length < 1)
                    throw new Error("Not enough arguments to OpSpecConstantOp.");
                // Auto-bitcast to result type as needed.
                // Works around various casting scenarios in glslang as there is no OpBitcast for specialization constants.
                return "(" + op + this.bitcast_glsl(type, cop.arguments[0]) + ")";
            }
            else if (cop.opcode === Op.OpSConvert || cop.opcode === Op.OpUConvert) {
                if (cop.arguments.length < 1)
                    throw new Error("Not enough arguments to OpSpecConstantOp.");
                var arg_type = this.expression_type(cop.arguments[0]);
                if (arg_type.width < type.width && input_type !== arg_type.basetype) {
                    var expected = arg_type;
                    expected.basetype = input_type;
                    return op + "(" + this.bitcast_glsl(expected, cop.arguments[0]) + ")";
                }
                else
                    return op + "(" + this.to_expression(cop.arguments[0]) + ")";
            }
            else {
                if (cop.arguments.length < 1)
                    throw new Error("Not enough arguments to OpSpecConstantOp.");
                return op + "(" + this.to_expression(cop.arguments[0]) + ")";
            }
        };
        CompilerGLSL.prototype.constant_expression_vector = function (c, vector) {
            var type = this.get(SPIRType, c.constant_type);
            type.columns = 1;
            var scalar_type = type;
            scalar_type.vecsize = 1;
            var backend = this.backend;
            var res = "";
            var splat = backend.use_constructor_splatting && c.vector_size() > 1;
            var swizzle_splat = backend.can_swizzle_scalar && c.vector_size() > 1;
            if (!type_is_floating_point(type)) {
                // Cannot swizzle literal integers as a special case.
                swizzle_splat = false;
            }
            if (splat || swizzle_splat) {
                // Cannot use constant splatting if we have specialization constants somewhere in the vector.
                for (var i = 0; i < c.vector_size(); i++) {
                    if (c.specialization_constant_id(vector, i) !== 0) {
                        splat = false;
                        swizzle_splat = false;
                        break;
                    }
                }
            }
            if (splat || swizzle_splat) {
                if (type.width === 64) {
                    var ident = c.scalar_u64(vector, 0);
                    for (var i = 1; i < c.vector_size(); i++) {
                        if (ident !== c.scalar_u64(vector, i)) {
                            splat = false;
                            swizzle_splat = false;
                            break;
                        }
                    }
                }
                else {
                    var ident = c.scalar(vector, 0);
                    for (var i = 1; i < c.vector_size(); i++) {
                        if (ident !== c.scalar(vector, i)) {
                            splat = false;
                            swizzle_splat = false;
                        }
                    }
                }
            }
            if (c.vector_size() > 1 && !swizzle_splat)
                res += this.type_to_glsl(type) + "(";
            switch (type.basetype) {
                case SPIRTypeBaseType.Half:
                    if (splat || swizzle_splat) {
                        res += this.convert_half_to_string(c, vector, 0);
                        if (swizzle_splat)
                            res = this.remap_swizzle(this.get(SPIRType, c.constant_type), 1, res);
                    }
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else
                                res += this.convert_half_to_string(c, vector, i);
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                case SPIRTypeBaseType.Float:
                    if (splat || swizzle_splat) {
                        res += this.convert_float_to_string(c, vector, 0);
                        if (swizzle_splat)
                            res = this.remap_swizzle(this.get(SPIRType, c.constant_type), 1, res);
                    }
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else
                                res += this.convert_float_to_string(c, vector, i);
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                case SPIRTypeBaseType.Double:
                    if (splat || swizzle_splat) {
                        res += this.convert_double_to_string(c, vector, 0);
                        if (swizzle_splat)
                            res = this.remap_swizzle(this.get(SPIRType, c.constant_type), 1, res);
                    }
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else
                                res += this.convert_double_to_string(c, vector, i);
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                case SPIRTypeBaseType.Int64: {
                    var tmp = type;
                    tmp.vecsize = 1;
                    tmp.columns = 1;
                    var int64_type = this.type_to_glsl(tmp);
                    if (splat) {
                        res += convert_to_string(c.scalar_i64(vector, 0), int64_type, backend.long_long_literal_suffix);
                    }
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else
                                res += convert_to_string(c.scalar_i64(vector, i), int64_type, backend.long_long_literal_suffix);
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                }
                case SPIRTypeBaseType.UInt64:
                    if (splat) {
                        res += convert_to_string(c.scalar_u64(vector, 0));
                        if (backend.long_long_literal_suffix)
                            res += "ull";
                        else
                            res += "ul";
                    }
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else {
                                res += convert_to_string(c.scalar_u64(vector, i));
                                if (backend.long_long_literal_suffix)
                                    res += "ull";
                                else
                                    res += "ul";
                            }
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                case SPIRTypeBaseType.UInt:
                    if (splat) {
                        res += convert_to_string(c.scalar(vector, 0));
                        if (this.is_legacy()) {
                            // Fake unsigned constant literals with signed ones if possible.
                            // Things like array sizes, etc, tend to be unsigned even though they could just as easily be signed.
                            if (c.scalar_i32(vector, 0) < 0)
                                throw new Error("Tried to convert uint literal into int, but this made the literal negative.");
                        }
                        else if (backend.uint32_t_literal_suffix)
                            res += "u";
                    }
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else {
                                res += convert_to_string(c.scalar(vector, i));
                                if (this.is_legacy()) {
                                    // Fake unsigned constant literals with signed ones if possible.
                                    // Things like array sizes, etc, tend to be unsigned even though they could just as easily be signed.
                                    if (c.scalar_i32(vector, i) < 0)
                                        throw new Error("Tried to convert uint literal into int, but this made the literal negative.");
                                }
                                else if (backend.uint32_t_literal_suffix)
                                    res += "u";
                            }
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                case SPIRTypeBaseType.Int:
                    if (splat)
                        res += convert_to_string(c.scalar_i32(vector, 0));
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else
                                res += convert_to_string(c.scalar_i32(vector, i));
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                case SPIRTypeBaseType.UShort:
                    if (splat) {
                        res += convert_to_string(c.scalar(vector, 0));
                    }
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else {
                                if (backend.uint16_t_literal_suffix !== "") {
                                    res += convert_to_string(c.scalar_u16(vector, i));
                                    res += backend.uint16_t_literal_suffix;
                                }
                                else {
                                    // If backend doesn't have a literal suffix, we need to value cast.
                                    res += this.type_to_glsl(scalar_type);
                                    res += "(";
                                    res += convert_to_string(c.scalar_u16(vector, i));
                                    res += ")";
                                }
                            }
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                case SPIRTypeBaseType.Short:
                    if (splat) {
                        res += convert_to_string(c.scalar_i16(vector, 0));
                    }
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else {
                                if (backend.int16_t_literal_suffix !== "") {
                                    res += convert_to_string(c.scalar_i16(vector, i));
                                    res += backend.int16_t_literal_suffix;
                                }
                                else {
                                    // If backend doesn't have a literal suffix, we need to value cast.
                                    res += this.type_to_glsl(scalar_type);
                                    res += "(";
                                    res += convert_to_string(c.scalar_i16(vector, i));
                                    res += ")";
                                }
                            }
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                case SPIRTypeBaseType.UByte:
                    if (splat) {
                        res += convert_to_string(c.scalar_u8(vector, 0));
                    }
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else {
                                res += this.type_to_glsl(scalar_type);
                                res += "(";
                                res += convert_to_string(c.scalar_u8(vector, i));
                                res += ")";
                            }
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                case SPIRTypeBaseType.SByte:
                    if (splat) {
                        res += convert_to_string(c.scalar_i8(vector, 0));
                    }
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else {
                                res += this.type_to_glsl(scalar_type);
                                res += "(";
                                res += convert_to_string(c.scalar_i8(vector, i));
                                res += ")";
                            }
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                case SPIRTypeBaseType.Boolean:
                    if (splat)
                        res += c.scalar(vector, 0) ? "true" : "false";
                    else {
                        for (var i = 0; i < c.vector_size(); i++) {
                            if (c.vector_size() > 1 && c.specialization_constant_id(vector, i) !== 0)
                                res += this.to_expression(c.specialization_constant_id(vector, i));
                            else
                                res += c.scalar(vector, i) ? "true" : "false";
                            if (i + 1 < c.vector_size())
                                res += ", ";
                        }
                    }
                    break;
                default:
                    throw new Error("Invalid constant expression basetype.");
            }
            if (c.vector_size() > 1 && !swizzle_splat)
                res += ")";
            return res;
        };
        CompilerGLSL.prototype.statement = function () {
            var _a;
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (this.is_forcing_recompilation()) {
                // Do not bother emitting code while force_recompile is active.
                // We will compile again.
                this.statement_count++;
                return;
            }
            if (this.redirect_statement) {
                this.redirect_statement = (_a = this.redirect_statement).concat.apply(_a, args);
                this.statement_count++;
            }
            else {
                for (var i = 0; i < this.indent; i++)
                    this.buffer.append("\t");
                this.statement_inner.apply(this, args);
                this.buffer.append("\n");
            }
        };
        CompilerGLSL.prototype.statement_no_indent = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var old_indent = this.indent;
            this.indent = 0;
            this.statement.apply(this, args);
            this.indent = old_indent;
        };
        CompilerGLSL.prototype.begin_scope = function () {
            this.statement("{");
            this.indent++;
        };
        CompilerGLSL.prototype.end_scope = function (trailer) {
            if (!this.indent)
                throw new Error("Popping empty indent stack.");
            this.indent--;
            if (trailer)
                this.statement("}", trailer);
            else
                this.statement("}");
        };
        CompilerGLSL.prototype.end_scope_decl = function (decl) {
            if (!this.indent)
                throw new Error("Popping empty indent stack.");
            this.indent--;
            if (decl)
                this.statement("} ", decl, ";");
            else
                this.statement("};");
        };
        CompilerGLSL.prototype.add_resource_name = function (id) {
            var dec = maplike_get(Meta, this.ir.meta, id).decoration;
            dec.alias = this.add_variable(this.resource_names, this.block_names, dec.alias);
        };
        CompilerGLSL.prototype.add_member_name = function (type, index) {
            var memb = maplike_get(Meta, this.ir.meta, type.self).members;
            if (index < memb.length && memb[index].alias !== "") {
                var name_2 = memb[index].alias;
                if (name_2 === "")
                    return;
                name_2 = ParsedIR.sanitize_identifier(name_2, true, true);
                name_2 = this.update_name_cache(type.member_name_cache, name_2);
                memb[index].alias = name_2;
            }
        };
        CompilerGLSL.prototype.type_to_array_glsl = function (type) {
            if (type.pointer && type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT && type.basetype !== SPIRTypeBaseType.Struct) {
                // We are using a wrapped pointer type, and we should not emit any array declarations here.
                return "";
            }
            if (type.array.length === 0)
                return "";
            var options = this.options;
            if (options.flatten_multidimensional_arrays) {
                var res = "";
                res += "[";
                for (var i = type.array.length; i; i--) {
                    res += this.enclose_expression(this.to_array_size(type, i - 1));
                    if (i > 1)
                        res += " * ";
                }
                res += "]";
                return res;
            }
            else {
                if (type.array.length > 1) {
                    if (!options.es && options.version < 430)
                        this.require_extension_internal("GL_ARB_arrays_of_arrays");
                    else if (options.es && options.version < 310)
                        throw new Error("Arrays of arrays not supported before ESSL version 310. " +
                            "Try using --flatten-multidimensional-arrays or set " +
                            "options.flatten_multidimensional_arrays to true.");
                }
                var res = "";
                for (var i = type.array.length; i; i--) {
                    res += "[";
                    res += this.to_array_size(type, i - 1);
                    res += "]";
                }
                return res;
            }
        };
        CompilerGLSL.prototype.to_array_size = function (type, index) {
            console.assert(type.array.length === type.array_size_literal.length);
            var size = type.array[index];
            if (!type.array_size_literal[index])
                return this.to_expression(size);
            else if (size)
                return convert_to_string(size);
            else if (!this.backend.unsized_array_supported) {
                // For runtime-sized arrays, we can work around
                // lack of standard support for this by simply having
                // a single element array.
                //
                // Runtime length arrays must always be the last element
                // in an interface block.
                return "1";
            }
            else
                return "";
        };
        CompilerGLSL.prototype.to_array_size_literal = function (type, index) {
            if (index === undefined)
                index = type.array.length - 1;
            console.assert(type.array.length === type.array_size_literal.length);
            if (type.array_size_literal[index]) {
                return type.array[index];
            }
            else {
                // Use the default spec constant value.
                // This is the best we can do.
                return this.evaluate_constant_u32(type.array[index]);
            }
        };
        CompilerGLSL.prototype.variable_decl = function (variable, name, id) {
            if (id === void 0) { id = 0; }
            if (name !== undefined) {
                // first overload
                var type_1 = variable;
                var type_name = this.type_to_glsl(type_1, id);
                type_name = this.remap_variable_type_name(type_1, name, type_name);
                return type_name + " " + name + this.type_to_array_glsl(type_1);
            }
            variable = variable;
            // Ignore the pointer type since GLSL doesn't have pointers.
            var type = this.get_variable_data_type(variable);
            if (type.pointer_depth > 1 && !this.backend.support_pointer_to_pointer)
                throw new Error("Cannot declare pointer-to-pointer types.");
            var options = this.options;
            var ir = this.ir;
            var res = this.to_qualifiers_glsl(variable.self) + this.variable_decl(type, this.to_name(variable.self), variable.self);
            if (variable.loop_variable && variable.static_expression) {
                var expr = variable.static_expression;
                if (ir.ids[expr].get_type() !== Types.TypeUndef)
                    res += " = " + this.to_unpacked_expression(variable.static_expression);
                else if (options.force_zero_initialized_variables && this.type_can_zero_initialize(type))
                    res += " = " + this.to_zero_initialized_expression(this.get_variable_data_type_id(variable));
            }
            else if (variable.initializer && !this.variable_decl_is_remapped_storage(variable, StorageClass.StorageClassWorkgroup)) {
                var expr = variable.initializer;
                if (ir.ids[expr].get_type() !== Types.TypeUndef)
                    res += " = " + this.to_initializer_expression(variable);
                else if (options.force_zero_initialized_variables && this.type_can_zero_initialize(type))
                    res += " = " + this.to_zero_initialized_expression(this.get_variable_data_type_id(variable));
            }
            return res;
        };
        CompilerGLSL.prototype.variable_decl_is_remapped_storage = function (var_, storage) {
            return var_.storage === storage;
        };
        CompilerGLSL.prototype.is_non_native_row_major_matrix = function (id) {
            // Natively supported row-major matrices do not need to be converted.
            // Legacy targets do not support row major.
            if (this.backend.native_row_major_matrix && !this.is_legacy())
                return false;
            var e = this.maybe_get(SPIRExpression, id);
            if (e)
                return e.need_transpose;
            else
                return this.has_decoration(id, Decoration.DecorationRowMajor);
        };
        CompilerGLSL.prototype.member_is_non_native_row_major_matrix = function (type, index) {
            // Natively supported row-major matrices do not need to be converted.
            if (this.backend.native_row_major_matrix && !this.is_legacy())
                return false;
            // Non-matrix or column-major matrix types do not need to be converted.
            if (!this.has_member_decoration(type.self, index, Decoration.DecorationRowMajor))
                return false;
            // Only square row-major matrices can be converted at this time.
            // Converting non-square matrices will require defining custom GLSL function that
            // swaps matrix elements while retaining the original dimensional form of the matrix.
            var mbr_type = this.get(SPIRType, type.member_types[index]);
            if (mbr_type.columns !== mbr_type.vecsize)
                throw new Error("Row-major matrices must be square on this platform.");
            return true;
        };
        CompilerGLSL.prototype.member_is_remapped_physical_type = function (type, index) {
            return this.has_extended_member_decoration(type.self, index, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID);
        };
        CompilerGLSL.prototype.member_is_packed_physical_type = function (type, index) {
            return this.has_extended_member_decoration(type.self, index, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked);
        };
        // Wraps the expression string in a function call that converts the
        // row_major matrix result of the expression to a column_major matrix.
        // Base implementation uses the standard library transpose() function.
        // Subclasses may override to use a different function.
        CompilerGLSL.prototype.convert_row_major_matrix = function (exp_str, exp_type, physical_type_id, is_packed) {
            exp_str = this.strip_enclosed_expression(exp_str);
            if (!this.is_matrix(exp_type)) {
                var column_index = exp_str.lastIndexOf("[");
                if (column_index === -1)
                    return exp_str;
                var column_expr = exp_str.substring(column_index);
                exp_str = exp_str.substring(0, column_index);
                var transposed_expr = this.type_to_glsl_constructor(exp_type) + "(";
                // Loading a column from a row-major matrix. Unroll the load.
                for (var c = 0; c < exp_type.vecsize; c++) {
                    transposed_expr += "".concat(exp_str, "[").concat(c, "]").concat(column_expr);
                    if (c + 1 < exp_type.vecsize)
                        transposed_expr += ", ";
                }
                transposed_expr += ")";
                return transposed_expr;
            }
            else if (this.options.version < 120) {
                // GLSL 110, ES 100 do not have transpose(), so emulate it.  Note that
                // these GLSL versions do not support non-square matrices.
                if (exp_type.vecsize === 2 && exp_type.columns === 2) {
                    if (!this.requires_transpose_2x2) {
                        this.requires_transpose_2x2 = true;
                        this.force_recompile();
                    }
                }
                else if (exp_type.vecsize === 3 && exp_type.columns === 3) {
                    if (!this.requires_transpose_3x3) {
                        this.requires_transpose_3x3 = true;
                        this.force_recompile();
                    }
                }
                else if (exp_type.vecsize === 4 && exp_type.columns === 4) {
                    if (!this.requires_transpose_4x4) {
                        this.requires_transpose_4x4 = true;
                        this.force_recompile();
                    }
                }
                else
                    throw new Error("Non-square matrices are not supported in legacy GLSL, cannot transpose.");
                return "spvTranspose(".concat(exp_str, ")");
            }
            else
                return "transpose(".concat(exp_str, ")");
        };
        CompilerGLSL.prototype.preserve_alias_on_reset = function (id) {
            this.preserved_aliases[id] = this.get_name(id);
        };
        CompilerGLSL.prototype.reset_name_caches = function () {
            var _this = this;
            this.preserved_aliases.forEach(function (preserved_second, preserved_first) {
                return _this.set_name(preserved_first, preserved_second);
            });
            this.preserved_aliases = [];
            this.resource_names.clear();
            this.block_input_names.clear();
            this.block_output_names.clear();
            this.block_ubo_names.clear();
            this.block_ssbo_names.clear();
            this.block_names.clear();
            this.function_overloads = {};
        };
        CompilerGLSL.prototype.emit_struct = function (type) {
            // Struct types can be stamped out multiple times
            // with just different offsets, matrix layouts, etc ...
            // Type-punning with these types is legal, which complicates things
            // when we are storing struct and array types in an SSBO for example.
            // If the type master is packed however, we can no longer assume that the struct declaration will be redundant.
            if (type.type_alias !== (0) && !this.has_extended_decoration(type.type_alias, ExtendedDecorations.SPIRVCrossDecorationBufferBlockRepacked))
                return;
            this.add_resource_name(type.self);
            var name = this.type_to_glsl(type);
            var backend = this.backend;
            this.statement(!backend.explicit_struct_type ? "struct " : "", name);
            this.begin_scope();
            type.member_name_cache.clear();
            var i = 0;
            var emitted = false;
            for (var _i = 0, _a = type.member_types; _i < _a.length; _i++) {
                var member = _a[_i];
                this.add_member_name(type, i);
                this.emit_struct_member(type, member, i);
                i++;
                emitted = true;
            }
            // Don't declare empty structs in GLSL, this is not allowed.
            if (this.type_is_empty(type) && !backend.supports_empty_struct) {
                this.statement("int empty_struct_member;");
                emitted = true;
            }
            if (this.has_extended_decoration(type.self, ExtendedDecorations.SPIRVCrossDecorationPaddingTarget))
                this.emit_struct_padding_target(type);
            this.end_scope_decl();
            if (emitted)
                this.statement("");
        };
        CompilerGLSL.prototype.emit_resources = function () {
            var _this = this;
            var execution = this.get_entry_point();
            var options = this.options;
            var ir = this.ir;
            this.replace_illegal_names();
            // Legacy GL uses gl_FragData[], redeclare all fragment outputs
            // with builtins.
            if (execution.model === ExecutionModel.ExecutionModelFragment && this.is_legacy())
                this.replace_fragment_outputs();
            // Emit PLS blocks if we have such variables.
            if (this.pls_inputs.length > 0 || this.pls_outputs.length > 0)
                this.emit_pls();
            /*switch (execution.model)
            {
                case ExecutionModelGeometry:
                case ExecutionModelTessellationControl:
                case ExecutionModelTessellationEvaluation:
                    fixup_implicit_builtin_block_names();
                    break;

                default:
                    break;
            }*/
            // Emit custom gl_PerVertex for SSO compatibility.
            if (options.separate_shader_objects && !options.es && execution.model !== ExecutionModel.ExecutionModelFragment) {
                switch (execution.model) {
                    /*case ExecutionModelGeometry:
                    case ExecutionModelTessellationControl:
                    case ExecutionModelTessellationEvaluation:
                        emit_declared_builtin_block(StorageClassInput, execution.model);
                        emit_declared_builtin_block(StorageClassOutput, execution.model);
                        break;*/
                    case ExecutionModel.ExecutionModelVertex:
                        this.emit_declared_builtin_block(StorageClass.StorageClassOutput, execution.model);
                        break;
                }
            }
            else if (this.should_force_emit_builtin_block(StorageClass.StorageClassOutput)) {
                this.emit_declared_builtin_block(StorageClass.StorageClassOutput, execution.model);
            }
            else if (execution.geometry_passthrough) {
                // Need to declare gl_in with Passthrough.
                // If we're doing passthrough, we cannot emit an output block, so the output block test above will never pass.
                this.emit_declared_builtin_block(StorageClass.StorageClassInput, execution.model);
            }
            else {
                // Need to redeclare clip/cull distance with explicit size to use them.
                // SPIR-V mandates these builtins have a size declared.
                var storage = execution.model === ExecutionModel.ExecutionModelFragment ? "in" : "out";
                if (this.clip_distance_count !== 0)
                    this.statement(storage, " float gl_ClipDistance[", this.clip_distance_count, "];");
                if (this.cull_distance_count !== 0)
                    this.statement(storage, " float gl_CullDistance[", this.cull_distance_count, "];");
                if (this.clip_distance_count !== 0 || this.cull_distance_count !== 0)
                    this.statement("");
            }
            if (this.position_invariant) {
                this.statement("invariant gl_Position;");
                this.statement("");
            }
            var emitted = false;
            // If emitted Vulkan GLSL,
            // emit specialization constants as actual floats,
            // spec op expressions will redirect to the constant name.
            //
            {
                var loop_lock = ir.create_loop_hard_lock();
                for (var _i = 0, _a = ir.ids_for_constant_or_type; _i < _a.length; _i++) {
                    var id_ = _a[_i];
                    var id = ir.ids[id_];
                    if (id.get_type() === Types.TypeConstant) {
                        var c = id.get(SPIRConstant);
                        var needs_declaration = c.specialization || c.is_used_as_lut;
                        if (needs_declaration) {
                            if ( /*!options.vulkan_semantics &&*/c.specialization) {
                                c.specialization_constant_macro_name =
                                    this.constant_value_macro_name(this.get_decoration(c.self, Decoration.DecorationSpecId));
                            }
                            this.emit_constant(c);
                            emitted = true;
                        }
                    }
                    else if (id.get_type() === Types.TypeConstantOp) {
                        this.emit_specialization_constant_op(id.get(SPIRConstantOp));
                        emitted = true;
                    }
                    else if (id.get_type() === Types.TypeType) {
                        var type = id.get(SPIRType);
                        var is_natural_struct = type.basetype === SPIRTypeBaseType.Struct && type.array.length === 0 && type.pointer &&
                            (!this.has_decoration(type.self, Decoration.DecorationBlock) &&
                                !this.has_decoration(type.self, Decoration.DecorationBufferBlock));
                        // Special case, ray payload and hit attribute blocks are not really blocks, just regular structs.
                        /*if (type.basetype === SPIRTypeBaseType.Struct && type.pointer &&
                            this.has_decoration(type.self, Decoration.DecorationBlock) &&
                            (type.storage === StorageClass.StorageClassRayPayloadKHR || type.storage === StorageClass.StorageClassIncomingRayPayloadKHR ||
                            type.storage === StorageClass.StorageClassHitAttributeKHR))
                        {
                            type = this.get<SPIRType>(SPIRType, type.parent_type);
                            is_natural_struct = true;
                        }*/
                        if (is_natural_struct) {
                            if (emitted)
                                this.statement("");
                            emitted = false;
                            this.emit_struct(type);
                        }
                    }
                }
                loop_lock.dispose();
            }
            if (emitted)
                this.statement("");
            // If we needed to declare work group size late, check here.
            // If the work group size depends on a specialization constant, we need to declare the layout() block
            // after constants (and their macros) have been declared.
            /*if (execution.model === ExecutionModelGLCompute && !options.vulkan_semantics &&
                (execution.workgroup_size.constant !== 0 || execution.flags.get(ExecutionModeLocalSizeId)))
            {
                SpecializationConstant wg_x, wg_y, wg_z;
                get_work_group_size_specialization_constants(wg_x, wg_y, wg_z);

                if ((wg_x.id !== ConstantID(0)) || (wg_y.id !== ConstantID(0)) || (wg_z.id !== ConstantID(0)))
                {
                    SmallVector<string> inputs;
                    build_workgroup_size(inputs, wg_x, wg_y, wg_z);
                    statement("layout(", merge(inputs), ") in;");
                    statement("");
                }
            }*/
            emitted = false;
            if (ir.addressing_model === AddressingModel.AddressingModelPhysicalStorageBuffer64EXT) {
                for (var _b = 0, _c = this.physical_storage_non_block_pointer_types; _b < _c.length; _b++) {
                    var type = _c[_b];
                    this.emit_buffer_reference_block(type, false);
                }
                // Output buffer reference blocks.
                // Do this in two stages, one with forward declaration,
                // and one without. Buffer reference blocks can reference themselves
                // to support things like linked lists.
                ir.for_each_typed_id(SPIRType, function (self, type) {
                    if (type.basetype === SPIRTypeBaseType.Struct && type.pointer &&
                        type.pointer_depth === 1 && !_this.type_is_array_of_pointers(type) &&
                        type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT) {
                        _this.emit_buffer_reference_block(self, true);
                    }
                });
                ir.for_each_typed_id(SPIRType, function (self, type) {
                    if (type.basetype === SPIRTypeBaseType.Struct &&
                        type.pointer && type.pointer_depth === 1 && !_this.type_is_array_of_pointers(type) &&
                        type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT) {
                        _this.emit_buffer_reference_block(self, false);
                    }
                });
            }
            // Output UBOs and SSBOs
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                var type = _this.get(SPIRType, var_.basetype);
                var is_block_storage = type.storage === StorageClass.StorageClassStorageBuffer ||
                    type.storage === StorageClass.StorageClassUniform ||
                    type.storage === StorageClass.StorageClassShaderRecordBufferKHR;
                var has_block_flags = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags.get(Decoration.DecorationBlock) ||
                    maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags.get(Decoration.DecorationBufferBlock);
                if (var_.storage !== StorageClass.StorageClassFunction && type.pointer && is_block_storage &&
                    !_this.is_hidden_variable(var_) && has_block_flags) {
                    _this.emit_buffer_block(var_);
                }
            });
            // Output push constant blocks
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                var type = _this.get(SPIRType, var_.basetype);
                if (var_.storage !== StorageClass.StorageClassFunction && type.pointer &&
                    type.storage === StorageClass.StorageClassPushConstant && !_this.is_hidden_variable(var_)) {
                    _this.emit_push_constant_block(var_);
                }
            });
            // Output Uniform Constants (values, samplers, images, etc).
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                var type = _this.get(SPIRType, var_.basetype);
                // If we're remapping separate samplers and images, only emit the combined samplers.
                {
                    // Sampler buffers are always used without a sampler, and they will also work in regular GL.
                    var sampler_buffer = type.basetype === SPIRTypeBaseType.Image && type.image.dim === Dim.DimBuffer;
                    var separate_image = type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1;
                    var separate_sampler = type.basetype === SPIRTypeBaseType.Sampler;
                    if (!sampler_buffer && (separate_image || separate_sampler))
                        return;
                }
                if (var_.storage !== StorageClass.StorageClassFunction && type.pointer &&
                    (type.storage === StorageClass.StorageClassUniformConstant || type.storage === StorageClass.StorageClassAtomicCounter ||
                        type.storage === StorageClass.StorageClassRayPayloadKHR || type.storage === StorageClass.StorageClassIncomingRayPayloadKHR ||
                        type.storage === StorageClass.StorageClassCallableDataKHR || type.storage === StorageClass.StorageClassIncomingCallableDataKHR ||
                        type.storage === StorageClass.StorageClassHitAttributeKHR) && !_this.is_hidden_variable(var_)) {
                    _this.emit_uniform(var_);
                    emitted = true;
                }
            });
            if (emitted)
                this.statement("");
            emitted = false;
            var emitted_base_instance = false;
            // Output in/out interfaces.
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                var type = _this.get(SPIRType, var_.basetype);
                var is_hidden = _this.is_hidden_variable(var_);
                // Unused output I/O variables might still be required to implement framebuffer fetch.
                if (var_.storage === StorageClass.StorageClassOutput && !_this.is_legacy() &&
                    _this.location_is_framebuffer_fetch(_this.get_decoration(var_.self, Decoration.DecorationLocation)) /* !== 0*/) {
                    is_hidden = false;
                }
                if (var_.storage !== StorageClass.StorageClassFunction && type.pointer &&
                    (var_.storage === StorageClass.StorageClassInput || var_.storage === StorageClass.StorageClassOutput) &&
                    _this.interface_variable_exists_in_entry_point(var_.self) && !is_hidden) {
                    if (options.es && _this.get_execution_model() === ExecutionModel.ExecutionModelVertex &&
                        var_.storage === StorageClass.StorageClassInput && type.array.length === 1) {
                        throw new Error("OpenGL ES doesn't support array input variables in vertex shader.");
                    }
                    _this.emit_interface_block(var_);
                    emitted = true;
                }
                else if (_this.is_builtin_variable(var_)) {
                    var builtin = (_this.get_decoration(var_.self, Decoration.DecorationBuiltIn));
                    // For gl_InstanceIndex emulation on GLES, the API user needs to
                    // supply this uniform.
                    // The draw parameter extension is soft-enabled on GL with some fallbacks.
                    // if (!options.vulkan_semantics)
                    // {
                    if (!emitted_base_instance &&
                        ((options.vertex.support_nonzero_base_instance && builtin === BuiltIn.BuiltInInstanceIndex) ||
                            (builtin === BuiltIn.BuiltInBaseInstance))) {
                        _this.statement("#ifdef GL_ARB_shader_draw_parameters");
                        _this.statement("#define SPIRV_Cross_BaseInstance gl_BaseInstanceARB");
                        _this.statement("#else");
                        // A crude, but simple workaround which should be good enough for non-indirect draws.
                        _this.statement("uniform int SPIRV_Cross_BaseInstance;");
                        _this.statement("#endif");
                        emitted = true;
                        emitted_base_instance = true;
                    }
                    else if (builtin === BuiltIn.BuiltInBaseVertex) {
                        _this.statement("#ifdef GL_ARB_shader_draw_parameters");
                        _this.statement("#define SPIRV_Cross_BaseVertex gl_BaseVertexARB");
                        _this.statement("#else");
                        // A crude, but simple workaround which should be good enough for non-indirect draws.
                        _this.statement("uniform int SPIRV_Cross_BaseVertex;");
                        _this.statement("#endif");
                    }
                    else if (builtin === BuiltIn.BuiltInDrawIndex) {
                        _this.statement("#ifndef GL_ARB_shader_draw_parameters");
                        // Cannot really be worked around.
                        _this.statement("#error GL_ARB_shader_draw_parameters is not supported.");
                        _this.statement("#endif");
                    }
                    // }
                }
            });
            // Global variables.
            for (var _d = 0, _e = this.global_variables; _d < _e.length; _d++) {
                var global_1 = _e[_d];
                var var_ = this.get(SPIRVariable, global_1);
                if (this.is_hidden_variable(var_, true))
                    continue;
                if (var_.storage !== StorageClass.StorageClassOutput) {
                    if (!this.variable_is_lut(var_)) {
                        this.add_resource_name(var_.self);
                        var initializer = "";
                        if (options.force_zero_initialized_variables && var_.storage === StorageClass.StorageClassPrivate &&
                            !var_.initializer && !var_.static_expression && this.type_can_zero_initialize(this.get_variable_data_type(var_))) {
                            initializer = " = " + this.to_zero_initialized_expression(this.get_variable_data_type_id(var_));
                        }
                        this.statement(this.variable_decl(var_), initializer, ";");
                        emitted = true;
                    }
                }
                else if (var_.initializer && this.maybe_get(SPIRConstant, var_.initializer) !== null) {
                    this.emit_output_variable_initializer(var_);
                }
            }
            if (emitted)
                this.statement("");
            this.declare_undefined_values();
        };
        CompilerGLSL.prototype.emit_buffer_block_native = function (var_) {
            var type = this.get(SPIRType, var_.basetype);
            var ir = this.ir;
            var flags = ir.get_buffer_block_flags(var_);
            var dec = maplike_get(Meta, ir.meta, type.self).decoration;
            var ssbo = var_.storage === StorageClass.StorageClassStorageBuffer || var_.storage === StorageClass.StorageClassShaderRecordBufferKHR ||
                dec.decoration_flags.get(Decoration.DecorationBufferBlock);
            var is_restrict = ssbo && flags.get(Decoration.DecorationRestrict);
            var is_writeonly = ssbo && flags.get(Decoration.DecorationNonReadable);
            var is_readonly = ssbo && flags.get(Decoration.DecorationNonWritable);
            var is_coherent = ssbo && flags.get(Decoration.DecorationCoherent);
            // Block names should never alias, but from HLSL input they kind of can because block types are reused for UAVs ...
            var buffer_name = this.to_name(type.self, false);
            var block_namespace = ssbo ? this.block_ssbo_names : this.block_ubo_names;
            // Shaders never use the block by interface name, so we don't
            // have to track this other than updating name caches.
            // If we have a collision for any reason, just fallback immediately.
            if (dec.alias === "" || block_namespace.has(buffer_name) || this.resource_names.has(buffer_name)) {
                buffer_name = this.get_block_fallback_name(var_.self);
            }
            // Make sure we get something unique for both global name scope and block name scope.
            // See GLSL 4.5 spec: section 4.3.9 for details.
            buffer_name = this.add_variable(block_namespace, this.resource_names, buffer_name);
            // If for some reason buffer_name is an illegal name, make a final fallback to a workaround name.
            // This cannot conflict with anything else, so we're safe now.
            // We cannot reuse this fallback name in neither global scope (blocked by block_names) nor block name scope.
            if (buffer_name === "")
                buffer_name = "_" + this.get(SPIRType, var_.basetype).self + "_" + var_.self;
            this.block_names.add(buffer_name);
            block_namespace.add(buffer_name);
            // Save for post-reflection later.
            this.declared_block_names[var_.self] = buffer_name;
            this.statement(this.layout_for_variable(var_), is_coherent ? "coherent " : "", is_restrict ? "restrict " : "", is_writeonly ? "writeonly " : "", is_readonly ? "readonly " : "", ssbo ? "buffer " : "uniform ", buffer_name);
            this.begin_scope();
            type.member_name_cache.clear();
            var i = 0;
            for (var _i = 0, _a = type.member_types; _i < _a.length; _i++) {
                var member = _a[_i];
                this.add_member_name(type, i);
                this.emit_struct_member(type, member, i);
                i++;
            }
            // var_.self can be used as a backup name for the block name,
            // so we need to make sure we don't disturb the name here on a recompile.
            // It will need to be reset if we have to recompile.
            this.preserve_alias_on_reset(var_.self);
            this.add_resource_name(var_.self);
            this.end_scope_decl(this.to_name(var_.self) + this.type_to_array_glsl(type));
            this.statement("");
        };
        CompilerGLSL.prototype.emit_buffer_reference_block = function (type_id, forward_declaration) {
            var type = this.get(SPIRType, type_id);
            var buffer_name = "";
            var ir = this.ir;
            if (forward_declaration) {
                // Block names should never alias, but from HLSL input they kind of can because block types are reused for UAVs ...
                // Allow aliased name since we might be declaring the block twice. Once with buffer reference (forward declared) and one proper declaration.
                // The names must match up.
                buffer_name = this.to_name(type.self, false);
                // Shaders never use the block by interface name, so we don't
                // have to track this other than updating name caches.
                // If we have a collision for any reason, just fallback immediately.
                if (maplike_get(Meta, ir.meta, type.self).decoration.alias.length === 0 ||
                    this.block_ssbo_names.has(buffer_name) ||
                    this.resource_names.has(buffer_name)) {
                    buffer_name = "_" + type.self;
                }
                // Make sure we get something unique for both global name scope and block name scope.
                // See GLSL 4.5 spec: section 4.3.9 for details.
                buffer_name = this.add_variable(this.block_ssbo_names, this.resource_names, buffer_name);
                // If for some reason buffer_name is an illegal name, make a final fallback to a workaround name.
                // This cannot conflict with anything else, so we're safe now.
                // We cannot reuse this fallback name in neither global scope (blocked by block_names) nor block name scope.
                if (buffer_name.length === 0)
                    buffer_name = "_" + type.self;
                this.block_names.add(buffer_name);
                this.block_ssbo_names.add(buffer_name);
                // Ensure we emit the correct name when emitting non-forward pointer type.
                ir.meta[type.self].decoration.alias = buffer_name;
            }
            else if (type.basetype !== SPIRTypeBaseType.Struct)
                buffer_name = this.type_to_glsl(type);
            else
                buffer_name = this.to_name(type.self, false);
            if (!forward_declaration) {
                var itr_second = this.physical_storage_type_to_alignment[type_id];
                var alignment = 0;
                if (itr_second)
                    alignment = itr_second.alignment;
                if (type.basetype === SPIRTypeBaseType.Struct) {
                    var attributes = ["buffer_reference"];
                    if (alignment)
                        attributes.push("buffer_reference_align = " + alignment);
                    attributes.push(this.buffer_to_packing_standard(type, true));
                    var flags = ir.get_buffer_block_type_flags(type);
                    var decorations = "";
                    if (flags.get(Decoration.DecorationRestrict))
                        decorations += " restrict";
                    if (flags.get(Decoration.DecorationCoherent))
                        decorations += " coherent";
                    if (flags.get(Decoration.DecorationNonReadable))
                        decorations += " writeonly";
                    if (flags.get(Decoration.DecorationNonWritable))
                        decorations += " readonly";
                    this.statement("layout(", attributes.join(", "), ")", decorations, " buffer ", buffer_name);
                }
                else if (alignment)
                    this.statement("layout(buffer_reference, buffer_reference_align = ", alignment, ") buffer ", buffer_name);
                else
                    this.statement("layout(buffer_reference) buffer ", buffer_name);
                this.begin_scope();
                if (type.basetype === SPIRTypeBaseType.Struct) {
                    type.member_name_cache.clear();
                    var i = 0;
                    for (var _i = 0, _a = type.member_types; _i < _a.length; _i++) {
                        var member = _a[_i];
                        this.add_member_name(type, i);
                        this.emit_struct_member(type, member, i);
                        i++;
                    }
                }
                else {
                    var pointee_type = this.get_pointee_type(type);
                    this.statement(this.type_to_glsl(pointee_type), " value", this.type_to_array_glsl(pointee_type), ";");
                }
                this.end_scope_decl();
                this.statement("");
            }
            else {
                this.statement("layout(buffer_reference) buffer ", buffer_name, ";");
            }
        };
        CompilerGLSL.prototype.emit_declared_builtin_block = function (storage, model) {
            var _this = this;
            var emitted_builtins = new Bitset();
            var global_builtins = new Bitset();
            var emitted_block = false;
            var builtin_array = false;
            // Need to use declared size in the type.
            // These variables might have been declared, but not statically used, so we haven't deduced their size yet.
            var cull_distance_size = 0;
            var clip_distance_size = 0;
            var have_xfb_buffer_stride = false;
            var have_geom_stream = false;
            var have_any_xfb_offset = false;
            var xfb_stride = 0, xfb_buffer = 0, geom_stream = 0;
            var builtin_xfb_offsets = []; //std::unordered_map<uint32_t, uint32_t> ;
            var _a = this, ir = _a.ir, options = _a.options;
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                var type = _this.get(SPIRType, var_.basetype);
                var block = _this.has_decoration(type.self, Decoration.DecorationBlock);
                var builtins = new Bitset();
                if (var_.storage === storage && block && _this.is_builtin_variable(var_)) {
                    var index = 0;
                    for (var _i = 0, _a = maplike_get(Meta, ir.meta, type.self).members; _i < _a.length; _i++) {
                        var m = _a[_i];
                        if (m.builtin) {
                            builtins.set(m.builtin_type);
                            if (m.builtin_type === BuiltIn.BuiltInCullDistance)
                                cull_distance_size = _this.to_array_size_literal(_this.get(SPIRType, type.member_types[index]));
                            else if (m.builtin_type === BuiltIn.BuiltInClipDistance)
                                clip_distance_size = _this.to_array_size_literal(_this.get(SPIRType, type.member_types[index]));
                            if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.DecorationOffset)) {
                                have_any_xfb_offset = true;
                                builtin_xfb_offsets[m.builtin_type] = m.offset;
                            }
                            if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.DecorationStream)) {
                                var stream = m.stream;
                                if (have_geom_stream && geom_stream !== stream)
                                    throw new Error("IO block member Stream mismatch.");
                                have_geom_stream = true;
                                geom_stream = stream;
                            }
                        }
                        index++;
                    }
                    if (storage === StorageClass.StorageClassOutput && _this.has_decoration(var_.self, Decoration.DecorationXfbBuffer) &&
                        _this.has_decoration(var_.self, Decoration.DecorationXfbStride)) {
                        var buffer_index = _this.get_decoration(var_.self, Decoration.DecorationXfbBuffer);
                        var stride = _this.get_decoration(var_.self, Decoration.DecorationXfbStride);
                        if (have_xfb_buffer_stride && buffer_index !== xfb_buffer)
                            throw new Error("IO block member XfbBuffer mismatch.");
                        if (have_xfb_buffer_stride && stride !== xfb_stride)
                            throw new Error("IO block member XfbBuffer mismatch.");
                        have_xfb_buffer_stride = true;
                        xfb_buffer = buffer_index;
                        xfb_stride = stride;
                    }
                    if (storage === StorageClass.StorageClassOutput && _this.has_decoration(var_.self, Decoration.DecorationStream)) {
                        var stream = _this.get_decoration(var_.self, Decoration.DecorationStream);
                        if (have_geom_stream && geom_stream !== stream)
                            throw new Error("IO block member Stream mismatch.");
                        have_geom_stream = true;
                        geom_stream = stream;
                    }
                }
                else if (var_.storage === storage && !block && _this.is_builtin_variable(var_)) {
                    // While we're at it, collect all declared global builtins (HLSL mostly ...).
                    var m = maplike_get(Meta, ir.meta, var_.self).decoration;
                    if (m.builtin) {
                        global_builtins.set(m.builtin_type);
                        if (m.builtin_type === BuiltIn.BuiltInCullDistance)
                            cull_distance_size = _this.to_array_size_literal(type);
                        else if (m.builtin_type === BuiltIn.BuiltInClipDistance)
                            clip_distance_size = _this.to_array_size_literal(type);
                        if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.DecorationXfbStride) &&
                            m.decoration_flags.get(Decoration.DecorationXfbBuffer) && m.decoration_flags.get(Decoration.DecorationOffset)) {
                            have_any_xfb_offset = true;
                            builtin_xfb_offsets[m.builtin_type] = m.offset;
                            var buffer_index = m.xfb_buffer;
                            var stride = m.xfb_stride;
                            if (have_xfb_buffer_stride && buffer_index !== xfb_buffer)
                                throw new Error("IO block member XfbBuffer mismatch.");
                            if (have_xfb_buffer_stride && stride !== xfb_stride)
                                throw new Error("IO block member XfbBuffer mismatch.");
                            have_xfb_buffer_stride = true;
                            xfb_buffer = buffer_index;
                            xfb_stride = stride;
                        }
                        if (is_block_builtin(m.builtin_type) && m.decoration_flags.get(Decoration.DecorationStream)) {
                            var stream = _this.get_decoration(var_.self, Decoration.DecorationStream);
                            if (have_geom_stream && geom_stream !== stream)
                                throw new Error("IO block member Stream mismatch.");
                            have_geom_stream = true;
                            geom_stream = stream;
                        }
                    }
                }
                if (builtins.empty())
                    return;
                if (emitted_block)
                    throw new Error("Cannot use more than one builtin I/O block.");
                emitted_builtins = builtins;
                emitted_block = true;
                builtin_array = type.array.length > 0;
            });
            global_builtins = new Bitset(global_builtins.get_lower());
            global_builtins.set(BuiltIn.BuiltInPosition);
            global_builtins.set(BuiltIn.BuiltInPointSize);
            global_builtins.set(BuiltIn.BuiltInClipDistance);
            global_builtins.set(BuiltIn.BuiltInCullDistance);
            // Try to collect all other declared builtins.
            if (!emitted_block)
                emitted_builtins = global_builtins;
            // Can't declare an empty interface block.
            if (emitted_builtins.empty())
                return;
            if (storage === StorageClass.StorageClassOutput) {
                var attr = [];
                if (have_xfb_buffer_stride && have_any_xfb_offset) {
                    if (!options.es) {
                        if (options.version < 440 && options.version >= 140)
                            this.require_extension_internal("GL_ARB_enhanced_layouts");
                        else if (options.version < 140)
                            throw new Error("Component decoration is not supported in targets below GLSL 1.40.");
                        if (!options.es && options.version < 440)
                            this.require_extension_internal("GL_ARB_enhanced_layouts");
                    }
                    else if (options.es)
                        throw new Error("Need GL_ARB_enhanced_layouts for xfb_stride or xfb_buffer.");
                    attr.push("xfb_buffer = ".concat(xfb_buffer, ", xfb_stride = ").concat(xfb_stride));
                }
                if (have_geom_stream) {
                    if (this.get_execution_model() !== ExecutionModel.ExecutionModelGeometry)
                        throw new Error("Geometry streams can only be used in geometry shaders.");
                    if (options.es)
                        throw new Error("Multiple geometry streams not supported in ESSL.");
                    if (options.version < 400)
                        this.require_extension_internal("GL_ARB_transform_feedback3");
                    attr.push("stream = " + geom_stream);
                }
                if (attr.length > 0)
                    this.statement("layout(", attr.join(", "), ") out gl_PerVertex");
                else
                    this.statement("out gl_PerVertex");
            }
            else {
                // If we have passthrough, there is no way PerVertex cannot be passthrough.
                if (this.get_entry_point().geometry_passthrough)
                    this.statement("layout(passthrough) in gl_PerVertex");
                else
                    this.statement("in gl_PerVertex");
            }
            this.begin_scope();
            if (emitted_builtins.get(BuiltIn.BuiltInPosition)) {
                var itr_second = builtin_xfb_offsets[BuiltIn.BuiltInPosition];
                if (itr_second)
                    this.statement("layout(xfb_offset = ", itr_second, ") vec4 gl_Position;");
                else
                    this.statement("vec4 gl_Position;");
            }
            if (emitted_builtins.get(BuiltIn.BuiltInPointSize)) {
                var itr_second = builtin_xfb_offsets.find[BuiltIn.BuiltInPointSize];
                if (itr_second)
                    this.statement("layout(xfb_offset = ", itr_second, ") float gl_PointSize;");
                else
                    this.statement("float gl_PointSize;");
            }
            if (emitted_builtins.get(BuiltIn.BuiltInClipDistance)) {
                var itr_second = builtin_xfb_offsets[BuiltIn.BuiltInClipDistance];
                if (itr_second)
                    this.statement("layout(xfb_offset = ", itr_second, ") float gl_ClipDistance[", clip_distance_size, "];");
                else
                    this.statement("float gl_ClipDistance[", clip_distance_size, "];");
            }
            if (emitted_builtins.get(BuiltIn.BuiltInCullDistance)) {
                var itr_second = builtin_xfb_offsets[BuiltIn.BuiltInCullDistance];
                if (itr_second)
                    this.statement("layout(xfb_offset = ", itr_second, ") float gl_CullDistance[", cull_distance_size, "];");
                else
                    this.statement("float gl_CullDistance[", cull_distance_size, "];");
            }
            if (builtin_array) ;
            else
                this.end_scope_decl();
            this.statement("");
        };
        CompilerGLSL.prototype.should_force_emit_builtin_block = function (storage) {
            // If the builtin block uses XFB, we need to force explicit redeclaration of the builtin block.
            var _this = this;
            if (storage !== StorageClass.StorageClassOutput)
                return false;
            var should_force = false;
            var ir = this.ir;
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                if (should_force)
                    return;
                var type = _this.get(SPIRType, var_.basetype);
                var block = _this.has_decoration(type.self, Decoration.DecorationBlock);
                if (var_.storage === storage && block && _this.is_builtin_variable(var_)) {
                    var member_count = type.member_types.length;
                    for (var i = 0; i < member_count; i++) {
                        if (_this.has_member_decoration(type.self, i, Decoration.DecorationBuiltIn) &&
                            is_block_builtin((_this.get_member_decoration(type.self, i, Decoration.DecorationBuiltIn))) &&
                            _this.has_member_decoration(type.self, i, Decoration.DecorationOffset)) {
                            should_force = true;
                        }
                    }
                }
                else if (var_.storage === storage && !block && _this.is_builtin_variable(var_)) {
                    if (is_block_builtin((_this.get_decoration(type.self, Decoration.DecorationBuiltIn))) &&
                        _this.has_decoration(var_.self, Decoration.DecorationOffset)) {
                        should_force = true;
                    }
                }
            });
            // If we're declaring clip/cull planes with control points we need to force block declaration.
            /*if (this.get_execution_model() === ExecutionModel.ExecutionModelTessellationControl &&
                (clip_distance_count || cull_distance_count))
            {
                should_force = true;
            }*/
            return should_force;
        };
        CompilerGLSL.prototype.emit_push_constant_block_glsl = function (var_) {
            var ir = this.ir;
            // OpenGL has no concept of push constant blocks, implement it as a uniform struct.
            var type = this.get(SPIRType, var_.basetype);
            var flags = maplike_get(Meta, ir.meta, var_.self).decoration.decoration_flags;
            flags.clear(Decoration.DecorationBinding);
            flags.clear(Decoration.DecorationDescriptorSet);
            /*#if 0
            if (flags & ((1ull << DecorationBinding) | (1ull << DecorationDescriptorSet)))
            throw new Error("Push constant blocks cannot be compiled to GLSL with Binding or Set syntax. "
            "Remap to location with reflection API first or disable these decorations.");
            #endif
            */
            // We're emitting the push constant block as a regular struct, so disable the block qualifier temporarily.
            // Otherwise, we will end up emitting layout() qualifiers on naked structs which is not allowed.
            var block_flags = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags;
            var block_flag = block_flags.get(Decoration.DecorationBlock);
            block_flags.clear(Decoration.DecorationBlock);
            this.emit_struct(type);
            if (block_flag)
                block_flags.set(Decoration.DecorationBlock);
            this.emit_uniform(var_);
            this.statement("");
        };
        CompilerGLSL.prototype.emit_interface_block = function (var_) {
            var type = this.get(SPIRType, var_.basetype);
            var _a = this, ir = _a.ir, options = _a.options;
            if (var_.storage === StorageClass.StorageClassInput && type.basetype === SPIRTypeBaseType.Double &&
                !options.es && options.version < 410) {
                this.require_extension_internal("GL_ARB_vertex_attrib_64bit");
            }
            // Either make it plain in/out or in/out blocks depending on what shader is doing ...
            var block = maplike_get(Meta, ir.meta, type.self).decoration.decoration_flags.get(Decoration.DecorationBlock);
            var qual = this.to_storage_qualifiers_glsl(var_);
            if (block) {
                // ESSL earlier than 310 and GLSL earlier than 150 did not support
                // I/O variables which are struct types.
                // To support this, flatten the struct into separate varyings instead.
                if (options.force_flattened_io_blocks || (options.es && options.version < 310) ||
                    (!options.es && options.version < 150)) {
                    // I/O blocks on ES require version 310 with Android Extension Pack extensions, or core version 320.
                    // On desktop, I/O blocks were introduced with geometry shaders in GL 3.2 (GLSL 150).
                    this.emit_flattened_io_block(var_, qual);
                }
                else {
                    if (options.es && options.version < 320) {
                        // Geometry and tessellation extensions imply this extension.
                        if (!this.has_extension("GL_EXT_geometry_shader") && !this.has_extension("GL_EXT_tessellation_shader"))
                            this.require_extension_internal("GL_EXT_shader_io_blocks");
                    }
                    // Workaround to make sure we can emit "patch in/out" correctly.
                    this.fixup_io_block_patch_qualifiers(var_);
                    // Block names should never alias.
                    var block_name = this.to_name(type.self, false);
                    // The namespace for I/O blocks is separate from other variables in GLSL.
                    var block_namespace = type.storage === StorageClass.StorageClassInput ? this.block_input_names : this.block_output_names;
                    // Shaders never use the block by interface name, so we don't
                    // have to track this other than updating name caches.
                    if (block_name.length === 0 || block_namespace.has(block_name))
                        block_name = this.get_fallback_name(type.self);
                    else
                        block_namespace.add(block_name);
                    // If for some reason buffer_name is an illegal name, make a final fallback to a workaround name.
                    // This cannot conflict with anything else, so we're safe now.
                    if (block_name.length === 0)
                        block_name = "_" + this.get(SPIRType, var_.basetype).self + "_" + var_.self;
                    // Instance names cannot alias block names.
                    this.resource_names.add(block_name);
                    var is_patch = this.has_decoration(var_.self, Decoration.DecorationPatch);
                    this.statement(this.layout_for_variable(var_), (is_patch ? "patch " : ""), qual, block_name);
                    this.begin_scope();
                    type.member_name_cache.clear();
                    var i = 0;
                    for (var _i = 0, _b = type.member_types; _i < _b.length; _i++) {
                        var member = _b[_i];
                        this.add_member_name(type, i);
                        this.emit_struct_member(type, member, i);
                        i++;
                    }
                    this.add_resource_name(var_.self);
                    this.end_scope_decl(this.to_name(var_.self) + this.type_to_array_glsl(type));
                    this.statement("");
                }
            }
            else {
                // ESSL earlier than 310 and GLSL earlier than 150 did not support
                // I/O variables which are struct types.
                // To support this, flatten the struct into separate varyings instead.
                if (type.basetype === SPIRTypeBaseType.Struct &&
                    (options.force_flattened_io_blocks || (options.es && options.version < 310) ||
                        (!options.es && options.version < 150))) {
                    this.emit_flattened_io_block(var_, qual);
                }
                else {
                    this.add_resource_name(var_.self);
                    // Tessellation control and evaluation shaders must have either gl_MaxPatchVertices or unsized arrays for input arrays.
                    // Opt for unsized as it's the more "correct" variant to use.
                    /*const control_point_input_array = type.storage === StorageClass.StorageClassInput && type.array.length > 0 &&
                        !this.has_decoration(var_.self, Decoration.DecorationPatch) &&
                        (this.get_entry_point().model === ExecutionModel.ExecutionModelTessellationControl ||
                        this.get_entry_point().model === ExecutionModel.ExecutionModelTessellationEvaluation);*/
                    /*let old_array_size = 0;
                    let old_array_size_literal = true;

                    if (control_point_input_array)
                    {
                        swap(type.array.back(), old_array_size);
                        swap(type.array_size_literal.back(), old_array_size_literal);
                    }*/
                    this.statement(this.layout_for_variable(var_), this.to_qualifiers_glsl(var_.self), this.variable_decl(type, this.to_name(var_.self), var_.self), ";");
                    /*if (control_point_input_array)
                    {
                        swap(type.array.back(), old_array_size);
                        swap(type.array_size_literal.back(), old_array_size_literal);
                    }*/
                }
            }
        };
        CompilerGLSL.prototype.constant_value_macro_name = function (id) {
            return "SPIRV_CROSS_CONSTANT_ID_" + id;
        };
        CompilerGLSL.prototype.get_constant_mapping_to_workgroup_component = function (c) {
            var entry_point = this.get_entry_point();
            var index = -1;
            // Need to redirect specialization constants which are used as WorkGroupSize to the builtin,
            // since the spec constant declarations are never explicitly declared.
            if (entry_point.workgroup_size.constant === 0 && entry_point.flags.get(ExecutionMode.ExecutionModeLocalSizeId)) {
                if (c.self === entry_point.workgroup_size.id_x)
                    index = 0;
                else if (c.self === entry_point.workgroup_size.id_y)
                    index = 1;
                else if (c.self === entry_point.workgroup_size.id_z)
                    index = 2;
            }
            return index;
        };
        CompilerGLSL.prototype.emit_constant = function (constant) {
            var type = this.get(SPIRType, constant.constant_type);
            var name = this.to_name(constant.self);
            // only relevant to Compute Shaders
            /*const wg_x = new SpecializationConstant(),
                wg_y = new SpecializationConstant(),
                wg_z = new SpecializationConstant();

            /*const workgroup_size_id = this.get_work_group_size_specialization_constants(wg_x, wg_y, wg_z);

            // This specialization constant is implicitly declared by emitting layout() in;
            if (constant.self === workgroup_size_id)
                return;

            // These specialization constants are implicitly declared by emitting layout() in;
            // In legacy GLSL, we will still need to emit macros for these, so a layout() in; declaration
            // later can use macro overrides for work group size.
            bool is_workgroup_size_constant = ConstantID(constant.self) === wg_x.id || ConstantID(constant.self) === wg_y.id ||
            ConstantID(constant.self) === wg_z.id;

            if (options.vulkan_semantics && is_workgroup_size_constant)
            {
                // Vulkan GLSL does not need to declare workgroup spec constants explicitly, it is handled in layout().
                return;
            }
            else if (!options.vulkan_semantics && is_workgroup_size_constant &&
                !has_decoration(constant.self, DecorationSpecId))
            {
                // Only bother declaring a workgroup size if it is actually a specialization constant, because we need macros.
                return;
            }*/
            // Only scalars have constant IDs.
            if (this.has_decoration(constant.self, Decoration.DecorationSpecId)) {
                /*if (options.vulkan_semantics)
                {
                    statement("layout(constant_id = ", get_decoration(constant.self, DecorationSpecId), ") const ",
                        variable_decl(type, name), " = ", constant_expression(constant), ";");
                }
                else
                {*/
                var macro_name = constant.specialization_constant_macro_name;
                this.statement("#ifndef ", macro_name);
                this.statement("#define ", macro_name, " ", this.constant_expression(constant));
                this.statement("#endif");
                // For workgroup size constants, only emit the macros.
                // if (!is_workgroup_size_constant)
                this.statement("const ", this.variable_decl(type, name), " = ", macro_name, ";");
                // }
            }
            else {
                this.statement("const ", this.variable_decl(type, name), " = ", this.constant_expression(constant), ";");
            }
        };
        CompilerGLSL.prototype.emit_specialization_constant_op = function (constant) {
            var type = this.get(SPIRType, constant.basetype);
            var name = this.to_name(constant.self);
            this.statement("const ", this.variable_decl(type, name), " = ", this.constant_op_expression(constant), ";");
        };
        CompilerGLSL.prototype.should_dereference = function (id) {
            var type = this.expression_type(id);
            // Non-pointer expressions don't need to be dereferenced.
            if (!type.pointer)
                return false;
            // Handles shouldn't be dereferenced either.
            if (!this.expression_is_lvalue(id))
                return false;
            // If id is a variable but not a phi variable, we should not dereference it.
            var var_ = this.maybe_get(SPIRVariable, id);
            if (var_)
                return var_.phi_variable;
            // If id is an access chain, we should not dereference it.
            var expr = this.maybe_get(SPIRExpression, id);
            if (expr)
                return !expr.access_chain;
            // Otherwise, we should dereference this pointer expression.
            return true;
        };
        CompilerGLSL.prototype.to_trivial_mix_op = function (type, left, right, lerp) {
            var backend = this.backend;
            var cleft = this.maybe_get(SPIRConstant, left);
            var cright = this.maybe_get(SPIRConstant, right);
            var lerptype = this.expression_type(lerp);
            // If our targets aren't constants, we cannot use construction.
            if (!cleft || !cright)
                return undefined;
            // If our targets are spec constants, we cannot use construction.
            if (cleft.specialization || cright.specialization)
                return undefined;
            var value_type = this.get(SPIRType, cleft.constant_type);
            if (lerptype.basetype !== SPIRTypeBaseType.Boolean)
                return undefined;
            if (value_type.basetype === SPIRTypeBaseType.Struct || this.is_array(value_type))
                return undefined;
            if (!backend.use_constructor_splatting && value_type.vecsize !== lerptype.vecsize)
                return undefined;
            // Only valid way in SPIR-V 1.4 to use matrices in select is a scalar select.
            // matrix(scalar) constructor fills in diagnonals, so gets messy very quickly.
            // Just avoid this case.
            if (value_type.columns > 1)
                return undefined;
            // If our bool selects between 0 and 1, we can cast from bool instead, making our trivial constructor.
            var ret = true;
            for (var row = 0; ret && row < value_type.vecsize; row++) {
                switch (type.basetype) {
                    case SPIRTypeBaseType.Short:
                    case SPIRTypeBaseType.UShort:
                        ret = cleft.scalar_u16(0, row) === 0 && cright.scalar_u16(0, row) === 1;
                        break;
                    case SPIRTypeBaseType.Int:
                    case SPIRTypeBaseType.UInt:
                        ret = cleft.scalar(0, row) === 0 && cright.scalar(0, row) === 1;
                        break;
                    case SPIRTypeBaseType.Half:
                        ret = cleft.scalar_f16(0, row) === 0.0 && cright.scalar_f16(0, row) === 1.0;
                        break;
                    case SPIRTypeBaseType.Float:
                        ret = cleft.scalar_f32(0, row) === 0.0 && cright.scalar_f32(0, row) === 1.0;
                        break;
                    case SPIRTypeBaseType.Double:
                        ret = cleft.scalar_f64(0, row) === 0.0 && cright.scalar_f64(0, row) === 1.0;
                        break;
                    case SPIRTypeBaseType.Int64:
                    case SPIRTypeBaseType.UInt64:
                        ret = cleft.scalar_u64(0, row) === BigInt(0) && cright.scalar_u64(0, row) === BigInt(1);
                        break;
                    default:
                        ret = false;
                        break;
                }
            }
            if (ret)
                return this.type_to_glsl_constructor(type);
            return undefined;
        };
        CompilerGLSL.prototype.binary_op_bitcast_helper = function (props, op0, op1, skip_cast_if_equal_type) {
            var type0 = this.expression_type(op0);
            var type1 = this.expression_type(op1);
            // We have to bitcast if our inputs are of different type, or if our types are not equal to expected inputs.
            // For some functions like OpIEqual and INotEqual, we don't care if inputs are of different types than expected
            // since equality test is exactly the same.
            var cast = (type0.basetype !== type1.basetype) || (!skip_cast_if_equal_type && type0.basetype !== props.input_type);
            // Create a fake type so we can bitcast to it.
            // We only deal with regular arithmetic types here like int, uints and so on.
            var expected_type = new SPIRType();
            expected_type.basetype = props.input_type;
            expected_type.vecsize = type0.vecsize;
            expected_type.columns = type0.columns;
            expected_type.width = type0.width;
            if (cast) {
                props.cast_op0 = this.bitcast_glsl(expected_type, op0);
                props.cast_op1 = this.bitcast_glsl(expected_type, op1);
            }
            else {
                // If we don't cast, our actual input type is that of the first (or second) argument.
                props.cast_op0 = this.to_enclosed_unpacked_expression(op0);
                props.cast_op1 = this.to_enclosed_unpacked_expression(op1);
                props.input_type = type0.basetype;
            }
            return expected_type;
        };
        CompilerGLSL.prototype.to_ternary_expression = function (restype, select, true_value, false_value) {
            var _this = this;
            var expr;
            var lerptype = this.expression_type(select);
            if (lerptype.vecsize === 1)
                expr = this.to_enclosed_expression(select) + " ? " + this.to_enclosed_pointer_expression(true_value) + " : " + this.to_enclosed_pointer_expression(false_value);
            else {
                var swiz = function (expression, i) {
                    return _this.to_extract_component_expression(expression, i);
                };
                expr = this.type_to_glsl_constructor(restype);
                expr += "(";
                for (var i = 0; i < restype.vecsize; i++) {
                    expr += swiz(select, i);
                    expr += " ? ";
                    expr += swiz(true_value, i);
                    expr += " : ";
                    expr += swiz(false_value, i);
                    if (i + 1 < restype.vecsize)
                        expr += ", ";
                }
                expr += ")";
            }
            return expr;
        };
        CompilerGLSL.prototype.expression_is_forwarded = function (id) {
            return this.forwarded_temporaries.has(id);
        };
        CompilerGLSL.prototype.expression_suppresses_usage_tracking = function (id) {
            return this.suppressed_usage_tracking.has(id);
        };
        CompilerGLSL.prototype.expression_read_implies_multiple_reads = function (id) {
            var expr = this.maybe_get(SPIRExpression, id);
            if (!expr)
                return false;
            // If we're emitting code at a deeper loop level than when we emitted the expression,
            // we're probably reading the same expression over and over.
            return this.current_loop_level > expr.emitted_loop_level;
        };
        CompilerGLSL.prototype.access_chain_internal_append_index = function (expr, base, type, flags, access_chain_is_arrayed, index) {
            var index_is_literal = (flags & AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT) !== 0;
            var register_expression_read = (flags & AccessChainFlagBits.ACCESS_CHAIN_SKIP_REGISTER_EXPRESSION_READ_BIT) === 0;
            expr += "[";
            if (index_is_literal)
                expr += convert_to_string(index);
            else
                expr += this.to_unpacked_expression(index, register_expression_read);
            expr += "]";
            return expr;
        };
        CompilerGLSL.prototype.access_chain_internal = function (base, indices, count, flags, meta) {
            var _this = this;
            var expr = "";
            var _a = this, backend = _a.backend, options = _a.options, ir = _a.ir;
            var index_is_literal = (flags & AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT) !== 0;
            var msb_is_id = (flags & AccessChainFlagBits.ACCESS_CHAIN_LITERAL_MSB_FORCE_ID) !== 0;
            var chain_only = (flags & AccessChainFlagBits.ACCESS_CHAIN_CHAIN_ONLY_BIT) !== 0;
            var ptr_chain = (flags & AccessChainFlagBits.ACCESS_CHAIN_PTR_CHAIN_BIT) !== 0;
            var register_expression_read = (flags & AccessChainFlagBits.ACCESS_CHAIN_SKIP_REGISTER_EXPRESSION_READ_BIT) === 0;
            var flatten_member_reference = (flags & AccessChainFlagBits.ACCESS_CHAIN_FLATTEN_ALL_MEMBERS_BIT) !== 0;
            if (!chain_only) {
                // We handle transpose explicitly, so don't resolve that here.
                var e = this.maybe_get(SPIRExpression, base);
                var old_transpose = e && e.need_transpose;
                if (e)
                    e.need_transpose = false;
                expr = this.to_enclosed_expression(base, register_expression_read);
                if (e)
                    e.need_transpose = old_transpose;
            }
            // Start traversing type hierarchy at the proper non-pointer types,
            // but keep type_id referencing the original pointer for use below.
            var type_id = this.expression_type_id(base);
            if (!backend.native_pointers) {
                if (ptr_chain)
                    throw new Error("Backend does not support native pointers and does not support OpPtrAccessChain.");
                // Wrapped buffer reference pointer types will need to poke into the internal "value" member before
                // continuing the access chain.
                if (this.should_dereference(base)) {
                    var type_2 = this.get(SPIRType, type_id);
                    expr = this.dereference_expression(type_2, expr);
                }
            }
            var type = this.get_pointee_type(type_id);
            var access_chain_is_arrayed = expr.indexOf("[") >= 0;
            var row_major_matrix_needs_conversion = this.is_non_native_row_major_matrix(base);
            var is_packed = this.has_extended_decoration(base, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked);
            var physical_type = this.get_extended_decoration(base, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID);
            var is_invariant = this.has_decoration(base, Decoration.DecorationInvariant);
            var pending_array_enclose = false;
            var dimension_flatten = false;
            var append_index = function (index, is_literal) {
                var mod_flags = flags;
                if (!is_literal)
                    mod_flags &= ~AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT;
                expr = _this.access_chain_internal_append_index(expr, base, type, mod_flags, access_chain_is_arrayed, index);
            };
            for (var i = 0; i < count; i++) {
                var index = indices[i];
                var is_literal = index_is_literal;
                if (is_literal && msb_is_id && (index >> 31) !== 0) {
                    is_literal = false;
                    index &= 0x7fffffff;
                }
                // Pointer chains
                if (ptr_chain && i === 0) {
                    // If we are flattening multidimensional arrays, only create opening bracket on first
                    // array index.
                    if (options.flatten_multidimensional_arrays) {
                        dimension_flatten = type.array.length >= 1;
                        pending_array_enclose = dimension_flatten;
                        if (pending_array_enclose)
                            expr += "[";
                    }
                    if (options.flatten_multidimensional_arrays && dimension_flatten) {
                        // If we are flattening multidimensional arrays, do manual stride computation.
                        if (is_literal)
                            expr += convert_to_string(index);
                        else
                            expr += this.to_enclosed_expression(index, register_expression_read);
                        for (var j = type.array.length; j; j--) {
                            expr += " * ";
                            expr += this.enclose_expression(this.to_array_size(type, j - 1));
                        }
                        if (type.array.length === 0)
                            pending_array_enclose = false;
                        else
                            expr += " + ";
                        if (!pending_array_enclose)
                            expr += "]";
                    }
                    else {
                        append_index(index, is_literal);
                    }
                    if (type.basetype === SPIRTypeBaseType.ControlPointArray) {
                        type_id = type.parent_type;
                        type = this.get(SPIRType, type_id);
                    }
                    access_chain_is_arrayed = true;
                }
                // Arrays
                else if (type.array.length > 0) {
                    // If we are flattening multidimensional arrays, only create opening bracket on first
                    // array index.
                    if (options.flatten_multidimensional_arrays && !pending_array_enclose) {
                        dimension_flatten = type.array.length > 1;
                        pending_array_enclose = dimension_flatten;
                        if (pending_array_enclose)
                            expr += "[";
                    }
                    console.assert(type.parent_type);
                    var var_ = this.maybe_get(SPIRVariable, base);
                    if (backend.force_gl_in_out_block && i === 0 && var_ && this.is_builtin_variable(var_) &&
                        !this.has_decoration(type.self, Decoration.DecorationBlock)) {
                        // This deals with scenarios for tesc/geom where arrays of gl_Position[] are declared.
                        // Normally, these variables live in blocks when compiled from GLSL,
                        // but HLSL seems to just emit straight arrays here.
                        // We must pretend this access goes through gl_in/gl_out arrays
                        // to be able to access certain builtins as arrays.
                        var builtin = maplike_get(Meta, ir.meta, base).decoration.builtin_type;
                        switch (builtin) {
                            // case BuiltInCullDistance: // These are already arrays, need to figure out rules for these in tess/geom.
                            // case BuiltInClipDistance:
                            case BuiltIn.BuiltInPosition:
                            case BuiltIn.BuiltInPointSize:
                                if (var_.storage === StorageClass.StorageClassInput)
                                    expr = "gl_in[" + this.to_expression(index, register_expression_read);
                                else if (var_.storage === StorageClass.StorageClassOutput)
                                    expr = "gl_out[" + this.to_expression(index, register_expression_read);
                                else
                                    append_index(index, is_literal);
                                break;
                            default:
                                append_index(index, is_literal);
                                break;
                        }
                    }
                    else if (options.flatten_multidimensional_arrays && dimension_flatten) {
                        // If we are flattening multidimensional arrays, do manual stride computation.
                        var parent_type = this.get(SPIRType, type.parent_type);
                        if (is_literal)
                            expr += convert_to_string(index);
                        else
                            expr += this.to_enclosed_expression(index, register_expression_read);
                        for (var j = parent_type.array.length; j; j--) {
                            expr += " * ";
                            expr += this.enclose_expression(this.to_array_size(parent_type, j - 1));
                        }
                        if (parent_type.array.length === 0)
                            pending_array_enclose = false;
                        else
                            expr += " + ";
                        if (!pending_array_enclose)
                            expr += "]";
                    }
                    // Some builtins are arrays in SPIR-V but not in other languages, e.g. gl_SampleMask[] is an array in SPIR-V but not in Metal.
                    // By throwing away the index, we imply the index was 0, which it must be for gl_SampleMask.
                    else if (!this.builtin_translates_to_nonarray((this.get_decoration(base, Decoration.DecorationBuiltIn)))) {
                        append_index(index, is_literal);
                    }
                    type_id = type.parent_type;
                    type = this.get(SPIRType, type_id);
                    access_chain_is_arrayed = true;
                }
                // For structs, the index refers to a constant, which indexes into the members, possibly through a redirection mapping.
                // We also check if this member is a builtin, since we then replace the entire expression with the builtin one.
                else if (type.basetype === SPIRTypeBaseType.Struct) {
                    if (!is_literal)
                        index = this.evaluate_constant_u32(index);
                    if (index < type.member_type_index_redirection.length)
                        index = type.member_type_index_redirection[index];
                    if (index >= type.member_types.length)
                        throw new Error("Member index is out of bounds!");
                    var builtin = this.is_member_builtin(type, index);
                    if (builtin !== undefined && this.access_chain_needs_stage_io_builtin_translation(base)) {
                        if (access_chain_is_arrayed) {
                            expr += ".";
                            expr += this.builtin_to_glsl(builtin, type.storage);
                        }
                        else
                            expr = this.builtin_to_glsl(builtin, type.storage);
                    }
                    else {
                        // If the member has a qualified name, use it as the entire chain
                        var qual_mbr_name = this.get_member_qualified_name(type_id, index);
                        if (qual_mbr_name !== "")
                            expr = qual_mbr_name;
                        else if (flatten_member_reference)
                            expr += "_" + this.to_member_name(type, index);
                        else
                            expr += this.to_member_reference(base, type, index, ptr_chain);
                    }
                    if (this.has_member_decoration(type.self, index, Decoration.DecorationInvariant))
                        is_invariant = true;
                    is_packed = this.member_is_packed_physical_type(type, index);
                    if (this.member_is_remapped_physical_type(type, index))
                        physical_type = this.get_extended_member_decoration(type.self, index, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID);
                    else
                        physical_type = 0;
                    row_major_matrix_needs_conversion = this.member_is_non_native_row_major_matrix(type, index);
                    type = this.get(SPIRType, type.member_types[index]);
                }
                // Matrix -> Vector
                else if (type.columns > 1) {
                    // If we have a row-major matrix here, we need to defer any transpose in case this access chain
                    // is used to store a column. We can resolve it right here and now if we access a scalar directly,
                    // by flipping indexing order of the matrix.
                    expr += "[";
                    if (is_literal)
                        expr += convert_to_string(index);
                    else
                        expr += this.to_unpacked_expression(index, register_expression_read);
                    expr += "]";
                    type_id = type.parent_type;
                    type = this.get(SPIRType, type_id);
                }
                // Vector -> Scalar
                else if (type.vecsize > 1) {
                    var deferred_index = "";
                    if (row_major_matrix_needs_conversion) {
                        // Flip indexing order.
                        var column_index = expr.lastIndexOf("[");
                        if (column_index >= 0) {
                            deferred_index = expr.substring(column_index);
                            expr = expr.substring(0, column_index);
                        }
                    }
                    // Internally, access chain implementation can also be used on composites,
                    // ignore scalar access workarounds in this case.
                    var effective_storage = StorageClass.StorageClassGeneric;
                    var ignore_potential_sliced_writes = false;
                    if ((flags & AccessChainFlagBits.ACCESS_CHAIN_FORCE_COMPOSITE_BIT) === 0) {
                        if (this.expression_type(base).pointer)
                            effective_storage = this.get_expression_effective_storage_class(base);
                        // Special consideration for control points.
                        // Control points can only be written by InvocationID, so there is no need
                        // to consider scalar access chains here.
                        // Cleans up some cases where it's very painful to determine the accurate storage class
                        // since blocks can be partially masked ...
                        /*const var_ = maybe_get_backing_variable(base);
                        if (var_ && var_.storage === StorageClass.StorageClassOutput &&
                            get_execution_model() === ExecutionModelTessellationControl &&
                            !has_decoration(var_.self, DecorationPatch))
                        {
                            ignore_potential_sliced_writes = true;
                        }*/
                    }
                    else
                        ignore_potential_sliced_writes = true;
                    if (!row_major_matrix_needs_conversion && !ignore_potential_sliced_writes) {
                        // On some backends, we might not be able to safely access individual scalars in a vector.
                        // To work around this, we might have to cast the access chain reference to something which can,
                        // like a pointer to scalar, which we can then index into.
                        expr = this.prepare_access_chain_for_scalar_access(expr, this.get(SPIRType, type.parent_type), effective_storage, is_packed);
                    }
                    if (is_literal) {
                        var out_of_bounds = (index >= type.vecsize);
                        if (!is_packed && !row_major_matrix_needs_conversion) {
                            expr += ".";
                            expr += this.index_to_swizzle(out_of_bounds ? 0 : index);
                        }
                        else {
                            // For packed vectors, we can only access them as an array, not by swizzle.
                            expr += "[" + (out_of_bounds ? 0 : index) + "]";
                        }
                    }
                    else if (ir.ids[index].get_type() === Types.TypeConstant && !is_packed && !row_major_matrix_needs_conversion) {
                        var c = this.get(SPIRConstant, index);
                        var out_of_bounds = (c.scalar() >= type.vecsize);
                        if (c.specialization) {
                            // If the index is a spec constant, we cannot turn extract into a swizzle.
                            expr += "[" + (out_of_bounds ? "0" : this.to_expression(index)) + "]";
                        }
                        else {
                            expr += "." + this.index_to_swizzle(out_of_bounds ? 0 : c.scalar());
                        }
                    }
                    else {
                        expr += "[" + this.to_unpacked_expression(index, register_expression_read) + "]";
                    }
                    if (row_major_matrix_needs_conversion && !ignore_potential_sliced_writes) {
                        expr = this.prepare_access_chain_for_scalar_access(expr, this.get(SPIRType, type.parent_type), effective_storage, is_packed);
                    }
                    expr += deferred_index;
                    row_major_matrix_needs_conversion = false;
                    is_packed = false;
                    physical_type = 0;
                    type_id = type.parent_type;
                    type = this.get(SPIRType, type_id);
                }
                else if (!backend.allow_truncated_access_chain)
                    throw new Error("Cannot subdivide a scalar value!");
            }
            if (pending_array_enclose) {
                throw new Error("Flattening of multidimensional arrays were enabled, " +
                    "but the access chain was terminated in the middle of a multidimensional array. " +
                    "This is not supported.");
            }
            if (meta) {
                meta.need_transpose = row_major_matrix_needs_conversion;
                meta.storage_is_packed = is_packed;
                meta.storage_is_invariant = is_invariant;
                meta.storage_physical_type = physical_type;
            }
            return expr;
        };
        CompilerGLSL.prototype.get_expression_effective_storage_class = function (ptr) {
            var var_ = this.maybe_get_backing_variable(ptr);
            // If the expression has been lowered to a temporary, we need to use the Generic storage class.
            // We're looking for the effective storage class of a given expression.
            // An access chain or forwarded OpLoads from such access chains
            // will generally have the storage class of the underlying variable, but if the load was not forwarded
            // we have lost any address space qualifiers.
            var forced_temporary = this.ir.ids[ptr].get_type() === Types.TypeExpression && !this.get(SPIRExpression, ptr).access_chain &&
                (this.forced_temporaries.has(ptr) || !this.forwarded_temporaries.has(ptr));
            if (var_ && !forced_temporary) {
                if (this.variable_decl_is_remapped_storage(var_, StorageClass.StorageClassWorkgroup))
                    return StorageClass.StorageClassWorkgroup;
                if (this.variable_decl_is_remapped_storage(var_, StorageClass.StorageClassStorageBuffer))
                    return StorageClass.StorageClassStorageBuffer;
                // Normalize SSBOs to StorageBuffer here.
                if (var_.storage === StorageClass.StorageClassUniform && this.has_decoration(this.get(SPIRType, var_.basetype).self, Decoration.DecorationBufferBlock))
                    return StorageClass.StorageClassStorageBuffer;
                else
                    return var_.storage;
            }
            else
                return this.expression_type(ptr).storage;
        };
        CompilerGLSL.prototype.access_chain_needs_stage_io_builtin_translation = function (_) {
            return true;
        };
        CompilerGLSL.prototype.prepare_access_chain_for_scalar_access = function (expr, type, storage, is_packed) {
            return expr;
        };
        CompilerGLSL.prototype.index_to_swizzle = function (index) {
            switch (index) {
                case 0:
                    return "x";
                case 1:
                    return "y";
                case 2:
                    return "z";
                case 3:
                    return "w";
                default:
                    return "x"; // Don't crash, but engage the "undefined behavior" described for out-of-bounds logical addressing in spec.
            }
        };
        CompilerGLSL.prototype.remap_swizzle = function (out_type, input_components, expr) {
            if (out_type.vecsize === input_components)
                return expr;
            else if (input_components === 1 && !this.backend.can_swizzle_scalar)
                return this.type_to_glsl(out_type) + "(" + expr + ")";
            else {
                // FIXME: This will not work with packed expressions.
                var e = this.enclose_expression(expr) + ".";
                // Just clamp the swizzle index if we have more outputs than inputs.
                for (var c = 0; c < out_type.vecsize; c++)
                    e += this.index_to_swizzle(Math.min(c, input_components - 1));
                if (this.backend.swizzle_is_function && out_type.vecsize > 1)
                    e += "()";
                e = this.remove_duplicate_swizzle(e);
                return e;
            }
        };
        CompilerGLSL.prototype.to_expression = function (id, register_expression_read) {
            if (register_expression_read === void 0) { register_expression_read = true; }
            if (this.invalid_expressions.hasOwnProperty(id))
                this.handle_invalid_expression(id);
            var ir = this.ir;
            if (ir.ids[id].get_type() === Types.TypeExpression) {
                // We might have a more complex chain of dependencies.
                // A possible scenario is that we
                //
                // %1 = OpLoad
                // %2 = OpDoSomething %1 %1. here %2 will have a dependency on %1.
                // %3 = OpDoSomethingAgain %2 %2. Here %3 will lose the link to %1 since we don't propagate the dependencies like that.
                // OpStore %1 %foo // Here we can invalidate %1, and hence all expressions which depend on %1. Only %2 will know since it's part of invalid_expressions.
                // %4 = OpDoSomethingAnotherTime %3 %3 // If we forward all expressions we will see %1 expression after store, not before.
                //
                // However, we can propagate up a list of depended expressions when we used %2, so we can check if %2 is invalid when reading %3 after the store,
                // and see that we should not forward reads of the original variable.
                var expr = this.get(SPIRExpression, id);
                for (var _i = 0, _a = expr.expression_dependencies; _i < _a.length; _i++) {
                    var dep = _a[_i];
                    if (this.invalid_expressions.hasOwnProperty(dep))
                        this.handle_invalid_expression(dep);
                }
            }
            if (register_expression_read)
                this.track_expression_read(id);
            switch (ir.ids[id].get_type()) {
                case Types.TypeExpression: {
                    var e = this.get(SPIRExpression, id);
                    if (e.base_expression)
                        return this.to_enclosed_expression(e.base_expression) + e.expression;
                    else if (e.need_transpose) {
                        // This should not be reached for access chains, since we always deal explicitly with transpose state
                        // when consuming an access chain expression.
                        var physical_type_id = this.get_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID);
                        var is_packed = this.has_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked);
                        return this.convert_row_major_matrix(e.expression, this.get(SPIRType, e.expression_type), physical_type_id, is_packed);
                    }
                    else if (this.flattened_structs.hasOwnProperty(id)) {
                        return this.load_flattened_struct(e.expression, this.get(SPIRType, e.expression_type));
                    }
                    else {
                        if (this.is_forcing_recompilation()) {
                            // During first compilation phase, certain expression patterns can trigger exponential growth of memory.
                            // Avoid this by returning dummy expressions during this phase.
                            // Do not use empty expressions here, because those are sentinels for other cases.
                            return "_";
                        }
                        else
                            return e.expression;
                    }
                }
                case Types.TypeConstant: {
                    var c = this.get(SPIRConstant, id);
                    var type = this.get(SPIRType, c.constant_type);
                    // WorkGroupSize may be a constant.
                    if (this.has_decoration(c.self, Decoration.DecorationBuiltIn))
                        return this.builtin_to_glsl((this.get_decoration(c.self, Decoration.DecorationBuiltIn)), StorageClass.StorageClassGeneric);
                    else if (c.specialization) {
                        if (this.backend.workgroup_size_is_hidden) {
                            var wg_index = this.get_constant_mapping_to_workgroup_component(c);
                            if (wg_index >= 0) {
                                var wg_size = this.builtin_to_glsl(BuiltIn.BuiltInWorkgroupSize, StorageClass.StorageClassInput) + this.vector_swizzle(1, wg_index);
                                if (type.basetype !== SPIRTypeBaseType.UInt)
                                    wg_size = this.bitcast_expression(type, SPIRTypeBaseType.UInt, wg_size);
                                return wg_size;
                            }
                        }
                        return this.to_name(id);
                    }
                    else if (c.is_used_as_lut)
                        return this.to_name(id);
                    else if (type.basetype === SPIRTypeBaseType.Struct && !this.backend.can_declare_struct_inline)
                        return this.to_name(id);
                    else if (type.array.length > 0 && !this.backend.can_declare_arrays_inline)
                        return this.to_name(id);
                    else
                        return this.constant_expression(c);
                }
                case Types.TypeConstantOp:
                    return this.to_name(id);
                case Types.TypeVariable: {
                    var var_ = this.get(SPIRVariable, id);
                    // If we try to use a loop variable before the loop header, we have to redirect it to the static expression,
                    // the variable has not been declared yet.
                    if (var_.statically_assigned || (var_.loop_variable && !var_.loop_variable_enable))
                        return this.to_expression(var_.static_expression);
                    else if (var_.deferred_declaration) {
                        var_.deferred_declaration = false;
                        return this.variable_decl(var_);
                    }
                    else if (this.flattened_structs.hasOwnProperty(id)) {
                        return this.load_flattened_struct(this.to_name(id), this.get(SPIRType, var_.basetype));
                    }
                    else {
                        var dec = maplike_get(Meta, ir.meta, var_.self).decoration;
                        if (dec.builtin)
                            return this.builtin_to_glsl(dec.builtin_type, var_.storage);
                        else
                            return this.to_name(id);
                    }
                }
                case Types.TypeCombinedImageSampler:
                    // This type should never be taken the expression of directly.
                    // The intention is that texture sampling functions will extract the image and samplers
                    // separately and take their expressions as needed.
                    // GLSL does not use this type because OpSampledImage immediately creates a combined image sampler
                    // expression ala sampler2D(texture, sampler).
                    throw new Error("Combined image samplers have no default expression representation.");
                case Types.TypeAccessChain:
                    // We cannot express this type. They only have meaning in other OpAccessChains, OpStore or OpLoad.
                    throw new Error("Access chains have no default expression representation.");
                default:
                    return this.to_name(id);
            }
        };
        // Just like to_expression except that we enclose the expression inside parentheses if needed.
        CompilerGLSL.prototype.to_enclosed_expression = function (id, register_expression_read) {
            if (register_expression_read === void 0) { register_expression_read = true; }
            return this.enclose_expression(this.to_expression(id, register_expression_read));
        };
        CompilerGLSL.prototype.to_unpacked_expression = function (id, register_expression_read) {
            if (register_expression_read === void 0) { register_expression_read = true; }
            // If we need to transpose, it will also take care of unpacking rules.
            var e = this.maybe_get(SPIRExpression, id);
            var need_transpose = e && e.need_transpose;
            var is_remapped = this.has_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID);
            var is_packed = this.has_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked);
            if (!need_transpose && (is_remapped || is_packed)) {
                return this.unpack_expression_type(this.to_expression(id, register_expression_read), this.get_pointee_type(this.expression_type_id(id)), this.get_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypeID), this.has_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked), false);
            }
            else
                return this.to_expression(id, register_expression_read);
        };
        CompilerGLSL.prototype.to_enclosed_unpacked_expression = function (id, register_expression_read) {
            if (register_expression_read === void 0) { register_expression_read = true; }
            return this.enclose_expression(this.to_unpacked_expression(id, register_expression_read));
        };
        CompilerGLSL.prototype.to_enclosed_pointer_expression = function (id, register_expression_read) {
            if (register_expression_read === void 0) { register_expression_read = true; }
            var type = this.expression_type(id);
            if (type.pointer && this.expression_is_lvalue(id) && !this.should_dereference(id))
                return this.address_of_expression(this.to_enclosed_expression(id, register_expression_read));
            else
                return this.to_enclosed_unpacked_expression(id, register_expression_read);
        };
        CompilerGLSL.prototype.to_extract_component_expression = function (id, index) {
            var expr = this.to_enclosed_expression(id);
            if (this.has_extended_decoration(id, ExtendedDecorations.SPIRVCrossDecorationPhysicalTypePacked))
                return expr + "[" + index + "]";
            else
                return expr + "." + this.index_to_swizzle(index);
        };
        CompilerGLSL.prototype.enclose_expression = function (expr) {
            var need_parens = false;
            var exprLength = expr.length;
            // If the expression starts with a unary we need to enclose to deal with cases where we have back-to-back
            // unary expressions.
            if (exprLength > 0) {
                var c = expr.charAt(0);
                if (c === "-" || c === "+" || c === "!" || c === "~" || c === "&" || c === "*")
                    need_parens = true;
            }
            if (!need_parens) {
                var paren_count = 0;
                for (var i = 0; i < exprLength; ++i) {
                    var c = expr.charAt(i);
                    if (c === "(" || c === "[")
                        paren_count++;
                    else if (c === ")" || c === "]") {
                        console.assert(paren_count);
                        paren_count--;
                    }
                    else if (c === " " && paren_count === 0) {
                        need_parens = true;
                        break;
                    }
                }
                console.assert(paren_count === 0);
            }
            // If this expression contains any spaces which are not enclosed by parentheses,
            // we need to enclose it so we can treat the whole string as an expression.
            // This happens when two expressions have been part of a binary op earlier.
            if (need_parens)
                return "(" + expr + ")";
            else
                return expr;
        };
        CompilerGLSL.prototype.dereference_expression = function (expr_type, expr) {
            // If this expression starts with an address-of operator ('&'), then
            // just return the part after the operator.
            // TODO: Strip parens if unnecessary?
            if (expr.charAt(0) === "&")
                return expr.substring(1);
            else if (this.backend.native_pointers)
                return "*" + expr;
            else if (expr_type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT && expr_type.basetype !== SPIRTypeBaseType.Struct &&
                expr_type.pointer_depth === 1) {
                return this.enclose_expression(expr) + ".value";
            }
            else
                return expr;
        };
        CompilerGLSL.prototype.address_of_expression = function (expr) {
            if (expr.length > 3 && expr.charAt(0) === "(" && expr.charAt(1) === "*" && expr.charAt(expr.length - 1) === ")") {
                // If we have an expression which looks like (*foo), taking the address of it is the same as stripping
                // the first two and last characters. We might have to enclose the expression.
                // This doesn't work for cases like (*foo + 10),
                // but this is an r-value expression which we cannot take the address of anyways.
                return this.enclose_expression(expr.substring(2, expr.length - 1));
            }
            else if (expr.charAt(0) === "*") {
                // If this expression starts with a dereference operator ('*'), then
                // just return the part after the operator.
                return expr.substr(1);
            }
            else
                return "&" + this.enclose_expression(expr);
        };
        // Sometimes we proactively enclosed an expression where it turns out we might have not needed it after all.
        CompilerGLSL.prototype.strip_enclosed_expression = function (expr) {
            var exprLength = expr.length;
            var lastChar = expr.charAt(exprLength - 1);
            if (exprLength < 2 || expr.charAt(0) !== "(" || lastChar !== ")")
                return expr;
            // Have to make sure that our first and last parens actually enclose everything inside it.
            var paren_count = 0;
            for (var i = 0; i < exprLength; ++i) {
                var c = expr.charAt(i);
                if (c === "(")
                    paren_count++;
                else if (c === ")") {
                    paren_count--;
                    // If we hit 0 and this is not the final char, our first and final parens actually don't
                    // enclose the expression, and we cannot strip, e.g.: (a + b) * (c + d).
                    if (paren_count === 0 && c !== lastChar)
                        return expr;
                }
            }
            return expr.substring(1, exprLength - 1);
        };
        CompilerGLSL.prototype.to_member_name = function (type, index) {
            if (type.type_alias !== (0) &&
                !this.has_extended_decoration(type.type_alias, ExtendedDecorations.SPIRVCrossDecorationBufferBlockRepacked)) {
                return this.to_member_name(this.get(SPIRType, type.type_alias), index);
            }
            var memb = maplike_get(Meta, this.ir.meta, type.self).members;
            if (index < memb.length && memb[index].alias !== "")
                return memb[index].alias;
            else
                return "_m" + index;
        };
        CompilerGLSL.prototype.to_member_reference = function (_, type, index, __) {
            return "." + this.to_member_name(type, index);
        };
        CompilerGLSL.prototype.type_to_glsl_constructor = function (type) {
            var options = this.options;
            var backend = this.backend;
            if (backend.use_array_constructor && type.array.length > 1) {
                if (options.flatten_multidimensional_arrays)
                    throw new Error("Cannot flatten constructors of multidimensional array constructors, e.g. float[][]().");
                else if (!options.es && options.version < 430)
                    this.require_extension_internal("GL_ARB_arrays_of_arrays");
                else if (options.es && options.version < 310)
                    throw new Error("Arrays of arrays not supported before ESSL version 310.");
            }
            var e = this.type_to_glsl(type);
            if (backend.use_array_constructor) {
                for (var i = 0; i < type.array.length; i++)
                    e += "[]";
            }
            return e;
        };
        CompilerGLSL.prototype.to_qualifiers_glsl = function (id) {
            var ir = this.ir;
            var backend = this.backend;
            var flags = maplike_get(Meta, ir.meta, id).decoration.decoration_flags;
            var res = "";
            var var_ = this.maybe_get(SPIRVariable, id);
            if (var_ && var_.storage === StorageClass.StorageClassWorkgroup && !backend.shared_is_implied)
                res += "shared ";
            res += this.to_interpolation_qualifiers(flags);
            if (var_)
                res += this.to_storage_qualifiers_glsl(var_);
            var type = this.expression_type(id);
            if (type.image.dim !== Dim.DimSubpassData && type.image.sampled === 2) {
                if (flags.get(Decoration.DecorationCoherent))
                    res += "coherent ";
                if (flags.get(Decoration.DecorationRestrict))
                    res += "restrict ";
                if (flags.get(Decoration.DecorationNonWritable))
                    res += "readonly ";
                var formatted_load = type.image.format === ImageFormat.ImageFormatUnknown;
                if (flags.get(Decoration.DecorationNonReadable)) {
                    res += "writeonly ";
                    formatted_load = false;
                }
                if (formatted_load) {
                    if (!this.options.es)
                        this.require_extension_internal("GL_EXT_shader_image_load_formatted");
                    else
                        throw new Error("Cannot use GL_EXT_shader_image_load_formatted in ESSL.");
                }
            }
            res += this.to_precision_qualifiers_glsl(id);
            return res;
        };
        CompilerGLSL.prototype.fixup_io_block_patch_qualifiers = function (var_) {
            // Works around weird behavior in glslangValidator where
            // a patch out block is translated to just block members getting the decoration.
            // To make glslang not complain when we compile again, we have to transform this back to a case where
            // the variable itself has Patch decoration, and not members.
            var type = this.get(SPIRType, var_.basetype);
            if (this.has_decoration(type.self, Decoration.DecorationBlock)) {
                var member_count = type.member_types.length;
                for (var i = 0; i < member_count; i++) {
                    if (this.has_member_decoration(type.self, i, Decoration.DecorationPatch)) {
                        this.set_decoration(var_.self, Decoration.DecorationPatch);
                        break;
                    }
                }
                if (this.has_decoration(var_.self, Decoration.DecorationPatch))
                    for (var i = 0; i < member_count; i++)
                        this.unset_member_decoration(type.self, i, Decoration.DecorationPatch);
            }
        };
        CompilerGLSL.prototype.emit_output_variable_initializer = function (var_) {
            var _this = this;
            var ir = this.ir;
            // If a StorageClassOutput variable has an initializer, we need to initialize it in main().
            var entry_func = this.get(SPIRFunction, ir.default_entry_point);
            var type = this.get(SPIRType, var_.basetype);
            var is_patch = this.has_decoration(var_.self, Decoration.DecorationPatch);
            var is_block = this.has_decoration(type.self, Decoration.DecorationBlock);
            var is_control_point = this.get_execution_model() === ExecutionModel.ExecutionModelTessellationControl && !is_patch;
            if (is_block) {
                var member_count = type.member_types.length;
                var type_is_array_1 = type.array.length === 1;
                var array_size = 1;
                if (type_is_array_1)
                    array_size = this.to_array_size_literal(type);
                var iteration_count = is_control_point ? 1 : array_size;
                var _loop_1 = function (i) {
                    // These outputs might not have been properly declared, so don't initialize them in that case.
                    if (this_1.has_member_decoration(type.self, i, Decoration.DecorationBuiltIn)) {
                        if (this_1.get_member_decoration(type.self, i, Decoration.DecorationBuiltIn) === BuiltIn.BuiltInCullDistance &&
                            !this_1.cull_distance_count)
                            return "continue";
                        if (this_1.get_member_decoration(type.self, i, Decoration.DecorationBuiltIn) === BuiltIn.BuiltInClipDistance &&
                            !this_1.clip_distance_count)
                            return "continue";
                    }
                    // We need to build a per-member array first, essentially transposing from AoS to SoA.
                    // This code path hits when we have an array of blocks.
                    var lut_name;
                    if (type_is_array_1) {
                        lut_name = "_".concat(var_.self, "_").concat(i, "_init");
                        var member_type_id = this_1.get(SPIRType, var_.basetype).member_types[i];
                        var member_type = this_1.get(SPIRType, member_type_id);
                        var array_type = member_type;
                        array_type.parent_type = member_type_id;
                        array_type.array.push(array_size);
                        array_type.array_size_literal.push(true);
                        var exprs = [];
                        // exprs.reserve(array_size);
                        var c = this_1.get(SPIRConstant, var_.initializer);
                        for (var j = 0; j < array_size; j++)
                            exprs.push(this_1.to_expression(this_1.get(SPIRConstant, c.subconstants[j]).subconstants[i]));
                        this_1.statement("const ", this_1.type_to_glsl(array_type), " ", lut_name, this_1.type_to_array_glsl(array_type), " = ", this_1.type_to_glsl_constructor(array_type), "(", exprs.join(", "), ");");
                    }
                    var _loop_2 = function (j) {
                        entry_func.fixup_hooks_in.push(function () {
                            var meta = new AccessChainMeta();
                            var c = _this.get(SPIRConstant, var_.initializer);
                            var invocation_id = 0;
                            var member_index_id = 0;
                            if (is_control_point) {
                                var ids = ir.increase_bound_by(3);
                                var uint_type = new SPIRType();
                                uint_type.basetype = SPIRTypeBaseType.UInt;
                                uint_type.width = 32;
                                _this.set(SPIRType, ids, uint_type);
                                _this.set(SPIRExpression, ids + 1, _this.builtin_to_glsl(BuiltIn.BuiltInInvocationId, StorageClass.StorageClassInput), ids, true);
                                _this.set(SPIRConstant, ids + 2, ids, i, false);
                                invocation_id = ids + 1;
                                member_index_id = ids + 2;
                            }
                            if (is_patch) {
                                _this.statement("if (gl_InvocationID === 0)");
                                _this.begin_scope();
                            }
                            if (type_is_array_1 && !is_control_point) {
                                var indices = [j, i];
                                var chain = _this.access_chain_internal(var_.self, indices, 2, AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT, meta);
                                _this.statement(chain, " = ", lut_name, "[", j, "];");
                            }
                            else if (is_control_point) {
                                var indices = [invocation_id, member_index_id];
                                var chain = _this.access_chain_internal(var_.self, indices, 2, 0, meta);
                                _this.statement(chain, " = ", lut_name, "[", _this.builtin_to_glsl(BuiltIn.BuiltInInvocationId, StorageClass.StorageClassInput), "];");
                            }
                            else {
                                var chain = _this.access_chain_internal(var_.self, [i], 1, AccessChainFlagBits.ACCESS_CHAIN_INDEX_IS_LITERAL_BIT, meta);
                                _this.statement(chain, " = ", _this.to_expression(c.subconstants[i]), ";");
                            }
                            if (is_patch)
                                _this.end_scope();
                        });
                    };
                    for (var j = 0; j < iteration_count; j++) {
                        _loop_2(j);
                    }
                };
                var this_1 = this;
                // If the initializer is a block, we must initialize each block member one at a time.
                for (var i = 0; i < member_count; i++) {
                    _loop_1(i);
                }
            }
            else if (is_control_point) {
                var lut_name_1 = "_".concat(var_.self, "_init");
                this.statement("const ", this.type_to_glsl(type), " ", lut_name_1, this.type_to_array_glsl(type), " = ", this.to_expression(var_.initializer), ";");
                entry_func.fixup_hooks_in.push(function () {
                    _this.statement(_this.to_expression(var_.self), "[gl_InvocationID] = ", lut_name_1, "[gl_InvocationID];");
                });
            }
            else if (this.has_decoration(var_.self, Decoration.DecorationBuiltIn) &&
                this.get_decoration(var_.self, Decoration.DecorationBuiltIn) === BuiltIn.BuiltInSampleMask) {
                // We cannot copy the array since gl_SampleMask is unsized in GLSL. Unroll time! <_<
                entry_func.fixup_hooks_in.push(function () {
                    var c = _this.get(SPIRConstant, var_.initializer);
                    var num_constants = c.subconstants.length;
                    for (var i = 0; i < num_constants; i++) {
                        // Don't use to_expression on constant since it might be uint, just fish out the raw int.
                        _this.statement(_this.to_expression(var_.self), "[", i, "] = ", convert_to_string(_this.get(SPIRConstant, c.subconstants[i]).scalar_i32()), ";");
                    }
                });
            }
            else {
                var lut_name_2 = "".concat(var_.self, "_init");
                this.statement("const ", this.type_to_glsl(type), " ", lut_name_2, this.type_to_array_glsl(type), " = ", this.to_expression(var_.initializer), ";");
                entry_func.fixup_hooks_in.push(function () {
                    if (is_patch) {
                        _this.statement("if (gl_InvocationID === 0)");
                        _this.begin_scope();
                    }
                    _this.statement(_this.to_expression(var_.self), " = ", lut_name_2, ";");
                    if (is_patch)
                        _this.end_scope();
                });
            }
        };
        CompilerGLSL.prototype.to_precision_qualifiers_glsl = function (id) {
            var type = this.expression_type(id);
            var use_precision_qualifiers = this.backend.allow_precision_qualifiers;
            if (use_precision_qualifiers && (type.basetype === SPIRTypeBaseType.Image || type.basetype === SPIRTypeBaseType.SampledImage)) {
                // Force mediump for the sampler type. We cannot declare 16-bit or smaller image types.
                var result_type = this.get(SPIRType, type.image.type);
                if (result_type.width < 32)
                    return "mediump ";
            }
            return this.flags_to_qualifiers_glsl(type, maplike_get(Meta, this.ir.meta, id).decoration.decoration_flags);
        };
        CompilerGLSL.prototype.to_storage_qualifiers_glsl = function (var_) {
            var execution = this.get_entry_point();
            if (this.subpass_input_is_framebuffer_fetch(var_.self))
                return "";
            if (var_.storage === StorageClass.StorageClassInput || var_.storage === StorageClass.StorageClassOutput) {
                if (this.is_legacy() && execution.model === ExecutionModel.ExecutionModelVertex)
                    return var_.storage === StorageClass.StorageClassInput ? "attribute " : "varying ";
                else if (this.is_legacy() && execution.model === ExecutionModel.ExecutionModelFragment)
                    return "varying "; // Fragment outputs are renamed so they never hit this case.
                else if (execution.model === ExecutionModel.ExecutionModelFragment && var_.storage === StorageClass.StorageClassOutput) {
                    var loc = this.get_decoration(var_.self, Decoration.DecorationLocation);
                    var is_inout = this.location_is_framebuffer_fetch(loc);
                    if (is_inout)
                        return "inout ";
                    else
                        return "out ";
                }
                else
                    return var_.storage === StorageClass.StorageClassInput ? "in " : "out ";
            }
            else if (var_.storage === StorageClass.StorageClassUniformConstant || var_.storage === StorageClass.StorageClassUniform ||
                var_.storage === StorageClass.StorageClassPushConstant) {
                return "uniform ";
            }
            else if (var_.storage === StorageClass.StorageClassRayPayloadKHR) {
                throw new Error("Raytracing not supported");
                // return ray_tracing_is_khr ? "rayPayloadEXT " : "rayPayloadNV ";
            }
            else if (var_.storage === StorageClass.StorageClassIncomingRayPayloadKHR) {
                throw new Error("Raytracing not supported");
                // return ray_tracing_is_khr ? "rayPayloadInEXT " : "rayPayloadInNV ";
            }
            else if (var_.storage === StorageClass.StorageClassHitAttributeKHR) {
                throw new Error("Raytracing not supported");
                // return ray_tracing_is_khr ? "hitAttributeEXT " : "hitAttributeNV ";
            }
            else if (var_.storage === StorageClass.StorageClassCallableDataKHR) {
                throw new Error("Raytracing not supported");
                // return ray_tracing_is_khr ? "callableDataEXT " : "callableDataNV ";
            }
            else if (var_.storage === StorageClass.StorageClassIncomingCallableDataKHR) {
                throw new Error("Raytracing not supported");
                // return ray_tracing_is_khr ? "callableDataInEXT " : "callableDataInNV ";
            }
            return "";
        };
        CompilerGLSL.prototype.flags_to_qualifiers_glsl = function (type, flags) {
            // GL_EXT_buffer_reference variables can be marked as restrict.
            if (flags.get(Decoration.DecorationRestrictPointerEXT))
                return "restrict ";
            var backend = this.backend;
            var options = this.options;
            var qual = "";
            if (type_is_floating_point(type) && flags.get(Decoration.DecorationNoContraction) && backend.support_precise_qualifier)
                qual = "precise ";
            // Structs do not have precision qualifiers, neither do doubles (desktop only anyways, so no mediump/highp).
            var type_supports_precision = type.basetype === SPIRTypeBaseType.Float || type.basetype === SPIRTypeBaseType.Int || type.basetype === SPIRTypeBaseType.UInt ||
                type.basetype === SPIRTypeBaseType.Image || type.basetype === SPIRTypeBaseType.SampledImage ||
                type.basetype === SPIRTypeBaseType.Sampler;
            if (!type_supports_precision)
                return qual;
            if (options.es) {
                var execution = this.get_entry_point();
                if (flags.get(Decoration.DecorationRelaxedPrecision)) {
                    var implied_fmediump = type.basetype === SPIRTypeBaseType.Float &&
                        options.fragment.default_float_precision === GLSLPrecision.Mediump &&
                        execution.model === ExecutionModel.ExecutionModelFragment;
                    var implied_imediump = (type.basetype === SPIRTypeBaseType.Int || type.basetype === SPIRTypeBaseType.UInt) &&
                        options.fragment.default_int_precision === GLSLPrecision.Mediump &&
                        execution.model === ExecutionModel.ExecutionModelFragment;
                    qual += (implied_fmediump || implied_imediump) ? "" : "mediump ";
                }
                else {
                    var implied_fhighp = type.basetype === SPIRTypeBaseType.Float && ((options.fragment.default_float_precision === GLSLPrecision.Highp &&
                        execution.model === ExecutionModel.ExecutionModelFragment) ||
                        (execution.model !== ExecutionModel.ExecutionModelFragment));
                    var implied_ihighp = (type.basetype === SPIRTypeBaseType.Int || type.basetype === SPIRTypeBaseType.UInt) &&
                        ((options.fragment.default_int_precision === GLSLPrecision.Highp &&
                            execution.model === ExecutionModel.ExecutionModelFragment) ||
                            (execution.model !== ExecutionModel.ExecutionModelFragment));
                    qual += (implied_fhighp || implied_ihighp) ? "" : "highp ";
                }
            }
            else if (backend.allow_precision_qualifiers) {
                // Vulkan GLSL supports precision qualifiers, even in desktop profiles, which is convenient.
                // The default is highp however, so only emit mediump in the rare case that a shader has these.
                if (flags.get(Decoration.DecorationRelaxedPrecision))
                    qual += "mediump ";
            }
            return qual;
        };
        CompilerGLSL.prototype.format_to_glsl = function (format) {
            if (this.options.es && this.is_desktop_only_format(format))
                throw new Error("Attempting to use image format not supported in ES profile.");
            switch (format) {
                case ImageFormat.ImageFormatRgba32f:
                    return "rgba32f";
                case ImageFormat.ImageFormatRgba16f:
                    return "rgba16f";
                case ImageFormat.ImageFormatR32f:
                    return "r32f";
                case ImageFormat.ImageFormatRgba8:
                    return "rgba8";
                case ImageFormat.ImageFormatRgba8Snorm:
                    return "rgba8_snorm";
                case ImageFormat.ImageFormatRg32f:
                    return "rg32f";
                case ImageFormat.ImageFormatRg16f:
                    return "rg16f";
                case ImageFormat.ImageFormatRgba32i:
                    return "rgba32i";
                case ImageFormat.ImageFormatRgba16i:
                    return "rgba16i";
                case ImageFormat.ImageFormatR32i:
                    return "r32i";
                case ImageFormat.ImageFormatRgba8i:
                    return "rgba8i";
                case ImageFormat.ImageFormatRg32i:
                    return "rg32i";
                case ImageFormat.ImageFormatRg16i:
                    return "rg16i";
                case ImageFormat.ImageFormatRgba32ui:
                    return "rgba32ui";
                case ImageFormat.ImageFormatRgba16ui:
                    return "rgba16ui";
                case ImageFormat.ImageFormatR32ui:
                    return "r32ui";
                case ImageFormat.ImageFormatRgba8ui:
                    return "rgba8ui";
                case ImageFormat.ImageFormatRg32ui:
                    return "rg32ui";
                case ImageFormat.ImageFormatRg16ui:
                    return "rg16ui";
                case ImageFormat.ImageFormatR11fG11fB10f:
                    return "r11f_g11f_b10f";
                case ImageFormat.ImageFormatR16f:
                    return "r16f";
                case ImageFormat.ImageFormatRgb10A2:
                    return "rgb10_a2";
                case ImageFormat.ImageFormatR8:
                    return "r8";
                case ImageFormat.ImageFormatRg8:
                    return "rg8";
                case ImageFormat.ImageFormatR16:
                    return "r16";
                case ImageFormat.ImageFormatRg16:
                    return "rg16";
                case ImageFormat.ImageFormatRgba16:
                    return "rgba16";
                case ImageFormat.ImageFormatR16Snorm:
                    return "r16_snorm";
                case ImageFormat.ImageFormatRg16Snorm:
                    return "rg16_snorm";
                case ImageFormat.ImageFormatRgba16Snorm:
                    return "rgba16_snorm";
                case ImageFormat.ImageFormatR8Snorm:
                    return "r8_snorm";
                case ImageFormat.ImageFormatRg8Snorm:
                    return "rg8_snorm";
                case ImageFormat.ImageFormatR8ui:
                    return "r8ui";
                case ImageFormat.ImageFormatRg8ui:
                    return "rg8ui";
                case ImageFormat.ImageFormatR16ui:
                    return "r16ui";
                case ImageFormat.ImageFormatRgb10a2ui:
                    return "rgb10_a2ui";
                case ImageFormat.ImageFormatR8i:
                    return "r8i";
                case ImageFormat.ImageFormatRg8i:
                    return "rg8i";
                case ImageFormat.ImageFormatR16i:
                    return "r16i";
                default:
                    // case ImageFormat.ImageFormatUnknown:
                    return null;
            }
        };
        CompilerGLSL.prototype.layout_for_member = function (type, index) {
            if (this.is_legacy())
                return "";
            var is_block = this.has_decoration(type.self, Decoration.DecorationBlock) || this.has_decoration(type.self, Decoration.DecorationBufferBlock);
            if (!is_block)
                return "";
            var _a = this, ir = _a.ir, options = _a.options;
            var memb = maplike_get(Meta, ir.meta, type.self).members;
            if (index >= memb.length)
                return "";
            var dec = memb[index];
            var attr = [];
            if (this.has_member_decoration(type.self, index, Decoration.DecorationPassthroughNV))
                attr.push("passthrough");
            // We can only apply layouts on members in block interfaces.
            // This is a bit problematic because in SPIR-V decorations are applied on the struct types directly.
            // This is not supported on GLSL, so we have to make the assumption that if a struct within our buffer block struct
            // has a decoration, it was originally caused by a top-level layout() qualifier in GLSL.
            //
            // We would like to go from (SPIR-V style):
            //
            // struct Foo { layout(row_major) mat4 matrix; };
            // buffer UBO { Foo foo; };
            //
            // to
            //
            // struct Foo { mat4 matrix; }; // GLSL doesn't support any layout shenanigans in raw struct declarations.
            // buffer UBO { layout(row_major) Foo foo; }; // Apply the layout on top-level.
            var flags = this.combined_decoration_for_member(type, index);
            if (flags.get(Decoration.DecorationRowMajor))
                attr.push("row_major");
            // We don't emit any global layouts, so column_major is default.
            //if (flags & (1ull << DecorationColMajor))
            //    attr.push("column_major");
            if (dec.decoration_flags.get(Decoration.DecorationLocation) && this.can_use_io_location(type.storage, true))
                attr.push("location = " + dec.location);
            // Can only declare component if we can declare location.
            if (dec.decoration_flags.get(Decoration.DecorationComponent) && this.can_use_io_location(type.storage, true)) {
                if (!options.es) {
                    if (options.version < 440 && options.version >= 140)
                        this.require_extension_internal("GL_ARB_enhanced_layouts");
                    else if (options.version < 140)
                        throw new Error("Component decoration is not supported in targets below GLSL 1.40.");
                    attr.push("component = " + dec.component);
                }
                else
                    throw new Error("Component decoration is not supported in ES targets.");
            }
            // SPIRVCrossDecorationPacked is set by layout_for_variable earlier to mark that we need to emit offset qualifiers.
            // This is only done selectively in GLSL as needed.
            if (this.has_extended_decoration(type.self, ExtendedDecorations.SPIRVCrossDecorationExplicitOffset) &&
                dec.decoration_flags.get(Decoration.DecorationOffset)) {
                attr.push("offset = " + dec.offset);
            }
            else if (type.storage === StorageClass.StorageClassOutput && dec.decoration_flags.get(Decoration.DecorationOffset))
                attr.push("xfb_offset = " + dec.offset);
            if (attr.length === 0)
                return "";
            var res = "layout(";
            res += attr.join(", ");
            res += ") ";
            return res;
        };
        CompilerGLSL.prototype.to_interpolation_qualifiers = function (flags) {
            var res = "";
            //if (flags & (1ull << DecorationSmooth))
            //    res += "smooth ";
            if (flags.get(Decoration.DecorationFlat))
                res += "flat ";
            if (flags.get(Decoration.DecorationNoPerspective))
                res += "noperspective ";
            if (flags.get(Decoration.DecorationCentroid))
                res += "centroid ";
            if (flags.get(Decoration.DecorationPatch))
                res += "patch ";
            if (flags.get(Decoration.DecorationSample))
                res += "sample ";
            if (flags.get(Decoration.DecorationInvariant))
                res += "invariant ";
            if (flags.get(Decoration.DecorationExplicitInterpAMD)) {
                this.require_extension_internal("GL_AMD_shader_explicit_vertex_parameter");
                res += "__explicitInterpAMD ";
            }
            if (flags.get(Decoration.DecorationPerVertexNV)) {
                var options = this.options;
                if (options.es && options.version < 320)
                    throw new Error("pervertexNV requires ESSL 320.");
                else if (!options.es && options.version < 450)
                    throw new Error("pervertexNV requires GLSL 450.");
                this.require_extension_internal("GL_NV_fragment_shader_barycentric");
                res += "pervertexNV ";
            }
            return res;
        };
        CompilerGLSL.prototype.layout_for_variable = function (var_) {
            // FIXME: Come up with a better solution for when to disable layouts.
            // Having layouts depend on extensions as well as which types
            // of layouts are used. For now, the simple solution is to just disable
            // layouts for legacy versions.
            if (this.is_legacy())
                return "";
            if (this.subpass_input_is_framebuffer_fetch(var_.self))
                return "";
            var _a = this, options = _a.options, ir = _a.ir;
            var attr = [];
            var type = this.get(SPIRType, var_.basetype);
            var flags = this.get_decoration_bitset(var_.self);
            var typeflags = this.get_decoration_bitset(type.self);
            if (flags.get(Decoration.DecorationPassthroughNV))
                attr.push("passthrough");
            /*if (options.vulkan_semantics && var_.storage === StorageClass.StorageClassPushConstant)
                attr.push("push_constant");
            else if (var_.storage === StorageClass.StorageClassShaderRecordBufferKHR)
                attr.push(ray_tracing_is_khr ? "shaderRecordEXT" : "shaderRecordNV");*/
            if (flags.get(Decoration.DecorationRowMajor))
                attr.push("row_major");
            if (flags.get(Decoration.DecorationColMajor))
                attr.push("column_major");
            /*if (options.vulkan_semantics)
            {
                if (flags.get(Decoration.DecorationInputAttachmentIndex))
                    attr.push("input_attachment_index = " + this.get_decoration(var_.self, DecorationInputAttachmentIndex));
            }*/
            var is_block = this.has_decoration(type.self, Decoration.DecorationBlock);
            if (flags.get(Decoration.DecorationLocation) && this.can_use_io_location(var_.storage, is_block)) {
                var combined_decoration = new Bitset();
                var members = maplike_get(Meta, ir.meta, type.self).members;
                for (var i = 0; i < members.length; i++)
                    combined_decoration.merge_or(this.combined_decoration_for_member(type, i));
                // If our members have location decorations, we don't need to
                // emit location decorations at the top as well (looks weird).
                if (!combined_decoration.get(Decoration.DecorationLocation))
                    attr.push("location = " + this.get_decoration(var_.self, Decoration.DecorationLocation));
            }
            if (this.get_execution_model() === ExecutionModel.ExecutionModelFragment && var_.storage === StorageClass.StorageClassOutput &&
                this.location_is_non_coherent_framebuffer_fetch(this.get_decoration(var_.self, Decoration.DecorationLocation))) {
                attr.push("noncoherent");
            }
            // Transform feedback
            var uses_enhanced_layouts = false;
            if (is_block && var_.storage === StorageClass.StorageClassOutput) {
                // For blocks, there is a restriction where xfb_stride/xfb_buffer must only be declared on the block itself,
                // since all members must match the same xfb_buffer. The only thing we will declare for members of the block
                // is the xfb_offset.
                var member_count = type.member_types.length;
                var have_xfb_buffer_stride = false;
                var have_any_xfb_offset = false;
                var have_geom_stream = false;
                var xfb_stride = 0, xfb_buffer = 0, geom_stream = 0;
                if (flags.get(Decoration.DecorationXfbBuffer) && flags.get(Decoration.DecorationXfbStride)) {
                    have_xfb_buffer_stride = true;
                    xfb_buffer = this.get_decoration(var_.self, Decoration.DecorationXfbBuffer);
                    xfb_stride = this.get_decoration(var_.self, Decoration.DecorationXfbStride);
                }
                if (flags.get(Decoration.DecorationStream)) {
                    have_geom_stream = true;
                    geom_stream = this.get_decoration(var_.self, Decoration.DecorationStream);
                }
                // Verify that none of the members violate our assumption.
                for (var i = 0; i < member_count; i++) {
                    if (this.has_member_decoration(type.self, i, Decoration.DecorationStream)) {
                        var member_geom_stream = this.get_member_decoration(type.self, i, Decoration.DecorationStream);
                        if (have_geom_stream && member_geom_stream !== geom_stream)
                            throw new Error("IO block member Stream mismatch.");
                        have_geom_stream = true;
                        geom_stream = member_geom_stream;
                    }
                    // Only members with an Offset decoration participate in XFB.
                    if (!this.has_member_decoration(type.self, i, Decoration.DecorationOffset))
                        continue;
                    have_any_xfb_offset = true;
                    if (this.has_member_decoration(type.self, i, Decoration.DecorationXfbBuffer)) {
                        var buffer_index = this.get_member_decoration(type.self, i, Decoration.DecorationXfbBuffer);
                        if (have_xfb_buffer_stride && buffer_index !== xfb_buffer)
                            throw new Error("IO block member XfbBuffer mismatch.");
                        have_xfb_buffer_stride = true;
                        xfb_buffer = buffer_index;
                    }
                    if (this.has_member_decoration(type.self, i, Decoration.DecorationXfbStride)) {
                        var stride = this.get_member_decoration(type.self, i, Decoration.DecorationXfbStride);
                        if (have_xfb_buffer_stride && stride !== xfb_stride)
                            throw new Error("IO block member XfbStride mismatch.");
                        have_xfb_buffer_stride = true;
                        xfb_stride = stride;
                    }
                }
                if (have_xfb_buffer_stride && have_any_xfb_offset) {
                    attr.push("xfb_buffer = " + xfb_buffer);
                    attr.push("xfb_stride = " + xfb_stride);
                    uses_enhanced_layouts = true;
                }
                if (have_geom_stream) {
                    if (this.get_execution_model() !== ExecutionModel.ExecutionModelGeometry)
                        throw new Error("Geometry streams can only be used in geometry shaders.");
                    if (options.es)
                        throw new Error("Multiple geometry streams not supported in ESSL.");
                    if (options.version < 400)
                        this.require_extension_internal("GL_ARB_transform_feedback3");
                    attr.push("stream = " + this.get_decoration(var_.self, Decoration.DecorationStream));
                }
            }
            else if (var_.storage === StorageClass.StorageClassOutput) {
                if (flags.get(Decoration.DecorationXfbBuffer) && flags.get(Decoration.DecorationXfbStride) && flags.get(Decoration.DecorationOffset)) {
                    // XFB for standalone variables, we can emit all decorations.
                    attr.push("xfb_buffer = " + this.get_decoration(var_.self, Decoration.DecorationXfbBuffer));
                    attr.push("xfb_stride = " + this.get_decoration(var_.self, Decoration.DecorationXfbStride));
                    attr.push("xfb_offset = " + this.get_decoration(var_.self, Decoration.DecorationOffset));
                    uses_enhanced_layouts = true;
                }
                if (flags.get(Decoration.DecorationStream)) {
                    if (this.get_execution_model() !== ExecutionModel.ExecutionModelGeometry)
                        throw new Error("Geometry streams can only be used in geometry shaders.");
                    if (options.es)
                        throw new Error("Multiple geometry streams not supported in ESSL.");
                    if (options.version < 400)
                        this.require_extension_internal("GL_ARB_transform_feedback3");
                    attr.push("stream = " + this.get_decoration(var_.self, Decoration.DecorationStream));
                }
            }
            // Can only declare Component if we can declare location.
            if (flags.get(Decoration.DecorationComponent) && this.can_use_io_location(var_.storage, is_block)) {
                uses_enhanced_layouts = true;
                attr.push("component = " + this.get_decoration(var_.self, Decoration.DecorationComponent));
            }
            if (uses_enhanced_layouts) {
                if (!options.es) {
                    if (options.version < 440 && options.version >= 140)
                        this.require_extension_internal("GL_ARB_enhanced_layouts");
                    else if (options.version < 140)
                        throw new Error("GL_ARB_enhanced_layouts is not supported in targets below GLSL 1.40.");
                    if (!options.es && options.version < 440)
                        this.require_extension_internal("GL_ARB_enhanced_layouts");
                }
                else if (options.es)
                    throw new Error("GL_ARB_enhanced_layouts is not supported in ESSL.");
            }
            if (flags.get(Decoration.DecorationIndex))
                attr.push("index = " + this.get_decoration(var_.self, Decoration.DecorationIndex));
            var ssbo_block = var_.storage === StorageClass.StorageClassStorageBuffer || var_.storage === StorageClass.StorageClassShaderRecordBufferKHR ||
                (var_.storage === StorageClass.StorageClassUniform && typeflags.get(Decoration.DecorationBufferBlock));
            var emulated_ubo = var_.storage === StorageClass.StorageClassPushConstant && options.emit_push_constant_as_uniform_buffer;
            var ubo_block = var_.storage === StorageClass.StorageClassUniform && typeflags.get(Decoration.DecorationBlock);
            // GL 3.0/GLSL 1.30 is not considered legacy, but it doesn't have UBOs ...
            var can_use_buffer_blocks = (options.es && options.version >= 300) || (!options.es && options.version >= 140);
            // pretend no UBOs when options say so
            if (ubo_block && options.emit_uniform_buffer_as_plain_uniforms)
                can_use_buffer_blocks = false;
            var can_use_binding;
            if (options.es)
                can_use_binding = options.version >= 310;
            else
                can_use_binding = options.enable_420pack_extension || (options.version >= 420);
            // Make sure we don't emit binding layout for a classic uniform on GLSL 1.30.
            if (!can_use_buffer_blocks && var_.storage === StorageClass.StorageClassUniform)
                can_use_binding = false;
            if (var_.storage === StorageClass.StorageClassShaderRecordBufferKHR)
                can_use_binding = false;
            if (can_use_binding && flags.get(Decoration.DecorationBinding))
                attr.push("binding = " + this.get_decoration(var_.self, Decoration.DecorationBinding));
            if (var_.storage !== StorageClass.StorageClassOutput && flags.get(Decoration.DecorationOffset)) {
                console.log(var_);
                attr.push("offset = " + this.get_decoration(var_.self, Decoration.DecorationOffset));
            }
            // Instead of adding explicit offsets for every element here, just assume we're using std140 or std430.
            // If SPIR-V does not comply with either layout, we cannot really work around it.
            if (can_use_buffer_blocks && (ubo_block || emulated_ubo)) {
                attr.push(this.buffer_to_packing_standard(type, false));
            }
            else if (can_use_buffer_blocks && (ssbo_block)) {
                attr.push(this.buffer_to_packing_standard(type, true));
            }
            // For images, the type itself adds a layout qualifer.
            // Only emit the format for storage images.
            if (type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 2) {
                var fmt = this.format_to_glsl(type.image.format);
                if (fmt)
                    attr.push(fmt);
            }
            if (attr.length === 0)
                return "";
            return "layout(" + attr.join(", ") + ") ";
        };
        CompilerGLSL.prototype.to_initializer_expression = function (var_) {
            return this.to_unpacked_expression(var_.initializer);
        };
        CompilerGLSL.prototype.to_zero_initialized_expression = function (type_id) {
            /*#ifndef NDEBUG
            auto &type = get<SPIRType>(type_id);
            assert(type.storage === StorageClassPrivate || type.storage === StorageClassFunction ||
            type.storage === StorageClassGeneric);
            #endif*/
            var ir = this.ir;
            var id = ir.increase_bound_by(1);
            ir.make_constant_null(id, type_id, false);
            return this.constant_expression(this.get(SPIRConstant, id));
        };
        CompilerGLSL.prototype.type_can_zero_initialize = function (type) {
            if (type.pointer)
                return false;
            if (type.array.length > 0 && this.options.flatten_multidimensional_arrays)
                return false;
            for (var _i = 0, _a = type.array_size_literal; _i < _a.length; _i++) {
                var literal = _a[_i];
                if (!literal)
                    return false;
            }
            for (var _b = 0, _c = type.member_types; _b < _c.length; _b++) {
                var memb = _c[_b];
                if (!this.type_can_zero_initialize(this.get(SPIRType, memb)))
                    return false;
            }
            return true;
        };
        CompilerGLSL.prototype.buffer_is_packing_standard = function (type, packing, failed_validation_index, start_offset, end_offset) {
            // This is very tricky and error prone, but try to be exhaustive and correct here.
            // SPIR-V doesn't directly say if we're using std430 or std140.
            // SPIR-V communicates this using Offset and ArrayStride decorations (which is what really matters),
            // so we have to try to infer whether or not the original GLSL source was std140 or std430 based on this information.
            // We do not have to consider shared or packed since these layouts are not allowed in Vulkan SPIR-V (they are useless anyways, and custom offsets would do the same thing).
            //
            // It is almost certain that we're using std430, but it gets tricky with arrays in particular.
            // We will assume std430, but infer std140 if we can prove the struct is not compliant with std430.
            //
            // The only two differences between std140 and std430 are related to padding alignment/array stride
            // in arrays and structs. In std140 they take minimum vec4 alignment.
            // std430 only removes the vec4 requirement.
            if (failed_validation_index === void 0) { failed_validation_index = null; }
            if (start_offset === void 0) { start_offset = 0; }
            if (end_offset === void 0) { end_offset = ~0; }
            var offset = 0;
            var pad_alignment = 1;
            var is_top_level_block = this.has_decoration(type.self, Decoration.DecorationBlock) || this.has_decoration(type.self, Decoration.DecorationBufferBlock);
            var ir = this.ir;
            for (var i = 0; i < type.member_types.length; i++) {
                var memb_type = this.get(SPIRType, type.member_types[i]);
                var member_flags = maplike_get(Meta, ir.meta, type.self).members[i].decoration_flags;
                // Verify alignment rules.
                var packed_alignment = this.type_to_packed_alignment(memb_type, member_flags, packing);
                // This is a rather dirty workaround to deal with some cases of OpSpecConstantOp used as array size, e.g:
                // layout(constant_id = 0) const int s = 10;
                // const int S = s + 5; // SpecConstantOp
                // buffer Foo { int data[S]; }; // <-- Very hard for us to deduce a fixed value here,
                // we would need full implementation of compile-time constant folding. :(
                // If we are the last member of a struct, there might be cases where the actual size of that member is irrelevant
                // for our analysis (e.g. unsized arrays).
                // This lets us simply ignore that there are spec constant op sized arrays in our buffers.
                // Querying size of this member will fail, so just don't call it unless we have to.
                //
                // This is likely "best effort" we can support without going into unacceptably complicated workarounds.
                var member_can_be_unsized = is_top_level_block && (i + 1) === type.member_types.length && memb_type.array.length > 0;
                var packed_size = 0;
                if (!member_can_be_unsized /*|| this.packing_is_hlsl(packing)*/)
                    packed_size = this.type_to_packed_size(memb_type, member_flags, packing);
                // We only need to care about this if we have non-array types which can straddle the vec4 boundary.
                /*if (packing_is_hlsl(packing))
                {
                    // If a member straddles across a vec4 boundary, alignment is actually vec4.
                    uint32_t begin_word = offset / 16;
                    uint32_t end_word = (offset + packed_size - 1) / 16;
                    if (begin_word !== end_word)
                        packed_alignment = max(packed_alignment, 16u);
                }*/
                var actual_offset = this.type_struct_member_offset(type, i);
                // Field is not in the specified range anymore and we can ignore any further fields.
                if (actual_offset >= end_offset)
                    break;
                var alignment = Math.max(packed_alignment, pad_alignment);
                offset = (offset + alignment - 1) & ~(alignment - 1);
                // The next member following a struct member is aligned to the base alignment of the struct that came before.
                // GL 4.5 spec, 7.6.2.2.
                if (memb_type.basetype === SPIRTypeBaseType.Struct && !memb_type.pointer)
                    pad_alignment = packed_alignment;
                else
                    pad_alignment = 1;
                // Only care about packing if we are in the given range
                if (actual_offset >= start_offset) {
                    // We only care about offsets in std140, std430, etc ...
                    // For EnhancedLayout variants, we have the flexibility to choose our own offsets.
                    if (!packing_has_flexible_offset(packing)) {
                        if (actual_offset !== offset) // This cannot be the packing we're looking for.
                         {
                            if (failed_validation_index)
                                failed_validation_index[0] = i;
                            return false;
                        }
                    }
                    else if ((actual_offset & (alignment - 1)) !== 0) {
                        // We still need to verify that alignment rules are observed, even if we have explicit offset.
                        if (failed_validation_index)
                            failed_validation_index[0] = i;
                        return false;
                    }
                    // Verify array stride rules.
                    if (memb_type.array.length === 0 && this.type_to_packed_array_stride(memb_type, member_flags, packing) !=
                        this.type_struct_member_array_stride(type, i)) {
                        if (failed_validation_index)
                            failed_validation_index[0] = i;
                        return false;
                    }
                    // Verify that sub-structs also follow packing rules.
                    // We cannot use enhanced layouts on substructs, so they better be up to spec.
                    var substruct_packing = packing_to_substruct_packing(packing);
                    if (!memb_type.pointer && memb_type.member_types.length > 0 &&
                        !this.buffer_is_packing_standard(memb_type, substruct_packing)) {
                        if (failed_validation_index)
                            failed_validation_index[0] = i;
                        return false;
                    }
                }
                // Bump size.
                offset = actual_offset + packed_size;
            }
            return true;
        };
        CompilerGLSL.prototype.buffer_to_packing_standard = function (type, support_std430_without_scalar_layout) {
            var options = this.options;
            if (support_std430_without_scalar_layout && this.buffer_is_packing_standard(type, BufferPackingStandard.BufferPackingStd430))
                return "std430";
            else if (this.buffer_is_packing_standard(type, BufferPackingStandard.BufferPackingStd140))
                return "std140";
            /*else if (options.vulkan_semantics && buffer_is_packing_standard(type, BufferPackingScalar))
            {
                require_extension_internal("GL_EXT_scalar_block_layout");
                return "scalar";
            }*/
            else if (support_std430_without_scalar_layout &&
                this.buffer_is_packing_standard(type, BufferPackingStandard.BufferPackingStd430EnhancedLayout)) {
                if (options.es /* && !options.vulkan_semantics*/)
                    throw new Error("Push constant block cannot be expressed as neither std430 nor std140. ES-targets do not support GL_ARB_enhanced_layouts.");
                /*if (!options.es && !options.vulkan_semantics && options.version < 440)
                    this.require_extension_internal("GL_ARB_enhanced_layouts");*/
                this.set_extended_decoration(type.self, ExtendedDecorations.SPIRVCrossDecorationExplicitOffset);
                return "std430";
            }
            else if (this.buffer_is_packing_standard(type, BufferPackingStandard.BufferPackingStd140EnhancedLayout)) {
                // Fallback time. We might be able to use the ARB_enhanced_layouts to deal with this difference,
                // however, we can only use layout(offset) on the block itself, not any substructs, so the substructs better be the appropriate layout.
                // Enhanced layouts seem to always work in Vulkan GLSL, so no need for extensions there.
                if (options.es /*&& !options.vulkan_semantics*/)
                    throw new Error("Push constant block cannot be expressed as neither std430 nor std140. ES-targets do not support GL_ARB_enhanced_layouts.");
                if (!options.es && /*!options.vulkan_semantics &&*/ options.version < 440)
                    this.require_extension_internal("GL_ARB_enhanced_layouts");
                this.set_extended_decoration(type.self, ExtendedDecorations.SPIRVCrossDecorationExplicitOffset);
                return "std140";
            }
            /*else if (options.vulkan_semantics && buffer_is_packing_standard(type, BufferPackingStandard.BufferPackingScalarEnhancedLayout))
            {
                set_extended_decoration(type.self, SPIRVCrossDecorationExplicitOffset);
                require_extension_internal("GL_EXT_scalar_block_layout");
                return "scalar";
            }*/
            /*else if (!support_std430_without_scalar_layout && options.vulkan_semantics &&
                buffer_is_packing_standard(type, BufferPackingStd430))
            {
                // UBOs can support std430 with GL_EXT_scalar_block_layout.
                require_extension_internal("GL_EXT_scalar_block_layout");
                return "std430";
            }*/
            /*else if (!support_std430_without_scalar_layout && options.vulkan_semantics &&
                buffer_is_packing_standard(type, BufferPackingStd430EnhancedLayout))
            {
                // UBOs can support std430 with GL_EXT_scalar_block_layout.
                set_extended_decoration(type.self, SPIRVCrossDecorationExplicitOffset);
                require_extension_internal("GL_EXT_scalar_block_layout");
                return "std430";
            }*/
            else {
                throw new Error("Buffer block cannot be expressed as any of std430, std140, scalar, even with enhanced layouts. You can try flattening this block to support a more flexible layout.");
            }
        };
        CompilerGLSL.prototype.type_to_packed_base_size = function (type, _) {
            switch (type.basetype) {
                case SPIRTypeBaseType.Double:
                case SPIRTypeBaseType.Int64:
                case SPIRTypeBaseType.UInt64:
                    return 8;
                case SPIRTypeBaseType.Float:
                case SPIRTypeBaseType.Int:
                case SPIRTypeBaseType.UInt:
                    return 4;
                case SPIRTypeBaseType.Half:
                case SPIRTypeBaseType.Short:
                case SPIRTypeBaseType.UShort:
                    return 2;
                case SPIRTypeBaseType.SByte:
                case SPIRTypeBaseType.UByte:
                    return 1;
                default:
                    throw new Error("Unrecognized type in type_to_packed_base_size.");
            }
        };
        CompilerGLSL.prototype.type_to_packed_alignment = function (type, flags, packing) {
            var ir = this.ir;
            // If using PhysicalStorageBufferEXT storage class, this is a pointer,
            // and is 64-bit.
            if (type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT) {
                if (!type.pointer)
                    throw new Error("Types in PhysicalStorageBufferEXT must be pointers.");
                if (ir.addressing_model === AddressingModel.AddressingModelPhysicalStorageBuffer64EXT) {
                    if (packing_is_vec4_padded(packing) && this.type_is_array_of_pointers(type))
                        return 16;
                    else
                        return 8;
                }
                else
                    throw new Error("AddressingModelPhysicalStorageBuffer64EXT must be used for PhysicalStorageBufferEXT.");
            }
            if (type.array.length) {
                var minimum_alignment = 1;
                if (packing_is_vec4_padded(packing))
                    minimum_alignment = 16;
                var tmp = this.get(SPIRType, type.parent_type);
                while (!tmp.array.length)
                    tmp = this.get(SPIRType, tmp.parent_type);
                // Get the alignment of the base type, then maybe round up.
                return Math.max(minimum_alignment, this.type_to_packed_alignment(tmp, flags, packing));
            }
            if (type.basetype === SPIRTypeBaseType.Struct) {
                // Rule 9. Structs alignments are maximum alignment of its members.
                var alignment = 1;
                for (var i = 0; i < type.member_types.length; i++) {
                    var member_flags = maplike_get(Meta, ir.meta, type.self).members[i].decoration_flags;
                    alignment =
                        Math.max(alignment, this.type_to_packed_alignment(this.get(SPIRType, type.member_types[i]), member_flags, packing));
                }
                // In std140, struct alignment is rounded up to 16.
                if (packing_is_vec4_padded(packing))
                    alignment = Math.max(alignment, 16);
                return alignment;
            }
            else {
                var base_alignment = this.type_to_packed_base_size(type, packing);
                // Alignment requirement for scalar block layout is always the alignment for the most basic component.
                if (packing_is_scalar(packing))
                    return base_alignment;
                // Vectors are *not* aligned in HLSL, but there's an extra rule where vectors cannot straddle
                // a vec4, this is handled outside since that part knows our current offset.
                /*if (type.columns === 1 && packing_is_hlsl(packing))
                    return base_alignment;*/
                // From 7.6.2.2 in GL 4.5 core spec.
                // Rule 1
                if (type.vecsize === 1 && type.columns === 1)
                    return base_alignment;
                // Rule 2
                if ((type.vecsize === 2 || type.vecsize === 4) && type.columns === 1)
                    return type.vecsize * base_alignment;
                // Rule 3
                if (type.vecsize === 3 && type.columns === 1)
                    return 4 * base_alignment;
                // Rule 4 implied. Alignment does not change in std430.
                // Rule 5. Column-major matrices are stored as arrays of
                // vectors.
                if (flags.get(Decoration.DecorationColMajor) && type.columns > 1) {
                    if (packing_is_vec4_padded(packing))
                        return 4 * base_alignment;
                    else if (type.vecsize === 3)
                        return 4 * base_alignment;
                    else
                        return type.vecsize * base_alignment;
                }
                // Rule 6 implied.
                // Rule 7.
                if (flags.get(Decoration.DecorationRowMajor) && type.vecsize > 1) {
                    if (packing_is_vec4_padded(packing))
                        return 4 * base_alignment;
                    else if (type.columns === 3)
                        return 4 * base_alignment;
                    else
                        return type.columns * base_alignment;
                }
                // Rule 8 implied.
            }
            throw new Error("Did not find suitable rule for type. Bogus decorations?");
        };
        CompilerGLSL.prototype.type_to_packed_array_stride = function (type, flags, packing) {
            // Array stride is equal to aligned size of the underlying type.
            var parent = type.parent_type;
            console.assert(parent);
            var tmp = this.get(SPIRType, parent);
            var size = this.type_to_packed_size(tmp, flags, packing);
            var alignment = this.type_to_packed_alignment(type, flags, packing);
            return (size + alignment - 1) & ~(alignment - 1);
        };
        CompilerGLSL.prototype.type_to_packed_size = function (type, flags, packing) {
            if (type.array.length) {
                var packed_size = this.to_array_size_literal(type) * this.type_to_packed_array_stride(type, flags, packing);
                // For arrays of vectors and matrices in HLSL, the last element has a size which depends on its vector size,
                // so that it is possible to pack other vectors into the last element.
                /*if (packing_is_hlsl(packing) && type.basetype !== SPIRTypeBaseType.Struct)
                    packed_size -= (4 - type.vecsize) * (type.width / 8);*/
                return packed_size;
            }
            var ir = this.ir;
            // If using PhysicalStorageBufferEXT storage class, this is a pointer,
            // and is 64-bit.
            if (type.storage === StorageClass.StorageClassPhysicalStorageBufferEXT) {
                if (!type.pointer)
                    throw new Error("Types in PhysicalStorageBufferEXT must be pointers.");
                if (ir.addressing_model === AddressingModel.AddressingModelPhysicalStorageBuffer64EXT)
                    return 8;
                else
                    throw new Error("AddressingModelPhysicalStorageBuffer64EXT must be used for PhysicalStorageBufferEXT.");
            }
            var size = 0;
            if (type.basetype === SPIRTypeBaseType.Struct) {
                var pad_alignment = 1;
                for (var i = 0; i < type.member_types.length; i++) {
                    var member_flags = maplike_get(Meta, ir.meta, type.self).members[i].decoration_flags;
                    var member_type = this.get(SPIRType, type.member_types[i]);
                    var packed_alignment = this.type_to_packed_alignment(member_type, member_flags, packing);
                    var alignment = Math.max(packed_alignment, pad_alignment);
                    // The next member following a struct member is aligned to the base alignment of the struct that came before.
                    // GL 4.5 spec, 7.6.2.2.
                    if (member_type.basetype === SPIRTypeBaseType.Struct)
                        pad_alignment = packed_alignment;
                    else
                        pad_alignment = 1;
                    size = (size + alignment - 1) & ~(alignment - 1);
                    size += this.type_to_packed_size(member_type, member_flags, packing);
                }
            }
            else {
                var base_alignment = this.type_to_packed_base_size(type, packing);
                if (packing_is_scalar(packing)) {
                    size = type.vecsize * type.columns * base_alignment;
                }
                else {
                    if (type.columns === 1)
                        size = type.vecsize * base_alignment;
                    if (flags.get(Decoration.DecorationColMajor) && type.columns > 1) {
                        if (packing_is_vec4_padded(packing))
                            size = type.columns * 4 * base_alignment;
                        else if (type.vecsize === 3)
                            size = type.columns * 4 * base_alignment;
                        else
                            size = type.columns * type.vecsize * base_alignment;
                    }
                    if (flags.get(Decoration.DecorationRowMajor) && type.vecsize > 1) {
                        if (packing_is_vec4_padded(packing))
                            size = type.vecsize * 4 * base_alignment;
                        else if (type.columns === 3)
                            size = type.vecsize * 4 * base_alignment;
                        else
                            size = type.vecsize * type.columns * base_alignment;
                    }
                    // For matrices in HLSL, the last element has a size which depends on its vector size,
                    // so that it is possible to pack other vectors into the last element.
                    /*if (this.packing_is_hlsl(packing) && type.columns > 1)
                        size -= (4 - type.vecsize) * (type.width / 8);*/
                }
            }
            return size;
        };
        CompilerGLSL.prototype.bitcast_glsl_op = function (out_type, in_type) {
            // OpBitcast can deal with pointers.
            if (out_type.pointer || in_type.pointer) {
                if (out_type.vecsize === 2 || in_type.vecsize === 2)
                    this.require_extension_internal("GL_EXT_buffer_reference_uvec2");
                return this.type_to_glsl(out_type);
            }
            if (out_type.basetype === in_type.basetype)
                return "";
            var options = this.options;
            console.assert(out_type.basetype !== SPIRTypeBaseType.Boolean);
            console.assert(in_type.basetype !== SPIRTypeBaseType.Boolean);
            var integral_cast = type_is_integral(out_type) && type_is_integral(in_type);
            var same_size_cast = out_type.width === in_type.width;
            // Trivial bitcast case, casts between integers.
            if (integral_cast && same_size_cast)
                return this.type_to_glsl(out_type);
            // Catch-all 8-bit arithmetic casts (GL_EXT_shader_explicit_arithmetic_types).
            if (out_type.width === 8 && in_type.width >= 16 && integral_cast && in_type.vecsize === 1)
                return "unpack8";
            else if (in_type.width === 8 && out_type.width === 16 && integral_cast && out_type.vecsize === 1)
                return "pack16";
            else if (in_type.width === 8 && out_type.width === 32 && integral_cast && out_type.vecsize === 1)
                return "pack32";
            // Floating <-> Integer special casts. Just have to enumerate all cases. :(
            // 16-bit, 32-bit and 64-bit floats.
            if (out_type.basetype === SPIRTypeBaseType.UInt && in_type.basetype === SPIRTypeBaseType.Float) {
                if (this.is_legacy_es())
                    throw new Error("Float -> Uint bitcast not supported on legacy ESSL.");
                else if (!options.es && options.version < 330)
                    this.require_extension_internal("GL_ARB_shader_bit_encoding");
                return "floatBitsToUint";
            }
            else if (out_type.basetype === SPIRTypeBaseType.Int && in_type.basetype === SPIRTypeBaseType.Float) {
                if (this.is_legacy_es())
                    throw new Error("Float -> Int bitcast not supported on legacy ESSL.");
                else if (!options.es && options.version < 330)
                    this.require_extension_internal("GL_ARB_shader_bit_encoding");
                return "floatBitsToInt";
            }
            else if (out_type.basetype === SPIRTypeBaseType.Float && in_type.basetype === SPIRTypeBaseType.UInt) {
                if (this.is_legacy_es())
                    throw new Error("Uint -> Float bitcast not supported on legacy ESSL.");
                else if (!options.es && options.version < 330)
                    this.require_extension_internal("GL_ARB_shader_bit_encoding");
                return "uintBitsToFloat";
            }
            else if (out_type.basetype === SPIRTypeBaseType.Float && in_type.basetype === SPIRTypeBaseType.Int) {
                if (this.is_legacy_es())
                    throw new Error("Int -> Float bitcast not supported on legacy ESSL.");
                else if (!options.es && options.version < 330)
                    this.require_extension_internal("GL_ARB_shader_bit_encoding");
                return "intBitsToFloat";
            }
            else if (out_type.basetype === SPIRTypeBaseType.Int64 && in_type.basetype === SPIRTypeBaseType.Double)
                return "doubleBitsToInt64";
            else if (out_type.basetype === SPIRTypeBaseType.UInt64 && in_type.basetype === SPIRTypeBaseType.Double)
                return "doubleBitsToUint64";
            else if (out_type.basetype === SPIRTypeBaseType.Double && in_type.basetype === SPIRTypeBaseType.Int64)
                return "int64BitsToDouble";
            else if (out_type.basetype === SPIRTypeBaseType.Double && in_type.basetype === SPIRTypeBaseType.UInt64)
                return "uint64BitsToDouble";
            else if (out_type.basetype === SPIRTypeBaseType.Short && in_type.basetype === SPIRTypeBaseType.Half)
                return "float16BitsToInt16";
            else if (out_type.basetype === SPIRTypeBaseType.UShort && in_type.basetype === SPIRTypeBaseType.Half)
                return "float16BitsToUint16";
            else if (out_type.basetype === SPIRTypeBaseType.Half && in_type.basetype === SPIRTypeBaseType.Short)
                return "int16BitsToFloat16";
            else if (out_type.basetype === SPIRTypeBaseType.Half && in_type.basetype === SPIRTypeBaseType.UShort)
                return "uint16BitsToFloat16";
            // And finally, some even more special purpose casts.
            if (out_type.basetype === SPIRTypeBaseType.UInt64 && in_type.basetype === SPIRTypeBaseType.UInt && in_type.vecsize === 2)
                return "packUint2x32";
            else if (out_type.basetype === SPIRTypeBaseType.UInt && in_type.basetype === SPIRTypeBaseType.UInt64 && out_type.vecsize === 2)
                return "unpackUint2x32";
            else if (out_type.basetype === SPIRTypeBaseType.Half && in_type.basetype === SPIRTypeBaseType.UInt && in_type.vecsize === 1)
                return "unpackFloat2x16";
            else if (out_type.basetype === SPIRTypeBaseType.UInt && in_type.basetype === SPIRTypeBaseType.Half && in_type.vecsize === 2)
                return "packFloat2x16";
            else if (out_type.basetype === SPIRTypeBaseType.Int && in_type.basetype === SPIRTypeBaseType.Short && in_type.vecsize === 2)
                return "packInt2x16";
            else if (out_type.basetype === SPIRTypeBaseType.Short && in_type.basetype === SPIRTypeBaseType.Int && in_type.vecsize === 1)
                return "unpackInt2x16";
            else if (out_type.basetype === SPIRTypeBaseType.UInt && in_type.basetype === SPIRTypeBaseType.UShort && in_type.vecsize === 2)
                return "packUint2x16";
            else if (out_type.basetype === SPIRTypeBaseType.UShort && in_type.basetype === SPIRTypeBaseType.UInt && in_type.vecsize === 1)
                return "unpackUint2x16";
            else if (out_type.basetype === SPIRTypeBaseType.Int64 && in_type.basetype === SPIRTypeBaseType.Short && in_type.vecsize === 4)
                return "packInt4x16";
            else if (out_type.basetype === SPIRTypeBaseType.Short && in_type.basetype === SPIRTypeBaseType.Int64 && in_type.vecsize === 1)
                return "unpackInt4x16";
            else if (out_type.basetype === SPIRTypeBaseType.UInt64 && in_type.basetype === SPIRTypeBaseType.UShort && in_type.vecsize === 4)
                return "packUint4x16";
            else if (out_type.basetype === SPIRTypeBaseType.UShort && in_type.basetype === SPIRTypeBaseType.UInt64 && in_type.vecsize === 1)
                return "unpackUint4x16";
            return "";
        };
        CompilerGLSL.prototype.bitcast_glsl = function (result_type, argument) {
            var op = this.bitcast_glsl_op(result_type, this.expression_type(argument));
            if (op === "")
                return this.to_enclosed_unpacked_expression(argument);
            else
                return op + "(" + this.to_unpacked_expression(argument) + ")";
        };
        CompilerGLSL.prototype.bitcast_expression = function (target_type, arg, expr) {
            if (expr === undefined) {
                // first overload
                target_type = target_type;
                expr = this.to_expression(arg);
                var src_type = this.expression_type(arg);
                if (src_type.basetype !== target_type) {
                    var target = src_type;
                    target.basetype = target_type;
                    expr = this.bitcast_glsl_op(target, src_type) + "(" + expr + ")";
                }
                return expr;
            }
            else {
                target_type = target_type;
                var expr_type = arg;
                // second overload
                if (target_type.basetype === expr_type)
                    return expr;
                var src_type = target_type;
                src_type.basetype = expr_type;
                return this.bitcast_glsl_op(target_type, src_type) + "(" + expr + ")";
            }
        };
        CompilerGLSL.prototype.remove_duplicate_swizzle = function (op) {
            var pos = op.lastIndexOf(".");
            // either not present, or the first
            if (pos <= 0)
                return op;
            var final_swiz = op.substring(pos + 1);
            if (this.backend.swizzle_is_function) {
                if (final_swiz.length < 2)
                    return op;
                if (final_swiz.substring(final_swiz.length - 2) === "()")
                    final_swiz.substring(0, final_swiz.length - 2);
                else
                    return op;
            }
            // Check if final swizzle is of form .x, .xy, .xyz, .xyzw or similar.
            // If so, and previous swizzle is of same length,
            // we can drop the final swizzle altogether.
            for (var i = 0; i < final_swiz.length; i++) {
                if (i >= 4 || final_swiz[i] !== expectedVecComps[i])
                    return op;
            }
            var prevpos = op.lastIndexOf(".", pos - 1);
            if (prevpos < 0)
                return op;
            prevpos++;
            // Make sure there are only swizzles here ...
            for (var i = prevpos; i < pos; i++) {
                if (op[i] < "w" || op[i] > "z") {
                    // If swizzles are foo.xyz() like in C++ backend for example, check for that.
                    if (this.backend.swizzle_is_function && i + 2 === pos && op[i] === "(" && op[i + 1] === ")")
                        break;
                    return op;
                }
            }
            // If original swizzle is large enough, just carve out the components we need.
            // E.g. foobar.wyx.xy will turn into foobar.wy.
            if (pos - prevpos >= final_swiz.length) {
                op = op.substring(0, prevpos + final_swiz.length);
                // Add back the function call ...
                if (this.backend.swizzle_is_function)
                    op += "()";
            }
            return op;
        };
        CompilerGLSL.prototype.replace_illegal_names = function (keywords_) {
            var _this = this;
            if (keywords_ === void 0) { keywords_ = keywords; }
            var ir = this.ir;
            ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                if (_this.is_hidden_variable(var_))
                    return;
                var meta = ir.find_meta(var_.self);
                if (!meta)
                    return;
                var m = meta.decoration;
                if (keywords_.has(m.alias))
                    m.alias = "_" + m.alias;
            });
            ir.for_each_typed_id(SPIRFunction, function (_, func) {
                var meta = ir.find_meta(func.self);
                if (!meta)
                    return;
                var m = meta.decoration;
                if (keywords_.has(m.alias))
                    m.alias = "_" + m.alias;
            });
            ir.for_each_typed_id(SPIRType, function (_, type) {
                var meta = ir.find_meta(type.self);
                if (!meta)
                    return;
                var m = meta.decoration;
                if (keywords_.has(m.alias))
                    m.alias = "_" + m.alias;
                for (var _i = 0, _a = meta.members; _i < _a.length; _i++) {
                    var memb = _a[_i];
                    if (keywords_.has(memb.alias))
                        memb.alias = "_" + memb.alias;
                }
            });
        };
        CompilerGLSL.prototype.replace_fragment_output = function (var_) {
            var ir = this.ir;
            var m = maplike_get(Meta, ir.meta, var_.self).decoration;
            var location = 0;
            if (m.decoration_flags.get(Decoration.DecorationLocation))
                location = m.location;
            // If our variable is arrayed, we must not emit the array part of this as the SPIR-V will
            // do the access chain part of this for us.
            var type = this.get(SPIRType, var_.basetype);
            if (type.array.length === 0) {
                // Redirect the write to a specific render target in legacy GLSL.
                m.alias = "gl_FragData[".concat(location, "]");
                if (this.is_legacy_es() && location !== 0)
                    this.require_extension_internal("GL_EXT_draw_buffers");
            }
            else if (type.array.length === 1) {
                // If location is non-zero, we probably have to add an offset.
                // This gets really tricky since we'd have to inject an offset in the access chain.
                // FIXME: This seems like an extremely odd-ball case, so it's probably fine to leave it like this for now.
                m.alias = "gl_FragData";
                if (location !== 0)
                    throw new Error("Arrayed output variable used, but location is not 0. This is unimplemented in SPIRV-Cross.");
                if (this.is_legacy_es())
                    this.require_extension_internal("GL_EXT_draw_buffers");
            }
            else
                throw new Error("Array-of-array output variable used. This cannot be implemented in legacy GLSL.");
            var_.compat_builtin = true; // We don't want to declare this variable, but use the name as-is.
        };
        CompilerGLSL.prototype.replace_fragment_outputs = function () {
            var _this = this;
            this.ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                var type = _this.get(SPIRType, var_.basetype);
                if (!_this.is_builtin_variable(var_) && !var_.remapped_variable && type.pointer && var_.storage === StorageClass.StorageClassOutput)
                    _this.replace_fragment_output(var_);
            });
        };
        CompilerGLSL.prototype.load_flattened_struct = function (basename, type) {
            var expr = this.type_to_glsl_constructor(type);
            expr += "(";
            for (var i = 0; i < type.member_types.length; i++) {
                if (i)
                    expr += ", ";
                var member_type = this.get(SPIRType, type.member_types[i]);
                if (member_type.basetype === SPIRTypeBaseType.Struct)
                    expr += this.load_flattened_struct(this.to_flattened_struct_member(basename, type, i), member_type);
                else
                    expr += this.to_flattened_struct_member(basename, type, i);
            }
            expr += ")";
            return expr;
        };
        CompilerGLSL.prototype.to_flattened_struct_member = function (basename, type, index) {
            var ret = basename + "_" + this.to_member_name(type, index);
            ParsedIR.sanitize_underscores(ret);
            return ret;
        };
        CompilerGLSL.prototype.track_expression_read = function (id) {
            var ir = this.ir;
            switch (ir.ids[id].get_type()) {
                case Types.TypeExpression: {
                    var e = this.get(SPIRExpression, id);
                    for (var _i = 0, _a = e.implied_read_expressions; _i < _a.length; _i++) {
                        var implied_read = _a[_i];
                        this.track_expression_read(implied_read);
                    }
                    break;
                }
                case Types.TypeAccessChain: {
                    var e = this.get(SPIRAccessChain, id);
                    for (var _b = 0, _c = e.implied_read_expressions; _b < _c.length; _b++) {
                        var implied_read = _c[_b];
                        this.track_expression_read(implied_read);
                    }
                    break;
                }
            }
            // If we try to read a forwarded temporary more than once we will stamp out possibly complex code twice.
            // In this case, it's better to just bind the complex expression to the temporary and read that temporary twice.
            if (this.expression_is_forwarded(id) && !this.expression_suppresses_usage_tracking(id)) {
                var v = maplike_get(0, this.expression_usage_counts, id);
                v++;
                // If we create an expression outside a loop,
                // but access it inside a loop, we're implicitly reading it multiple times.
                // If the expression in question is expensive, we should hoist it out to avoid relying on loop-invariant code motion
                // working inside the backend compiler.
                if (this.expression_read_implies_multiple_reads(id))
                    v++;
                if (v >= 2) {
                    //if (v === 2)
                    //    fprintf(stderr, "ID %u was forced to temporary due to more than 1 expression use!\n", id);
                    this.forced_temporaries.add(id);
                    // Force a recompile after this pass to avoid forwarding this variable.
                    this.force_recompile();
                }
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
        CompilerGLSL.prototype.pls_decl = function (var_) {
            var variable = this.get(SPIRVariable, var_.id);
            var type = new SPIRType();
            type.vecsize = pls_format_to_components(var_.format);
            type.basetype = pls_format_to_basetype(var_.format);
            return to_pls_layout(var_.format) + this.to_pls_qualifiers_glsl(variable) + this.type_to_glsl(type) + " " +
                this.to_name(variable.self);
        };
        CompilerGLSL.prototype.to_pls_qualifiers_glsl = function (variable) {
            var flags = maplike_get(Meta, this.ir.meta, variable.self).decoration.decoration_flags;
            if (flags.get(Decoration.DecorationRelaxedPrecision))
                return "mediump ";
            else
                return "highp ";
        };
        CompilerGLSL.prototype.emit_pls = function () {
            var execution = this.get_entry_point();
            var options = this.options;
            if (execution.model !== ExecutionModel.ExecutionModelFragment)
                throw new Error("Pixel local storage only supported in fragment shaders.");
            if (!options.es)
                throw new Error("Pixel local storage only supported in OpenGL ES.");
            if (options.version < 300)
                throw new Error("Pixel local storage only supported in ESSL 3.0 and above.");
            if (this.pls_inputs.length > 0) {
                this.statement("__pixel_local_inEXT _PLSIn");
                this.begin_scope();
                for (var _i = 0, _a = this.pls_inputs; _i < _a.length; _i++) {
                    var input = _a[_i];
                    this.statement(this.pls_decl(input), ";");
                }
                this.end_scope_decl();
                this.statement("");
            }
            if (this.pls_outputs.length > 0) {
                this.statement("__pixel_local_outEXT _PLSOut");
                this.begin_scope();
                for (var _b = 0, _c = this.pls_outputs; _b < _c.length; _b++) {
                    var output = _c[_b];
                    this.statement(this.pls_decl(output), ";");
                }
                this.end_scope_decl();
                this.statement("");
            }
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
        CompilerGLSL.prototype.location_is_framebuffer_fetch = function (location) {
            return !!this.inout_color_attachments.find(function (elem) { return elem.first === location; });
        };
        CompilerGLSL.prototype.location_is_non_coherent_framebuffer_fetch = function (location) {
            return !!this.inout_color_attachments.find(function (elem) { return elem.first === location && !elem.second; });
        };
        CompilerGLSL.prototype.subpass_input_is_framebuffer_fetch = function (id) {
            if (!this.has_decoration(id, Decoration.DecorationInputAttachmentIndex))
                return false;
            var input_attachment_index = this.get_decoration(id, Decoration.DecorationInputAttachmentIndex);
            for (var _i = 0, _a = this.subpass_to_framebuffer_fetch_attachment; _i < _a.length; _i++) {
                var remap = _a[_i];
                if (remap.first === input_attachment_index)
                    return true;
            }
            return false;
        };
        CompilerGLSL.prototype.emit_inout_fragment_outputs_copy_to_subpass_inputs = function () {
            var _this = this;
            var _loop_3 = function (remap) {
                var subpass_var = this_2.find_subpass_input_by_attachment_index(remap.first);
                var output_var = this_2.find_color_output_by_location(remap.second);
                if (!subpass_var)
                    return "continue";
                if (!output_var)
                    throw new Error("Need to declare the corresponding fragment output variable to be able to read from" +
                        " it.");
                if (this_2.is_array(this_2.get(SPIRType, output_var.basetype)))
                    throw new Error("Cannot use GL_EXT_shader_framebuffer_fetch with arrays of color outputs.");
                var func = this_2.get(SPIRFunction, this_2.get_entry_point().self);
                func.fixup_hooks_in.push(function () {
                    if (_this.is_legacy()) {
                        _this.statement(_this.to_expression(subpass_var.self), " = ", "gl_LastFragData[", _this.get_decoration(output_var.self, Decoration.DecorationLocation), "];");
                    }
                    else {
                        var num_rt_components = _this.get(SPIRType, output_var.basetype).vecsize;
                        _this.statement(_this.to_expression(subpass_var.self), _this.vector_swizzle(num_rt_components, 0), " = ", _this.to_expression(output_var.self), ";");
                    }
                });
            };
            var this_2 = this;
            for (var _i = 0, _a = this.subpass_to_framebuffer_fetch_attachment; _i < _a.length; _i++) {
                var remap = _a[_i];
                _loop_3(remap);
            }
        };
        CompilerGLSL.prototype.find_subpass_input_by_attachment_index = function (index) {
            var _this = this;
            var ret = null;
            this.ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                if (_this.has_decoration(var_.self, Decoration.DecorationInputAttachmentIndex) &&
                    _this.get_decoration(var_.self, Decoration.DecorationInputAttachmentIndex) === index) {
                    ret = var_;
                }
            });
            return ret;
        };
        CompilerGLSL.prototype.find_color_output_by_location = function (location) {
            var _this = this;
            var ret = null;
            this.ir.for_each_typed_id(SPIRVariable, function (_, var_) {
                if (var_.storage === StorageClass.StorageClassOutput && _this.get_decoration(var_.self, Decoration.DecorationLocation) === location)
                    ret = var_;
            });
            return ret;
        };
        // A variant which takes two sets of name. The secondary is only used to verify there are no collisions,
        // but the set is not updated when we have found a new name.
        // Used primarily when adding block interface names.
        CompilerGLSL.prototype.add_variable = function (variables_primary, variables_secondary, name) {
            if (name === "")
                return;
            name = ParsedIR.sanitize_underscores(name);
            if (ParsedIR.is_globally_reserved_identifier(name, true)) {
                name = "";
                return;
            }
            name = this.update_name_cache(variables_primary, variables_secondary, name);
            return name;
        };
        CompilerGLSL.prototype.handle_invalid_expression = function (id) {
            // We tried to read an invalidated expression.
            // This means we need another pass at compilation, but next time, force temporary variables so that they cannot be invalidated.
            this.forced_temporaries.add(id);
            this.force_recompile();
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
            this.find_static_extensions();
            this.fixup_image_load_store_access();
            this.update_active_builtins();
            this.analyze_image_and_sampler_usage();
            this.analyze_interlocked_resource_usage();
            if (this.inout_color_attachments.length > 0)
                this.emit_inout_fragment_outputs_copy_to_subpass_inputs();
            // Shaders might cast unrelated data to pointers of non-block types.
            // Find all such instances and make sure we can cast the pointers to a synthesized block type.
            if (ir.addressing_model === AddressingModel.AddressingModelPhysicalStorageBuffer64EXT)
                this.analyze_non_block_pointer_types();
            var pass_count = 0;
            do {
                if (pass_count >= 3)
                    throw new Error("Over 3 compilation loops detected. Must be a bug!");
                this.reset();
                this.buffer.reset();
                this.emit_header();
                this.emit_resources();
                // this.emit_extension_workarounds(this.get_execution_model());
                // this.emit_function(this.get<SPIRFunction>(SPIRFunction, ir.default_entry_point), new Bitset());
                pass_count++;
            } while (this.is_forcing_recompilation());
            /*
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

            // Entry point in GLSL is always main().*/
            this.get_entry_point().name = "main";
            return this.buffer.str();
        };
        CompilerGLSL.prototype.find_static_extensions = function () {
            var _this = this;
            var ir = this.ir;
            var options = this.options;
            ir.for_each_typed_id(SPIRType, function (_, type) {
                if (type.basetype === SPIRTypeBaseType.Double) {
                    if (options.es)
                        throw new Error("FP64 not supported in ES profile.");
                    if (!options.es && options.version < 400)
                        _this.require_extension_internal("GL_ARB_gpu_shader_fp64");
                }
                else if (type.basetype === SPIRTypeBaseType.Int64 || type.basetype === SPIRTypeBaseType.UInt64) {
                    if (options.es)
                        throw new Error("64-bit integers not supported in ES profile.");
                    if (!options.es)
                        _this.require_extension_internal("GL_ARB_gpu_shader_int64");
                }
                else if (type.basetype === SPIRTypeBaseType.Half) {
                    _this.require_extension_internal("GL_EXT_shader_explicit_arithmetic_types_float16");
                    // if (options.vulkan_semantics)
                    //     require_extension_internal("GL_EXT_shader_16bit_storage");
                }
                else if (type.basetype === SPIRTypeBaseType.SByte || type.basetype === SPIRTypeBaseType.UByte) {
                    _this.require_extension_internal("GL_EXT_shader_explicit_arithmetic_types_int8");
                    // if (options.vulkan_semantics)
                    //     require_extension_internal("GL_EXT_shader_8bit_storage");
                }
                else if (type.basetype === SPIRTypeBaseType.Short || type.basetype === SPIRTypeBaseType.UShort) {
                    _this.require_extension_internal("GL_EXT_shader_explicit_arithmetic_types_int16");
                    // if (options.vulkan_semantics)
                    //     require_extension_internal("GL_EXT_shader_16bit_storage");
                }
            });
            var execution = this.get_entry_point();
            switch (execution.model) {
                case ExecutionModel.ExecutionModelGLCompute:
                    throw new Error("Compute shaders are not supported!");
                /*if (!options.es && options.version < 430)
                    this.require_extension_internal("GL_ARB_compute_shader");
                if (options.es && options.version < 310)
                    throw new Error("At least ESSL 3.10 required for compute shaders.");
                break;*/
                case ExecutionModel.ExecutionModelGeometry:
                    throw new Error("Geometry shaders are not supported!");
                /*if (options.es && options.version < 320)
                    this.require_extension_internal("GL_EXT_geometry_shader");
                if (!options.es && options.version < 150)
                    this.require_extension_internal("GL_ARB_geometry_shader4");

                if (execution.flags.get(ExecutionMode.ExecutionModeInvocations) && execution.invocations !== 1)
                {
                    // Instanced GS is part of 400 core or this extension.
                    if (!options.es && options.version < 400)
                        this.require_extension_internal("GL_ARB_gpu_shader5");
                }
                break;*/
                case ExecutionModel.ExecutionModelTessellationEvaluation:
                case ExecutionModel.ExecutionModelTessellationControl:
                    throw new Error("Tessellation shaders are not supported!");
                /*if (options.es && options.version < 320)
                    this.require_extension_internal("GL_EXT_tessellation_shader");
                if (!options.es && options.version < 400)
                    this.require_extension_internal("GL_ARB_tessellation_shader");
                break;*/
                case ExecutionModel.ExecutionModelRayGenerationKHR:
                case ExecutionModel.ExecutionModelIntersectionKHR:
                case ExecutionModel.ExecutionModelAnyHitKHR:
                case ExecutionModel.ExecutionModelClosestHitKHR:
                case ExecutionModel.ExecutionModelMissKHR:
                case ExecutionModel.ExecutionModelCallableKHR:
            }
            if (this.pls_inputs.length !== 0 || this.pls_outputs.length !== 0) {
                if (execution.model !== ExecutionModel.ExecutionModelFragment)
                    throw new Error("Can only use GL_EXT_shader_pixel_local_storage in fragment shaders.");
                this.require_extension_internal("GL_EXT_shader_pixel_local_storage");
            }
            if (this.inout_color_attachments.length !== 0) {
                if (execution.model !== ExecutionModel.ExecutionModelFragment)
                    throw new Error("Can only use GL_EXT_shader_framebuffer_fetch in fragment shaders.");
                // if (options.vulkan_semantics)
                //     throw new Error("Cannot use EXT_shader_framebuffer_fetch in Vulkan GLSL.");
                var has_coherent = false;
                var has_incoherent = false;
                for (var _i = 0, _a = this.inout_color_attachments; _i < _a.length; _i++) {
                    var att = _a[_i];
                    if (att.second)
                        has_coherent = true;
                    else
                        has_incoherent = true;
                }
                if (has_coherent)
                    this.require_extension_internal("GL_EXT_shader_framebuffer_fetch");
                if (has_incoherent)
                    this.require_extension_internal("GL_EXT_shader_framebuffer_fetch_non_coherent");
            }
            if (options.separate_shader_objects && !options.es && options.version < 410)
                this.require_extension_internal("GL_ARB_separate_shader_objects");
            if (ir.addressing_model === AddressingModel.AddressingModelPhysicalStorageBuffer64EXT) {
                // if (!options.vulkan_semantics)
                throw new Error("GL_EXT_buffer_reference is only supported in Vulkan GLSL.");
            }
            else if (ir.addressing_model !== AddressingModel.AddressingModelLogical) {
                throw new Error("Only Logical and PhysicalStorageBuffer64EXT addressing models are supported.");
            }
            // Check for nonuniform qualifier and passthrough.
            // Instead of looping over all decorations to find this, just look at capabilities.
            for (var _b = 0, _c = ir.declared_capabilities; _b < _c.length; _b++) {
                var cap = _c[_b];
                switch (cap) {
                    case Capability.CapabilityShaderNonUniformEXT:
                        throw new Error("CapabilityShaderNonUniformEXT not supported");
                    case Capability.CapabilityRuntimeDescriptorArrayEXT:
                        throw new Error("CapabilityRuntimeDescriptorArrayEXT not supported");
                    /*if (!options.vulkan_semantics)
                        throw new Error("GL_EXT_nonuniform_qualifier is only supported in Vulkan GLSL.");
                    this.require_extension_internal("GL_EXT_nonuniform_qualifier");
                    break;*/
                    case Capability.CapabilityGeometryShaderPassthroughNV:
                        throw new Error("GeometryShaderPassthroughNV capability not supported");
                    /*if (execution.model === ExecutionModelGeometry)
                    {
                        require_extension_internal("GL_NV_geometry_shader_passthrough");
                        execution.geometry_passthrough = true;
                    }
                    break;*/
                    case Capability.CapabilityVariablePointers:
                    case Capability.CapabilityVariablePointersStorageBuffer:
                        throw new Error("VariablePointers capability is not supported in GLSL.");
                    case Capability.CapabilityMultiView:
                        throw new Error("MultiView capability is not supported in GLSL.");
                    /*if (options.vulkan_semantics)
                        require_extension_internal("GL_EXT_multiview");
                    else
                    {
                        require_extension_internal("GL_OVR_multiview2");
                        if (options.ovr_multiview_view_count === 0)
                            throw new Error("ovr_multiview_view_count must be non-zero when using GL_OVR_multiview2.");
                        if (get_execution_model() !== ExecutionModelVertex)
                            throw new Error("OVR_multiview2 can only be used with Vertex shaders.");
                    }
                    break;*/
                    case Capability.CapabilityRayQueryKHR:
                        throw new Error("RayQuery capability is not supported.");
                    /*if (options.es || options.version < 460 || !options.vulkan_semantics)
                        throw new Error("RayQuery requires Vulkan GLSL 460.");
                    require_extension_internal("GL_EXT_ray_query");
                    ray_tracing_is_khr = true;
                    break;*/
                    case Capability.CapabilityRayTraversalPrimitiveCullingKHR:
                        throw new Error("RayTraversalPrimitiveCulling capability is not supported.");
                }
            }
            if (options.ovr_multiview_view_count) {
                throw new Error("OVR_multiview2 is not supported");
                /*if (options.vulkan_semantics)
                    throw new Error("OVR_multiview2 cannot be used with Vulkan semantics.");
                if (get_execution_model() !== ExecutionModelVertex)
                    throw new Error("OVR_multiview2 can only be used with Vertex shaders.");
                require_extension_internal("GL_OVR_multiview2");*/
            }
        };
        CompilerGLSL.prototype.fixup_image_load_store_access = function () {
            var _this = this;
            if (!this.options.enable_storage_image_qualifier_deduction)
                return;
            this.ir.for_each_typed_id(SPIRVariable, function (var_, _) {
                var vartype = _this.expression_type(var_);
                if (vartype.basetype === SPIRTypeBaseType.Image && vartype.image.sampled === 2) {
                    // Very old glslangValidator and HLSL compilers do not emit required qualifiers here.
                    // Solve this by making the image access as restricted as possible and loosen up if we need to.
                    // If any no-read/no-write flags are actually set, assume that the compiler knows what it's doing.
                    var flags = maplike_get(Meta, _this.ir.meta, var_).decoration.decoration_flags;
                    if (!flags.get(Decoration.DecorationNonWritable) && !flags.get(Decoration.DecorationNonReadable)) {
                        flags.set(Decoration.DecorationNonWritable);
                        flags.set(Decoration.DecorationNonReadable);
                    }
                }
            });
        };
        CompilerGLSL.prototype.type_is_empty = function (type) {
            return type.basetype === SPIRTypeBaseType.Struct && type.member_types.length === 0;
        };
        CompilerGLSL.prototype.declare_undefined_values = function () {
            var _this = this;
            var emitted = false;
            this.ir.for_each_typed_id(SPIRUndef, function (_, undef) {
                var type = _this.get(SPIRType, undef.basetype);
                // OpUndef can be void for some reason ...
                if (type.basetype === SPIRTypeBaseType.Void)
                    return;
                var initializer = "";
                if (_this.options.force_zero_initialized_variables && _this.type_can_zero_initialize(type))
                    initializer = " = " + _this.to_zero_initialized_expression(undef.basetype);
                _this.statement(_this.variable_decl(type, _this.to_name(undef.self), undef.self), initializer, ";");
                emitted = true;
            });
            if (emitted)
                this.statement("");
        };
        CompilerGLSL.prototype.can_use_io_location = function (storage, block) {
            var options = this.options;
            // Location specifiers are must have in SPIR-V, but they aren't really supported in earlier versions of GLSL.
            // Be very explicit here about how to solve the issue.
            if ((this.get_execution_model() !== ExecutionModel.ExecutionModelVertex && storage === StorageClass.StorageClassInput) ||
                (this.get_execution_model() !== ExecutionModel.ExecutionModelFragment && storage === StorageClass.StorageClassOutput)) {
                var minimum_desktop_version = block ? 440 : 410;
                // ARB_enhanced_layouts vs ARB_separate_shader_objects ...
                if (!options.es && options.version < minimum_desktop_version && !options.separate_shader_objects)
                    return false;
                else if (options.es && options.version < 310)
                    return false;
            }
            if ((this.get_execution_model() === ExecutionModel.ExecutionModelVertex && storage === StorageClass.StorageClassInput) ||
                (this.get_execution_model() === ExecutionModel.ExecutionModelFragment && storage === StorageClass.StorageClassOutput)) {
                if (options.es && options.version < 300)
                    return false;
                else if (!options.es && options.version < 330)
                    return false;
            }
            if (storage === StorageClass.StorageClassUniform || storage === StorageClass.StorageClassUniformConstant || storage === StorageClass.StorageClassPushConstant) {
                if (options.es && options.version < 310)
                    return false;
                else if (!options.es && options.version < 430)
                    return false;
            }
            return true;
        };
        CompilerGLSL.prototype.convert_half_to_string = function (c, col, row) {
            var res;
            var float_value = c.scalar_f16(col, row);
            // There is no literal "hf" in GL_NV_gpu_shader5, so to avoid lots
            // of complicated workarounds, just value-cast to the half type always.
            if (isNaN(float_value) || float_value === Number.POSITIVE_INFINITY || float_value === Number.NEGATIVE_INFINITY) {
                var type = new SPIRType();
                type.basetype = SPIRTypeBaseType.Half;
                type.vecsize = 1;
                type.columns = 1;
                if (float_value === Number.POSITIVE_INFINITY)
                    res = this.type_to_glsl(type) + "(1.0 / 0.0)";
                else if (float_value === Number.NEGATIVE_INFINITY)
                    res = this.type_to_glsl(type) + "(-1.0 / 0.0)";
                else if (isNaN(float_value))
                    res = this.type_to_glsl(type) + "(0.0 / 0.0)";
                else
                    throw new Error("Cannot represent non-finite floating point constant.");
            }
            else {
                var type = new SPIRType();
                type.basetype = SPIRTypeBaseType.Half;
                type.vecsize = 1;
                type.columns = 1;
                res = this.type_to_glsl(type) + "(" + convert_to_string(float_value) + ")";
            }
            return res;
        };
        CompilerGLSL.prototype.convert_float_to_string = function (c, col, row) {
            var res;
            var float_value = c.scalar_f32(col, row);
            var backend = this.backend;
            if (isNaN(float_value) || float_value === Number.POSITIVE_INFINITY || float_value === Number.NEGATIVE_INFINITY) {
                // Use special representation.
                if (!this.is_legacy()) {
                    var out_type = new SPIRType();
                    var in_type = new SPIRType();
                    out_type.basetype = SPIRTypeBaseType.Float;
                    in_type.basetype = SPIRTypeBaseType.UInt;
                    out_type.vecsize = 1;
                    in_type.vecsize = 1;
                    out_type.width = 32;
                    in_type.width = 32;
                    var print_buffer = "0x" + c.scalar(col, row) + "u";
                    var comment = "inf";
                    if (float_value === Number.NEGATIVE_INFINITY)
                        comment = "-inf";
                    else if (isNaN(float_value))
                        comment = "nan";
                    res = this.bitcast_glsl_op(out_type, in_type) + "(".concat(print_buffer, " /* ").concat(comment, " */)");
                }
                else {
                    if (float_value === Number.POSITIVE_INFINITY) {
                        if (backend.float_literal_suffix)
                            res = "(1.0f / 0.0f)";
                        else
                            res = "(1.0 / 0.0)";
                    }
                    else if (float_value === Number.NEGATIVE_INFINITY) {
                        if (backend.float_literal_suffix)
                            res = "(-1.0f / 0.0f)";
                        else
                            res = "(-1.0 / 0.0)";
                    }
                    else if (isNaN(float_value)) {
                        if (backend.float_literal_suffix)
                            res = "(0.0f / 0.0f)";
                        else
                            res = "(0.0 / 0.0)";
                    }
                    else
                        throw new Error("Cannot represent non-finite floating point constant.");
                }
            }
            else {
                res = convert_to_string(float_value);
                if (backend.float_literal_suffix)
                    res += "f";
            }
            return res;
        };
        CompilerGLSL.prototype.convert_double_to_string = function (c, col, row) {
            var res;
            var double_value = c.scalar_f64(col, row);
            var options = this.options;
            var backend = this.backend;
            if (isNaN(double_value) || isNaN(double_value)) {
                // Use special representation.
                if (!this.is_legacy()) {
                    var out_type = new SPIRType();
                    var in_type = new SPIRType();
                    out_type.basetype = SPIRTypeBaseType.Double;
                    in_type.basetype = SPIRTypeBaseType.UInt64;
                    out_type.vecsize = 1;
                    in_type.vecsize = 1;
                    out_type.width = 64;
                    in_type.width = 64;
                    var u64_value = c.scalar_u64(col, row);
                    if (options.es)
                        throw new Error("64-bit integers/float not supported in ES profile.");
                    this.require_extension_internal("GL_ARB_gpu_shader_int64");
                    var print_buffer = "0x" + u64_value.toString() + backend.long_long_literal_suffix ? "ull" : "ul";
                    var comment = "inf";
                    if (double_value === Number.POSITIVE_INFINITY)
                        comment = "-inf";
                    else if (isNaN(double_value))
                        comment = "nan";
                    res = this.bitcast_glsl_op(out_type, in_type) + "(".concat(print_buffer, " /* ").concat(comment, " */)");
                }
                else {
                    if (options.es)
                        throw new Error("FP64 not supported in ES profile.");
                    if (options.version < 400)
                        this.require_extension_internal("GL_ARB_gpu_shader_fp64");
                    if (double_value === Number.POSITIVE_INFINITY) {
                        if (backend.double_literal_suffix)
                            res = "(1.0lf / 0.0lf)";
                        else
                            res = "(1.0 / 0.0)";
                    }
                    else if (double_value === Number.NEGATIVE_INFINITY) {
                        if (backend.double_literal_suffix)
                            res = "(-1.0lf / 0.0lf)";
                        else
                            res = "(-1.0 / 0.0)";
                    }
                    else if (isNaN(double_value)) {
                        if (backend.double_literal_suffix)
                            res = "(0.0lf / 0.0lf)";
                        else
                            res = "(0.0 / 0.0)";
                    }
                    else
                        throw new Error("Cannot represent non-finite floating point constant.");
                }
            }
            else {
                res = convert_to_string(double_value);
                if (backend.double_literal_suffix)
                    res += "lf";
            }
            return res;
        };
        CompilerGLSL.prototype.variable_is_lut = function (var_) {
            var statically_assigned = var_.statically_assigned && var_.static_expression !== (0) && var_.remapped_variable;
            if (statically_assigned) {
                var constant = this.maybe_get(SPIRConstant, var_.static_expression);
                if (constant && constant.is_used_as_lut)
                    return true;
            }
            return false;
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
                        if (other_id === self)
                            return;
                        if (other_type.type_alias === type.type_alias)
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
        CompilerGLSL.prototype.vector_swizzle = function (vecsize, index) {
            console.assert(vecsize >= 1 && vecsize <= 4);
            console.assert(index >= 0 && index < 4);
            console.assert(swizzle[vecsize - 1][index]);
            return swizzle[vecsize - 1][index];
        };
        return CompilerGLSL;
    }(Compiler));
    function swap(arr, a, b) {
        var t = a[a];
        arr[a] = arr[b];
        arr[b] = t;
    }
    function is_block_builtin(builtin) {
        return builtin === BuiltIn.BuiltInPosition || builtin === BuiltIn.BuiltInPointSize || builtin === BuiltIn.BuiltInClipDistance ||
            builtin === BuiltIn.BuiltInCullDistance;
    }
    function is_unsigned_opcode(op) {
        // Don't have to be exhaustive, only relevant for legacy target checking ...
        switch (op) {
            case Op.OpShiftRightLogical:
            case Op.OpUGreaterThan:
            case Op.OpUGreaterThanEqual:
            case Op.OpULessThan:
            case Op.OpULessThanEqual:
            case Op.OpUConvert:
            case Op.OpUDiv:
            case Op.OpUMod:
            case Op.OpUMulExtended:
            case Op.OpConvertUToF:
            case Op.OpConvertFToU:
                return true;
            default:
                return false;
        }
    }
    function packing_has_flexible_offset(packing) {
        switch (packing) {
            case BufferPackingStandard.BufferPackingStd140:
            case BufferPackingStandard.BufferPackingStd430:
            case BufferPackingStandard.BufferPackingScalar:
                // case BufferPackingHLSLCbuffer:
                return false;
            default:
                return true;
        }
    }
    function packing_to_substruct_packing(packing) {
        switch (packing) {
            case BufferPackingStandard.BufferPackingStd140EnhancedLayout:
                return BufferPackingStandard.BufferPackingStd140;
            case BufferPackingStandard.BufferPackingStd430EnhancedLayout:
                return BufferPackingStandard.BufferPackingStd430;
            // case BufferPackingStandard.BufferPackingHLSLCbufferPackOffset:
            // return BufferPackingStandard.BufferPackingHLSLCbuffer;
            case BufferPackingStandard.BufferPackingScalarEnhancedLayout:
                return BufferPackingStandard.BufferPackingScalar;
            default:
                return packing;
        }
    }
    function packing_is_vec4_padded(packing) {
        switch (packing) {
            // case BufferPackingStandard.BufferPackingHLSLCbuffer:
            // case BufferPackingStandard.BufferPackingHLSLCbufferPackOffset:
            case BufferPackingStandard.BufferPackingStd140:
            case BufferPackingStandard.BufferPackingStd140EnhancedLayout:
                return true;
            default:
                return false;
        }
    }
    function packing_is_scalar(packing) {
        switch (packing) {
            case BufferPackingStandard.BufferPackingScalar:
            case BufferPackingStandard.BufferPackingScalarEnhancedLayout:
                return true;
            default:
                return false;
        }
    }
    function pls_format_to_basetype(format) {
        switch (format) {
            case PlsFormat.PlsRGBA8I:
            case PlsFormat.PlsRG16I:
                return SPIRTypeBaseType.Int;
            case PlsFormat.PlsRGB10A2UI:
            case PlsFormat.PlsRGBA8UI:
            case PlsFormat.PlsRG16UI:
            case PlsFormat.PlsR32UI:
                return SPIRTypeBaseType.UInt;
            default:
                /*case PlsR11FG11FB10F:
                case PlsR32F:
                case PlsRG16F:
                case PlsRGB10A2:
                case PlsRGBA8:
                case PlsRG16:*/
                return SPIRTypeBaseType.Float;
        }
    }
    function pls_format_to_components(format) {
        switch (format) {
            default:
            case PlsFormat.PlsR32F:
            case PlsFormat.PlsR32UI:
                return 1;
            case PlsFormat.PlsRG16F:
            case PlsFormat.PlsRG16:
            case PlsFormat.PlsRG16UI:
            case PlsFormat.PlsRG16I:
                return 2;
            case PlsFormat.PlsR11FG11FB10F:
                return 3;
            case PlsFormat.PlsRGB10A2:
            case PlsFormat.PlsRGBA8:
            case PlsFormat.PlsRGBA8I:
            case PlsFormat.PlsRGB10A2UI:
            case PlsFormat.PlsRGBA8UI:
                return 4;
        }
    }
    function to_pls_layout(format) {
        switch (format) {
            case PlsFormat.PlsR11FG11FB10F:
                return "layout(r11f_g11f_b10f) ";
            case PlsFormat.PlsR32F:
                return "layout(r32f) ";
            case PlsFormat.PlsRG16F:
                return "layout(rg16f) ";
            case PlsFormat.PlsRGB10A2:
                return "layout(rgb10_a2) ";
            case PlsFormat.PlsRGBA8:
                return "layout(rgba8) ";
            case PlsFormat.PlsRG16:
                return "layout(rg16) ";
            case PlsFormat.PlsRGBA8I:
                return "layout(rgba8i)";
            case PlsFormat.PlsRG16I:
                return "layout(rg16i) ";
            case PlsFormat.PlsRGB10A2UI:
                return "layout(rgb10_a2ui) ";
            case PlsFormat.PlsRGBA8UI:
                return "layout(rgba8ui) ";
            case PlsFormat.PlsRG16UI:
                return "layout(rg16ui) ";
            case PlsFormat.PlsR32UI:
                return "layout(r32ui) ";
            default:
                return "";
        }
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
            var remap_cb = function (type, name) {
                for (var _i = 0, _a = args.variable_type_remaps; _i < _a.length; _i++) {
                    var remap = _a[_i];
                    if (name === remap.variable_name)
                        return remap.new_variable_type;
                }
                return name;
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
