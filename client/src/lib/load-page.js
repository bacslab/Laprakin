import { lazy } from 'react';

export function loadPage(moduleLoader) {
  return lazy(async () => {
    const module = await moduleLoader();
    return { default: module.default || module };
  });
}
