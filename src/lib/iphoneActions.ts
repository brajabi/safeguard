import { getCountry } from "countries-and-timezones";
import { countryLabel } from "./countries";

// Verified in the installed Shadowrocket app: Info.plist registers the
// shadowrocket scheme, and its executable contains shadowrocket://connect.
// Opening this URL requests a connection; it does not prove a VPN is connected.
export const SHADOWROCKET_CONNECT_URL = "shadowrocket://connect";

type LinkingPort = {
  canOpenURL(url: string): Promise<boolean>;
  openURL(url: string): Promise<unknown>;
};

export async function requestShadowrocketConnection(
  platform: string,
  linking: LinkingPort,
): Promise<{ opened: boolean; message: string }> {
  if (platform !== "ios") {
    return {
      opened: false,
      message: "Shadowrocket connection is available on iPhone.",
    };
  }

  try {
    if (!(await linking.canOpenURL(SHADOWROCKET_CONNECT_URL))) {
      return {
        opened: false,
        message:
          "Install and configure Shadowrocket on your iPhone, then try again.",
      };
    }
    await linking.openURL(SHADOWROCKET_CONNECT_URL);
    return {
      opened: true,
      message: "Connection requested. Return to Safeguard to check it.",
    };
  } catch {
    return {
      opened: false,
      message:
        "Could not open Shadowrocket. Open it manually to connect, then return to Safeguard.",
    };
  }
}

export function timeZoneInstructions(countryCode?: string): string {
  const steps =
    "iOS requires a manual change: open Settings > General > Date & Time, turn off Set Automatically, then tap Time Zone.";
  const country =
    countryCode && /^[A-Z]{2}$/.test(countryCode)
      ? getCountry(countryCode)
      : null;
  if (!country || country.timezones.length === 0) {
    return `${steps}\n\nSearch for the city matching your intended region. Return to Safeguard to refresh the check.`;
  }

  const zones = country.timezones;
  const suggestions = zones
    .slice(0, 6)
    .map((zone) => {
      const city = zone.split("/").at(-1)!.replaceAll("_", " ");
      return `${city} (${zone})`;
    })
    .join(", ");
  const guidance =
    zones.length === 1
      ? `For ${countryLabel(country.id)}, search for ${suggestions}.`
      : `${countryLabel(country.id)} has multiple time zones. Choose the city matching your intended region. Examples: ${suggestions}${zones.length > 6 ? ", and more" : ""}.`;

  return `${steps}\n\n${guidance}\n\nReturn to Safeguard to refresh the check.`;
}
