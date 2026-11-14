import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null,
  );
}

/**
 * Shared focus trap for modal dialogs (lightbox, dialogs).
 *
 * While `active`, Tab cycles inside `containerRef`, Escape calls `onEscape`,
 * and focus starts on the container itself (it should carry tabIndex={-1}).
 * On deactivation/unmount, focus returns to whatever had it before the
 * dialog opened (the trigger), unless `returnFocus` is false.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options?: { onEscape?: () => void; returnFocus?: boolean },
) {
  const onEscapeRef = useRef(options?.onEscape);
  const returnFocus = options?.returnFocus !== false;

  // Keep the latest onEscape in a ref (synced every render) so the trap
  // effect below never depends on the caller's — usually inline — callback
  // identity, which would re-run the trap (and steal focus) on each render.
  useEffect(() => {
    onEscapeRef.current = options?.onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    container.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableElements(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      if (returnFocus && previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef, returnFocus]);
}
