import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AddDishPage from "../pages/AddDishPage/AddDishPage";

const { addDishMock, showToastMock } = vi.hoisted(() => ({
  addDishMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../hooks/useDishes", () => ({
  useDishes: () => ({ addDish: addDishMock, dishes: [] }),
}));

vi.mock("../components/toastContext", () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

const DRAFT_KEY = "add-dish-draft";
const NAME_PLACEHOLDER = "Nom du plat";
const DESCRIPTION_PLACEHOLDER = "Description, conseils de préparation ou ingrédients...";

function renderPage() {
  return render(
    <MemoryRouter>
      <AddDishPage />
    </MemoryRouter>,
  );
}

function getDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  addDishMock.mockReset();
  showToastMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AddDishPage draft persistence", () => {
  it("saves the draft to localStorage after changes", () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(NAME_PLACEHOLDER), {
      target: { value: "Ratatouille" },
    });
    fireEvent.click(screen.getByText("Plat"));
    fireEvent.click(screen.getByText("Été"));
    fireEvent.change(screen.getByPlaceholderText(DESCRIPTION_PLACEHOLDER), {
      target: { value: "Un grand classique." },
    });

    expect(getDraft()).toBeNull();

    act(() => vi.advanceTimersByTime(400));

    expect(getDraft()).toEqual({
      name: "Ratatouille",
      dishCourse: "Plat",
      selectedSeasons: [1],
      description: "Un grand classique.",
    });
  });

  it("does not write an empty draft", () => {
    renderPage();
    act(() => vi.advanceTimersByTime(400));
    expect(getDraft()).toBeNull();
  });

  it("removes the draft when the user clears all fields", () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ name: "X", dishCourse: "Plat", selectedSeasons: [1], description: "" }),
    );
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(NAME_PLACEHOLDER), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Plat"));
    fireEvent.click(screen.getByText("Été"));

    act(() => vi.advanceTimersByTime(400));
    expect(getDraft()).toBeNull();
  });

  it("restores fields from a saved draft on mount", () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        name: "Tartare",
        dishCourse: "Entrée",
        selectedSeasons: [1, 3],
        description: "Servi frais.",
      }),
    );

    renderPage();

    expect((screen.getByPlaceholderText(NAME_PLACEHOLDER) as HTMLInputElement).value).toBe(
      "Tartare",
    );
    expect(
      (screen.getByPlaceholderText(DESCRIPTION_PLACEHOLDER) as HTMLTextAreaElement).value,
    ).toBe("Servi frais.");
    expect(screen.getByText("Entrée").closest("button")).toHaveClass("active");
    expect(screen.getByText("Été").closest("button")).toHaveClass("selected");
    expect(screen.getByText("Hiver").closest("button")).toHaveClass("selected");
    expect(screen.getByText("Plat").closest("button")).not.toHaveClass("active");
  });

  it("ignores a corrupted draft", () => {
    localStorage.setItem(DRAFT_KEY, "not-json{");

    renderPage();

    expect((screen.getByPlaceholderText(NAME_PLACEHOLDER) as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Plat").closest("button")).not.toHaveClass("active");
  });

  it("clears the draft on successful save", async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ name: "X", dishCourse: null, selectedSeasons: [], description: "" }),
    );
    addDishMock.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(NAME_PLACEHOLDER), {
      target: { value: "Lasagnes" },
    });
    fireEvent.click(screen.getByText("Plat"));
    fireEvent.click(screen.getByText("Automne"));
    act(() => vi.advanceTimersByTime(400));
    expect(getDraft()).toEqual({
      name: "Lasagnes",
      dishCourse: "Plat",
      selectedSeasons: [2],
      description: "",
    });

    fireEvent.click(screen.getByText("Sauvegarder"));
    await act(async () => {
      await Promise.resolve();
    });

    expect(addDishMock).toHaveBeenCalledTimes(1);
    expect(getDraft()).toBeNull();
  });

  it("shows success toast on successful save", async () => {
    addDishMock.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(NAME_PLACEHOLDER), {
      target: { value: "Lasagnes" },
    });
    fireEvent.click(screen.getByText("Plat"));
    fireEvent.click(screen.getByText("Automne"));

    await act(async () => {
      fireEvent.click(screen.getByText("Sauvegarder"));
    });

    expect(showToastMock).toHaveBeenCalledWith(
      "Plat ajouté avec succès",
      "success",
    );
  });

  it("shows error toast when addDish throws", async () => {
    addDishMock.mockRejectedValue(new Error("fail"));
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(NAME_PLACEHOLDER), {
      target: { value: "Lasagnes" },
    });
    fireEvent.click(screen.getByText("Plat"));
    fireEvent.click(screen.getByText("Automne"));

    await act(async () => {
      fireEvent.click(screen.getByText("Sauvegarder"));
    });

    expect(showToastMock).toHaveBeenCalledWith(
      "Erreur lors de la création",
      "error",
    );
  });
});
