export enum GroupOperation {
    GroupOperationReduce = 0,
    GroupOperationInclusiveScan = 1,
    GroupOperationExclusiveScan = 2,
    GroupOperationClusteredReduce = 3,
    GroupOperationPartitionedReduceNV = 6,
    GroupOperationPartitionedInclusiveScanNV = 7,
    GroupOperationPartitionedExclusiveScanNV = 8,
    GroupOperationMax = 0x7fffffff,
}