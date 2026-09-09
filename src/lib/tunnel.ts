import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export interface TunnelStatus {
  /** False in Expo Go, on non-iOS platforms, or when the native check fails. */
  available: boolean;
  /** A tunnel interface is up. This does not establish VPN protection. */
  active: boolean;
  interfaces: string[];
}

interface TunnelStatusModule {
  getTunnelStatus(): TunnelStatus;
}

/** Local observation only; interface names are never sent to an external service. */
export function getTunnelStatus(): TunnelStatus {
  const unavailable = { available: false, active: false, interfaces: [] };
  if (Platform.OS !== "ios") return unavailable;
  try {
    const nativeModule =
      requireOptionalNativeModule<TunnelStatusModule>("TunnelStatus");
    if (!nativeModule) return unavailable;
    const result = nativeModule.getTunnelStatus();
    if (
      typeof result?.available !== "boolean" ||
      typeof result.active !== "boolean" ||
      !Array.isArray(result.interfaces) ||
      !result.interfaces.every((name) => typeof name === "string")
    )
      return unavailable;
    return result;
  } catch {
    return unavailable;
  }
}
