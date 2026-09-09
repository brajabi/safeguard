import "./global.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { HeroUINativeProvider } from "heroui-native/provider";
import { Button } from "heroui-native/button";
import { Uniwind } from "uniwind";
import * as Location from "expo-location";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Feather from "@expo/vector-icons/Feather";
import LocationMap from "./src/components/LocationMap";
import AppChecker from "./src/components/AppChecker";
import { countryLabel, countryCodeForTimeZone } from "./src/lib/countries";
import type { Snapshot } from "./src/lib/profiles";
import { getTunnelStatus } from "./src/lib/tunnel";
import { fetchIpInfo, fetchIpv6, type IpInfo } from "./src/lib/ip";
import {
  compareTimeZones,
  distanceKm,
  formatOffset,
  formatTime,
  getDeviceTimeZone,
  timeZonePlace,
  type DeviceLocation,
} from "./src/lib/comparison";

Uniwind.setTheme("light");
const C = {
  bg: "#F7F8F4",
  card: "#FFFFFF",
  ink: "#1A3029",
  muted: "#738078",
  line: "#E8ECE5",
  green: "#23745B",
  pale: "#EAF2E9",
  amber: "#90682B",
};
type IconName = React.ComponentProps<typeof Feather>["name"];
function Icon({
  name,
  size = 19,
  color = C.green,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Feather
      name={name}
      size={size}
      color={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text selectable style={[s.rowValue, mono && s.mono]}>
        {value}
      </Text>
    </View>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={s.eyebrow}>{children}</Text>;
}

function Dashboard() {
  const [tab, setTab] = useState<"home" | "checker">("home");
  const [gpsCountry, setGpsCountry] = useState<string | null>(null);
  const [gpsCheckedAt, setGpsCheckedAt] = useState<number | null>(null);
  const locationBusy = useRef(false);
  const locationGeneration = useRef(0);
  const [tunnel, setTunnel] = useState(getTunnelStatus);
  const [ip, setIp] = useState<IpInfo | null>(null);
  const [ipv6, setIpv6] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<Date | null>(null);
  const [zone, setZone] = useState(getDeviceTimeZone);
  const [now, setNow] = useState(new Date());
  const [device, setDevice] = useState<DeviceLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [denied, setDenied] = useState(false);
  const [selected, setSelected] = useState<"ip" | "device">("ip");
  const [info, setInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const busy = useRef(false);
  const refreshQueued = useRef(false);
  const mounted = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(async (): Promise<void> => {
    if (busy.current) {
      refreshQueued.current = true;
      return;
    }
    busy.current = true;
    setLoading(true);
    setError("");
    setZone(getDeviceTimeZone());
    setTunnel(getTunnelStatus());
    const results = await Promise.allSettled([fetchIpInfo(), fetchIpv6()]);
    if (mounted.current) {
      if (results[0].status === "fulfilled") {
        setIp(results[0].value);
        setChecked(new Date());
      } else {
        setIp(null);
        setChecked(null);
        setError(
          "We couldn’t check your connection. Check your internet and try again.",
        );
      }
      setIpv6(results[1].status === "fulfilled" ? results[1].value : null);
      setTunnel(getTunnelStatus());
      setLoading(refreshQueued.current);
    }
    busy.current = false;
    if (refreshQueued.current && mounted.current) {
      refreshQueued.current = false;
      void refresh();
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(
      () =>
        setNow((previous) => {
          const current = new Date();
          return Math.floor(previous.getTime() / 60000) ===
            Math.floor(current.getTime() / 60000)
            ? previous
            : current;
        }),
      1000,
    );
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setZone(getDeviceTimeZone());
        void Location.getForegroundPermissionsAsync()
          .then((permission) => {
            if (!mounted.current) return;
            setDenied(
              permission.status !== "granted" && !permission.canAskAgain,
            );
            if (permission.status !== "granted") {
              locationGeneration.current += 1;
              locationBusy.current = false;
              setLocating(false);
              setDevice(null);
              setGpsCountry(null);
              setGpsCheckedAt(null);
            }
          })
          .catch(() => {});
        void refresh();
      }
    });
    return () => {
      mounted.current = false;
      locationGeneration.current += 1;
      clearInterval(timer);
      sub.remove();
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [refresh]);
  const locate = async () => {
    if (locationBusy.current) return;
    locationBusy.current = true;
    const requestGeneration = ++locationGeneration.current;
    const isCurrent = () =>
      mounted.current && requestGeneration === locationGeneration.current;
    setLocating(true);
    setDevice(null);
    setGpsCountry(null);
    setGpsCheckedAt(null);
    setLocationError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!isCurrent()) return;
      if (permission.status !== "granted") {
        setDenied(!permission.canAskAgain);
        setLocationError(
          "Location access is off. Your IP and time zone still work.",
        );
        return;
      }
      setDenied(false);
      if (!(await Location.hasServicesEnabledAsync()))
        throw new Error("services");
      const position = await new Promise<Location.LocationObject>(
        (resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("timeout")), 18000);
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }).then(
            (value) => {
              clearTimeout(timeout);
              resolve(value);
            },
            (reason) => {
              clearTimeout(timeout);
              reject(reason);
            },
          );
        },
      );
      if (!isCurrent()) return;
      setDevice({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        label: "Device location",
      });
      setSelected("device");
      setGpsCheckedAt(position.timestamp);
      try {
        const places = await new Promise<Location.LocationGeocodedAddress[]>(
          (resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error("geocode timeout")),
              8000,
            );
            Location.reverseGeocodeAsync(position.coords).then(
              (result) => {
                clearTimeout(timer);
                resolve(result);
              },
              (reason) => {
                clearTimeout(timer);
                reject(reason);
              },
            );
          },
        );
        if (isCurrent()) {
          const code = places[0]?.isoCountryCode?.toUpperCase();
          setGpsCountry(code && /^[A-Z]{2}$/.test(code) ? code : null);
          if (!code)
            setLocationError(
              "GPS coordinates found, but the country couldn’t be resolved. Try again.",
            );
        }
      } catch {
        if (isCurrent())
          setLocationError(
            "GPS coordinates found, but the country lookup is unavailable. Try again.",
          );
      }
      void Haptics.selectionAsync().catch(() => {});
    } catch {
      if (isCurrent())
        setLocationError(
          "Couldn’t get a location fix. Check Location Services and try again.",
        );
    } finally {
      if (isCurrent()) {
        locationBusy.current = false;
        setLocating(false);
      }
    }
  };
  const timezoneCountry = countryCodeForTimeZone(zone);
  const snapshot: Snapshot = {
    vpn: ip?.vpn ?? null,
    residential: null,
    ipCountry: ip?.countryCode || null,
    timezoneCountry,
    gpsCountry,
    checkedAt: checked?.getTime() ?? null,
    gpsCheckedAt,
    loading,
  };
  const locateOrSettings = () => {
    if (denied) void Linking.openSettings();
    else void locate();
  };
  const match = ip ? compareTimeZones(zone, ip.timeZone) : "unknown";
  const copy = async () => {
    if (!ip) return;
    try {
      await Clipboard.setStringAsync(ip.ip);
      setCopied(true);
      void Haptics.selectionAsync().catch(() => {});
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        "Couldn’t copy. You can select the address to copy it manually.",
      );
    }
  };
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, display: tab === "home" ? "flex" : "none" }}>
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={C.green}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={s.header}>
            <View style={s.brand}>
              <View style={s.logo}>
                <Icon name="shield" color="white" size={21} />
              </View>
              <Text style={s.brandName}>
                safeguard<Text style={{ color: C.green }}> .</Text>
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="About these checks and privacy"
              onPress={() => setInfo(true)}
              style={s.iconButton}
            >
              <Icon name="info" color={C.muted} />
            </Pressable>
          </View>
          <View style={[s.intro, { marginTop: 27, marginBottom: 18 }]}>
            <Eyebrow>YOUR CONNECTION, AT A GLANCE</Eyebrow>
            <Text style={s.title}>Your results.</Text>
            <Text style={s.subtitle}>
              Know where you stand before you open an app.
            </Text>
          </View>
          <View style={s.card}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 9,
              }}
            >
              <Text style={s.summaryTitle}>Connection checklist</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh checklist"
                onPress={refresh}
                disabled={loading}
                style={s.iconButton}
              >
                {loading ? (
                  <ActivityIndicator color={C.green} />
                ) : (
                  <Icon name="refresh-cw" size={17} />
                )}
              </Pressable>
            </View>
            <Row
              label="VPN detection"
              value={
                loading
                  ? "Checking…"
                  : ip?.vpn === true
                    ? "✅ Using VPN (IP flagged)"
                    : tunnel.active
                      ? "⚠️ Possible VPN"
                      : "⚠️ Not confirmed"
              }
            />
            <Row
              label="Residential IP"
              value={loading ? "Checking…" : "⚠️ Not verified"}
            />
            <Row
              label="IP location"
              value={
                loading ? "Checking…" : countryLabel(ip?.countryCode || null)
              }
            />
            <Row
              label="Time-zone location"
              value={countryLabel(timezoneCountry)}
            />
            <Row
              label="GPS location"
              value={locating ? "Locating…" : countryLabel(gpsCountry)}
            />
            <View style={s.rule} />
            <Text style={s.note}>
              A tunnel suggests a possible VPN. Residential IP status needs
              verified provider data. Unknown results never count as a match.
            </Text>
            <Button
              variant="ghost"
              onPress={locateOrSettings}
              isDisabled={locating}
              style={{ marginTop: 8 }}
            >
              <Button.Label style={{ color: C.green, fontSize: 12 }}>
                {locating
                  ? "Checking GPS…"
                  : denied
                    ? "Open location settings"
                    : gpsCountry
                      ? "Update GPS location"
                      : "Check GPS location"}
              </Button.Label>
            </Button>
            {!!locationError && (
              <Text accessibilityRole="alert" style={s.locationError}>
                {locationError}
              </Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setTab("checker")}
            style={[s.summary, { marginTop: 12 }]}
          >
            <Icon name="check-square" />
            <View style={{ flex: 1 }}>
              <Text style={s.summaryTitle}>Ready for your next app?</Text>
              <Text style={s.summaryText}>
                Compare these results with your saved preferences.
              </Text>
            </View>
            <Icon name="arrow-right" size={17} />
          </Pressable>
          {!!error && (
            <View accessibilityRole="alert" style={s.error}>
              <Text style={s.errorText}>{error}</Text>
              <Button variant="ghost" onPress={refresh}>
                Try again
              </Button>
            </View>
          )}
          <View style={s.sectionHeading}>
            <Eyebrow>01 / PUBLIC CONNECTION</Eyebrow>
            <View style={s.live}>
              <View
                style={[
                  s.dot,
                  { backgroundColor: ip && !loading ? C.green : C.muted },
                ]}
              />
              <Text style={s.liveText}>
                {loading ? "CHECKING" : ip ? "LIVE" : "UNAVAILABLE"}
              </Text>
            </View>
          </View>
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={s.smallIcon}>
                <Icon name="globe" />
              </View>
              <Text style={s.cardLabel}>Public IP address</Text>
              <Pressable
                disabled={!ip || loading}
                onPress={copy}
                style={s.iconButton}
                accessibilityRole="button"
                accessibilityLabel={
                  copied ? "IP address copied" : "Copy IP address"
                }
              >
                <Icon
                  name={copied ? "check" : "copy"}
                  size={17}
                  color={C.muted}
                />
              </Pressable>
            </View>
            <Text
              selectable
              style={[s.ip, ip?.ip.includes(":") && { fontSize: 23 }]}
            >
              {ip?.ip ?? (loading ? "Finding your IP…" : "Not available")}
            </Text>
            <View style={s.ipPlace}>
              <Icon name="map-pin" size={15} />
              <Text style={s.place}>
                {ip
                  ? [ip.city, ip.country].filter(Boolean).join(", ")
                  : "Your approximate internet location"}
              </Text>
            </View>
            <View style={s.rule} />
            <Row label="Network" value={ip?.isp || "—"} />
            <Row label="Region" value={ip?.region || "—"} />
            <Row label="ASN" value={ip?.asn || "—"} />
            <Row
              label="IPv6"
              value={loading ? "Checking…" : (ipv6 ?? "No result")}
              mono
            />
            <View style={s.cardNote}>
              <Icon name="info" size={13} color={C.muted} />
              <Text style={s.note}>
                IP location is approximate. IPv6 availability is not a leak
                test.
              </Text>
            </View>
          </View>
          <View style={s.sectionHeading}>
            <Eyebrow>02 / LOCATION</Eyebrow>
            <Text style={s.sectionHint}>Two ways to place you</Text>
          </View>
          <View style={s.card}>
            <View style={s.segment}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: selected === "ip" }}
                onPress={() => setSelected("ip")}
                style={[s.segmentItem, selected === "ip" && s.segmentActive]}
              >
                <Icon
                  name="globe"
                  size={15}
                  color={selected === "ip" ? C.ink : C.muted}
                />
                <Text
                  style={[s.segmentText, selected === "ip" && { color: C.ink }]}
                >
                  IP location
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: selected === "device" }}
                onPress={() => setSelected("device")}
                style={[
                  s.segmentItem,
                  selected === "device" && s.segmentActive,
                ]}
              >
                <Icon
                  name="navigation"
                  size={15}
                  color={selected === "device" ? C.ink : C.muted}
                />
                <Text
                  style={[
                    s.segmentText,
                    selected === "device" && { color: C.ink },
                  ]}
                >
                  Device location
                </Text>
              </Pressable>
            </View>
            <View style={s.mapTitle}>
              <View style={{ flex: 1 }}>
                <Text style={s.locationTitle}>
                  {selected === "ip"
                    ? ip?.city || "Waiting for your IP"
                    : device
                      ? "Last device fix"
                      : "A more local view"}
                </Text>
                <Text style={s.locationSub}>
                  {selected === "ip"
                    ? ip
                      ? `${ip.region}, ${ip.country}`
                      : "Location will appear after a check"
                    : device
                      ? `Accuracy: ${device.accuracy == null ? "unknown" : `about ${Math.round(device.accuracy)} m`}`
                      : "Only with your permission"}
                </Text>
              </View>
              <Icon
                name={selected === "ip" ? "map-pin" : "crosshair"}
                size={22}
              />
            </View>
            {selected === "device" && !device ? (
              <View style={s.locationPrompt}>
                <View style={s.locationGlyph}>
                  <Icon name="navigation" size={28} />
                </View>
                <Text style={s.promptTitle}>Compare with where you are</Text>
                <Text style={s.promptText}>
                  Use your device location to see how far away your IP appears.
                </Text>
                <Button
                  isDisabled={locating}
                  onPress={
                    denied
                      ? () => {
                          void Linking.openSettings();
                        }
                      : locate
                  }
                  style={s.primaryButton}
                >
                  <Button.Label style={s.primaryLabel}>
                    {locating
                      ? "Finding your location…"
                      : denied
                        ? "Open Settings"
                        : "Enable device location"}
                  </Button.Label>
                </Button>
              </View>
            ) : (
              <LocationMap ip={ip} device={device} selected={selected} />
            )}
            {!!locationError && (
              <Text accessibilityRole="alert" style={s.locationError}>
                {locationError}
              </Text>
            )}
            <View style={s.mapFooter}>
              <View style={s.legend}>
                <View style={s.dot} />
                <Text style={s.note}>
                  {selected === "ip"
                    ? "Approximate IP location"
                    : "Device coordinates"}
                </Text>
              </View>
              {selected === "device" && device && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Update device location"
                  onPress={locate}
                  disabled={locating}
                  style={{ padding: 12 }}
                >
                  <Icon name="refresh-cw" size={15} />
                </Pressable>
              )}
            </View>
            {selected === "device" && device && (
              <Text selectable style={s.coordinates}>
                {device.latitude.toFixed(4)}°, {device.longitude.toFixed(4)}°
              </Text>
            )}
            {device && ip && (
              <Text style={s.distance}>
                Your IP appears{" "}
                {Math.round(distanceKm(device, ip)).toLocaleString()} km from
                your device. This alone doesn’t prove VPN use.
              </Text>
            )}
          </View>
          <View style={s.sectionHeading}>
            <Eyebrow>03 / TIME ZONE</Eyebrow>
            <View
              style={[
                s.pill,
                match === "different" && { backgroundColor: "#F6EDDB" },
              ]}
            >
              <Text
                style={[
                  s.pillText,
                  match === "different" && { color: C.amber },
                ]}
              >
                {match === "match"
                  ? "In sync"
                  : match === "different"
                    ? "Different zones"
                    : "Device time"}
              </Text>
            </View>
          </View>
          <View style={s.card}>
            <View style={s.clockRow}>
              <View style={s.clockColumn}>
                <Text style={s.clockLabel}>YOUR DEVICE</Text>
                <Text style={s.clock}>{formatTime(zone, now)}</Text>
                <Text style={s.clockPlace}>{timeZonePlace(zone)}</Text>
                <Text style={s.offset}>{formatOffset(zone, now)}</Text>
              </View>
              <View style={s.clockDivider} />
              <View style={s.clockColumn}>
                <Text style={s.clockLabel}>YOUR IP</Text>
                <Text style={s.clock}>
                  {ip ? formatTime(ip.timeZone, now) : "—"}
                </Text>
                <Text style={s.clockPlace}>
                  {ip ? timeZonePlace(ip.timeZone) : "Not available"}
                </Text>
                <Text style={s.offset}>
                  {ip ? formatOffset(ip.timeZone, now) : "—"}
                </Text>
              </View>
            </View>
            <View style={s.rule} />
            <Row label="Device zone" value={zone} />
            <Row label="IP zone" value={ip?.timeZone || "—"} />
            <Text style={[s.note, { marginTop: 12, lineHeight: 18 }]}>
              A time zone names a region, not your exact location. Travel or a
              manual setting can explain a difference.
            </Text>
          </View>
          <View style={s.sectionHeading}>
            <Eyebrow>04 / NETWORK SIGNALS</Eyebrow>
            <Icon name="shield" size={15} color={C.muted} />
          </View>
          <View style={s.card}>
            <Row
              label="Device tunnel"
              value={
                !tunnel.available
                  ? "Not available in this build"
                  : tunnel.active
                    ? "Detected · possible VPN"
                    : "Not detected"
              }
            />
            <View style={s.rule} />
            {(
              [
                ["VPN database", ip?.vpn],
                ["Proxy", ip?.proxy],
                ["Tor exit", ip?.tor],
                ["Hosting network", ip?.hosting],
              ] as const
            ).map(([label, value]) => (
              <Row
                key={label}
                label={label}
                value={
                  loading
                    ? "Checking…"
                    : value === true
                      ? "Flagged"
                      : value === false
                        ? "Not flagged"
                        : "Unknown"
                }
              />
            ))}
            <View style={s.rule} />
            <Text style={s.note}>
              A tunnel can indicate a VPN or an iOS service. No tunnel doesn’t
              rule out a VPN. Free IP lookups do not include VPN database
              checks, so those signals may be unknown.
            </Text>
          </View>
          <Button
            variant="outline"
            onPress={refresh}
            isDisabled={loading}
            style={s.refreshButton}
          >
            <Icon name="refresh-cw" size={16} />
            <Button.Label style={{ color: C.green }}>
              {loading ? "Checking…" : "Check again"}
            </Button.Label>
          </Button>
          <View style={s.footer}>
            <Icon name="lock" size={12} color={C.muted} />
            <Text style={s.footerText}>No account. No saved history.</Text>
          </View>
          <Text style={s.timestamp}>
            {checked
              ? `Last checked ${checked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${ip?.source}`
              : "Pull down to refresh"}
          </Text>
        </ScrollView>
      </View>
      <View style={{ flex: 1, display: tab === "checker" ? "flex" : "none" }}>
        <AppChecker
          snapshot={snapshot}
          onRefresh={() => {
            void refresh();
          }}
          onLocate={locateOrSettings}
          locating={locating}
          locationError={locationError}
        />
      </View>
      <SafeAreaView edges={["bottom"]} style={s.tabBar}>
        {(
          [
            ["home", "Home", "home"],
            ["checker", "App checker", "check-square"],
          ] as const
        ).map(([id, label, icon]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: tab === id }}
            onPress={() => {
              setTab(id);
              void Haptics.selectionAsync().catch(() => {});
            }}
            style={s.tabItem}
          >
            <Icon
              name={icon}
              size={21}
              color={tab === id ? C.green : C.muted}
            />
            <Text
              style={[s.tabLabel, { color: tab === id ? C.green : C.muted }]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </SafeAreaView>
      <Modal
        visible={info}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInfo(false)}
      >
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.modal}>
            <View style={s.header}>
              <Text style={s.modalTitle}>A clearer picture.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close information"
                onPress={() => setInfo(false)}
                style={s.iconButton}
              >
                <Icon name="x" />
              </Pressable>
            </View>
            <Text style={s.modalBody}>
              Safeguard compares the location your connection suggests with your
              device’s time zone and optional location.
            </Text>
            <Text style={s.summaryTitle}>What gets shared</Text>
            <Text style={s.modalBody}>
              IP lookups contact ipwho.is. An IPv6 check contacts ipify. These
              services see your public IP, as any website would. Their own
              privacy policies apply.
            </Text>
            <Text style={s.summaryTitle}>Device location is optional</Text>
            <Text style={s.modalBody}>
              Coordinates stay in app memory and are not sent to the IP lookup
              services. The native map provider receives map-view requests, and
              the device geocoding service receives coordinates to resolve your
              GPS country. App names and requirements are saved only on this
              device. There is no account, analytics, background tracking, or
              saved location history.
            </Text>
            <Text style={s.summaryTitle}>A signal, not a verdict</Text>
            <Text style={s.modalBody}>
              The on-device check looks for active tunnel interfaces. VPNs,
              enterprise networks, and iOS services can create them, so it
              cannot prove VPN use or protection. This check requires the native
              iOS build; it is unavailable in Expo Go. VPN, proxy, Tor, and
              hosting database classifications are unavailable with the free
              lookup service. A time-zone or distance mismatch is not proof of a
              VPN. This app does not run DNS or WebRTC leak tests.
            </Text>
            <Text style={s.summaryTitle}>Free services have limits</Text>
            <Text style={s.modalBody}>
              Requests can fail or be rate-limited, especially on a shared VPN
              address. Refresh after changing your VPN. Results describe this
              app’s connection, which may differ from Safari when using Private
              Relay or split tunneling.
            </Text>
            <Button onPress={() => setInfo(false)} style={s.primaryButton}>
              <Button.Label style={s.primaryLabel}>Got it</Button.Label>
            </Button>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <Dashboard />
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 12,
    paddingBottom: 8,
    minHeight: 58,
  },
  tabLabel: { fontSize: 11, fontWeight: "600" },
  safe: { flex: 1, backgroundColor: C.bg },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 42,
    width: "100%",
    maxWidth: 590,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    height: 37,
    width: 35,
    borderRadius: 12,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: -1,
    color: C.ink,
  },
  iconButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  intro: { marginTop: 39, marginBottom: 25 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: C.muted,
  },
  title: {
    fontSize: 35,
    fontWeight: "600",
    letterSpacing: -1.6,
    color: C.ink,
    marginTop: 11,
  },
  subtitle: { fontSize: 15, color: C.muted, marginTop: 9, lineHeight: 22 },
  summary: {
    backgroundColor: C.pale,
    borderRadius: 20,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  summaryIcon: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: { fontSize: 15, fontWeight: "600", color: C.ink },
  summaryText: { fontSize: 12, lineHeight: 18, color: "#5D7566", marginTop: 4 },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 29,
    marginBottom: 12,
    minHeight: 24,
  },
  live: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { height: 5, width: 5, borderRadius: 3, backgroundColor: C.green },
  liveText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: C.green,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -6,
  },
  smallIcon: { width: 24 },
  cardLabel: { fontSize: 12, color: C.muted, flex: 1 },
  ip: {
    fontSize: 30,
    fontWeight: "500",
    letterSpacing: -1,
    color: C.ink,
    marginTop: 7,
    fontVariant: ["tabular-nums"],
  },
  mono: { fontVariant: ["tabular-nums"] },
  ipPlace: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  place: { fontSize: 13, color: C.green, fontWeight: "500", flex: 1 },
  rule: { height: 1, backgroundColor: C.line, marginVertical: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 7,
  },
  rowLabel: { fontSize: 12, color: C.muted, flexShrink: 0 },
  rowValue: {
    fontSize: 12,
    fontWeight: "500",
    color: C.ink,
    textAlign: "right",
    flex: 1,
  },
  cardNote: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    marginTop: 14,
  },
  note: { fontSize: 10, color: C.muted, lineHeight: 16, flexShrink: 1 },
  sectionHint: { fontSize: 10, color: C.muted },
  segment: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: "#F1F3EE",
    borderRadius: 12,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentActive: { backgroundColor: "white", boxShadow: "0 1px 4px #132A1510" },
  segmentText: { fontSize: 11, fontWeight: "600", color: C.muted },
  mapTitle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 19,
    gap: 10,
  },
  locationTitle: {
    fontSize: 21,
    fontWeight: "500",
    letterSpacing: -0.5,
    color: C.ink,
  },
  locationSub: { fontSize: 11, color: C.muted, marginTop: 5 },
  mapFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 11,
    minHeight: 25,
  },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  coordinates: { fontSize: 12, color: C.ink, fontVariant: ["tabular-nums"] },
  distance: { fontSize: 11, lineHeight: 18, color: C.muted, marginTop: 8 },
  locationPrompt: {
    backgroundColor: C.bg,
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
  },
  locationGlyph: {
    backgroundColor: C.pale,
    padding: 16,
    borderRadius: 24,
    marginBottom: 17,
  },
  promptTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: C.ink,
    textAlign: "center",
  },
  promptText: {
    fontSize: 12,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  primaryButton: { backgroundColor: C.green, borderRadius: 14, minHeight: 48 },
  primaryLabel: { color: "white", fontSize: 13, fontWeight: "600" },
  locationError: {
    fontSize: 12,
    color: C.amber,
    lineHeight: 18,
    marginTop: 12,
  },
  pill: {
    backgroundColor: C.pale,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pillText: { fontSize: 9, fontWeight: "600", color: C.green },
  clockRow: { flexDirection: "row", paddingVertical: 8, gap: 16 },
  clockColumn: { flex: 1 },
  clockLabel: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: C.muted,
    fontWeight: "600",
  },
  clock: {
    fontSize: 31,
    fontWeight: "400",
    letterSpacing: -1.1,
    color: C.ink,
    marginTop: 14,
    fontVariant: ["tabular-nums"],
  },
  clockPlace: { fontSize: 13, color: C.ink, marginTop: 7 },
  offset: { fontSize: 10, color: C.muted, marginTop: 5 },
  clockDivider: { width: 1, backgroundColor: C.line, marginVertical: 4 },
  refreshButton: {
    borderColor: "#D5E0D5",
    borderRadius: 16,
    marginTop: 24,
    minHeight: 48,
  },
  footer: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 25,
  },
  footerText: { fontSize: 10, color: C.muted },
  timestamp: { fontSize: 9, textAlign: "center", color: C.muted, marginTop: 7 },
  error: {
    padding: 14,
    backgroundColor: "#FBF0DE",
    borderRadius: 16,
    marginTop: 12,
  },
  errorText: { color: C.amber, fontSize: 12, lineHeight: 18 },
  modal: {
    padding: 26,
    gap: 18,
    maxWidth: 590,
    width: "100%",
    alignSelf: "center",
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -1,
    color: C.ink,
  },
  modalBody: { fontSize: 14, color: C.muted, lineHeight: 23 },
});
