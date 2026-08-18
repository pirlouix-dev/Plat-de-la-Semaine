import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EditDishPage from "../pages/EditDishPage/EditDishPage";
import type { DishDocType } from "../db/schemas/dishes";

function makeDish(overrides: Partial<DishDocType> = {}): DishDocType {
  return {
    id: "d1",
    serverId: "",
    name: "Colin d'Alaska & riz",
    description: "Colin d'Alaska, riz à la vapeur",
    course: 1,
    seasons: [0, 1, 2, 3],
    updatedAt: "2025-01-01T00:00:00Z",
    isDeleted: false,
    syncStatus: "synced",
    ...overrides,
  };
}

const dishes: DishDocType[] = [
  makeDish({ id: "d1", name: "Colin d'Alaska & riz", course: 1, seasons: [0, 1, 2, 3] }),
  makeDish({ id: "d2", name: "Courgette & semoule", course: 1, seasons: [0, 1, 2, 3] }),
  makeDish({ id: "d3", name: "Falafels & semoule", course: 0, seasons: [2, 3] }),
  makeDish({ id: "d4", name: "Tarte aux pommes", course: 2, seasons: [2] }),
];

const { editDishMock, removeDishMock, showToastMock } = vi.hoisted(() => ({
  editDishMock: vi.fn(),
  removeDishMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../hooks/useDishes", () => ({
  useDishes: () => ({
    dishes,
    editDish: editDishMock,
    removeDish: removeDishMock,
    addDish: vi.fn(),
  }),
}));

vi.mock("../components/toastContext", () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <EditDishPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  editDishMock.mockResolvedValue(undefined);
  removeDishMock.mockResolvedValue(undefined);
});

