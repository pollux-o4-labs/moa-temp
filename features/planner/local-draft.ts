import { planSchema, type Plan } from "../../lib/plan.ts";

export const ANONYMOUS_DRAFT_KEY_PREFIX = "moa:anonymous-draft:";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export interface LocalDraftStore {
  read(day: string): Plan | null;
  write(day: string, plan: Plan): void;
  remove(day: string): void;
}

export const noLocalDraftStore: LocalDraftStore = {
  read: () => null,
  write: () => undefined,
  remove: () => undefined,
};

export function createLocalDraftStore(
  storage: StorageLike | null
): LocalDraftStore {
  if (!storage) return noLocalDraftStore;

  return {
    read(day) {
      try {
        const raw = storage.getItem(keyFor(day));
        if (!raw) return null;
        const parsed = planSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    write(day, plan) {
      try {
        storage.setItem(keyFor(day), JSON.stringify(plan));
      } catch {
        // A blocked or full browser store must never discard the in-memory draft.
      }
    },
    remove(day) {
      try {
        storage.removeItem(keyFor(day));
      } catch {
        // Storage cleanup is best effort after a successful server save.
      }
    },
  };
}

export function createBrowserLocalDraftStore(): LocalDraftStore {
  if (typeof window === "undefined") return noLocalDraftStore;
  try {
    return createLocalDraftStore(window.localStorage);
  } catch {
    return noLocalDraftStore;
  }
}

function keyFor(day: string): string {
  return `${ANONYMOUS_DRAFT_KEY_PREFIX}${encodeURIComponent(day)}`;
}
