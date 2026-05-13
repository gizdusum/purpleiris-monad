export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toSlugFromValidator(name: string, nodeId: string): string {
  const base = toSlug(name);
  return base || nodeId.slice(0, 12);
}
