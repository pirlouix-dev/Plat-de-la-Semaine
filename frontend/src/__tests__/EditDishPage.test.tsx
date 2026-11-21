import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EditDishPage from "../pages/EditDishPage/EditDishPage";
import { createTranslator } from "../i18n";

const t = createTranslator("en");
import type { DishDocType } from "../db/schemas/dishes";
import {
  installElementGeometryMock,
  setElementGeometry,
} from "./elementGeometry";

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

const defaultDishes: DishDocType[] = [
  makeDish({
    id: "d1",
    name: "Colin d'Alaska & riz",
    course: 1,
    seasons: [0, 1, 2, 3],
  }),
  makeDish({
    id: "d2",
    name: "Courgette & semoule",
    course: 1,
    seasons: [0, 1, 2, 3],
  }),
  makeDish({
    id: "d3",
    name: "Falafels & semoule",
    course: 0,
    seasons: [2, 3],
  }),
  makeDish({ id: "d4", name: "Tarte aux pommes", course: 2, seasons: [2] }),
];

let dishes: DishDocType[] = defaultDishes;

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
  dishes = defaultDishes;
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

    it("displays a badge for each dish course", () => {
      renderPage();
      const badges = screen.getAllByText(new RegExp(t("course.main")), {
        selector: ".dish-card-course-badge",
      });
      expect(badges).toHaveLength(2);
      expect(
        screen.getByText(new RegExp(t("course.starter")), {
          selector: ".dish-card-course-badge",
        }),
      ).toBeTruthy();
      expect(
        screen.getByText(new RegExp(t("course.dessert")), {
          selector: ".dish-card-course-badge",
        }),
      ).toBeTruthy();
    });

    it("shows 'Toutes saisons' badge when dish has all 4 seasons", () => {
      renderPage();
      const badges = screen.getAllByText(new RegExp(t("common.allSeasons")));
      expect(badges.length).toBe(2);
    });

    it("shows individual season badges when not all seasons", () => {
      renderPage();
      const automne = screen.getAllByText(new RegExp(t("season.autumn")));
      expect(automne.length).toBeGreaterThanOrEqual(2);
      const hiver = screen.getAllByText(new RegExp(t("season.winter")));
      expect(hiver.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("dish selection", () => {
    it("selects a dish and populates the form", () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));

      expect(screen.getByText(t("edit.detailTitle", { name: "Colin d'Alaska & riz" }))).toBeTruthy();
      expect(
        (screen.getByPlaceholderText(t("add.name")) as HTMLInputElement).value,
      ).toBe("Colin d'Alaska & riz");
      expect(
        (screen.getByPlaceholderText(t("add.description")) as HTMLTextAreaElement)
          .value,
      ).toBe("Colin d'Alaska, riz à la vapeur");
    });

    it("highlights the correct course button", () => {
      renderPage();
      fireEvent.click(screen.getByText("Falafels & semoule"));

      const starterBtn = screen.getByText(t("course.starter")).closest(".course-option");
      expect(starterBtn?.className).toContain("active");
    });

    it("deselects a dish when back button is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      expect(screen.getByText(t("edit.detailTitle", { name: "Colin d'Alaska & riz" }))).toBeTruthy();

      fireEvent.click(screen.getByLabelText(t("edit.backToList")));
      expect(screen.getByText(t("edit.noSelectionTitle"))).toBeTruthy();
    });
  });

  describe("search and filters", () => {
    it("filters dishes by name search", () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText(t("edit.search")), {
        target: { value: "Falafels" },
      });
      expect(screen.getByText("Falafels & semoule")).toBeTruthy();
      expect(screen.queryByText("Colin d'Alaska & riz")).toBeNull();
    });

    it("filters dishes by course", () => {
      renderPage();
      fireEvent.click(screen.getByTitle(t("edit.toggleFilters")));

      const filterChips = screen.getAllByText(
        new RegExp(t("course.starter")),
        { selector: ".filter-chip" },
      );
      fireEvent.click(filterChips[0]);

      expect(screen.getByText("Falafels & semoule")).toBeTruthy();
      expect(screen.queryByText("Colin d'Alaska & riz")).toBeNull();
    });

    it("filters dishes by season", () => {
      renderPage();
      fireEvent.click(screen.getByTitle(t("edit.toggleFilters")));

      const filterChips = screen.getAllByText(new RegExp(t("season.winter")), {
        selector: ".filter-chip",
      });
      fireEvent.click(filterChips[0]);

      expect(screen.getByText("Colin d'Alaska & riz")).toBeTruthy();
      expect(screen.queryByText("Tarte aux pommes")).toBeNull();
    });

    it("shows empty state when no dishes match", () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText(t("edit.search")), {
        target: { value: "xyznonexistent" },
      });
      expect(
        screen.getByText(t("edit.noResults")),
      ).toBeTruthy();
    });
  });

  describe("description see more", () => {
    const longDescription =
      "Ingrédients : Pommes, pâte brisée, sucre, vanille, cannelle, jus de citron, compote maison et quelques conseils de préparation supplémentaires.";

    let restoreGeometry: () => void;

    beforeEach(() => {
      restoreGeometry = installElementGeometryMock();
    });

    afterEach(() => {
      restoreGeometry();
    });

    function renderSingleDish(description: string) {
      dishes = [
        makeDish({ id: "d5", name: "Gigot & haricots", description }),
      ];
      renderPage();
    }

    it("shows the toggle when the description overflows the clamp", () => {
      setElementGeometry(40, 80);
      renderSingleDish("Description courte");

      expect(screen.getByText(t("common.seeMore"))).toBeTruthy();
      expect(screen.queryByText("Voir moins")).toBeNull();
    });

    it("hides the toggle when a long description still fits the clamp", () => {
      setElementGeometry(40, 40);
      renderSingleDish(longDescription);

      expect(screen.queryByText(t("common.seeMore"))).toBeNull();
    });

    it("toggles between Voir plus and Voir moins", () => {
      setElementGeometry(40, 80);
      renderSingleDish(longDescription);

      fireEvent.click(screen.getByText(t("common.seeMore")));
      expect(screen.getByText(t("common.seeLess"))).toBeTruthy();

      fireEvent.click(screen.getByText(t("common.seeLess")));
      expect(screen.getByText(t("common.seeMore"))).toBeTruthy();
    });

    it("does not select the dish when toggling expansion", () => {
      setElementGeometry(40, 80);
      renderSingleDish(longDescription);

      fireEvent.click(screen.getByText(t("common.seeMore")));

      const detailPrefix = t("edit.detailTitle", { name: "" }).trim();
      expect(
        screen.queryByText((content) => content.startsWith(detailPrefix)),
      ).toBeNull();
    });
  });

  describe("save", () => {
    it("calls editDish with correct payload on save", async () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));

      fireEvent.change(screen.getByPlaceholderText(t("add.name")), {
        target: { value: "Colin mis à jour" },
      });

      await act(async () => {
        fireEvent.submit(screen.getByText(t("edit.save")));
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
        fireEvent.submit(screen.getByText(t("edit.save")));
      });

      expect(showToastMock).toHaveBeenCalledWith(
        t("edit.saveSuccess"),
        "success",
      );
    });

    it("shows error toast when editDish throws", async () => {
      editDishMock.mockRejectedValue(new Error("fail"));
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));

      await act(async () => {
        fireEvent.submit(screen.getByText(t("edit.save")));
      });

      expect(showToastMock).toHaveBeenCalledWith(
        t("edit.saveError"),
        "error",
      );
    });

    it("disables save button when form is invalid", () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));

      fireEvent.change(screen.getByPlaceholderText(t("add.name")), {
        target: { value: "" },
      });

      expect(screen.getByText(t("edit.save")).closest("button")).toBeDisabled();
    });
  });

  describe("delete", () => {
    it("opens delete modal when trash icon is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      fireEvent.click(screen.getByTitle(t("edit.deleteDish")));

      expect(screen.getByText(t("edit.deleteTitle"))).toBeTruthy();
      expect(
        screen.getByText(
          t("edit.deleteConfirm", { name: "Colin d'Alaska & riz" }),
        ),
      ).toBeTruthy();
    });

    it("closes modal when cancel is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      fireEvent.click(screen.getByTitle(t("edit.deleteDish")));
      fireEvent.click(screen.getByText(t("common.cancel")));

      expect(screen.queryByText(t("edit.deleteTitle"))).toBeNull();
    });

    it("calls removeDish and shows success toast on confirm", async () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      fireEvent.click(screen.getByTitle(t("edit.deleteDish")));

      await act(async () => {
        fireEvent.click(screen.getByText(t("common.delete")));
      });

      expect(removeDishMock).toHaveBeenCalledWith("d1");
      expect(showToastMock).toHaveBeenCalledWith(t("edit.deleteSuccess"), "success");
    });

    it("deselects dish after successful delete", async () => {
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      fireEvent.click(screen.getByTitle(t("edit.deleteDish")));

      await act(async () => {
        fireEvent.click(screen.getByText(t("common.delete")));
      });

      expect(screen.getByText(t("edit.noSelectionTitle"))).toBeTruthy();
    });

    it("shows error toast when removeDish throws", async () => {
      removeDishMock.mockRejectedValue(new Error("fail"));
      renderPage();
      fireEvent.click(screen.getByText("Colin d'Alaska & riz"));
      fireEvent.click(screen.getByTitle(t("edit.deleteDish")));

      await act(async () => {
        fireEvent.click(screen.getByText(t("common.delete")));
      });

      expect(showToastMock).toHaveBeenCalledWith(
        t("edit.deleteError"),
        "error",
      );
    });
  });
});
