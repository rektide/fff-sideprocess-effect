---
type: LibraryGuide
title: FFF sideprocess Effect adapter
description: Explicit Linux sideprocess execution for the existing shared FFF projection contracts, built as compiled JavaScript and declarations for distribution.
resource: /packages/sideprocess-effect/README.md
status: Native naming and package split locally verified, including packed Node consumption without source files; canonical merge and host integration remain separate
author: GPT-6.1 Sol xhigh
model: openai/gpt-6.1-sol#xhigh
date: 2026-10-30
sources:
  - resource: "opencode://ses_e79c4be63ffegMBm5UFlKy7P6s"
    title: Implement the process backend, apply the final sideprocess names, split the adapter package and verify built-package consumption without source files
  - resource: /doc/external-inventory/process-backend0.sol61x.md
    title: Protocol, native artifact, lifecycle checks and retained parity/Store qualifications
  - resource: /packages/effect/README.md
    title: Unchanged shared controller, binding and operation-scoped retention contracts
  - resource: /packages/sideprocess-effect/src/Process.ts
    title: Injected process capability and scope-owned child lifetime
  - resource: /packages/sideprocess-effect/package.json
    title: Compiled public entrypoint, peer contracts and prepack build
---

# `@ff-labs/fff-sideprocess-effect`

Explicit execution through the **fff-sideprocess** Rust helper. This package
depends on **@ff-labs/fff-effect 0.2.0** for the existing `NativeFactory`,
`NativePicker`, result types and `ProjectionError`. It does not own another
source controller or retention store. `fromBinding`, `makeController` and
`makeStore` remain in the unchanged shared package.

## Use

```ts
import { makeController } from "@ff-labs/fff-effect"
import { fromProcess } from "@ff-labs/fff-sideprocess-effect"
import { ChildProcessSpawner } from "effect/process"

const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
const native = fromProcess({ executable: "/absolute/path/to/fff-sideprocess", parentPid: process.pid }, spawner)
const controller = yield* makeController({ source, root: canonicalRoot, native })
const result = yield* controller.findMixed(query, { pageSize: 20 })
```

The caller supplies the approved source, canonical root and its existing Effect
process service. `parentPid` is the actual spawning process's PID. No concrete
Node platform, Bun native loader or OpenCode runtime is imported by this package.
There is no automatic executable download, build or fallback. Linux is the
currently verified/supported supervision platform.

`fromProcess(options, spawner): NativeFactory` is synchronous and lazy. Each
construction scope owns one persistent child. Caller cancellation abandons its
wait, not an entered operation: that operation drains its reply while holding the
serial lane. Close is idempotent, terminates independently of that lane and
verifies process exit before returning. Unverified cleanup is a defect, not a
successful close. Linux parent-death supervision also works with a blocked
command loop. Existing Git refresh completion and native read semantics remain.

Exports include `ProcessOptions`, `ProcessSpawner`, `NativeFactory`,
`NativePicker`, `NativeProfile`, `NativeCreationBounds`, `ApplyReceipt`,
`ApplyOutcome`, `InventoryCandidate`, `MembershipChange`, `SearchOptions`,
`SearchResult`, `DirSearchOptions`, `DirSearchResult`, `MixedSearchResult`,
`fromProcess` and the shared `ProjectionError` class.

## Built distribution

Ordinary imports resolve to **dist/index.js** with **dist/index.d.ts**. `tsgo`
emits JavaScript, declarations and maps; `prepack` runs that real build. The
explicit `./source` subpath is optional raw TypeScript for source-aware tooling;
Node consumers should use the package root. Local imports in emitted JavaScript
use `.js`, and all shared-library imports use the public `@ff-labs/fff-effect`
entrypoint, never its private source files.

The runtime dependency uses the portable exact version **0.2.0**, not a
`workspace:` specifier. Peer dependencies mirror the shared package: Effect
**4.0.1** and effect-watch-plus **1.0.0**. The latter remains Git-sourced in this
repository's development install; this work does not publish it or the shared
package. Remote consumers must have those compatible dependencies available.

## Build and checks

From the FFF root, after installing `packages/` workspace dependencies:

```sh
mise exec zig@0.16.0 -- make build-sideprocess
make build-sideprocess-effect
(cd packages/sideprocess-effect && bun run typecheck)
mise exec zig@0.16.0 -- make test-sideprocess-effect
mise exec zig@0.16.0 -- make test-sideprocess-effect-runtime
mise exec zig@0.16.0 -- make test-sideprocess-effect-package
```

The build target builds `fff-effect` first, then this package. The native zlob
target requires Zig 0.16.0; `make test-sideprocess` exercises the helper directly.
The adapter tests select the actual binary with `FFF_SIDEPROCESS_TEST_BINARY`
and the private comparison library with `FFF_SIDEPROCESS_TEST_LIBRARY`.

The package-consumer check packs both library packages, extracts them into an
isolated consumer's real `node_modules`, removes their `src` directories, then
runs ordinary Node through their public compiled entrypoints. Already-installed
peer/platform dependencies are linked into that fixture; it is not a claim that
unpublished peers were fetched from a public registry.

**Qualifications remain explicit:** the existing binding reads `exactMatch` at
byte 32 rather than native byte 36, so paired parity excludes only that known
decoder defect. Current shared Store expiry also drops its key before native
close completes; strict capacity-one non-overlap is not established. The
[checkpoint receipt](/doc/external-inventory/process-backend0.sol61x.md) records
these issues, protocol bounds, native identity and verification evidence.
No canonical merge, publication, default switch or host integration is performed
by this package split.
