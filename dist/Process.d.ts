import type { NativeFactory } from "@ff-labs/fff-effect";
import type { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
export interface ProcessOptions {
    readonly executable: string;
    readonly parentPid: number;
}
export type ProcessSpawner = Pick<ChildProcessSpawner["Service"], "spawn">;
export declare function fromProcess(options: ProcessOptions, spawner: ProcessSpawner): NativeFactory;
//# sourceMappingURL=Process.d.ts.map