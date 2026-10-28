/**
 * The WHATWG URL parser: pure, and global in every runtime core runs in. Declared
 * here rather than taking @types/node, which would also make `node:fs` and the
 * rest of Node type-check in a package that must not use them.
 */
declare class URL {
  constructor(input: string, base?: string);
  readonly protocol: string;
  readonly hostname: string;
}
