export function resolveReducedMotion(userPreference = false, systemPreference = false) {
  return Boolean(userPreference || systemPreference);
}
