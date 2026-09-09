import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import type { LocationMapProps } from "./LocationMap";

export default function LocationMap({
  ip,
  device,
  selected,
}: LocationMapProps) {
  const [retry, setRetry] = useState(0);
  const point = selected === "device" ? device : ip;
  const validPoint =
    point &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180;

  if (!validPoint) {
    return (
      <View style={[styles.frame, styles.placeholder]} accessibilityRole="text">
        <Text style={styles.title}>
          {selected === "device"
            ? "Your location, when you choose"
            : "A place for your connection"}
        </Text>
        <Text style={styles.caption}>
          {selected === "device"
            ? "Share your device location to see it here."
            : "Your approximate IP location will appear here."}
        </Text>
      </View>
    );
  }

  // Clip the viewport at the date line instead of wrapping its west/east edges.
  const delta = selected === "ip" ? 0.07 : 0.0125;
  const bbox = [
    Math.max(-180, point.longitude - delta),
    Math.max(-90, point.latitude - delta),
    Math.min(180, point.longitude + delta),
    Math.min(90, point.latitude + delta),
  ].join(",");
  const uri = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${point.latitude},${point.longitude}`)}`;
  const label =
    selected === "ip" ? "Approximate IP location" : "Device location";

  return (
    <View style={styles.frame}>
      <WebView
        key={`${uri}:${retry}`}
        source={{ uri }}
        style={styles.map}
        accessibilityLabel={`Map centered on ${label.toLowerCase()}`}
        accessibilityHint="Pinch to zoom and drag to explore. IP locations are approximate."
        // Route every navigation through the validator; a narrow whitelist can
        // hand unmatched URLs to Android's external URL handler automatically.
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={({ url }) => {
          try {
            const target = new URL(url);
            return (
              target.protocol === "https:" &&
              target.hostname === "www.openstreetmap.org"
            );
          } catch {
            return false;
          }
        }}
        javaScriptEnabled
        geolocationEnabled={false}
        allowsFullscreenVideo={false}
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        mixedContentMode="never"
        thirdPartyCookiesEnabled={false}
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <ActivityIndicator color="#386B52" />
          </View>
        )}
        renderError={() => (
          <View style={[styles.frame, styles.placeholder]}>
            <Text style={styles.title}>Map unavailable</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetry((value) => value + 1)}
              hitSlop={12}
            >
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        )}
      />
      <View pointerEvents="none" style={styles.badge}>
        <View
          style={[
            styles.dot,
            { backgroundColor: selected === "ip" ? "#386B52" : "#3B78A0" },
          ]}
        />
        <Text style={styles.badgeText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 210,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#EEEFE7",
  },
  map: { flex: 1, backgroundColor: "#EEEFE7" },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#EEEFE7",
  },
  title: {
    color: "#3D493D",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  caption: {
    color: "#747B70",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 7,
  },
  retry: { color: "#386B52", fontSize: 14, fontWeight: "600", marginTop: 12 },
  // Keep the embed's OpenStreetMap attribution visible along the bottom edge.
  badge: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FFFFFFF0",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, color: "#384536", fontWeight: "500" },
});
