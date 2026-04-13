/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Observable, Subscription} from 'rxjs';
import {
  assertInInjectionContext,
  BaseResourceOptions,
  resource,
  ResourceLoaderParams,
  ResourceParamsContext,
  ResourceRef,
  ResourceStreamItem,
  Signal,
  signal,
  ɵRuntimeError,
  ɵRuntimeErrorCode,
} from '../../src/core';
import {encapsulateResourceError} from '../../src/resource/resource';

/**
 * Like `ResourceOptions` but uses an RxJS-based `loader`.
 *
 * @experimental
 */
export interface RxResourceOptions<T, R> extends BaseResourceOptions<T, R> {
  stream: (params: ResourceLoaderParams<R>) => Observable<T>;
}

/**
 * Overload for when `params` may be `undefined` at runtime (e.g. `params: getParams()` where
 * `getParams()` returns `(() => R) | undefined`). The stream receives `null` for `params`
 * when the params function is absent.
 *
 * @experimental
 */
export function rxResource<T, R, P extends ((ctx: ResourceParamsContext) => R) | undefined>(
  opts: RxResourceOptions<T, R | null> & {params: P; defaultValue: NoInfer<T>} & ([
      undefined,
    ] extends [P]
      ? {}
      : never) &
    ([P] extends [undefined] ? never : {}),
): ResourceRef<T>;

/**
 * Overload for when `params` may be `undefined` at runtime (e.g. `params: getParams()` where
 * `getParams()` returns `(() => R) | undefined`). The stream receives `null` for `params`
 * when the params function is absent.
 *
 * @experimental
 */
export function rxResource<T, R, P extends ((ctx: ResourceParamsContext) => R) | undefined>(
  opts: RxResourceOptions<T, R | null> & {params: P} & ([undefined] extends [P] ? {} : never) &
    ([P] extends [undefined] ? never : {}),
): ResourceRef<T | undefined>;

/**
 * Like `resource` but uses an RxJS based `loader` which maps the request to an `Observable` of the
 * resource's value.
 *
 * This overload handles the case when `params` is explicitly `undefined`. The stream receives
 * `R | null` for `params`.
 *
 * @experimental
 */
export function rxResource<T, R = null>(
  opts: RxResourceOptions<T, R | null> & {params: undefined; defaultValue: NoInfer<T>},
): ResourceRef<T>;

/**
 * Like `resource` but uses an RxJS based `loader` which maps the request to an `Observable` of the
 * resource's value.
 *
 * This overload handles the case when `params` is explicitly `undefined`. The stream receives
 * `R | null` for `params`.
 *
 * @experimental
 */
export function rxResource<T, R = null>(
  opts: RxResourceOptions<T, R | null> & {params: undefined},
): ResourceRef<T | undefined>;

/**
 * Like `resource` but uses an RxJS based `loader` which maps the request to an `Observable` of the
 * resource's value.
 *
 * @see [Using rxResource for async data](ecosystem/rxjs-interop#using-rxresource-for-async-data)
 *
 * @experimental
 */
export function rxResource<T, R = null>(
  opts: RxResourceOptions<T, R> & {defaultValue: NoInfer<T>} & ([R] extends [null]
      ? {}
      : {params: (ctx: ResourceParamsContext) => R}),
): ResourceRef<T>;

/**
 * Like `resource` but uses an RxJS based `loader` which maps the request to an `Observable` of the
 * resource's value.
 *
 * @experimental
 */
export function rxResource<T, R = null>(
  opts: RxResourceOptions<T, R> &
    ([R] extends [null] ? {} : {params: (ctx: ResourceParamsContext) => R}),
): ResourceRef<T | undefined>;
export function rxResource<T, R>(
  opts: RxResourceOptions<T, R> | RxResourceOptions<T, R | null>,
): ResourceRef<T | undefined> {
  if (ngDevMode && !opts?.injector) {
    assertInInjectionContext(rxResource);
  }
  return (resource as Function)({
    ...(opts as RxResourceOptions<T, R>),
    loader: undefined,
    stream: (params: ResourceLoaderParams<R>) => {
      let sub: Subscription | undefined;

      // Track the abort listener so it can be removed if the Observable completes (as a memory
      // optimization).
      const onAbort = () => sub?.unsubscribe();
      params.abortSignal.addEventListener('abort', onAbort);

      // Start off stream as undefined.
      const stream = signal<ResourceStreamItem<T>>({value: undefined as T});
      let resolve: ((value: Signal<ResourceStreamItem<T>>) => void) | undefined;
      const promise = new Promise<Signal<ResourceStreamItem<T>>>((r) => (resolve = r));

      function send(value: ResourceStreamItem<T>): void {
        stream.set(value);
        resolve?.(stream);
        resolve = undefined;
      }

      const streamFn = opts.stream;
      if (streamFn === undefined) {
        throw new ɵRuntimeError(
          ɵRuntimeErrorCode.MUST_PROVIDE_STREAM_OPTION,
          ngDevMode && `Must provide \`stream\` option.`,
        );
      }

      sub = streamFn(params).subscribe({
        next: (value) => send({value}),
        error: (error: unknown) => {
          send({error: encapsulateResourceError(error)});
          params.abortSignal.removeEventListener('abort', onAbort);
        },
        complete: () => {
          if (resolve) {
            send({
              error: new ɵRuntimeError(
                ɵRuntimeErrorCode.RESOURCE_COMPLETED_BEFORE_PRODUCING_VALUE,
                ngDevMode && 'Resource completed before producing a value',
              ),
            });
          }
          params.abortSignal.removeEventListener('abort', onAbort);
        },
      });

      if (resolve === undefined) {
        return stream;
      }

      return promise;
    },
  });
}
