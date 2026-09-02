export function localizeAiDataClasses(dataClasses = [], t = (key) => key) {
  return [...new Set(dataClasses)].map((dataClass) => {
    const key = `workspace.composer.dataClasses.${dataClass}`;
    const localized = t(key);
    return localized === key ? String(dataClass).replaceAll('_', ' ') : localized;
  });
}
