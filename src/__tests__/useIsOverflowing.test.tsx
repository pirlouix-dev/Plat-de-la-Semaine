import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { useIsOverflowing } from "../hooks/useIsOverflowing";
import {
  installElementGeometryMock,
  setElementGeometry,
} from "./elementGeometry";

let resizeCallbacks: Array<() => void> = [];

class CapturingResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe() {
    resizeCallbacks.push(() =>
      this.callback([], this as unknown as ResizeObserver),
    );
  }

  unobserve() {}

  disconnect() {}
}

function Harness({
  description,
  expanded = false,
}: {
  description: string;
  expanded?: boolean;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const overflowing = useIsOverflowing(ref, description, expanded);
  return <p ref={ref}>{overflowing ? "overflowing" : "fits"}</p>;
}

describe("useIsOverflowing", () => {
  let restoreGeometry: () => void;

  beforeEach(() => {
    resizeCallbacks = [];
    vi.stubGlobal("ResizeObserver", CapturingResizeObserver);
    restoreGeometry = installElementGeometryMock();
  });

  afterEach(() => {
    restoreGeometry();
    vi.unstubAllGlobals();
  });

  it("reports overflow when the content is clipped", () => {
    setElementGeometry(40, 80);
    render(<Harness description="anything" />);

    expect(document.querySelector("p")?.textContent).toBe("overflowing");
  });

  it("reports no overflow when the content fits its box", () => {
    setElementGeometry(40, 40);
    render(<Harness description="anything" />);

    expect(document.querySelector("p")?.textContent).toBe("fits");
  });

  it("re-checks when the observed element resizes", () => {
    setElementGeometry(40, 40);
    render(<Harness description="anything" />);
    expect(document.querySelector("p")?.textContent).toBe("fits");

    setElementGeometry(40, 80);
    act(() => {
      resizeCallbacks.forEach((callback) => callback());
    });

    expect(document.querySelector("p")?.textContent).toBe("overflowing");
  });

  it("keeps the last measurement while expanded, then re-measures on collapse", () => {
    setElementGeometry(40, 80);
    const { rerender } = render(
      <Harness description="anything" expanded={false} />,
    );
    expect(document.querySelector("p")?.textContent).toBe("overflowing");

    setElementGeometry(40, 40);
    rerender(<Harness description="anything" expanded={true} />);
    expect(document.querySelector("p")?.textContent).toBe("overflowing");

    rerender(<Harness description="anything" expanded={false} />);
    expect(document.querySelector("p")?.textContent).toBe("fits");
  });
});
