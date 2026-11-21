import type { RxJsonSchema } from "rxdb";

export interface PreferenceDocType {
  key: string;
  value: string;
  updatedAt: string;
}

export const preferencesSchema: RxJsonSchema<PreferenceDocType> = {
  version: 0,
  primaryKey: "key",
  type: "object",
  properties: {
    key: { type: "string", maxLength: 50 },
    value: { type: "string" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["key", "value", "updatedAt"],
};
