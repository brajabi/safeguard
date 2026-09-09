import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import {
  requestShadowrocketConnection,
  timeZoneInstructions,
} from "../lib/iphoneActions";

type Props = {
  requiredCountry?: string;
  showVpn?: boolean;
  showTimezone?: boolean;
  disabled?: boolean;
  onConnectionRequest?: () => void;
  onConnectionFailure?: () => void;
};

export default function IPhoneActions({
  requiredCountry,
  showVpn = true,
  showTimezone = true,
  disabled = false,
  onConnectionRequest,
  onConnectionFailure,
}: Props) {
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (Platform.OS !== "ios" || (!showVpn && !showTimezone)) return null;

  const connect = async () => {
    if (busy.current || disabled) return;
    busy.current = true;
    setOpening(true);
    setMessage("");
    let requested = false;
    try {
      const result = await requestShadowrocketConnection(Platform.OS, {
        canOpenURL: (url) => Linking.canOpenURL(url),
        openURL: (url) => {
          if (!mounted.current)
            return Promise.reject(new Error("Screen closed"));
          requested = true;
          onConnectionRequest?.();
          return Linking.openURL(url);
        },
      });
      if (!result.opened && mounted.current) {
        setMessage(result.message);
        if (requested) onConnectionFailure?.();
      }
    } finally {
      busy.current = false;
      if (mounted.current) setOpening(false);
    }
  };
  const timezone = () =>
    Alert.alert(
      "Set time zone",
      `${timeZoneInstructions(requiredCountry)}\n\nOpen Settings starts on Safeguard’s page. Use the Settings back button to reach General.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => {
            void Linking.openSettings().catch(() =>
              setMessage("Open Settings manually, then General → Date & Time."),
            );
          },
        },
      ],
    );
  return (
    <View>
      <View style={s.actions}>
        {showVpn && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Connect Shadowrocket VPN"
            disabled={disabled || opening}
            onPress={() => void connect()}
            style={[s.action, (disabled || opening) && s.disabled]}
          >
            <Feather
              accessible={false}
              accessibilityElementsHidden
              name="shield"
              size={15}
              color="#23745B"
            />
            <Text style={s.label}>
              {opening ? "Opening…" : "Connect Shadowrocket"}
            </Text>
          </Pressable>
        )}
        {showTimezone && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show iPhone time-zone settings instructions"
            onPress={timezone}
            style={s.action}
          >
            <Feather
              accessible={false}
              accessibilityElementsHidden
              name="clock"
              size={15}
              color="#23745B"
            />
            <Text style={s.label}>Set time zone</Text>
          </Pressable>
        )}
      </View>
      {!!message && (
        <Text accessibilityRole="alert" style={s.message}>
          {message}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 18,
  },
  action: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
  },
  label: { fontSize: 12, color: "#23745B", fontWeight: "600" },
  disabled: { opacity: 0.4 },
  message: {
    color: "#90682B",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
});
