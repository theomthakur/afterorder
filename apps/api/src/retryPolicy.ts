const safeAutomaticRetrySteps = new Set(['validate', 'source', 'reserve']);

export const automaticRetryLimit = 2;

export function shouldRetryAutomatically(step: string, attempts: number) {
  return safeAutomaticRetrySteps.has(step) && attempts < automaticRetryLimit;
}

export function automaticRetryDelay(attempts: number) {
  return Math.min(4_000, 750 * 2 ** attempts);
}
