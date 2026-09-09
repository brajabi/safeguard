import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { LocationMapProps } from "./LocationMap";

export default function LocationMap({
  ip,
  device,
  selected,
}: LocationMapProps) {
  const point = selected === "device" ? device : ip;
  const label = selected === "device" ? device?.label : ip?.city;
  return (
    <View style={styles.frame}>
      <View style={styles.pin}>
        <View style={styles.pinCenter} />
      </View>
      <Text style={styles.title}>
        {point ? label || "Location found" : "Your location will appear here"}
      </Text>
      <Text style={styles.caption}>
        {point
          ? `${point.latitude.toFixed(3)}°, ${point.longitude.toFixed(3)}° · ${selected === "ip" ? "Approximate IP location" : "Device location"}`
          : selected === "device"
            ? "Share your device location to see it here."
            : "Run a check to find your approximate IP location."}
      </Text>
      {point && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${label || "this location"} in OpenStreetMap`}
          onPress={() =>
            void Linking.openURL(
              `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=12/${point.latitude}/${point.longitude}`,
            )
          }
          style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.linkText}>Open in OpenStreetMap ↗</Text>
        </Pressable>
      )}
      <Text style={styles.note}>Interactive Apple Maps on iOS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 210,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#EEEFE7",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#8D9F82",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  pinCenter: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#7C936E",
  },
  title: {
    color: "#3D493D",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  caption: {
    color: "#747B70",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
  },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  linkText: { color: "#386B52", fontSize: 12, fontWeight: "600" },
  note: { color: "#858D7E", fontSize: 10, marginTop: 3 },
});
