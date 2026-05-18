const STORAGE_KEY = "iris.remembered_validator";

export interface RememberedValidator {
  address: string;
  moniker?: string;
  saved_at: number;
}

export function getRemembered(): RememberedValidator | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RememberedValidator;
  } catch {
    return null;
  }
}

export function remember(v: RememberedValidator): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
}

export function forget(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
