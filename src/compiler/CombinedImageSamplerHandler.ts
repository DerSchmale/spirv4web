import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import {
    SPIRFunction,
    SPIRFunctionCombinedImageSamplerParameter,
    SPIRFunctionParameter
} from "../common/SPIRFunction";
import { SPIRType, SPIRTypeBaseType } from "../common/SPIRType";
import { SPIRExpression } from "../common/SPIRExpression";
import { defaultCopy } from "../utils/defaultCopy";
import { SPIRVariable } from "../common/SPIRVariable";
import { CombinedImageSampler } from "./CombinedImageSampler";
import { Op } from "../spirv/Op";
import { Dim } from "../spirv/Dim";
import { StorageClass } from "../spirv/StorageClass";
import { Decoration } from "../spirv/Decoration";

export class CombinedImageSamplerHandler extends OpcodeHandler
{
    compiler: Compiler;

    // Each function in the call stack needs its own remapping for parameters so we can deduce which global variable each texture/sampler the parameter is statically bound to.
    // this is a stack of a map (Sparse array)
    parameter_remapping: number[][] = [];
    functions: SPIRFunction[] = [];

    constructor(compiler: Compiler)
    {
        super();
        this.compiler = compiler
    }

    handle(opcode: Op, args: Uint32Array, length: number): boolean
    {
        const compiler = this.compiler;

        // We need to figure out where samplers and images are loaded from, so do only the bare bones compilation we need.
        let is_fetch = false;

        switch (opcode) {
            case Op.OpLoad: {
                if (length < 3)
                    return false;

                const result_type = args[0];

                const type = compiler.get<SPIRType>(SPIRType, result_type);
                const separate_image = type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1;
                const separate_sampler = type.basetype === SPIRTypeBaseType.Sampler;

                // If not separate image or sampler, don't bother.
                if (!separate_image && !separate_sampler)
                    return true;

                const id = args[1];
                const ptr = args[2];
                compiler.set<SPIRExpression>(SPIRExpression, id, "", result_type, true);
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

                const result_type = args[0];

                const type = compiler.get<SPIRType>(SPIRType, result_type);
                const separate_image = type.basetype === SPIRTypeBaseType.Image && type.image.sampled === 1;
                const separate_sampler = type.basetype === SPIRTypeBaseType.Sampler;
                if (separate_sampler)
                    throw new Error("Attempting to use arrays or structs of separate samplers. This is not possible" +
                        " to statically remap to plain GLSL.");

                if (separate_image) {
                    const id = args[1];
                    const ptr = args[2];
                    compiler.set<SPIRExpression>(SPIRExpression, id, "", result_type, true);
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
                const var_ = compiler.maybe_get_backing_variable(args[2]);
                if (!var_)
                    return true;

                const type = compiler.get<SPIRType>(SPIRType, var_.basetype);
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
            const callee = this.functions[this.functions.length - 1];
            if (callee.do_combined_parameters) {
                let image_id = args[2];

                const image = compiler.maybe_get_backing_variable(image_id);
                if (image)
                    image_id = image.self;

                let sampler_id = is_fetch ? compiler.dummy_sampler_id : args[3];
                const sampler = compiler.maybe_get_backing_variable(sampler_id);
                if (sampler)
                    sampler_id = sampler.self;

                const combined_id = args[1];

                const combined_type = compiler.get<SPIRType>(SPIRType, args[0]);
                this.register_combined_image_sampler(callee, combined_id, image_id, sampler_id, combined_type.image.depth);
            }
        }

        // For function calls, we need to remap IDs which are function parameters into global variables.
        // This information is statically known from the current place in the call stack.
        // Function parameters are not necessarily pointers, so if we don't have a backing variable, remapping will know
        // which backing variable the image/sample came from.
        const image_id: VariableID = this.remap_parameter(args[2]);
        const sampler_id: VariableID = is_fetch ? compiler.dummy_sampler_id : this.remap_parameter(args[3]);

        const element = compiler.combined_image_samplers.find(combined => {
            return combined.image_id === image_id && combined.sampler_id === sampler_id;
        });

        if (!element)
        {
            let sampled_type: number;
            let combined_module_id: number;
            if (is_fetch)
            {
                // Have to invent the sampled image type.
                sampled_type = compiler.ir.increase_bound_by(1);
                const type = compiler.set<SPIRType>(SPIRType, sampled_type);
                defaultCopy(compiler.expression_type(args[2]), type);
                type.self = sampled_type;
                type.basetype = SPIRTypeBaseType.SampledImage;
                type.image.depth = false;
                combined_module_id = 0;
            }
            else
            {
                sampled_type = args[0];
                combined_module_id = args[1];
            }

            const id = compiler.ir.increase_bound_by(2);
            const type_id = id + 0;
            const combined_id = id + 1;

            // Make a new type, pointer to OpTypeSampledImage, so we can make a variable of this type.
            // We will probably have this type lying around, but it doesn't hurt to make duplicates for internal purposes.
            const type = compiler.set<SPIRType>(SPIRType, type_id);
            const base = compiler.get<SPIRType>(SPIRType, sampled_type);
            defaultCopy(base, type);
            type.pointer = true;
            type.storage = StorageClass.StorageClassUniformConstant;
            type.parent_type = type_id;

            // Build new variable.
            compiler.set<SPIRVariable>(SPIRVariable, combined_id, type_id, StorageClass.StorageClassUniformConstant, 0);

            // Inherit RelaxedPrecision (and potentially other useful flags if deemed relevant).
            // If any of OpSampledImage, underlying image or sampler are marked, inherit the decoration.
            const relaxed_precision =
                (sampler_id && compiler.has_decoration(sampler_id, Decoration.DecorationRelaxedPrecision)) ||
                (image_id && compiler.has_decoration(image_id, Decoration.DecorationRelaxedPrecision)) ||
                (combined_module_id && compiler.has_decoration(combined_module_id, Decoration.DecorationRelaxedPrecision));

            if (relaxed_precision)
                compiler.set_decoration(combined_id, Decoration.DecorationRelaxedPrecision);

            // Propagate the array type for the original image as well.
            const var_ = compiler.maybe_get_backing_variable(image_id);
            if (var_)
            {
                const parent_type = compiler.get<SPIRType>(SPIRType, var_.basetype);
                type.array = parent_type.array;
                type.array_size_literal = parent_type.array_size_literal;
            }

            compiler.combined_image_samplers.push(new CombinedImageSampler(combined_id, image_id, sampler_id));
        }

        return true;
    }

    begin_function_scope(args: Uint32Array, length: number): boolean
    {
        if (length < 3)
            return false;

        const callee = this.compiler.get<SPIRFunction>(SPIRFunction, args[2]);
        args = args.slice(3)
        length -= 3;
        this.push_remap_parameters(callee, args, length);
        this.functions.push(callee);
        return true;
    }

    end_function_scope(args: Uint32Array, length: number): boolean
    {
        if (length < 3)
            return false;

        const functions = this.functions;
        const compiler = this.compiler;
        const callee = compiler.get<SPIRFunction>(SPIRFunction, args[2]);
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

        const params = functions.pop().combined_parameters;
        if (functions.length === 0)
            return true;

        const caller = functions[functions.length - 1];
        if (caller.do_combined_parameters)
        {
            for (let param of params)
            {
                let image_id: VariableID = param.global_image ? param.image_id : <VariableID>(args[param.image_id]);
                let sampler_id: VariableID = param.global_sampler ? param.sampler_id : <VariableID>(args[param.sampler_id]);

                const i = compiler.maybe_get_backing_variable(image_id);
                const s = compiler.maybe_get_backing_variable(sampler_id);
                if (i)
                    image_id = i.self;
                if (s)
                    sampler_id = s.self;

                this.register_combined_image_sampler(caller, 0, image_id, sampler_id, param.depth);
            }
        }

        return true;
    }

    remap_parameter(id: number): number
    {
        const var_ = this.compiler.maybe_get_backing_variable(id);
        if (var_)
            id = var_.self;

        const parameter_remapping = this.parameter_remapping;
        if (parameter_remapping.length === 0)
            return id;

        const remapping = parameter_remapping[parameter_remapping.length - 1];
        const elm = remapping[id];
        if (elm !== undefined)
            return elm;
        else
            return id;
    }

    push_remap_parameters(func: SPIRFunction, args: Uint32Array, length: number)
    {
        // If possible, pipe through a remapping table so that parameters know
        // which variables they actually bind to in this scope.
        // original is map<uint, uint>
        const remapping: number[] = [];
        for (let i = 0; i < length; i++)
            remapping[func.arguments[i].id] = this.remap_parameter(args[i]);

        this.parameter_remapping.push(remapping);
    }

    pop_remap_parameters()
    {
        this.parameter_remapping.pop();
    }

    register_combined_image_sampler(caller: SPIRFunction, combined_module_id: VariableID, image_id: VariableID, sampler_id: VariableID, depth: boolean)
    {
// We now have a texture ID and a sampler ID which will either be found as a global
        // or a parameter in our own function. If both are global, they will not need a parameter,
        // otherwise, add it to our list.
        const param = new SPIRFunctionCombinedImageSamplerParameter(0, image_id, sampler_id, true, true, depth);

        const texture_itr = caller.arguments.find(p => p.id === image_id);
        const sampler_itr = caller.arguments.find(p => p.id === sampler_id);

        if (texture_itr)
        {
            param.global_image = false;
            param.image_id = caller.arguments.indexOf(texture_itr);
        }

        if (sampler_itr)
        {
            param.global_sampler = false;
            param.sampler_id = caller.arguments.indexOf(sampler_itr);
        }

        if (param.global_image && param.global_sampler)
            return;

        const itr = caller.combined_parameters.find(p => {
            return param.image_id === p.image_id && param.sampler_id === p.sampler_id &&
                param.global_image === p.global_image && param.global_sampler === p.global_sampler;
        });

        const compiler = this.compiler;
        if (!itr)
        {
            const id = compiler.ir.increase_bound_by(3);
            const type_id = id;
            const ptr_type_id = id + 1;
            const combined_id = id + 2;
            const base = compiler.expression_type(image_id);
            const type = compiler.set<SPIRType>(SPIRType, type_id);
            const ptr_type = compiler.set<SPIRType>(SPIRType, ptr_type_id);

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
            compiler.set<SPIRVariable>(SPIRVariable, combined_id, ptr_type_id, StorageClass.StorageClassFunction, 0);

            // Inherit RelaxedPrecision.
            // If any of OpSampledImage, underlying image or sampler are marked, inherit the decoration.
            const relaxed_precision =
                compiler.has_decoration(sampler_id, Decoration.DecorationRelaxedPrecision) ||
                compiler.has_decoration(image_id, Decoration.DecorationRelaxedPrecision) ||
                (combined_module_id && compiler.has_decoration(combined_module_id, Decoration.DecorationRelaxedPrecision));

            if (relaxed_precision)
                compiler.set_decoration(combined_id, Decoration.DecorationRelaxedPrecision);

            param.id = combined_id;

            compiler.set_name(combined_id, "SPIRV_Cross_Combined" + compiler.to_name(image_id) + compiler.to_name(sampler_id));

            caller.combined_parameters.push(param);
            caller.shadow_arguments.push(new SPIRFunctionParameter(ptr_type_id, combined_id, 0, 0, true));
        }
    }
}