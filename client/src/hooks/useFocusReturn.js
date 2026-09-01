import { useEffect, useRef } from 'react';

export function useFocusReturn(open) {
  const triggerRef = useRef(null);
  const lastOpen = useRef(false);
  useEffect(() => {
    if (open && !lastOpen.current) triggerRef.current = document.activeElement;
    if (!open && lastOpen.current) triggerRef.current?.focus?.();
    lastOpen.current = open;
    return () => {
      if (open) triggerRef.current?.focus?.();
    };
  }, [open]);
  return triggerRef;
}
