import { OpcodeHandler } from "./OpcodeHandler";
import { Compiler } from "./Compiler";
import { Op } from "../spirv";
import { SPIRBlock } from "../common/SPIRBlock";
import { SPIRFunction } from "../common/SPIRFunction";

export class InterlockedResourceAccessPrepassHandler extends OpcodeHandler
{
    compiler: Compiler;
    interlock_function_id: number = 0;
    current_block_id: number = 0;
    split_function_case: boolean = false;
    control_flow_interlock: boolean = false;
    call_stack: number[] = [];

    constructor(compiler: Compiler, entry_point_id: number)
    {
        super();
        this.compiler = compiler;
        this.call_stack.push(entry_point_id);
    }


    rearm_current_block(block: SPIRBlock): void
    {
        this.current_block_id = block.self;
    }

    begin_function_scope(args: Uint32Array, length: number): boolean
    {
        if (length < 3)
            return false;

        this.call_stack.push(args[2]);
        return true;
    }

    end_function_scope(args: Uint32Array, length: number): boolean
    {
        this.call_stack.pop();
        return true;
    }

    handle(op: Op, args: Uint32Array, length: number): boolean
    {
        if (op === Op.OpBeginInvocationInterlockEXT || op === Op.OpEndInvocationInterlockEXT)
        {
            if (this.interlock_function_id != 0 && this.interlock_function_id !== this.call_stack[this.call_stack.length - 1])
            {
                // Most complex case, we have no sensible way of dealing with this
                // other than taking the 100% conservative approach, exit early.
                this.split_function_case = true;
                return false;
            }
            else
            {
                const compiler = this.compiler;
                this.interlock_function_id = this.call_stack[this.call_stack.length - 1];
                // If this call is performed inside control flow we have a problem.
                const cfg = compiler.get_cfg_for_function(this.interlock_function_id);

                const from_block_id = compiler.get<SPIRFunction>(SPIRFunction, this.interlock_function_id).entry_block;
                const outside_control_flow = cfg.node_terminates_control_flow_in_sub_graph(from_block_id, this.current_block_id);
                if (!outside_control_flow)
                    this.control_flow_interlock = true;
            }
        }
        return true;
    }

}