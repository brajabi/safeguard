export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  label: string;
};

type Coordinates = Pick<DeviceLocation, "latitude" | "longitude">;

function canonicalTimeZone(timeZone: string): string | null {
  if (!timeZone?.trim()) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
}

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
  } catch {
    return "Unknown";
  }
}

export function formatTime(timeZone: string, date: Date = new Date()): string {
  if (!canonicalTimeZone(timeZone) || Number.isNaN(date.getTime()))
    return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatOffset(
  timeZone: string,
  date: Date = new Date(),
): string {
  if (!canonicalTimeZone(timeZone) || Number.isNaN(date.getTime()))
    return "Unavailable";
  // Some Hermes/ICU builds return GMT for longOffset even during DST.
  // Derive the offset from the same zoned calendar fields used by the clock.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
  const localAsUtc = new Date(0);
  localAsUtc.setUTCFullYear(field("year"), field("month") - 1, field("day"));
  // Accommodate engines that render midnight as 24 despite h23.
  localAsUtc.setUTCHours(
    field("hour") % 24,
    field("minute"),
    field("second"),
    0,
  );
  const minutes = Math.round(
    (localAsUtc.getTime() - Math.floor(date.getTime() / 1000) * 1000) / 60000,
  );
  if (!Number.isFinite(minutes)) return "Unavailable";
  if (minutes === 0) return "UTC";
  const hours = String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0");
  const remainder = String(Math.abs(minutes) % 60).padStart(2, "0");
  return `UTC${minutes < 0 ? "-" : "+"}${hours}:${remainder}`;
}

/** A timezone's representative name, never a claim about the device's location. */
export function timeZonePlace(timeZone: string): string {
  const canonical = canonicalTimeZone(timeZone);
  if (!canonical) return "Unknown time zone";
  if (
    canonical === "UTC" ||
    canonical === "GMT" ||
    canonical.startsWith("Etc/")
  ) {
    return "No geographic location";
  }
  return canonical.split("/").at(-1)!.replaceAll("_", " ");
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const valid = (point: Coordinates) =>
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180;
  if (!valid(a) || !valid(b)) return Number.NaN;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = radians(b.latitude - a.latitude);
  const deltaLon = radians(b.longitude - a.longitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(deltaLon / 2) ** 2;
  return (
    6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))))
  );
}

export function compareTimeZones(
  a: string,
  b: string,
): "match" | "different" | "unknown" {
  const left = canonicalTimeZone(a);
  const right = canonicalTimeZone(b);
  if (!left || !right) return "unknown";
  return left === right ? "match" : "different";
}

export function assessConnection(
  ip: {
    vpn: boolean | null;
    proxy: boolean | null;
    tor: boolean | null;
    hosting: boolean | null;
    timeZone: string;
  },
  deviceTimeZone: string,
): { title: string; detail: string; tone: "neutral" | "good" | "warning" } {
  if (ip.vpn || ip.proxy || ip.tor) {
    const signals = [ip.vpn && "VPN", ip.proxy && "proxy", ip.tor && "Tor"]
      .filter(Boolean)
      .join(", ");
    return {
      title: "Privacy network flagged",
      detail: `The IP provider flags this address as ${signals}. IP classifications can be incomplete or outdated.`,
      tone: "warning",
    };
  }
  if (ip.hosting) {
    return {
      title: "Data center IP",
      detail:
        "The IP provider flags a hosting network. This can occur with a VPN, but does not confirm one.",
      tone: "warning",
    };
  }
  if (compareTimeZones(ip.timeZone, deviceTimeZone) === "different") {
    return {
      title: "Time zones differ",
      detail:
        "Your IP and device time zones differ. Travel, device settings, or IP lookup errors can also cause this; it does not prove VPN use.",
      tone: "warning",
    };
  }
  if (ip.vpn === false && ip.proxy === false && ip.tor === false) {
    return {
      title: "No VPN flagged",
      detail:
        "The IP provider reports no VPN, proxy, or Tor signal. This does not guarantee a direct connection.",
      tone: "good",
    };
  }
  return {
    title: "VPN status unknown",
    detail:
      "VPN classification is unavailable or incomplete. Matching time zones cannot rule out a VPN.",
    tone: "neutral",
  };
}
