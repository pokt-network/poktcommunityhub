/**
 * The rollback line tools/deploy.mjs prints, as a pure function so it can be
 * tested without an ssh host.
 *
 * A service that is new in this release has no image tagged for the previous
 * commit. Retagging it would fail and stop the whole line (phase 6's printed
 * rollback did exactly that for the worker), so it is stopped and removed
 * instead, and `up` names only the services the previous release ran.
 *
 * @param {{
 *   host: string,
 *   dir: string,
 *   compose: string,
 *   image: (service: string, tag: string) => string,
 *   previousShort: string,
 *   services: string[],
 *   previousServices: string[],
 * }} options `previousServices` is the subset of `services` with an image
 *   tagged `previousShort` on the host.
 * @returns {string}
 */
export function rollbackCommand({
  host,
  dir,
  compose,
  image,
  previousShort,
  services,
  previousServices,
}) {
  const kept = services.filter((service) => previousServices.includes(service));
  const added = services.filter((service) => !previousServices.includes(service));
  const steps = [
    `cd ${dir}`,
    ...kept.map(
      (service) => `docker tag ${image(service, previousShort)} ${image(service, 'latest')}`,
    ),
    ...(added.length > 0 ? [`${compose} rm -sf ${added.join(' ')}`] : []),
    `${compose} up -d --no-build ${kept.join(' ')}`.trimEnd(),
    'cp DEPLOYED_COMMIT.prev DEPLOYED_COMMIT',
  ];
  return `ssh ${host} "${steps.join(' && ')}"`;
}
