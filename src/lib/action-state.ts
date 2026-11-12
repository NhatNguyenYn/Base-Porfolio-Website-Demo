import type { FieldErrors } from "./validation";

export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: FieldErrors;
};

export const initialActionState: ActionState = { ok: false, message: "" };

export function firstError(state: ActionState, key: string): string | undefined {
  return state.fieldErrors?.[key]?.[0];
}

export function fieldErrorId(key: string): string {
  return `error-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
