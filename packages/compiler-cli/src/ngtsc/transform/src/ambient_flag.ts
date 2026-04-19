/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import ts from 'typescript';

/**
 * The numeric value of `ts.NodeFlags.Ambient` (1 << 25).
 *
 * `NodeFlags` is a `const enum` and may be erased in some bundling
 * configurations, so we access it defensively with a hardcoded fallback.
 *
 * @see https://github.com/microsoft/TypeScript/blob/main/src/compiler/types.ts
 */
export const TS_NODE_FLAGS_AMBIENT: number = (ts.NodeFlags as any)['Ambient'] ?? 1 << 25;

/**
 * Copies the `Ambient` flag from `source` to `target` if present.
 *
 * `ts.factory.create*` / `ts.factory.update*` do not preserve `NodeFlags`.
 * A `declare` property carries `NodeFlags.Ambient`, and losing it causes
 * TypeScript to emit `this.prop = undefined`, overwriting the parent-class
 * initializer at runtime (see https://github.com/angular/angular/issues/68069).
 */
export function preserveAmbientFlag<T extends ts.Node>(source: ts.Node, target: T): T {
  if (source.flags & TS_NODE_FLAGS_AMBIENT) {
    (target as any).flags |= TS_NODE_FLAGS_AMBIENT;
  }
  return target;
}
