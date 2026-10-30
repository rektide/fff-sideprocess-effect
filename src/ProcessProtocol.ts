import type { InventoryCandidate } from "@ff-labs/fff-effect";
import { Schema } from "effect";
import type { LexicalEntry } from "effect-watch-plus/inventory";

export const VERSION = 1;
const encoder = new TextEncoder();
export const MAX_FRAME = 8 * 1024 * 1024;
export const MAX_CHUNK_ROWS = 1024;
export const MAX_CHUNK_BYTES = 256 * 1024;
export const BASELINE_OVERHEAD = new TextEncoder().encode(
  '{"version":1,"entries":[]}',
).byteLength;

const score = Schema.Struct({
  total: Schema.Number,
  baseScore: Schema.Number,
  filenameBonus: Schema.Number,
  specialFilenameBonus: Schema.Number,
  frecencyBoost: Schema.Number,
  distancePenalty: Schema.Number,
  currentFilePenalty: Schema.Number,
  comboMatchBoost: Schema.Number,
  exactMatch: Schema.Boolean,
  matchType: Schema.String,
});
const file = Schema.Struct({
  relativePath: Schema.String,
  fileName: Schema.String,
  size: Schema.Number,
  modified: Schema.Number,
  accessFrecencyScore: Schema.Number,
  modificationFrecencyScore: Schema.Number,
  totalFrecencyScore: Schema.Number,
  gitStatus: Schema.String,
});
const directory = Schema.Struct({
  relativePath: Schema.String,
  dirName: Schema.String,
  maxAccessFrecency: Schema.Number,
});
const position = Schema.Struct({ line: Schema.Number, col: Schema.Number });
const location = Schema.Union([
  Schema.Struct({ type: Schema.Literal("line"), line: Schema.Number }),
  Schema.Struct({
    type: Schema.Literal("position"),
    line: Schema.Number,
    col: Schema.Number,
  }),
  Schema.Struct({ type: Schema.Literal("range"), start: position, end: position }),
]);
export const files = Schema.Struct({
  items: Schema.mutable(Schema.Array(file)),
  scores: Schema.mutable(Schema.Array(score)),
  totalMatched: Schema.Number,
  totalFiles: Schema.Number,
  location: Schema.optionalKey(location),
});
export const directories = Schema.Struct({
  items: Schema.mutable(Schema.Array(directory)),
  scores: Schema.mutable(Schema.Array(score)),
  totalMatched: Schema.Number,
  totalDirs: Schema.Number,
});
export const mixed = Schema.Struct({
  items: Schema.mutable(
    Schema.Array(
      Schema.Union([
        Schema.Struct({ type: Schema.Literal("file"), item: file }),
        Schema.Struct({ type: Schema.Literal("directory"), item: directory }),
      ]),
    ),
  ),
  scores: Schema.mutable(Schema.Array(score)),
  totalMatched: Schema.Number,
  totalFiles: Schema.Number,
  totalDirs: Schema.Number,
  location: Schema.optionalKey(location),
});
export const applied = Schema.Struct({
  type: Schema.Literal("applied"),
  outcome: Schema.Union([
    Schema.Struct({ type: Schema.Literal("applied") }),
    Schema.Struct({
      type: Schema.Literals(["needs-baseline", "failed"]),
      reason: Schema.String,
      mutated: Schema.Boolean,
    }),
  ]),
  repairRequired: Schema.NullOr(Schema.String),
});
export const accepted = Schema.Struct({ type: Schema.Literal("accepted") });
export const ready = Schema.Struct({ type: Schema.Literal("ready") });
export const refreshed = Schema.Struct({ type: Schema.Literal("refreshed") });
export const reply = Schema.fromJsonString(
  Schema.Union([
    Schema.Struct({
      version: Schema.Literal(VERSION),
      id: Schema.Number,
      ok: Schema.Literal(true),
      value: Schema.Unknown,
    }),
    Schema.Struct({
      version: Schema.Literal(VERSION),
      id: Schema.Number,
      ok: Schema.Literal(false),
      error: Schema.String,
    }),
  ]),
);

export function encodeFrame(value: unknown): Uint8Array {
  const payload = encoder.encode(JSON.stringify(value));
  if (!payload.length || payload.length > MAX_FRAME)
    throw new Error("Request exceeds process frame budget");
  const frame = new Uint8Array(payload.length + 4);
  new DataView(frame.buffer).setUint32(0, payload.length);
  frame.set(payload, 4);
  return frame;
}

export class Frames {
  header = new Uint8Array(4);
  headerSize = 0;
  body: Uint8Array | undefined;
  bodySize = 0;

  push(bytes: Uint8Array): Uint8Array | undefined {
    let offset = 0;
    let completed: Uint8Array | undefined;
    while (offset < bytes.length) {
      if (!this.body) {
        const size = Math.min(4 - this.headerSize, bytes.length - offset);
        this.header.set(bytes.subarray(offset, offset + size), this.headerSize);
        offset += size;
        this.headerSize += size;
        if (this.headerSize < 4) continue;
        const length = new DataView(this.header.buffer).getUint32(0);
        if (!length || length > MAX_FRAME)
          throw new Error("Invalid process reply frame length");
        this.body = new Uint8Array(length);
      }
      const size = Math.min(this.body.length - this.bodySize, bytes.length - offset);
      this.body.set(bytes.subarray(offset, offset + size), this.bodySize);
      offset += size;
      this.bodySize += size;
      if (this.bodySize < this.body.length) continue;
      if (completed) throw new Error("Unsolicited process reply");
      completed = this.body;
      this.headerSize = 0;
      this.bodySize = 0;
      this.body = undefined;
    }
    return completed;
  }
}

export function candidate(entry: LexicalEntry): InventoryCandidate {
  return {
    relativePath: entry.path,
    kind:
      entry.type === "File"
        ? "file"
        : entry.type === "Directory"
          ? "directory"
          : entry.type === "SymbolicLink"
            ? "symlink"
            : "other",
    ...(entry.size !== undefined && entry.mtimeMs !== undefined
      ? {
          metadata: {
            size: entry.size,
            modified: Math.max(0, Math.floor(entry.mtimeMs / 1000)),
          },
        }
      : {}),
  };
}