describe("EditDishPage", () => {
  describe("dish list rendering", () => {
    it("renders all non-deleted dishes from the hook", () => {
      renderPage();
      expect(screen.getByText("Colin d'Alaska & riz")).toBeTruthy();
      expect(screen.getByText("Courgette & semoule")).toBeTruthy();
      expect(screen.getByText("Falafels & semoule")).toBeTruthy();
      expect(screen.getByText("Tarte aux pommes")).toBeTruthy();
    });

    it("displays course badges for each dish type", () => {
      renderPage();
      const badges = screen.getAllByText(/Plat/, { selector: ".dish-card-type-badge" });
      expect(badges).toHaveLength(2);
      expect(screen.getByText(/Entrée/, { selector: ".dish-card-type-badge" })).toBeTruthy();
      expect(screen.getByText(/Dessert/, { selector: ".dish-card-type-badge" })).toBeTruthy();
    });

    it("shows 'Toutes saisons' badge when dish has all 4 seasons", () => {
      renderPage();
      const badges = screen.getAllByText("🗓️ Toutes saisons");
      expect(badges.length).toBe(2);
    });

    it("shows individual season badges when not all seasons", () => {
      renderPage();
      const automne = screen.getAllByText(/Automne/);
      expect(automne.length).toBeGreaterThanOrEqual(2);
      const hiver = screen.getAllByText(/Hiver/);
      expect(hiver.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("dish selection", () => {
    it("selects a dish and populates the form", () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));

      expect(screen.getByText("Édition : Colin d'Alaska & riz")).toBeTruthy();
      expect(
        (screen.getByPlaceholderText("Nom du plat") as HTMLInputElement).value,
      ).toBe("Colin d'Alaska & riz");
      expect(
        (screen.getByPlaceholderText(/Description/) as HTMLTextAreaElement).value,
      ).toBe("Colin d'Alaska, riz à la vapeur");
    });

    it("highlights the correct course type button", () => {
      renderPage();
      fireEvent.click(screen.getByText("Falafels & semoule"));

      const starterBtn = screen
        .getByText("Entrée")
        .closest(".type-option");
      expect(starterBtn?.className).toContain("active");
    });

    it("deselects a dish when back button is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      expect(screen.getByText("Édition : Colin d'Alaska & riz")).toBeTruthy();

      fireEvent.click(screen.getByLabelText("Retour à la liste"));
      expect(screen.getByText("Aucun plat sélectionné")).toBeTruthy();
    });
  });

  describe("search and filters", () => {
    it("filters dishes by name search", () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText(/Rechercher/), {
        target: { value: "Falafels" },
      });
      expect(screen.getByText("Falafels & semoule")).toBeTruthy();
      expect(screen.queryByText("Colin d'Alaska & riz")).toBeNull();
    });

    it("filters dishes by course type", () => {
      renderPage();
      fireEvent.click(screen.getByTitle("Afficher/masquer les filtres"));

      const filterChips = screen.getAllByText(/Entrée/, { selector: ".filter-chip" });
      fireEvent.click(filterChips[0]);

      expect(screen.getByText("Falafels & semoule")).toBeTruthy();
      expect(screen.queryByText("Colin d'Alaska & riz")).toBeNull();
    });

    it("filters dishes by season", () => {
      renderPage();
      fireEvent.click(screen.getByTitle("Afficher/masquer les filtres"));

      const filterChips = screen.getAllByText(/Hiver/, { selector: ".filter-chip" });
      fireEvent.click(filterChips[0]);

      expect(screen.getByText("Colin d'Alaska & riz")).toBeTruthy();
      expect(screen.queryByText("Tarte aux pommes")).toBeNull();
    });

    it("shows empty state when no dishes match", () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText(/Rechercher/), {
        target: { value: "xyznonexistent" },
      });
      expect(
        screen.getByText("Aucun plat ne correspond à vos critères."),
      ).toBeTruthy();
    });
  });

  describe("save", () => {
    it("calls editDish with correct payload on save", async () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));

      fireEvent.change(screen.getByPlaceholderText("Nom du plat"), {
        target: { value: "Colin mis à jour" },
      });

      await act(async () => {
        fireEvent.submit(screen.getByText("Sauvegarder"));
      });

      expect(editDishMock).toHaveBeenCalledWith("d1", {
        name: "Colin mis à jour",
        description: "Colin d'Alaska, riz à la vapeur",
        course: 1,
        seasons: [0, 1, 2, 3],
      });
    });

    it("shows success toast after successful save", async () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));

      await act(async () => {
        fireEvent.submit(screen.getByText("Sauvegarder"));
      });

      expect(showToastMock).toHaveBeenCalledWith(
        "Plat sauvegardé",
        "success",
      );
    });

    it("shows error toast when editDish throws", async () => {
      editDishMock.mockRejectedValue(new Error("fail"));
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));

      await act(async () => {
        fireEvent.submit(screen.getByText("Sauvegarder"));
      });

      expect(showToastMock).toHaveBeenCalledWith(
        "Erreur lors de la sauvegarde",
        "error",
      );
    });

    it("disables save button when form is invalid", () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));

      fireEvent.change(screen.getByPlaceholderText("Nom du plat"), {
        target: { value: "" },
      });

      expect(screen.getByText("Sauvegarder").closest("button")).toBeDisabled();
    });
  });

  describe("delete", () => {
    it("opens delete modal when trash icon is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      fireEvent.click(screen.getByTitle("Supprimer ce plat"));

      expect(screen.getByText("Supprimer le plat ?")).toBeTruthy();
      expect(
        screen.getByText(/Voulez-vous vraiment supprimer/),
      ).toBeTruthy();
    });

    it("closes modal when cancel is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      fireEvent.click(screen.getByTitle("Supprimer ce plat"));
      fireEvent.click(screen.getByText("Annuler"));

      expect(screen.queryByText("Supprimer le plat ?")).toBeNull();
    });

    it("calls removeDish and shows success toast on confirm", async () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      fireEvent.click(screen.getByTitle("Supprimer ce plat"));

      await act(async () => {
        fireEvent.click(screen.getByText("Supprimer"));
      });

      expect(removeDishMock).toHaveBeenCalledWith("d1");
      expect(showToastMock).toHaveBeenCalledWith(
        "Plat supprimé",
        "success",
      );
    });

    it("deselects dish after successful delete", async () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      fireEvent.click(screen.getByTitle("Supprimer ce plat"));

      await act(async () => {
        fireEvent.click(screen.getByText("Supprimer"));
      });

      expect(screen.getByText("Aucun plat sélectionné")).toBeTruthy();
    });

    it("shows error toast when removeDish throws", async () => {
      removeDishMock.mockRejectedValue(new Error("fail"));
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      fireEvent.click(screen.getByTitle("Supprimer ce plat"));

      await act(async () => {
        fireEvent.click(screen.getByText("Supprimer"));
      });

      expect(showToastMock).toHaveBeenCalledWith(
        "Erreur lors de la suppression",
        "error",
      );
    });
  });
});
