import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const RouterContext = createContext(null);
const NAVIGATION_EVENT = 'laprakin:navigation';

function currentLocation() {
  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
    state: window.history.state,
  };
}

function internalTarget(to) {
  const value = String(to || '').trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  const parsed = new URL(value, window.location.origin);
  if (parsed.origin !== window.location.origin) return '/';
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function BrowserRouter({ children }) {
  const [location, setLocation] = useState(currentLocation);

  useEffect(() => {
    const update = () => setLocation(currentLocation());
    window.addEventListener('popstate', update);
    window.addEventListener(NAVIGATION_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAVIGATION_EVENT, update);
    };
  }, []);

  const navigate = useCallback((to, options = {}) => {
    const target = internalTarget(to);
    const active = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (target === active) return;
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method](options.state ?? null, '', target);
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter() {
  const router = useContext(RouterContext);
  if (!router) throw new Error('Router harus dipasang di atas komponen aplikasi.');
  return router;
}

export function useNavigate() {
  return useRouter().navigate;
}

export function useLocation() {
  return useRouter().location;
}

export function Link({ to, replace = false, state = null, onClick, target, children, ...props }) {
  const navigate = useNavigate();
  const href = internalTarget(to);
  const handleClick = (event) => {
    onClick?.(event);
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || (target && target !== '_self')
    ) return;
    event.preventDefault();
    navigate(href, { replace, state });
  };
  return <a {...props} href={href} target={target} onClick={handleClick}>{children}</a>;
}

export function Navigate({ to, replace = false, state = null }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace, state });
  }, [navigate, replace, state, to]);
  return null;
}

export function Route() {
  return null;
}

function routeMatches(pattern, pathname) {
  if (pattern === '*') return true;
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2);
    return pathname === base || pathname.startsWith(`${base}/`);
  }
  return pathname === pattern;
}

export function Routes({ children }) {
  const { pathname } = useLocation();
  const routes = Children.toArray(children);
  const match = routes.find((route) => routeMatches(route.props.path, pathname));
  return match?.props.element ?? null;
}
