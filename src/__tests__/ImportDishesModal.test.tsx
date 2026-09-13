import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImportDishesModal from "../components/ImportDishesModal";
import type { ImportOutcome } from "../components/ImportDishesModal";
import type { ValidatedDishImportItem } from "../types/dish";

type ImportFn = (items: ValidatedDishImportItem[]) => Promise<ImportOutcome>;

function renderModal(onImport: ImportFn) {
  return render(<ImportDishesModal onClose={vi.fn()} onImport={onImport} />);
}

function selectFile(container: HTMLElement, content: string) {
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  const file = new File([content], "dishes.json", {
    type: "application/json",
  });
  fireEvent.change(input, { target: { files: [file] } });
}

const VALID_JSON = JSON.stringify([
  { name: "Ratatouille", description: "Légumes", course: 1, seasons: [1, 2] },
]);

describe("ImportDishesModal", () => {
  let onImport: Mock<ImportFn>;

  beforeEach(() => {
    onImport = vi.fn<ImportFn>();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed JSON with a clear message", async () => {
    const { container } = renderModal(onImport);
    selectFile(container, "{ not json");

    await waitFor(() => {
      expect(
        screen.getByText("Le fichier n'est pas un JSON valide."),
      ).toBeTruthy();
    });
    expect(
      screen.getByRole("button", { name: /^importer/i }),
    ).toBeDisabled();
  });

  it("rejects a non-array top level", async () => {
    const { container } = renderModal(onImport);
    selectFile(container, JSON.stringify({ name: "X" }));

    await waitFor(() => {
      expect(
        screen.getByText("Le JSON doit contenir un tableau de plats."),
      ).toBeTruthy();
    });
  });

  it("imports valid items and reports the result", async () => {
    onImport.mockResolvedValue({
      imported: 1,
      failed: 0,
      errors: [],
      offline: false,
    });
    const { container } = renderModal(onImport);
    selectFile(container, VALID_JSON);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /importer 1 plat/i }),
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /importer 1 plat/i }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith([
        {
          name: "Ratatouille",
          description: "Légumes",
          course: 1,
          seasons: [1, 2],
        },
      ]);
      expect(
        screen.getByText("1 plat(s) importé(s), 0 en échec."),
      ).toBeTruthy();
    });
  });

  it("reports locally-stored items when offline", async () => {
    onImport.mockResolvedValue({
      imported: 1,
      failed: 0,
      errors: [],
      offline: true,
    });
    const { container } = renderModal(onImport);
    selectFile(container, VALID_JSON);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /importer 1 plat/i }),
      ).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /importer 1 plat/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          /1 plat\(s\) enregistré\(s\) localement, en attente de synchronisation\./,
        ),
      ).toBeTruthy();
    });
  });

  it("shows backend errors returned with the result", async () => {
    onImport.mockResolvedValue({
      imported: 0,
      failed: 1,
      errors: [
        {
          index: 0,
          name: "Ratatouille",
          errors: [{ field: "name", message: "Nom déjà utilisé" }],
        },
      ],
      offline: false,
    });
    const { container } = renderModal(onImport);
    selectFile(container, VALID_JSON);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /importer 1 plat/i }),
      ).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /importer 1 plat/i }));

    await waitFor(() => {
      expect(screen.getByText(/Nom déjà utilisé/)).toBeTruthy();
    });
  });
});
