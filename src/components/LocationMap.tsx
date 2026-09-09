import { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

export type LocationMapProps = {
  ip: { latitude: number; longitude: number; city: string } | null;
  device: { latitude: number; longitude: number; label: string } | null;
  selected: "ip" | "device";
};

export default function LocationMap({
  ip,
  device,
  selected,
}: LocationMapProps) {
  const map = useRef<MapView>(null);
  const point = selected === "device" ? device : ip;
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  const delta = selected === "ip" ? 0.14 : 0.025;

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    map.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: delta, longitudeDelta: delta },
      450,
    );
  }, [latitude, longitude, delta]);

  if (!point) {
    return (
      <View style={[styles.frame, styles.placeholder]} accessibilityRole="text">
        <View style={styles.emptyPin}>
          <View style={styles.emptyPinCenter} />
        </View>
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

  return (
    <View style={styles.frame}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          ...point,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
        userInterfaceStyle="light"
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsCompass={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        loadingEnabled
        loadingBackgroundColor="#EEEFE7"
        loadingIndicatorColor="#386B52"
        accessibilityLabel={`Map centered on ${selected === "ip" ? `approximate IP location, ${ip?.city || "unknown city"}` : device?.label || "device location"}`}
        accessibilityHint="Pinch to zoom and drag to explore. IP locations are approximate."
      >
        {ip && (
          <Marker
            coordinate={ip}
            pinColor="#386B52"
            title="IP location"
            description={`${ip.city || "Unknown city"} · approximate`}
          />
        )}
        {device && (
          <Marker
            coordinate={device}
            pinColor="#3B78A0"
            title="Device location"
            description={device.label}
          />
        )}
      </MapView>
      <View pointerEvents="none" style={styles.badge}>
        <View
          style={[
            styles.dot,
            { backgroundColor: selected === "ip" ? "#386B52" : "#3B78A0" },
          ]}
        />
        <Text style={styles.badgeText}>
          {selected === "ip" ? "Approximate IP location" : "Device location"}
        </Text>
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
  placeholder: { alignItems: "center", justifyContent: "center", padding: 24 },
  emptyPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#9BA993",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  emptyPinCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9BA993",
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
  badge: {
    position: "absolute",
    top: 14,
    left: 14,
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
