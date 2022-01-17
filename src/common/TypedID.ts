// in C++, these types are templated to prevent implicit conversion. Typescript doesn't allow this (generics using
// enum values aren't possible, but we're counting on the C++ code being valid due to their type-checks, so we can
// simplify this)
type VariableID = number;
type TypeID = number;
type ConstantID = number;
type FunctionID = number;
type BlockID = number;
type ID = number;