const DEVICE_ID_KEY = "top-seed-device-id";

export function getDeviceId(): string {
  if (typeof localStorage === "undefined") {
    return "device-fallback";
  }
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export const DEFAULT_ORG_ID = "org-default";
