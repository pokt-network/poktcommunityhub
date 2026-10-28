/**
 * Ids arrive in URLs and forms as untrusted strings. Postgres rejects a
 * malformed uuid with an error, not a miss, so check before asking: a bad id
 * is a 404, not a 500.
 */
export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
