import { countries } from "./countries";

export const REQUIREMENT_KEYS = [
  "vpn",
  "residential",
  "ipCountry",
  "timezoneCountry",
  "gpsCountry",
] as const;

export type RequirementKey = (typeof REQUIREMENT_KEYS)[number];
export type Profile = {
  id: string;
  name: string;
  requirements: Partial<Record<RequirementKey, string>>;
};
export type Snapshot = {
  vpn: boolean | null;
  residential: boolean | null;
  ipCountry: string | null;
  timezoneCountry: string | null;
  gpsCountry: string | null;
  checkedAt: number | null;
  gpsCheckedAt: number | null;
  loading: boolean;
};
export type RequirementResult = {
  key: RequirementKey;
  status: "pass" | "fail" | "unknown";
  expected: string;
  actual: string | null;
};
export type ProfileEvaluation = {
  status: RequirementResult["status"] | "empty";
  results: RequirementResult[];
};

export const RESULT_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_PROFILES = 100;
const COUNTRY_CODES = new Set(countries.map(({ code }) => code));

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && COUNTRY_CODES.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequirementValue(
  key: RequirementKey,
  value: unknown,
): value is string {
  return key === "vpn" || key === "residential"
    ? value === "yes" || value === "no"
    : isCountryCode(value);
}

export function isProfile(value: unknown): value is Profile {
  if (!isRecord(value) || Object.keys(value).length !== 3) return false;
  const { id, name, requirements } = value;
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
    typeof name !== "string" ||
    !name.trim() ||
    name !== name.trim() ||
    name.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(name) ||
    !isRecord(requirements)
  )
    return false;
  return Object.entries(requirements).every(
    ([key, expected]) =>
      REQUIREMENT_KEYS.includes(key as RequirementKey) &&
      isRequirementValue(key as RequirementKey, expected),
  );
}

function areProfiles(value: unknown): value is Profile[] {
  if (
    !Array.isArray(value) ||
    value.length > MAX_PROFILES ||
    !value.every(isProfile)
  )
    return false;
  return new Set(value.map((profile) => profile.id)).size === value.length;
}

/** An editable example requested by the user; not N26's official requirements. */
export function createN26Profile(): Profile {
  return {
    id: "n26-example",
    name: "N26",
    requirements: {
      vpn: "yes",
      residential: "yes",
      ipCountry: "IE",
      timezoneCountry: "IE",
      gpsCountry: "IE",
    },
  };
}

/** Missing storage seeds the example once; an intentionally saved empty list stays empty. */
export function parseStoredProfiles(raw: string | null): Profile[] {
  if (raw === null) return [createN26Profile()];
  try {
    const stored: unknown = JSON.parse(raw);
    if (
      !isRecord(stored) ||
      Object.keys(stored).length !== 2 ||
      stored.version !== 1 ||
      !areProfiles(stored.profiles)
    )
      return [];
    return stored.profiles;
  } catch {
    return [];
  }
}

export function serializeProfiles(profiles: Profile[]): string {
  if (!areProfiles(profiles))
    throw new Error(
      "App preferences are invalid. Check the name and requirements.",
    );
  // Explicitly serialize only preferences. Device observations are never persisted.
  return JSON.stringify({
    version: 1,
    profiles: profiles.map(({ id, name, requirements }) => ({
      id,
      name,
      requirements,
    })),
  });
}

function isFresh(timestamp: number | null, now: number): boolean {
  return (
    typeof timestamp === "number" &&
    Number.isFinite(timestamp) &&
    Number.isFinite(now) &&
    timestamp <= now &&
    now - timestamp <= RESULT_MAX_AGE_MS
  );
}

export function evaluateProfile(
  profile: Profile,
  snapshot: Snapshot,
  now = Date.now(),
): ProfileEvaluation {
  if (!isProfile(profile)) return { status: "unknown", results: [] };
  const results: RequirementResult[] = [];
  for (const key of REQUIREMENT_KEYS) {
    const expected = profile.requirements[key];
    if (expected === undefined) continue;
    const fresh =
      !snapshot.loading &&
      isFresh(
        key === "gpsCountry" ? snapshot.gpsCheckedAt : snapshot.checkedAt,
        now,
      );
    const observed = snapshot[key];
    const actual = !fresh
      ? null
      : key === "vpn" || key === "residential"
        ? typeof observed === "boolean"
          ? observed
            ? "yes"
            : "no"
          : null
        : isCountryCode(observed)
          ? observed
          : null;
    results.push({
      key,
      expected,
      actual,
      status:
        actual === null ? "unknown" : actual === expected ? "pass" : "fail",
    });
  }
  const status =
    results.length === 0
      ? "empty"
      : results.some((result) => result.status === "fail")
        ? "fail"
        : results.some((result) => result.status === "unknown")
          ? "unknown"
          : "pass";
  return { status, results };
}
