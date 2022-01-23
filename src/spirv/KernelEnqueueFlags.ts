export enum KernelEnqueueFlags {
    KernelEnqueueFlagsNoWait = 0,
    KernelEnqueueFlagsWaitKernel = 1,
    KernelEnqueueFlagsWaitWorkGroup = 2,
    KernelEnqueueFlagsMax = 0x7fffffff,
}