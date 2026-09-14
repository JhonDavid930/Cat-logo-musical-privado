export const defaultProOrganizations = ["BMI", "ASCAP", "SGAE"];
export const organizationName = (name: string) => name.trim().replace(/\s+/gu, " ");
export const organizationKey = (name: string) => organizationName(name).toLowerCase();

export function mergeOrganizations(...lists: string[][]) {
  const names = new Map<string, string>();
  for (const name of [...defaultProOrganizations, ...lists.flat()]) {
    const clean = organizationName(name);
    if (clean && !names.has(organizationKey(clean))) names.set(organizationKey(clean), clean);
  }
  return [...names.values()];
}

export function normalizeProOrganizations<T extends { proOrganizations: string[]; registrations: { agency: string; organization?: string }[] }>(catalog: T): T {
  const proOrganizations = mergeOrganizations(catalog.proOrganizations, catalog.registrations.filter(r=>r.agency === "PRO").map(r=>r.organization || ""));
  const names = new Map(proOrganizations.map(name=>[organizationKey(name),name]));
  return { ...catalog, proOrganizations, registrations: catalog.registrations.map(registration=> registration.agency === "PRO" && registration.organization ? { ...registration, organization: names.get(organizationKey(registration.organization))! } : registration) };
}
