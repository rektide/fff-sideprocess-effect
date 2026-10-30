import type {
  DirSearchOptions,
  InventoryCandidate,
  MembershipChange,
  NativeFactory,
  NativePicker,
  SearchOptions,
} from "@ff-labs/fff-effect";
import { ProjectionError } from "@ff-labs/fff-effect";
import { Deferred, Effect, Exit, Fiber, Schema, Scope, Semaphore, Stream } from "effect";
import { ChildProcess } from "effect/process";
import type { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import {
  accepted,
  applied,
  BASELINE_OVERHEAD,
  candidate,
  directories,
  encodeFrame,
  Frames,
  files,
  MAX_CHUNK_BYTES,
  MAX_CHUNK_ROWS,
  mixed,
  ready,
  refreshed,
  reply,
  VERSION,
} from "./ProcessProtocol.ts";

export interface ProcessOptions {
  readonly executable: string;
  readonly parentPid: number;
}
export type ProcessSpawner = Pick<ChildProcessSpawner["Service"], "spawn">;

export function fromProcess(
  options: ProcessOptions,
  spawner: ProcessSpawner,
): NativeFactory {
  const encoder = new TextEncoder();
  return {
    createScoped: (profile, entries, bounds) =>
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const maxRows = bounds?.maxRows ?? 1_000_000;
          const maxBytes = bounds?.maxBytes ?? 64 * 1024 * 1024;
          if (
            !options.executable.startsWith("/") ||
            options.executable.includes("\0") ||
            !Number.isSafeInteger(options.parentPid) ||
            options.parentPid <= 1 ||
            !Number.isSafeInteger(maxRows) ||
            maxRows <= 0 ||
            maxRows > 1_000_000 ||
            !Number.isSafeInteger(maxBytes) ||
            maxBytes <= 0 ||
            maxBytes > 64 * 1024 * 1024
          )
            return yield* new ProjectionError({
              reason: "configuration",
              message: "Invalid process executable, parent PID or creation bounds",
            });
          if (entries.length > maxRows)
            return yield* new ProjectionError({
              reason: "budget",
              message: "Baseline candidate budget exceeded",
            });
          if (maxBytes < BASELINE_OVERHEAD)
            return yield* new ProjectionError({
              reason: "budget",
              message: "Native creation byte budget exceeded",
            });
          const owner = yield* Scope.make();
          const child = yield* spawner
            .spawn(
              ChildProcess.make(
                options.executable,
                ["--parent-pid", String(options.parentPid)],
                {
                  stdin: { stream: "pipe", endOnDone: false },
                  stdout: "pipe",
                  stderr: "pipe",
                },
              ),
            )
            .pipe(
              Scope.provide(owner),
              Effect.mapError((cause) =>
                nativeError("Could not spawn sideprocess executable", cause),
              ),
              Effect.onError(() => Scope.close(owner, Exit.void)),
            );
          const lane = yield* Semaphore.make(1);
          let closed = false;
          let failure: ProjectionError | undefined;
          let nextId = 0;
          let diagnostics = new Uint8Array(0);
          let pending:
            | { id: number; reply: Deferred.Deferred<unknown, ProjectionError> }
            | undefined;
          const fail = (error: ProjectionError) =>
            Effect.sync(() => {
              failure ??= error;
              if (pending) Deferred.doneUnsafe(pending.reply, Effect.fail(failure));
            });
          const close = yield* Effect.cached(
            Effect.gen(function* () {
              closed = true;
              yield* fail(
                new ProjectionError({
                  reason: "closed",
                  message: "Sideprocess is closed",
                }),
              );
              const killed = yield* child
                .kill({ killSignal: "SIGKILL" })
                .pipe(Effect.result);
              if (killed._tag === "Failure") {
                const running = yield* child.isRunning.pipe(Effect.orDie);
                if (running)
                  return yield* Effect.die(
                    nativeError(
                      "Sideprocess termination failed; exit is unverified",
                      killed.failure,
                    ),
                  );
              }
              const exited = yield* child.exitCode.pipe(Effect.result);
              if (exited._tag === "Failure") {
                // Some spawners report signal exit as failure after observing completion.
                const running = yield* child.isRunning.pipe(
                  Effect.mapError((cause) =>
                    nativeError("Could not verify sideprocess exit", cause),
                  ),
                  Effect.orDie,
                );
                if (running)
                  return yield* Effect.die(
                    nativeError("Sideprocess exit could not be verified", exited.failure),
                  );
              }
              yield* Scope.close(owner, Exit.void);
            }).pipe(Effect.uninterruptible, Effect.withSpan("Fff.sideprocess.close")),
          );
          yield* Effect.addFinalizer(() => close);
          const frames = new Frames();
          yield* child.stderr.pipe(
            Stream.runForEach((bytes) =>
              Effect.sync(() => {
                const tail = bytes.subarray(Math.max(0, bytes.length - 16 * 1024));
                const kept = diagnostics.subarray(
                  Math.max(0, diagnostics.length + tail.length - 16 * 1024),
                );
                const next = new Uint8Array(kept.length + tail.length);
                next.set(kept);
                next.set(tail, kept.length);
                diagnostics = next;
              }),
            ),
            Effect.catch((cause) =>
              fail(nativeError("Sideprocess stderr failed", cause)),
            ),
            Effect.forkIn(owner, { uninterruptible: false }),
          );
          yield* child.stdout.pipe(
            Stream.runForEach((bytes) =>
              Effect.gen(function* () {
                const payload = yield* Effect.try({
                  try: () => frames.push(bytes),
                  catch: (cause) => nativeError("Invalid sideprocess reply frame", cause),
                });
                if (!payload) return;
                const text = yield* Effect.try({
                  try: () => new TextDecoder("utf-8", { fatal: true }).decode(payload),
                  catch: (cause) => nativeError("Invalid sideprocess UTF-8", cause),
                });
                const value = yield* Schema.decodeUnknownEffect(reply)(text).pipe(
                  Effect.mapError((cause) =>
                    nativeError("Invalid sideprocess reply", cause),
                  ),
                );
                if (!pending || pending.id !== value.id)
                  return yield* nativeError("Sideprocess reply identity mismatch");
                const waiting = pending;
                pending = undefined;
                yield* Deferred.completeWith(
                  waiting.reply,
                  value.ok
                    ? Effect.succeed(value.value)
                    : Effect.fail(nativeError(value.error)),
                );
              }),
            ),
            Effect.andThen(() =>
              fail(
                nativeError(
                  "Sideprocess stdout ended",
                  new TextDecoder().decode(diagnostics),
                ),
              ),
            ),
            Effect.catch((cause) =>
              fail(
                cause instanceof ProjectionError
                  ? cause
                  : nativeError("Sideprocess stdout failed", cause),
              ),
            ),
            Effect.forkIn(owner, { uninterruptible: false }),
          );
          yield* child.exitCode.pipe(
            Effect.result,
            Effect.flatMap((exit) => fail(nativeError("Sideprocess exited", exit))),
            Effect.forkIn(owner, { uninterruptible: false }),
          );

          const exchange = Effect.fnUntraced(function* (command: object) {
            if (closed || failure)
              return yield* failure ?? nativeError("Sideprocess is closed");
            const id = nextId + 1;
            const deferred = yield* Deferred.make<unknown, ProjectionError>();
            const frame = yield* Effect.try({
              try: () => encodeFrame({ version: VERSION, id, ...command }),
              catch: (cause) => nativeError("Sideprocess request encoding failed", cause),
            });
            nextId = id;
            pending = { id, reply: deferred };
            yield* Stream.make(frame).pipe(
              Stream.run(child.stdin),
              Effect.mapError((cause) => nativeError("Sideprocess stdin failed", cause)),
              Effect.tapError(fail),
            );
            return yield* Deferred.await(deferred);
          });
          const call = <S extends Schema.ConstraintDecoder<unknown>>(
            command: object,
            schema: S,
          ) =>
            Effect.uninterruptibleMask((resume) =>
              Effect.gen(function* () {
                yield* resume(lane.take(1));
                if (closed || failure) {
                  yield* lane.release(1);
                  return yield* failure ?? nativeError("Sideprocess is closed");
                }
                const work = yield* exchange(command).pipe(
                  Effect.flatMap((value) =>
                    Schema.decodeUnknownEffect(schema)(value).pipe(
                      Effect.mapError((cause) =>
                        nativeError("Invalid sideprocess result", cause),
                      ),
                      Effect.tapError(fail),
                    ),
                  ),
                  Effect.ensuring(lane.release(1)),
                  Effect.forkIn(owner, { uninterruptible: false }),
                );
                return yield* resume(Fiber.join(work));
              }),
            );
          yield* restore(
            Effect.gen(function* () {
              yield* call(
                {
                  op: "baseline-start",
                  root: profile.root,
                  aiMode: profile.aiMode,
                  maxRows,
                  maxBytes,
                },
                accepted,
              );
              let index = 0;
              let total = BASELINE_OVERHEAD;
              while (index < entries.length) {
                const chunk: InventoryCandidate[] = [];
                let bytes = 2;
                while (index < entries.length && chunk.length < MAX_CHUNK_ROWS) {
                  const entry = entries[index]!;
                  if (entry.path.length >= 4096)
                    return yield* nativeError("Candidate path exceeds native bounds");
                  const row = candidate(entry);
                  const size =
                    encoder.encode(JSON.stringify(row)).length + (chunk.length ? 1 : 0);
                  if (chunk.length && bytes + size > MAX_CHUNK_BYTES) break;
                  if (bytes + size > MAX_CHUNK_BYTES)
                    return yield* nativeError("Candidate exceeds process chunk bounds");
                  bytes += size;
                  chunk.push(row);
                  index++;
                }
                total += bytes - 2 + (index > chunk.length ? 1 : 0);
                if (total > maxBytes)
                  return yield* new ProjectionError({
                    reason: "budget",
                    message: "Native creation byte budget exceeded",
                  });
                // Only one bounded chunk is encoded; each acknowledgement supplies backpressure.
                yield* call({ op: "baseline-chunk", entries: chunk }, accepted);
              }
              yield* call({ op: "baseline-end" }, ready);
            }),
          ).pipe(
            Effect.mapError((cause) =>
              cause instanceof ProjectionError
                ? cause
                : nativeError("Baseline encoding failed", cause),
            ),
            Effect.onExit((exit) => (Exit.isFailure(exit) ? close : Effect.void)),
          );
          return {
            find: (query: string, search?: SearchOptions) =>
              call({ op: "search", kind: "file", query, options: search ?? {} }, files),
            findDirectories: (query: string, search?: DirSearchOptions) =>
              call(
                { op: "search", kind: "directory", query, options: search ?? {} },
                directories,
              ),
            findMixed: (query: string, search?: SearchOptions) =>
              call({ op: "search", kind: "mixed", query, options: search ?? {} }, mixed),
            apply: (changes: readonly MembershipChange[]) =>
              call({ op: "apply", changes }, applied).pipe(
                Effect.map((receipt) => ({
                  outcome: receipt.outcome,
                  repairRequired: receipt.repairRequired,
                })),
              ),
            refreshGit: call({ op: "refresh-git" }, refreshed).pipe(Effect.asVoid),
            close,
          } satisfies NativePicker;
        }),
      ).pipe(Effect.withSpan("Fff.sideprocess.create")),
  };
}

function nativeError(message: string, cause?: unknown): ProjectionError {
  return new ProjectionError({
    reason: "native",
    message,
    ...(cause === undefined ? {} : { cause }),
  });
}
