import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchIpInfo, fetchIpv6, isIpv6, normalizeIpInfo } from "./ip";

const fixture = {
  success: true,
  ip: "203.0.113.8",
  city: "Dublin",
  country: "Ireland",
  country_code: "IE",
  latitude: 53.3498,
  longitude: -6.2603,
  timezone: { id: "Europe/Dublin" },
  connection: { asn: 12345, isp: "Example ISP" },
};

test("free lookup normalizes location and preserves unknown security status", () => {
  const result = normalizeIpInfo(fixture);
  assert.equal(result.timeZone, "Europe/Dublin");
  assert.equal(result.asn, "AS12345");
  assert.equal(result.region, "");
  assert.deepEqual(
    [result.vpn, result.proxy, result.tor, result.hosting],
    [null, null, null, null],
  );
});

test("security claims require actual booleans, never truthy strings", () => {
  const result = normalizeIpInfo({
    ...fixture,
    security: { vpn: "false", proxy: false, tor: true, hosting: 0 },
  });
  assert.deepEqual(
    [result.vpn, result.proxy, result.tor, result.hosting],
    [null, false, true, null],
  );
});

test("rejects provider errors, invalid addresses and missing/out-of-range coordinates", () => {
  for (const data of [
    null,
    [],
    {},
    { ...fixture, success: false },
    { ...fixture, ip: "999.1.1.1" },
    { ...fixture, latitude: "53.3" },
    { ...fixture, latitude: NaN },
    { ...fixture, latitude: 91 },
    { ...fixture, longitude: 181 },
    { ...fixture, longitude: undefined },
  ]) {
    assert.throws(() => normalizeIpInfo(data));
  }
  assert.equal(
    normalizeIpInfo({ ...fixture, latitude: 0, longitude: 0 }).latitude,
    0,
  );
});

test("IPv6 parsing handles compression and mapped addresses without accepting malformed input", () => {
  for (const ip of [
    "2001:db8::1",
    "::1",
    "::",
    "2001:db8:0:0:0:0:0:1",
    "::ffff:192.0.2.1",
  ])
    assert.equal(isIpv6(ip), true, ip);
  for (const ip of [
    "1.2.3.4",
    ":1",
    "::::",
    "1::2::3",
    "gggg::1",
    "1:2:3:4:5:6:7:8::",
    "::ffff:999.1.1.1",
    "fe80::1%en0",
  ])
    assert.equal(isIpv6(ip), false, ip);
});

test("HTTP errors surface while IPv6 failures remain inconclusive", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("{}", { status: 429 }),
  );
  await assert.rejects(fetchIpInfo, /rate limited/);
  assert.equal(await fetchIpv6(), null);
});

test("IPv6 endpoint cannot accidentally return an IPv4 result", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({ ip: "203.0.113.8" })),
  );
  assert.equal(await fetchIpv6(), null);
  fetchMock.mock.mockImplementation(
    async () => new Response(JSON.stringify({ ip: "2001:db8::42" })),
  );
  assert.equal(await fetchIpv6(), "2001:db8::42");
});

test("malformed JSON produces an actionable error", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>Unavailable</html>"),
  );
  await assert.rejects(fetchIpInfo, /unreadable response/);
});
