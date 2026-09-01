import { useEffect } from 'react';

export function useFocusTrap(containerRef, enabled = true) {
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const focusable = [...container.querySelectorAll('a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hidden && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [containerRef, enabled]);
}
