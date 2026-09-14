import type { Registration } from "./catalog";
export function registrationLabel(registration: Registration) {
  return registration.agency === "PRO"
    ? `PRO · ${registration.organization || "Sin especificar"}`
    : registration.organization
      ? `${registration.agency} · ${registration.organization}`
      : registration.agency;
}
