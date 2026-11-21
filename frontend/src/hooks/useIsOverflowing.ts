import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Reports whether an element's content is clipped vertically.
 *
 * Measured from the rendered box (`scrollHeight` vs `clientHeight`) rather than
 * an assumed character count, so line-clamped text is only flagged when it
 * actually overflows. Re-checks on resize and when `content` changes.
 *
 * While `expanded` is true the checkbox is skipped on purpose: an expanded
 * element is no longer clamped, so it would always look like it fits. Keeping
 * the last measurement lets the "see less" action stay visible.
 */
export function useIsOverflowing(
  ref: RefObject<HTMLElement | null>,
  content: string,
  expanded: boolean,
): boolean {
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;

    const check = () => {
      setIsOverflowing(element.scrollHeight - element.clientHeight > 1);
    };
    check();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, content, expanded]);

  return isOverflowing;
}
