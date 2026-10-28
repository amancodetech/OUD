import { validateRuntime } from './validate-runtime.mjs';
validateRuntime();
await import('../server.js');
