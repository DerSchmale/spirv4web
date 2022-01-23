import { Compiler } from "../compiler/Compiler";
import { Resource } from "../compiler/ShaderResources";
import { SPIRTypeBaseType } from "../common/SPIRType";
import { Decoration } from "../spirv/Decoration";

export function rename_interface_variable(compiler: Compiler, resources: Resource[], location: number, name: string)
{
    for (let v of resources)
    {
        if (!compiler.has_decoration(v.id, Decoration.DecorationLocation))
            continue;

        const loc = compiler.get_decoration(v.id, Decoration.DecorationLocation);
        if (loc != location)
            continue;

        const type = compiler.get_type(v.base_type_id);

        // This is more of a friendly variant. If we need to rename interface variables, we might have to rename
        // structs as well and make sure all the names match up.
        if (type.basetype == SPIRTypeBaseType.Struct)
        {
            compiler.set_name(v.base_type_id, "SPIRV_Cross_Interface_Location" + location);
            for (let i = 0; i < type.member_types.length; i++)
                compiler.set_member_name(v.base_type_id, i, "InterfaceMember" + i);
        }

        compiler.set_name(v.id, name);
    }
}

export function inherit_combined_sampler_bindings(compiler: Compiler)
{
    const samplers = compiler.get_combined_image_samplers();
    for (let s of samplers)
    {
        if (compiler.has_decoration(s.image_id, Decoration.DecorationDescriptorSet))
        {
            const set = compiler.get_decoration(s.image_id, Decoration.DecorationDescriptorSet);
            compiler.set_decoration(s.combined_id, Decoration.DecorationDescriptorSet, set);
        }

        if (compiler.has_decoration(s.image_id, Decoration.DecorationBinding))
        {
            const binding = compiler.get_decoration(s.image_id, Decoration.DecorationBinding);
            compiler.set_decoration(s.combined_id, Decoration.DecorationBinding, binding);
        }
    }
}