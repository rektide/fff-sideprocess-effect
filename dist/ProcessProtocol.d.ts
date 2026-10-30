import type { InventoryCandidate } from "@ff-labs/fff-effect";
import { Schema } from "effect";
import type { LexicalEntry } from "effect-watch-plus/inventory";
export declare const VERSION = 1;
export declare const MAX_FRAME: number;
export declare const MAX_CHUNK_ROWS = 1024;
export declare const MAX_CHUNK_BYTES: number;
export declare const BASELINE_OVERHEAD: number;
export declare const files: Schema.Struct<{
    readonly items: Schema.mutable<Schema.$Array<Schema.Struct<{
        readonly relativePath: Schema.String;
        readonly fileName: Schema.String;
        readonly size: Schema.Number;
        readonly modified: Schema.Number;
        readonly accessFrecencyScore: Schema.Number;
        readonly modificationFrecencyScore: Schema.Number;
        readonly totalFrecencyScore: Schema.Number;
        readonly gitStatus: Schema.String;
    }>>>;
    readonly scores: Schema.mutable<Schema.$Array<Schema.Struct<{
        readonly total: Schema.Number;
        readonly baseScore: Schema.Number;
        readonly filenameBonus: Schema.Number;
        readonly specialFilenameBonus: Schema.Number;
        readonly frecencyBoost: Schema.Number;
        readonly distancePenalty: Schema.Number;
        readonly currentFilePenalty: Schema.Number;
        readonly comboMatchBoost: Schema.Number;
        readonly exactMatch: Schema.Boolean;
        readonly matchType: Schema.String;
    }>>>;
    readonly totalMatched: Schema.Number;
    readonly totalFiles: Schema.Number;
    readonly location: Schema.optionalKey<Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"line">;
        readonly line: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"position">;
        readonly line: Schema.Number;
        readonly col: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"range">;
        readonly start: Schema.Struct<{
            readonly line: Schema.Number;
            readonly col: Schema.Number;
        }>;
        readonly end: Schema.Struct<{
            readonly line: Schema.Number;
            readonly col: Schema.Number;
        }>;
    }>]>>;
}>;
export declare const directories: Schema.Struct<{
    readonly items: Schema.mutable<Schema.$Array<Schema.Struct<{
        readonly relativePath: Schema.String;
        readonly dirName: Schema.String;
        readonly maxAccessFrecency: Schema.Number;
    }>>>;
    readonly scores: Schema.mutable<Schema.$Array<Schema.Struct<{
        readonly total: Schema.Number;
        readonly baseScore: Schema.Number;
        readonly filenameBonus: Schema.Number;
        readonly specialFilenameBonus: Schema.Number;
        readonly frecencyBoost: Schema.Number;
        readonly distancePenalty: Schema.Number;
        readonly currentFilePenalty: Schema.Number;
        readonly comboMatchBoost: Schema.Number;
        readonly exactMatch: Schema.Boolean;
        readonly matchType: Schema.String;
    }>>>;
    readonly totalMatched: Schema.Number;
    readonly totalDirs: Schema.Number;
}>;
export declare const mixed: Schema.Struct<{
    readonly items: Schema.mutable<Schema.$Array<Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"file">;
        readonly item: Schema.Struct<{
            readonly relativePath: Schema.String;
            readonly fileName: Schema.String;
            readonly size: Schema.Number;
            readonly modified: Schema.Number;
            readonly accessFrecencyScore: Schema.Number;
            readonly modificationFrecencyScore: Schema.Number;
            readonly totalFrecencyScore: Schema.Number;
            readonly gitStatus: Schema.String;
        }>;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"directory">;
        readonly item: Schema.Struct<{
            readonly relativePath: Schema.String;
            readonly dirName: Schema.String;
            readonly maxAccessFrecency: Schema.Number;
        }>;
    }>]>>>;
    readonly scores: Schema.mutable<Schema.$Array<Schema.Struct<{
        readonly total: Schema.Number;
        readonly baseScore: Schema.Number;
        readonly filenameBonus: Schema.Number;
        readonly specialFilenameBonus: Schema.Number;
        readonly frecencyBoost: Schema.Number;
        readonly distancePenalty: Schema.Number;
        readonly currentFilePenalty: Schema.Number;
        readonly comboMatchBoost: Schema.Number;
        readonly exactMatch: Schema.Boolean;
        readonly matchType: Schema.String;
    }>>>;
    readonly totalMatched: Schema.Number;
    readonly totalFiles: Schema.Number;
    readonly totalDirs: Schema.Number;
    readonly location: Schema.optionalKey<Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"line">;
        readonly line: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"position">;
        readonly line: Schema.Number;
        readonly col: Schema.Number;
    }>, Schema.Struct<{
        readonly type: Schema.Literal<"range">;
        readonly start: Schema.Struct<{
            readonly line: Schema.Number;
            readonly col: Schema.Number;
        }>;
        readonly end: Schema.Struct<{
            readonly line: Schema.Number;
            readonly col: Schema.Number;
        }>;
    }>]>>;
}>;
export declare const applied: Schema.Struct<{
    readonly type: Schema.Literal<"applied">;
    readonly outcome: Schema.Union<readonly [Schema.Struct<{
        readonly type: Schema.Literal<"applied">;
    }>, Schema.Struct<{
        readonly type: Schema.Literals<readonly ["needs-baseline", "failed"]>;
        readonly reason: Schema.String;
        readonly mutated: Schema.Boolean;
    }>]>;
    readonly repairRequired: Schema.NullOr<Schema.String>;
}>;
export declare const accepted: Schema.Struct<{
    readonly type: Schema.Literal<"accepted">;
}>;
export declare const ready: Schema.Struct<{
    readonly type: Schema.Literal<"ready">;
}>;
export declare const refreshed: Schema.Struct<{
    readonly type: Schema.Literal<"refreshed">;
}>;
export declare const reply: Schema.fromJsonString<Schema.Union<readonly [Schema.Struct<{
    readonly version: Schema.Literal<1>;
    readonly id: Schema.Number;
    readonly ok: Schema.Literal<true>;
    readonly value: Schema.Unknown;
}>, Schema.Struct<{
    readonly version: Schema.Literal<1>;
    readonly id: Schema.Number;
    readonly ok: Schema.Literal<false>;
    readonly error: Schema.String;
}>]>>;
export declare function encodeFrame(value: unknown): Uint8Array;
export declare class Frames {
    header: Uint8Array<ArrayBuffer>;
    headerSize: number;
    body: Uint8Array | undefined;
    bodySize: number;
    push(bytes: Uint8Array): Uint8Array | undefined;
}
export declare function candidate(entry: LexicalEntry): InventoryCandidate;
//# sourceMappingURL=ProcessProtocol.d.ts.map