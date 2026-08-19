import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider } from "../components/Toast";
import { useToast } from "../components/toastContext";

function TestConsumer() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast("Saved!")}>save</button>
      <button onClick={() => showToast("Oops", "error")}>error</button>
      <button onClick={() => showToast("Heads up", "info")}>info</button>
    </div>
  );
}

function renderToast() {
  return render(
    <ToastProvider>
      <TestConsumer />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("shows a toast when showToast is called", () => {
    renderToast();
    act(() => {
      screen.getByText("save").click();
    });
    expect(screen.getByText("Saved!")).toBeTruthy();
  });

  it("applies the correct type class", () => {
    renderToast();
    act(() => {
      screen.getByText("error").click();
    });
    const toast = screen.getByText("Oops");
    expect(toast.className).toContain("toast-error");
  });

  it("defaults to success type", () => {
    renderToast();
    act(() => {
      screen.getByText("save").click();
    });
    const toast = screen.getByText("Saved!");
    expect(toast.className).toContain("toast-success");
  });

  it("applies info type class", () => {
    renderToast();
    act(() => {
      screen.getByText("info").click();
    });
    const toast = screen.getByText("Heads up");
    expect(toast.className).toContain("toast-info");
  });

  it("auto-dismisses after duration", () => {
    renderToast();
    act(() => {
      screen.getByText("save").click();
    });
    expect(screen.getByText("Saved!")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // After 3000ms the dismiss timer fires, which starts the 200ms exit animation
    const toast = screen.queryByText("Saved!");
    expect(toast).not.toBeNull();
    expect(toast!.className).toContain("toast-exiting");

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("Saved!")).toBeNull();
  });

  it("stacks multiple toasts", () => {
    renderToast();
    act(() => {
      screen.getByText("save").click();
    });
    act(() => {
      screen.getByText("error").click();
    });
    expect(screen.getByText("Saved!")).toBeTruthy();
    expect(screen.getByText("Oops")).toBeTruthy();
  });

  it("throws useToast outside ToastProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useToast();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(
      "useToast must be used within a ToastProvider",
    );
    spy.mockRestore();
  });
});
