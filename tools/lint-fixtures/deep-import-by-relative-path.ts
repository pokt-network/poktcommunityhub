// Must FAIL lint: crosses into another package by relative path (tools/verify-boundaries.mjs).
export { createPool } from '../../packages/store/src/pool.js';
