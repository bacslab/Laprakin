import { useCallback } from 'react';
import { useLocation, useNavigate } from '../../../router';
import { buildAdminListLocation, parseAdminListSearch } from './list-query';

export function useAdminListQuery(basePath, defaults = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const query = parseAdminListSearch(location.search, defaults);
  const setQuery = useCallback((patch, options = {}) => {
    const current = parseAdminListSearch(window.location.search, defaults);
    navigate(buildAdminListLocation(basePath, current, patch), { replace: options.replace ?? false });
  }, [basePath, defaults, navigate]);
  return [query, setQuery];
}
