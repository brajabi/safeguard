import assert from "node:assert/strict";
import test from "node:test";
import {
  createN26Profile,
  evaluateProfile,
  isProfile,
  parseStoredProfiles,
  RESULT_MAX_AGE_MS,
  serializeProfiles,
  type Profile,
  type Snapshot,
} from "./profiles";

const now = 1_800_000_000_000;
const fresh: Snapshot = {
  vpn: true,
  residential: true,
  ipCountry: "IE",
  timezoneCountry: "IE",
  gpsCountry: "IE",
  checkedAt: now,
  gpsCheckedAt: now,
  loading: false,
};

test("the editable N26 example passes only when all five observations match", () => {
  const result = evaluateProfile(createN26Profile(), fresh, now);
  assert.equal(result.status, "pass");
  assert.equal(result.results.length, 5);
  for (const key of ["vpn", "residential"] as const) {
    const failing = evaluateProfile(
      createN26Profile(),
      { ...fresh, [key]: false },
      now,
    );
    assert.equal(failing.status, "fail");
    assert.equal(
      failing.results.find((result) => result.key === key)?.actual,
      "no",
    );
  }
  for (const key of ["ipCountry", "timezoneCountry", "gpsCountry"] as const) {
    assert.equal(
      evaluateProfile(createN26Profile(), { ...fresh, [key]: "GB" }, now)
        .status,
      "fail",
    );
  }
});

test("unavailable observations stay unknown and a known failure takes precedence", () => {
  assert.equal(
    evaluateProfile(createN26Profile(), { ...fresh, residential: null }, now)
      .status,
    "unknown",
  );
  const failed = evaluateProfile(
    createN26Profile(),
    { ...fresh, vpn: false, residential: null },
    now,
  );
  assert.equal(failed.status, "fail");
  assert.equal(
    failed.results.find((result) => result.key === "residential")?.status,
    "unknown",
  );
  assert.equal(
    evaluateProfile(createN26Profile(), { ...fresh, ipCountry: "ZZ" }, now)
      .status,
    "unknown",
  );
});

test("network and GPS freshness expire separately after five minutes", () => {
  const profile = createN26Profile();
  assert.equal(
    evaluateProfile(profile, fresh, now + RESULT_MAX_AGE_MS).status,
    "pass",
  );
  assert.equal(
    evaluateProfile(profile, fresh, now + RESULT_MAX_AGE_MS + 1).status,
    "unknown",
  );
  const gpsOld = evaluateProfile(
    profile,
    { ...fresh, gpsCheckedAt: now - RESULT_MAX_AGE_MS - 1 },
    now,
  );
  assert.equal(
    gpsOld.results.find((result) => result.key === "gpsCountry")?.status,
    "unknown",
  );
  assert.equal(
    gpsOld.results.find((result) => result.key === "ipCountry")?.status,
    "pass",
  );
  const networkOld = evaluateProfile(
    profile,
    { ...fresh, checkedAt: null },
    now,
  );
  assert.equal(
    networkOld.results.find((result) => result.key === "gpsCountry")?.status,
    "pass",
  );
  assert.equal(
    networkOld.results.find((result) => result.key === "ipCountry")?.status,
    "unknown",
  );
});

test("refreshing, missing timestamps, and backwards clock changes cannot pass", () => {
  for (const snapshot of [
    { ...fresh, loading: true },
    { ...fresh, checkedAt: null, gpsCheckedAt: null },
    { ...fresh, checkedAt: now + 1, gpsCheckedAt: now + 1 },
  ]) {
    const result = evaluateProfile(createN26Profile(), snapshot, now);
    assert.equal(result.status, "unknown");
    assert.ok(
      result.results.every(
        (row) => row.status === "unknown" && row.actual === null,
      ),
    );
  }
});

test("only selected preferences are checked, with explicit negative preferences supported", () => {
  const profile: Profile = {
    id: "test",
    name: "Travel",
    requirements: { vpn: "no" },
  };
  assert.equal(
    evaluateProfile(
      profile,
      { ...fresh, vpn: false, residential: null, gpsCountry: null },
      now,
    ).status,
    "pass",
  );
  assert.deepEqual(
    evaluateProfile({ ...profile, requirements: {} }, fresh, now),
    { status: "empty", results: [] },
  );
});

test("strict preference validation rejects malformed or incomplete enabled requirements", () => {
  const valid = createN26Profile();
  assert.ok(isProfile(valid));
  for (const invalid of [
    null,
    [],
    { ...valid, name: " " },
    { ...valid, name: "x".repeat(81) },
    { ...valid, id: "" },
    { ...valid, snapshot: fresh },
    { ...valid, requirements: { vpn: true } },
    { ...valid, requirements: { ipCountry: "ie" } },
    { ...valid, requirements: { ipCountry: "ZZ" } },
    { ...valid, requirements: { gpsCountry: "" } },
    { ...valid, requirements: { unsupported: "yes" } },
  ])
    assert.equal(isProfile(invalid), false);
});

test("storage seeds only first use, preserves edits and deletions, and rejects malformed data", () => {
  assert.deepEqual(parseStoredProfiles(null), [createN26Profile()]);
  assert.deepEqual(parseStoredProfiles(serializeProfiles([])), []);
  const profiles = [{ ...createN26Profile(), name: "My travel settings" }];
  assert.deepEqual(parseStoredProfiles(serializeProfiles(profiles)), profiles);
  for (const raw of [
    "oops",
    "null",
    "[]",
    '{"version":2,"profiles":[]}',
    '{"version":1,"profiles":[{}]}',
  ]) {
    assert.deepEqual(parseStoredProfiles(raw), []);
  }
  assert.throws(() =>
    serializeProfiles([createN26Profile(), createN26Profile()]),
  );
  assert.deepEqual(
    parseStoredProfiles(
      JSON.stringify({
        version: 1,
        profiles: [createN26Profile(), createN26Profile()],
      }),
    ),
    [],
  );
  assert.throws(() =>
    serializeProfiles([{ ...createN26Profile(), snapshot: fresh } as Profile]),
  );
  assert.doesNotMatch(
    serializeProfiles(profiles),
    /checkedAt|gpsCheckedAt|loading/,
  );
});
