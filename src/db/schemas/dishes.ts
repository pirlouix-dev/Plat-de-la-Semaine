import type { RxJsonSchema } from "rxdb";

export interface DishDocType {
  id: string;
  serverId: string;
  name: string;
  description: string;
  course: number;
  seasons: number[];
  updatedAt: string;
  isDeleted: boolean;
  syncStatus:
    | "synced"
    | "pending_create"
    | "pending_update"
    | "pending_delete";
}

export const dishesSchema: RxJsonSchema<DishDocType> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    serverId: { type: "string", maxLength: 36 },
    name: { type: "string" },
    description: { type: "string" },
    course: { type: "number" },
    seasons: { type: "array", items: { type: "number" } },
    updatedAt: { type: "string", format: "date-time" },
    isDeleted: { type: "boolean" },
    syncStatus: { type: "string" },
  },
  required: [
    "id",
    "name",
    "description",
    "course",
    "seasons",
    "updatedAt",
    "isDeleted",
    "syncStatus",
  ],
};
