export type IpClassification = {
  residential: boolean | null;
  vpn: boolean | null;
  proxy: boolean | null;
  tor: boolean | null;
  hosting: boolean | null;
  networkType: string;
  source: string;
  evidence: string[];
  reason: string;
};

const SOURCE = "Blackbox";
const ENDPOINT = "https://blackbox.ipinfo.app/api/v3beta/";

function unavailable(reason: string): IpClassification {
  return {
    residential: null,
    vpn: null,
    proxy: null,
    tor: null,
    hosting: null,
    networkType: "Unknown",
    source: SOURCE,
    evidence: [],
    reason,
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// Canonicalize IPv6 without Node-only APIs; Blackbox strips mapped IPv4 prefixes.
function canonicalIp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ipv4 = (address: string): number[] | null => {
    const parts = address.split(".");
    return parts.length === 4 &&
      parts.every(
        (part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255,
      )
      ? parts.map(Number)
      : null;
  };
  const v4 = ipv4(value);
  if (v4) return v4.join(".");
  if (!value.includes(":") || !/^[\da-fA-F:.]+$/.test(value)) return null;
  let address = value.toLowerCase();
  if (address.includes(".")) {
    const split = address.lastIndexOf(":");
    const tail = ipv4(address.slice(split + 1));
    if (!tail) return null;
    address =
      address.slice(0, split + 1) +
      ((tail[0] << 8) | tail[1]).toString(16) +
      ":" +
      ((tail[2] << 8) | tail[3]).toString(16);
  }
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const groups = halves.map((half) => (half === "" ? [] : half.split(":")));
  const present = groups.flat();
  if (!present.every((group) => /^[\da-f]{1,4}$/.test(group))) return null;
  if (halves.length === 1 ? present.length !== 8 : present.length >= 8)
    return null;
  const expanded = (
    halves.length === 1
      ? present
      : [...groups[0], ...Array(8 - present.length).fill("0"), ...groups[1]]
  ).map((group) => parseInt(group, 16));
  if (
    expanded.slice(0, 5).every((group) => group === 0) &&
    expanded[5] === 65535
  ) {
    return [
      expanded[6] >> 8,
      expanded[6] & 255,
      expanded[7] >> 8,
      expanded[7] & 255,
    ].join(".");
  }
  return expanded.map((group) => group.toString(16)).join(":");
}

/** Positive network evidence is separate from VPN use; neither proves the other. */
export function normalizeClassification(
  payload: unknown,
  expectedIp: string,
): IpClassification {
  const data = object(payload);
  const signals = object(data?.signals);
  const expected = canonicalIp(expectedIp);
  const returned = canonicalIp(data?.ip);
  if (!expected || !returned)
    return unavailable("Network classification is unavailable.");
  if (returned !== expected)
    return unavailable("Classifier returned a different IP; result ignored.");
  const kinds = [
    "residential",
    "vpn",
    "hosting",
    "mobile",
    "business",
    "bogon",
    "tor",
    "privacy_relay",
    "unknown",
  ];
  if (
    !data ||
    data.error !== null ||
    !signals ||
    typeof data.classification !== "string" ||
    !kinds.includes(data.classification) ||
    !Array.isArray(data.evidence) ||
    !data.evidence.every((item) => typeof item === "string") ||
    Object.values(signals).some((value) => typeof value !== "boolean") ||
    typeof data.confidence !== "number" ||
    !Number.isFinite(data.confidence) ||
    data.confidence < 0 ||
    data.confidence > 1
  ) {
    return unavailable("Network classification is unavailable.");
  }
  const evidence = data.evidence as string[];
  const has = (...rules: string[]) =>
    rules.some((rule) => evidence.includes(rule));
  const residentialSignal =
    signals.residentialasn === true ||
    has("residential_asn", "rdns_residential");
  const hostingSignal =
    signals.hosting === true ||
    signals.cloud === true ||
    has("hosting_asn", "cloud_cidr", "rdns_hosting");
  const mobileSignal =
    signals.mobileasn === true || has("mobile_asn", "rdns_mobile");
  const businessSignal =
    signals.businessasn === true ||
    has("business_asn", "rdns_business", "rdns_corp_mx", "rdns_corp_spf");
  const otherNetwork = hostingSignal || mobileSignal || businessSignal;
  const conflict = residentialSignal && otherNetwork;
  const vpn =
    data.classification === "vpn" ||
    signals.vpnasn === true ||
    has("vpn_asn", "rdns_vpn")
      ? true
      : null;
  const residential = conflict
    ? null
    : residentialSignal && ["residential", "vpn"].includes(data.classification)
      ? true
      : otherNetwork && !residentialSignal
        ? false
        : null;
  const flag = (name: string) =>
    typeof signals[name] === "boolean" ? (signals[name] as boolean) : null;
  const networkType = conflict
    ? "Unknown"
    : residential === true
      ? vpn
        ? "Residential VPN"
        : "Residential"
      : hostingSignal
        ? "Datacenter"
        : mobileSignal
          ? "Mobile"
          : businessSignal
            ? "Business"
            : "Unknown";
  const reason = conflict
    ? "Network sources contain conflicting residential and non-residential signals."
    : residential === true
      ? "Blackbox found residential ISP or reverse-DNS evidence."
      : residential === false
        ? `Blackbox identified a ${networkType.toLowerCase()} network.`
        : "No conclusive residential network evidence is available.";
  return {
    residential,
    vpn,
    proxy: flag("proxy"),
    tor: flag("tor"),
    hosting: flag("hosting"),
    networkType,
    source: SOURCE,
    evidence,
    reason,
  };
}

/** Optional beta provider: schema changes, quotas and outages remain inconclusive. */
export async function fetchIpClassification(
  ip: string,
): Promise<IpClassification> {
  if (!canonicalIp(ip))
    return unavailable("Network classification needs a valid public IP.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(ENDPOINT + encodeURIComponent(ip), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok)
      return unavailable(
        response.status === 429
          ? "Network classification is temporarily rate limited."
          : "Network classification is unavailable.",
      );
    return normalizeClassification(await response.json(), ip);
  } catch {
    return unavailable(
      controller.signal.aborted
        ? "Network classification timed out."
        : "Network classification is unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
