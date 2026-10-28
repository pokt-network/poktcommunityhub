/**
 * The images this repository builds, named ONCE and imported by the deploy and
 * its tests. The Agentic Portal kept this list in four places and shipped a
 * stale image for two releases when one was missed; images.test.mjs holds this
 * list to what docker-compose.yml actually builds.
 */

/** Long-running services: built, tagged per commit, asserted, retagged on rollback. */
export const APP_SERVICES = ['web'];

/** Run-once tools (compose profile `tools`): built and asserted, never left running. */
export const TOOL_SERVICES = ['migrate'];

export const BUILT_SERVICES = [...APP_SERVICES, ...TOOL_SERVICES];
