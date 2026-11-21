import type { RxCollection } from "rxdb";
import type { DishDocType } from "./schemas/dishes";
import type { PreferenceDocType } from "./schemas/preferences";

export type DishesCollection = RxCollection<DishDocType>;
export type PreferencesCollection = RxCollection<PreferenceDocType>;

export interface DatabaseCollections {
  dishes: DishesCollection;
  preferences: PreferencesCollection;
}
