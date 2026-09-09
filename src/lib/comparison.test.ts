import assert from "node:assert/strict";
import test from "node:test";
import {
  assessConnection,
  compareTimeZones,
  distanceKm,
  formatOffset,
  formatTime,
  timeZonePlace,
} from "./comparison";

test("timezone comparisons validate zones and recognize aliases", () => {
  assert.equal(compareTimeZones("US/Eastern", "America/New_York"), "match");
  assert.equal(compareTimeZones("UTC", "Etc/UTC"), "match");
  assert.equal(compareTimeZones("Europe/Dublin", "Europe/London"), "different");
  assert.equal(compareTimeZones("", "UTC"), "unknown");
  assert.equal(compareTimeZones("not/a-zone", "not/a-zone"), "unknown");
});

test("time and offset formatting respect daylight saving and fractional offsets", () => {
  const winter = new Date("2026-01-10T12:00:00Z");
  const summer = new Date("2026-07-10T12:00:00Z");
  assert.equal(formatTime("Europe/Dublin", winter), "12:00");
  assert.equal(formatTime("Europe/Dublin", summer), "13:00");
  assert.equal(formatOffset("Europe/Dublin", winter), "UTC");
  assert.equal(formatOffset("Europe/Dublin", summer), "UTC+01:00");
  assert.equal(formatOffset("Asia/Kolkata", winter), "UTC+05:30");
  assert.equal(formatTime("bad", winter), "Unavailable");
  assert.equal(formatOffset("UTC", new Date("invalid")), "Unavailable");
});

test("timezone names are representative places, and UTC has no location", () => {
  assert.equal(timeZonePlace("America/Argentina/Buenos_Aires"), "Buenos Aires");
  assert.equal(timeZonePlace("UTC"), "No geographic location");
  assert.equal(timeZonePlace("Etc/GMT+5"), "No geographic location");
  assert.equal(timeZonePlace("bad"), "Unknown time zone");
});

test("offsets handle both directions of calendar rollover and subsecond dates", () => {
  assert.equal(
    formatOffset("Pacific/Kiritimati", new Date("2026-12-31T23:59:59.999Z")),
    "UTC+14:00",
  );
  assert.equal(
    formatOffset("Pacific/Honolulu", new Date("2026-01-01T00:00:00.999Z")),
    "UTC-10:00",
  );
  assert.equal(
    formatOffset("Asia/Kathmandu", new Date("2026-09-09T23:59:59.999Z")),
    "UTC+05:45",
  );
  assert.equal(
    formatOffset("America/St_Johns", new Date("2026-01-01T00:00:00Z")),
    "UTC-03:30",
  );
  assert.equal(
    formatOffset("Europe/Dublin", new Date("2026-09-09T08:20:00Z")),
    "UTC+01:00",
  );
  assert.equal(
    formatOffset("UTC", new Date("2026-01-01T00:00:00.999Z")),
    "UTC",
  );
});

test("offset changes at the daylight saving transition", () => {
  assert.equal(
    formatOffset("Europe/Dublin", new Date("2026-03-29T00:59:59Z")),
    "UTC",
  );
  assert.equal(
    formatOffset("Europe/Dublin", new Date("2026-03-29T01:00:00Z")),
    "UTC+01:00",
  );
  assert.equal(
    formatOffset("Europe/Dublin", new Date("2026-10-25T00:59:59Z")),
    "UTC+01:00",
  );
  assert.equal(
    formatOffset("Europe/Dublin", new Date("2026-10-25T01:00:00Z")),
    "UTC",
  );
});

test("great-circle distances handle date line, antipodes, and invalid inputs", () => {
  const dublin = { latitude: 53.3498, longitude: -6.2603 };
  assert.equal(distanceKm(dublin, dublin), 0);
  assert.ok(
    Math.abs(
      distanceKm(dublin, { latitude: 51.5074, longitude: -0.1278 }) - 464,
    ) < 2,
  );
  assert.ok(
    distanceKm(
      { latitude: 0, longitude: 179 },
      { latitude: 0, longitude: -179 },
    ) < 223,
  );
  assert.ok(
    Number.isFinite(
      distanceKm(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 180 },
      ),
    ),
  );
  assert.ok(Number.isNaN(distanceKm({ latitude: 91, longitude: 0 }, dublin)));
});

const unknownIp = {
  vpn: null,
  proxy: null,
  tor: null,
  hosting: null,
  timeZone: "Europe/Dublin",
};

test("matching timezones do not imply a direct connection", () => {
  assert.equal(
    assessConnection(unknownIp, "Europe/Dublin").title,
    "VPN status unknown",
  );
  const mismatch = assessConnection(unknownIp, "America/New_York");
  assert.equal(mismatch.title, "Time zones differ");
  assert.match(mismatch.detail, /does not prove VPN use/);
});

test("IP classifications retain uncertainty and positive flags take precedence", () => {
  assert.equal(
    assessConnection(
      { ...unknownIp, vpn: false, proxy: false },
      "Europe/Dublin",
    ).title,
    "VPN status unknown",
  );
  const negative = assessConnection(
    { ...unknownIp, vpn: false, proxy: false, tor: false },
    "Europe/Dublin",
  );
  assert.equal(negative.title, "No VPN flagged");
  assert.match(negative.detail, /does not guarantee/);
  assert.equal(
    assessConnection({ ...unknownIp, hosting: true }, "Europe/Dublin").title,
    "Data center IP",
  );
  const positive = assessConnection(
    { ...unknownIp, tor: true },
    "America/New_York",
  );
  assert.equal(positive.title, "Privacy network flagged");
  assert.match(positive.detail, /Tor/);
});
