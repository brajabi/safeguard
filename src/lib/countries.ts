import { getAllCountries, getTimezone } from "countries-and-timezones";

export const countries: Array<{ code: string; name: string }> = Object.values(
  getAllCountries(),
)
  .map(({ id, name }) => ({ code: id, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const countryNames = new Map(countries.map(({ code, name }) => [code, name]));

export function countryLabel(code: string | null): string {
  const name = code === null ? undefined : countryNames.get(code);
  if (!code || !name) return "⚠️ Not available";

  const flag = String.fromCodePoint(
    ...Array.from(code, (letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
  return `${flag} ${name}`;
}

/**
 * Identifies a named time zone's territory, never the device's physical location.
 * Preserve country-specific aliases: canonicalizing Europe/Guernsey to London
 * would discard its territory. Shared zones and fixed offsets are inconclusive.
 */
export function countryCodeForTimeZone(zone: string): string | null {
  const timeZone = getTimezone(zone);
  if (
    !timeZone ||
    !Array.isArray(timeZone.countries) ||
    timeZone.countries.length !== 1
  )
    return null;
  const code = timeZone.countries[0];
  return countryNames.has(code) ? code : null;
}
