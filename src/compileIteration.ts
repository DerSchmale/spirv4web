import { Args, PLSArg, Remap } from "./Args";
import { Parser } from "./parser/Parser";
import { CompilerGLSL } from "./compiler/glsl/CompilerGLSL";
import { Resource, ShaderResources } from "./compiler/ShaderResources";
import { Compiler } from "./compiler/Compiler";
import { inherit_combined_sampler_bindings, rename_interface_variable } from "./utils/util";
import { PlsRemap } from "./compiler/glsl/PlsRemap";
import { ExecutionModel } from "./spirv/ExecutionModel";
import { Decoration } from "./spirv/Decoration";
import { StorageClass } from "./spirv/StorageClass";

function stage_to_execution_model(stage: string): ExecutionModel
{
    if (stage === "vert")
        return ExecutionModel.Vertex;
    else if (stage === "frag")
        return ExecutionModel.Fragment;
    /*else if (stage === "comp")
        return ExecutionModel.GLCompute;
    else if (stage === "tesc")
        return ExecutionModel.TessellationControl;
    else if (stage === "tese")
        return ExecutionModel.TessellationEvaluation;
    else if (stage === "geom")
        return ExecutionModel.Geometry;*/
    else
        throw new Error("Invalid stage!");
}

export function compile_iteration(args: Args, spirv_file: Uint32Array): string
{
    const spirv_parser = new Parser(spirv_file);
    spirv_parser.parse();

    const combined_image_samplers: boolean = true;
    const build_dummy_sampler = false;

    const compiler = new CompilerGLSL(spirv_parser.get_parsed_ir());

    if (args.variable_type_remaps.length !== 0)
    {
        const remap_cb = (type, name) => {
            for (let remap of args.variable_type_remaps)
                if (name === remap.variable_name)
                    return remap.new_variable_type;

            return name;
        };

        compiler.set_variable_type_remap_callback(remap_cb);
    }

    for (let masked of args.masked_stage_outputs)
        compiler.mask_stage_output_by_location(masked.first, masked.second);

    for (let masked of args.masked_stage_builtins)
        compiler.mask_stage_output_by_builtin(masked);

    for (let rename of args.entry_point_rename)
        compiler.rename_entry_point(rename.old_name, rename.new_name, rename.execution_model);

    const entry_points = compiler.get_entry_points_and_stages();
    let entry_point = args.entry;
    let model = ExecutionModel.Max;

    if (args.entry_stage && args.entry_stage.length > 0)
    {
        model = stage_to_execution_model(args.entry_stage);
        if (!entry_point || entry_point === "")
        {
            // Just use the first entry point with this stage.
            for (let e of entry_points) {
                if (e.execution_model === model)
                {
                    entry_point = e.name;
                    break;
                }
            }

            if (!entry_point)
            {
                throw new Error(`Could not find an entry point with stage: ${args.entry_stage}`);
            }
        }
        else
        {
            // Make sure both stage and name exists.
            let exists = false;
            for (let e of entry_points)
            {
                if (e.execution_model === model && e.name === entry_point)
                {
                    exists = true;
                    break;
                }
            }

            if (!exists)
            {
                throw new Error(`Could not find an entry point %s with stage: ${args.entry_stage}`);
            }
        }
    }
    else if (entry_point && entry_point !== "")
    {
        // Make sure there is just one entry point with this name, or the stage
        // is ambiguous.
        let stage_count = 0;
        for (let e of entry_points)
        {
            if (e.name === entry_point)
            {
                stage_count++;
                model = e.execution_model;
            }
        }

        if (stage_count === 0)
        {
            throw new Error(`There is no entry point with name: ${entry_point}`);
        }
        else if (stage_count > 1)
        {
            throw new Error(`There is more than one entry point with name: ${entry_point}. Use --stage.`);
        }
    }

    if (entry_point && entry_point !== "")
        compiler.set_entry_point(entry_point, model);

    if (!args.set_version && !compiler.get_common_options().version)
    {
        throw new Error("Didn't specify GLSL version and SPIR-V did not specify language.");
    }

    const opts = compiler.get_common_options();
    if (args.set_version)
        opts.version = args.version;
    // if (args.set_es)
    //     opts.es = args.es;
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
    opts.keep_unnamed_ubos = args.glsl_keep_unnamed_ubos;
    opts.remove_attribute_layouts = args.glsl_remove_attribute_layouts;
    opts.specialization_constant_prefix = args.specialization_constant_prefix;
    opts.ovr_multiview_view_count = args.glsl_ovr_multiview_view_count;
    opts.emit_line_directives = args.emit_line_directives;
    opts.enable_storage_image_qualifier_deduction = args.enable_storage_image_qualifier_deduction;
    opts.force_zero_initialized_variables = args.force_zero_initialized_variables;

    for (let fetch of args.glsl_ext_framebuffer_fetch)
        compiler.remap_ext_framebuffer_fetch(fetch.first, fetch.second, !args.glsl_ext_framebuffer_fetch_noncoherent);

    if (build_dummy_sampler)
    {
        const sampler = compiler.build_dummy_sampler_for_combined_images();
        if (sampler !== 0)
        {
            // Set some defaults to make validation happy.
            compiler.set_decoration(sampler, Decoration.DescriptorSet, 0);
            compiler.set_decoration(sampler, Decoration.Binding, 0);
        }
    }

    let res: ShaderResources;
    if (args.remove_unused)
    {
        const active = compiler.get_active_interface_variables();
        res = compiler.get_shader_resources(active);
        compiler.set_enabled_interface_variables(active);
    }
    else
        res = compiler.get_shader_resources();

    if (args.flatten_ubo)
    {
        for (let ubo of res.uniform_buffers)
            compiler.flatten_buffer_block(ubo.id);
        for (let ubo of res.push_constant_buffers)
            compiler.flatten_buffer_block(ubo.id);
    }

    const pls_inputs = remap_pls(args.pls_in, res.stage_inputs, res.subpass_inputs);
    const pls_outputs = remap_pls(args.pls_out, res.stage_outputs, null);
    compiler.remap_pixel_local_storage(pls_inputs, pls_outputs);

    for (let ext of args.extensions)
        compiler.require_extension(ext);

    for (let remap of args.remaps)
    {
        if (remap_generic(compiler, res.stage_inputs, remap))
            continue;
        if (remap_generic(compiler, res.stage_outputs, remap))
            continue;
        if (remap_generic(compiler, res.subpass_inputs, remap))
            continue;
    }

    for (let rename of args.interface_variable_renames)
    {
        if (rename.storageClass === StorageClass.Input)
            rename_interface_variable(compiler, res.stage_inputs, rename.location, rename.variable_name);
    else if (rename.storageClass === StorageClass.Output)
            rename_interface_variable(compiler, res.stage_outputs, rename.location, rename.variable_name);
    else
        {
            throw new Error("error at --rename-interface-variable <in|out> ...");
        }
    }

    if (combined_image_samplers)
    {
        compiler.build_combined_image_samplers();
        if (args.combined_samplers_inherit_bindings)
            inherit_combined_sampler_bindings(compiler);

        // Give the remapped combined samplers new names.
        for (let remap of compiler.get_combined_image_samplers())
        {
            compiler.set_name(remap.combined_id, "SPIRV_Cross_Combined" + compiler.get_name(remap.image_id) +
                compiler.get_name(remap.sampler_id));
        }
    }



    const ret = compiler.compile();

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

function remap_generic(compiler: Compiler, resources: Resource[], remap: Remap): boolean
{
    const elm = resources.find(res => { return res.name === remap.src_name; });

    if (elm)
    {
        compiler.set_remapped_variable_state(elm.id, true);
        compiler.set_name(elm.id, remap.dst_name);
        compiler.set_subpass_input_remapped_components(elm.id, remap.components);
        return true;
    }
    else
        return false;
}

function remap_pls(pls_variables: PLSArg[], resources: Resource[], secondary_resources: Resource[]): PlsRemap[]
{
    const ret: PlsRemap[] = [];

    for (let pls of pls_variables)
    {
        let found = false;
        for (let res of resources)
        {
            if (res.name === pls.name)
            {
                ret.push(new PlsRemap(res.id, pls.format));
                found = true;
                break;
            }
        }

        if (!found && secondary_resources)
        {
            for (let res of secondary_resources)
            {
                if (res.name === pls.name)
                {
                    ret.push(new PlsRemap(res.id, pls.format));
                    found = true;
                    break;
                }
            }
        }

        if (!found)
            throw new Error(`Did not find stage input/output/target with name ${pls.name}`);
    }

    return ret;
}