import type { ActiveJobState } from '../types';

/** Anonymous job capabilities are runtime-only and must not be persisted with history. */
export function stripPersistedJobCapabilities(jobs: ActiveJobState[]): ActiveJobState[] {
  return jobs.map(({ jobCapability: _jobCapability, ...job }) => job);
}
