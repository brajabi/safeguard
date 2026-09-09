import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchIpClassification,
  normalizeClassification,
} from "./classification";

const ip = "72.49.1.1";
const response = (overrides: Record<string, unknown> = {}) => ({
  ip,
  error: null,
  classification: "residential",
  confidence: 1,
  signals: { residentialasn: true, hosting: false, proxy: false, tor: false },
  evidence: ["residential_asn"],
  ...overrides,
});

test("positive residential evidence supports residential VPN independently", () => {
  const result = normalizeClassification(
    response({
      classification: "vpn",
      evidence: ["residential_asn", "rdns_vpn"],
    }),
    ip,
  );
  assert.equal(result.residential, true);
  assert.equal(result.vpn, true);
  assert.equal(result.networkType, "Residential VPN");
});

test("VPN alone and no hosting never imply residential or non-residential", () => {
  const result = normalizeClassification(
    response({
      classification: "vpn",
      signals: { vpnasn: true, hosting: false },
      evidence: ["vpn_asn"],
    }),
    ip,
  );
  assert.equal(result.residential, null);
  assert.equal(result.vpn, true);
  assert.equal(
    normalizeClassification(
      response({ signals: { hosting: false }, evidence: [] }),
      ip,
    ).residential,
    null,
  );
});

test("hosting, mobile and business positive evidence rule out residential", () => {
  for (const [classification, signal, rule] of [
    ["hosting", "hosting", "hosting_asn"],
    ["mobile", "mobileasn", "mobile_asn"],
    ["business", "businessasn", "business_asn"],
  ]) {
    assert.equal(
      normalizeClassification(
        response({
          classification,
          signals: { [signal]: true },
          evidence: [rule],
        }),
        ip,
      ).residential,
      false,
    );
  }
});

test("conflicting network evidence stays unknown even when winner is residential", () => {
  const result = normalizeClassification(
    response({ signals: { residentialasn: true, hosting: true } }),
    ip,
  );
  assert.equal(result.residential, null);
  assert.equal(result.networkType, "Unknown");
});

test("absence of VPN evidence is inconclusive and missing flags stay null", () => {
  const result = normalizeClassification(
    response({ signals: { residentialasn: true } }),
    ip,
  );
  assert.equal(result.vpn, null);
  assert.equal(result.hosting, null);
  assert.equal(result.proxy, null);
  assert.equal(result.tor, null);
});

test("malformed schema and string boolean signals never become claims", () => {
  for (const payload of [
    null,
    [],
    response({ signals: { residentialasn: "true" } }),
    response({ confidence: NaN }),
    response({ evidence: "residential_asn" }),
    response({ classification: "new-kind" }),
    response({ error: "unavailable" }),
  ]) {
    assert.equal(normalizeClassification(payload, ip).residential, null);
  }
});

test("an answer for another IP is rejected", () => {
  const result = normalizeClassification(response({ ip: "8.8.8.8" }), ip);
  assert.equal(result.residential, null);
  assert.equal(result.hosting, null);
  assert.match(result.reason, /different IP/);
  assert.equal(
    normalizeClassification(response({ ip: "not-an-ip" }), ip).reason,
    "Network classification is unavailable.",
  );
  assert.equal(
    normalizeClassification(response({ ip: undefined }), ip).reason,
    "Network classification is unavailable.",
  );
});

test("equivalent IPv6 and IPv4-mapped addresses match safely", () => {
  assert.equal(
    normalizeClassification(
      response({ ip: "2001:db8::1" }),
      "2001:0DB8:0:0:0:0:0:1",
    ).residential,
    true,
  );
  assert.equal(
    normalizeClassification(response(), "::ffff:72.49.1.1").residential,
    true,
  );
  assert.equal(
    normalizeClassification(response({ ip: "::ffff:4831:101" }), ip)
      .residential,
    true,
  );
  assert.equal(
    normalizeClassification(response({ ip: "2001:db8::2" }), "2001:db8::1")
      .residential,
    null,
  );
  assert.equal(
    normalizeClassification(response({ ip: "::::" }), "::::").residential,
    null,
  );
});

test("provider failures preserve unknown instead of rejecting the IP lookup", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  assert.equal((await fetchIpClassification(ip)).residential, null);
  mock.mock.mockImplementation(
    async () => new Response("rate limited", { status: 429 }),
  );
  assert.match((await fetchIpClassification(ip)).reason, /rate limited/);
  mock.mock.mockImplementation(
    async () => new Response("not json", { status: 200 }),
  );
  assert.equal((await fetchIpClassification(ip)).residential, null);
});

test("fetch queries the specific observed IP over HTTPS with cancellation", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request, options?: RequestInit) => {
      assert.equal(url, "https://blackbox.ipinfo.app/api/v3beta/72.49.1.1");
      assert.ok(options?.signal instanceof AbortSignal);
      assert.equal(options?.cache, "no-store");
      return Response.json(response());
    },
  );
  assert.equal((await fetchIpClassification(ip)).residential, true);
});
