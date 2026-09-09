import { fetchIpClassification } from "./classification";

export interface IpInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timeZone: string;
  isp: string;
  asn: string;
  vpn: boolean | null;
  proxy: boolean | null;
  tor: boolean | null;
  hosting: boolean | null;
  residential: boolean | null;
  networkType: string;
  classificationSource: string;
  classificationReason: string;
  source: string;
}

const IP_ENDPOINT = "https://ipwho.is/";
const IPV6_ENDPOINT = "https://api6.ipify.org?format=json";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every(
      (part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255,
    )
  );
}

export function isIpv6(value: string): boolean {
  // Include IPv4-mapped IPv6; zone identifiers are not public addresses.
  if (!value.includes(":") || !/^[a-fA-F0-9:.]+$/.test(value)) return false;
  let normalized = value;
  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    if (!isIpv4(value.slice(lastColon + 1))) return false;
    normalized = value.slice(0, lastColon + 1) + "0:0";
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return false;
  const groups = halves.flatMap((half) => (half === "" ? [] : half.split(":")));
  if (!groups.every((group) => /^[a-fA-F0-9]{1,4}$/.test(group))) return false;
  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}

function coordinate(value: unknown, limit: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > limit
  ) {
    throw new Error(
      "The IP service returned an invalid location. Please try again.",
    );
  }
  return value;
}

function signal(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Validate an external response before its coordinates or claims reach the UI. */
export function normalizeIpInfo(value: unknown): IpInfo {
  const data = record(value);
  if (data.success !== true) {
    throw new Error(
      "The IP service could not locate this connection. Please try again.",
    );
  }
  const ip = text(data.ip);
  if (!isIpv4(ip) && !isIpv6(ip)) {
    throw new Error(
      "The IP service returned an invalid address. Please try again.",
    );
  }
  const connection = record(data.connection);
  const security = record(data.security);
  const asn = connection.asn;
  return {
    ip,
    city: text(data.city),
    region: text(data.region),
    country: text(data.country),
    countryCode: text(data.country_code),
    latitude: coordinate(data.latitude, 90),
    longitude: coordinate(data.longitude, 180),
    timeZone: text(record(data.timezone).id),
    isp: text(connection.isp) || text(connection.org),
    asn:
      typeof asn === "number" && Number.isSafeInteger(asn) && asn >= 0
        ? `AS${asn}`
        : "",
    // The free endpoint omits security data. Absence must never imply "no VPN".
    vpn: signal(security.vpn),
    proxy: signal(security.proxy),
    tor: signal(security.tor),
    hosting: signal(security.hosting),
    residential: null,
    networkType: "Unknown",
    classificationSource: "",
    classificationReason: "No classification result",
    source: "ipwho.is",
  };
}

async function requestJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 429) {
      throw new Error(
        "The IP service is rate limited. Please try again later.",
      );
    }
    if (!response.ok) {
      throw new Error("The IP service is unavailable. Please try again.");
    }
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The connection check timed out. Please try again.");
    }
    if (error instanceof SyntaxError) {
      throw new Error(
        "The IP service returned an unreadable response. Please try again.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** The request must originate on the device to observe that device's public IP. */
export async function fetchIpInfo(): Promise<IpInfo> {
  const info = normalizeIpInfo(await requestJson(IP_ENDPOINT, 12_000));
  // Classify the exact observed address, not the address of a proxy/backend.
  // Optional reputation failure must never discard a successful location lookup.
  const classification = await fetchIpClassification(info.ip);
  return {
    ...info,
    residential: classification.residential,
    vpn: classification.vpn ?? info.vpn,
    proxy: classification.proxy ?? info.proxy,
    tor: classification.tor ?? info.tor,
    hosting: classification.hosting ?? info.hosting,
    networkType: classification.networkType,
    classificationSource: classification.source,
    classificationReason: classification.reason,
  };
}

/** Null means no IPv6 result; network blocking and endpoint failures are inconclusive. */
export async function fetchIpv6(): Promise<string | null> {
  try {
    const data = record(await requestJson(IPV6_ENDPOINT, 6_000));
    const ip = text(data.ip);
    return isIpv6(ip) ? ip : null;
  } catch {
    return null;
  }
}
