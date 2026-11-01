import { AsyncLocalStorage } from 'node:async_hooks';

// The custom Worker and Next's compiled server share this exact request scope.
const key = Symbol.for('oud.request-runtime.v1');
/** @type {AsyncLocalStorage<{connectionString:string, bindings?:any, client?:import('@prisma/client').PrismaClient, memo:Map<string,Promise<unknown>>}>} */
export const requestRuntime = globalThis[key] ??= new AsyncLocalStorage();

export function workerRuntime() { return requestRuntime.getStore(); }
