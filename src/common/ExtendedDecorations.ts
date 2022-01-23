export enum ExtendedDecorations
{
    // Marks if a buffer block is re-packed, i.e. member declaration might be subject to PhysicalTypeID remapping and padding.
    SPIRVCrossDecorationBufferBlockRepacked = 0,

    // A type in a buffer block might be declared with a different physical type than the logical type.
    // If this is not set, PhysicalTypeID === the SPIR-V type as declared.
    SPIRVCrossDecorationPhysicalTypeID,

    // Marks if the physical type is to be declared with tight packing rules, i.e. packed_floatN on MSL and friends.
    // If this is set, PhysicalTypeID might also be set. It can be set to same as logical type if all we're doing
    // is converting float3 to packed_float3 for example.
    // If this is marked on a struct, it means the struct itself must use only Packed types for all its members.
    SPIRVCrossDecorationPhysicalTypePacked,

    // The padding in bytes before declaring this struct member.
    // If used on a struct type, marks the target size of a struct.
    SPIRVCrossDecorationPaddingTarget,

    SPIRVCrossDecorationInterfaceMemberIndex,
    SPIRVCrossDecorationInterfaceOrigID,
    SPIRVCrossDecorationResourceIndexPrimary,
    // Used for decorations like resource indices for samplers when part of combined image samplers.
    // A variable might need to hold two resource indices in this case.
    SPIRVCrossDecorationResourceIndexSecondary,
    // Used for resource indices for multiplanar images when part of combined image samplers.
    SPIRVCrossDecorationResourceIndexTertiary,
    SPIRVCrossDecorationResourceIndexQuaternary,

    // Marks a buffer block for using explicit offsets (GLSL/HLSL).
    SPIRVCrossDecorationExplicitOffset,

    // Apply to a variable in the Input storage class; marks it as holding the base group passed to vkCmdDispatchBase(),
    // or the base vertex and instance indices passed to vkCmdDrawIndexed().
    // In MSL, this is used to adjust the WorkgroupId and GlobalInvocationId variables in compute shaders,
    // and to hold the BaseVertex and BaseInstance variables in vertex shaders.
    SPIRVCrossDecorationBuiltInDispatchBase,

    // Apply to a variable that is a function parameter; marks it as being a "dynamic"
    // combined image-sampler. In MSL, this is used when a function parameter might hold
    // either a regular combined image-sampler or one that has an attached sampler
    // Y'CbCr conversion.
    SPIRVCrossDecorationDynamicImageSampler,

    // Apply to a variable in the Input storage class; marks it as holding the size of the stage
    // input grid.
    // In MSL, this is used to hold the vertex and instance counts in a tessellation pipeline
    // vertex shader.
    SPIRVCrossDecorationBuiltInStageInputSize,

    // Apply to any access chain of a tessellation I/O variable; stores the type of the sub-object
    // that was chained to, as recorded in the input variable itself. This is used in case the pointer
    // is itself used as the base of an access chain, to calculate the original type of the sub-object
    // chained to, in case a swizzle needs to be applied. This should not happen normally with valid
    // SPIR-V, but the MSL backend can change the type of input variables, necessitating the
    // addition of swizzles to keep the generated code compiling.
    SPIRVCrossDecorationTessIOOriginalInputTypeID,

    // Apply to any access chain of an interface variable used with pull-model interpolation, where the variable is a
    // vector but the resulting pointer is a scalar; stores the component index that is to be accessed by the chain.
    // This is used when emitting calls to interpolation functions on the chain in MSL: in this case, the component
    // must be applied to the result, since pull-model interpolants in MSL cannot be swizzled directly, but the
    // results of interpolation can.
    SPIRVCrossDecorationInterpolantComponentExpr,

    SPIRVCrossDecorationCount
}