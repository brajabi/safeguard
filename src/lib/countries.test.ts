import assert from "node:assert/strict";
import test from "node:test";
import { countries, countryCodeForTimeZone, countryLabel } from "./countries";

test("country labels include flags and only accept supported exact country codes", () => {
  assert.equal(countryLabel("IE"), "🇮🇪 Ireland");
  assert.equal(countryLabel("JP"), "🇯🇵 Japan");
  assert.ok(countries.length > 240);
  assert.equal(new Set(countries.map(({ code }) => code)).size, countries.length);
  for (const { code, name } of countries) {
    assert.match(code, /^[A-Z]{2}$/);
    assert.ok(countryLabel(code).endsWith(` ${name}`));
    assert.equal(Array.from(countryLabel(code).split(" ")[0]).length, 2);
    assert.equal(countryLabel(code.toLowerCase()), "⚠️ Not available");
  }
  for (const code of [null, "", "ZZ", "USA", " IE", "IE ", "__proto__", "UK"]) {
    assert.equal(countryLabel(code), "⚠️ Not available");
  }
});

test("named zones and legacy aliases retain unique country information", () => {
  assert.equal(countryCodeForTimeZone("Europe/Dublin"), "IE");
  assert.equal(countryCodeForTimeZone("Eire"), "IE");
  assert.equal(countryCodeForTimeZone("America/Los_Angeles"), "US");
  assert.equal(countryCodeForTimeZone("US/Pacific"), "US");
  assert.equal(countryCodeForTimeZone("Asia/Calcutta"), "IN");
  assert.equal(countryCodeForTimeZone("Europe/Guernsey"), "GG");
});

test("shared zones, fixed offsets and invalid zones never imply one country", () => {
  for (const zone of [
    "Europe/London", "Europe/Zurich", "Europe/Berlin", "Africa/Abidjan",
    "UTC", "Etc/UTC", "GMT", "Etc/GMT+5", "", "invalid/zone", "__proto__",
  ]) {
    assert.equal(countryCodeForTimeZone(zone), null, zone);
  }
});
