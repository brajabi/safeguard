import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "heroui-native/button";
import Feather from "@expo/vector-icons/Feather";
import AppLogo from "./AppLogo";
import Svg, { Path } from "react-native-svg";
import { APP_CATALOG } from "../lib/appCatalog";
import {
  evaluateProfile,
  type Profile,
  type RequirementKey,
  type Snapshot,
} from "../lib/profiles";
import { loadProfiles, saveProfiles } from "../lib/profileStorage";
import { countries, countryLabel } from "../lib/countries";

const C = {
  bg: "#F7F8F4",
  ink: "#1A3029",
  muted: "#738078",
  green: "#23745B",
  pale: "#EAF2E9",
  line: "#E8ECE5",
  amber: "#90682B",
  red: "#A34939",
};
const fields: { key: RequirementKey; label: string; description: string }[] = [
  {
    key: "vpn",
    label: "VPN connection",
    description: "Choose whether a VPN should be connected.",
  },
  {
    key: "residential",
    label: "Residential IP",
    description: "Check the network’s residential classification.",
  },
  {
    key: "ipCountry",
    label: "IP location",
    description: "The country your public IP points to.",
  },
  {
    key: "timezoneCountry",
    label: "Time zone location",
    description: "The country associated with your device time zone.",
  },
  {
    key: "gpsCountry",
    label: "GPS location",
    description: "The country returned by device location.",
  },
];
const isCountry = (key: RequirementKey) =>
  key !== "vpn" && key !== "residential";
const valueLabel = (key: RequirementKey, value: string | null) =>
  value === null
    ? isCountry(key)
      ? "Unknown · check again"
      : "Verification unavailable"
    : isCountry(key)
      ? countryLabel(value)
      : key === "vpn"
        ? value === "yes"
          ? "Using VPN"
          : "No VPN"
        : value === "yes"
          ? "Residential IP"
          : "Not residential";
const statusLabels = {
  pass: "Ready",
  fail: "Needs attention",
  unknown: "Check needed",
  empty: "Set requirements",
};
const statusEmoji = { pass: "✅", fail: "❎", unknown: "⚠️" };

export default function AppChecker({
  snapshot,
  onRefresh,
  onLocate,
  locating,
  locationError,
}: {
  snapshot: Snapshot;
  onRefresh: () => void;
  onLocate: () => void;
  locating: boolean;
  locationError?: string;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [open, setOpen] = useState<string | null>(null);
  const [pickingApp, setPickingApp] = useState(false);
  const [addingApp, setAddingApp] = useState(false);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [draftError, setDraftError] = useState("");
  const [countryField, setCountryField] = useState<RequirementKey | null>(null);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(true);
  const readProfiles = async () => {
    setError("");
    try {
      const saved = await loadProfiles();
      if (!mounted.current) return;
      setProfiles(saved);

      setLoaded(true);
    } catch {
      if (mounted.current) setError("Couldn’t load your profiles. Try again.");
    }
  };
  useEffect(() => {
    mounted.current = true;
    void readProfiles();
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);

  const persist = async (next: Profile[]) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setError("");
    setDraftError("");
    try {
      await saveProfiles(next);
      if (mounted.current) setProfiles(next);
      return true;
    } catch {
      if (mounted.current) {
        setError("Couldn’t save your changes. Please try again.");
        setDraftError("Couldn’t save. Your changes are still here; try again.");
      }
      return false;
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const edit = (profile?: Profile, appName = "") => {
    setAddingApp(!profile);
    setPickingApp(false);
    setDraftError("");
    setCountryField(null);
    setQuery("");
    setDraft(
      profile
        ? { ...profile, requirements: { ...profile.requirements } }
        : {
            id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name: appName,
            requirements: {},
          },
    );
  };
  const updateRequirement = (key: RequirementKey, value?: string) =>
    setDraft((previous) => {
      if (!previous) return previous;
      const requirements = { ...previous.requirements };
      if (value === undefined) delete requirements[key];
      else requirements[key] = value;
      return { ...previous, requirements };
    });
  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setDraftError("Enter an app name.");
      return;
    }
    const profile = { ...draft, name: draft.name.trim() };
    const next = profiles.some((item) => item.id === profile.id)
      ? profiles.map((item) => (item.id === profile.id ? profile : item))
      : [...profiles, profile];
    if (await persist(next)) {
      setOpen(profile.id);
      setDraft(null);
    }
  };
  const remove = (profile: Profile) =>
    Alert.alert(
      `Delete ${profile.name}?`,
      "This removes its saved preferences from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void persist(
              profiles.filter((item) => item.id !== profile.id),
            ).then((saved) => {
              if (saved) setOpen(null);
            });
          },
        },
      ],
    );

  const selected = profiles.find((profile) => profile.id === open);
  const evaluation = selected
    ? evaluateProfile(selected, snapshot, Math.max(now, Date.now()))
    : null;

  return (
    <>
      <ScrollView key={selected?.id ?? "apps"} contentContainerStyle={s.page}>
        {selected && evaluation ? (
          <>
            <View style={s.toolbar}>
              <Pressable
                style={s.textButton}
                accessibilityRole="button"
                accessibilityLabel="Back to apps"
                onPress={() => setOpen(null)}
              >
                <Feather
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  name="chevron-left"
                  size={22}
                  color={C.green}
                />
                <Text style={s.actionLabel}>Apps</Text>
              </Pressable>
              <Pressable
                style={s.textButton}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${selected.name}`}
                onPress={() => remove(selected)}
              >
                <Feather
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  name="trash-2"
                  size={18}
                  color={C.muted}
                />
              </Pressable>
            </View>
            <View style={s.detailHeading}>
              <AppLogo name={selected.name} size={64} />
              <Text style={s.detailTitle}>{selected.name}</Text>
              <Text
                style={[
                  s.status,
                  evaluation.status === "pass" && { color: C.green },
                ]}
              >
                {statusLabels[evaluation.status]}
              </Text>
            </View>
            <View style={s.checklist}>
              {evaluation.results.length === 0 && (
                <Text style={s.subtitle}>
                  Choose your checks in preferences.
                </Text>
              )}
              {evaluation.results.map((result, index) => (
                <View
                  key={result.key}
                  style={[s.result, index === 0 && { borderTopWidth: 0 }]}
                >
                  <View style={s.flex}>
                    <Text style={s.resultLabel}>
                      {fields.find((field) => field.key === result.key)?.label}
                    </Text>
                    <Text style={s.actual}>
                      {valueLabel(result.key, result.actual)}
                    </Text>
                    <Text style={s.small}>
                      Required: {valueLabel(result.key, result.expected)}
                    </Text>
                  </View>
                  <Text
                    style={s.resultEmoji}
                    accessibilityLabel={
                      result.status === "pass"
                        ? "Matches"
                        : result.status === "fail"
                          ? "Does not match"
                          : "Unknown"
                    }
                  >
                    {statusEmoji[result.status]}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable
              style={[s.textButton, { marginTop: 8 }]}
              disabled={saving}
              onPress={() => edit(selected)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${selected.name}`}
            >
              <Text style={s.actionLabel}>Edit preferences</Text>
            </Pressable>
            <View style={s.checkActions}>
              <Button
                isDisabled={snapshot.loading}
                onPress={onRefresh}
                style={s.refresh}
              >
                <Button.Label style={s.white}>
                  {snapshot.loading ? "Checking…" : "Check again"}
                </Button.Label>
              </Button>
              {selected.requirements.gpsCountry !== undefined && (
                <Button
                  variant="ghost"
                  isDisabled={locating}
                  onPress={onLocate}
                >
                  <Button.Label style={s.actionLabel}>
                    {locating ? "Locating…" : "Update GPS"}
                  </Button.Label>
                </Button>
              )}
            </View>
            {!!locationError && <Text style={s.error}>{locationError}</Text>}
          </>
        ) : (
          <>
            <View style={s.toolbar}>
              <Text style={s.title}>App checker</Text>
              <Pressable
                disabled={!loaded || saving}
                onPress={() => setPickingApp(true)}
                style={[s.addButton, (!loaded || saving) && { opacity: 0.4 }]}
                accessibilityRole="button"
                accessibilityLabel="Add app profile"
              >
                <Feather
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  name="plus"
                  size={23}
                  color="white"
                />
              </Pressable>
            </View>
            {!loaded && !error && (
              <ActivityIndicator color={C.green} style={{ margin: 30 }} />
            )}
            {loaded && profiles.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>Add your first app</Text>
                <Text style={s.subtitle}>
                  Tap + to choose an app and its checks.
                </Text>
              </View>
            )}
            <View style={s.grid}>
              {profiles.map((profile) => {
                const result = evaluateProfile(
                  profile,
                  snapshot,
                  Math.max(now, Date.now()),
                );
                return (
                  <Pressable
                    key={profile.id}
                    style={s.appTile}
                    accessibilityRole="button"
                    accessibilityLabel={`${profile.name}, ${statusLabels[result.status]}`}
                    onPress={() => setOpen(profile.id)}
                  >
                    <View style={s.logoWrap}>
                      <AppLogo name={profile.name} size={54} />
                      <View
                        style={[
                          s.cornerStatus,
                          {
                            backgroundColor:
                              result.status === "pass" ? C.green : C.red,
                          },
                        ]}
                        pointerEvents="none"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <Svg width={12} height={12} viewBox="0 0 24 24">
                          <Path
                            d={
                              result.status === "pass"
                                ? "M5 12l4 4L19 6"
                                : "M6 6l12 12M18 6L6 18"
                            }
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                    </View>
                    <Text style={s.tileName} numberOfLines={2}>
                      {profile.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {!!error && (
          <View style={s.notice}>
            <Text style={s.error}>{error}</Text>
            {!loaded && (
              <Button variant="ghost" onPress={() => void readProfiles()}>
                <Button.Label>Try again</Button.Label>
              </Button>
            )}
          </View>
        )}
      </ScrollView>
      <Modal
        visible={pickingApp || draft !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!saving) {
            if (countryField) setCountryField(null);
            else {
              setDraft(null);
              setPickingApp(false);
            }
          }
        }}
      >
        <SafeAreaView style={s.modal} edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={s.flex}
          >
            <View style={s.modalHeader}>
              <Pressable
                style={s.textButton}
                disabled={saving}
                accessibilityRole="button"
                onPress={() => {
                  if (countryField) setCountryField(null);
                  else if (draft && addingApp) {
                    setDraft(null);
                    setPickingApp(true);
                  } else {
                    setDraft(null);
                    setPickingApp(false);
                  }
                }}
              >
                <Text style={s.actionLabel}>
                  {countryField || (draft && addingApp) ? "Back" : "Cancel"}
                </Text>
              </Pressable>
              <Text style={s.modalTitle}>
                {countryField
                  ? "Choose country"
                  : pickingApp
                    ? "Choose app"
                    : "App preferences"}
              </Text>
              <View style={{ width: 58 }} />
            </View>
            {pickingApp ? (
              <ScrollView contentContainerStyle={s.pickerContent}>
                <View style={s.pickerGrid}>
                  {APP_CATALOG.map((app) => (
                    <Pressable
                      key={app.id}
                      style={s.pickerTile}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${app.name}`}
                      onPress={() =>
                        edit(undefined, app.id === "custom" ? "" : app.name)
                      }
                    >
                      <AppLogo name={app.name} size={52} />
                      <Text style={s.pickerName}>{app.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            ) : countryField ? (
              <>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search countries"
                  placeholderTextColor={C.muted}
                  style={[s.input, { marginHorizontal: 24, marginBottom: 12 }]}
                  accessibilityLabel="Search countries"
                  autoCorrect={false}
                />
                <FlatList
                  keyboardShouldPersistTaps="handled"
                  data={countries.filter((country) =>
                    `${country.name} ${country.code}`
                      .toLowerCase()
                      .includes(query.trim().toLowerCase()),
                  )}
                  keyExtractor={(item) => item.code}
                  contentContainerStyle={{
                    paddingHorizontal: 24,
                    paddingBottom: 24,
                  }}
                  ListEmptyComponent={
                    <Text style={s.subtitle}>No countries found.</Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      accessibilityRole="button"
                      style={s.countryOption}
                      onPress={() => {
                        updateRequirement(countryField, item.code);
                        setCountryField(null);
                      }}
                    >
                      <Text style={s.countryText}>
                        {countryLabel(item.code)}
                      </Text>
                      {draft?.requirements[countryField] === item.code && (
                        <Feather
                          accessible={false}
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                          name="check"
                          size={20}
                          color={C.green}
                        />
                      )}
                    </Pressable>
                  )}
                />
              </>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.form}
              >
                <View style={s.formLogo}>
                  <AppLogo name={draft?.name || "Custom"} size={54} />
                </View>
                <Text style={s.inputLabel}>APP NAME</Text>
                <TextInput
                  value={draft?.name ?? ""}
                  onChangeText={(name) =>
                    setDraft((previous) =>
                      previous ? { ...previous, name } : null,
                    )
                  }
                  placeholder="e.g. N26"
                  placeholderTextColor={C.muted}
                  maxLength={60}
                  style={s.input}
                  accessibilityLabel="App name"
                  returnKeyType="done"
                />
                <Text style={s.inputLabel}>REQUIREMENTS</Text>
                <Text style={s.subtitle}>
                  Turn on the checks you need, then choose the expected value
                  for each.
                </Text>
                {fields.map((field) => {
                  const value = draft?.requirements[field.key];
                  return (
                    <View key={field.key} style={s.requirement}>
                      <View style={s.requirementHeader}>
                        <View style={s.flex}>
                          <Text style={s.resultLabel}>{field.label}</Text>
                          <Text style={s.small}>{field.description}</Text>
                        </View>
                        <Switch
                          accessibilityLabel={`Require ${field.label}`}
                          value={value !== undefined}
                          trackColor={{ false: "#DEE4DD", true: C.green }}
                          onValueChange={(enabled) =>
                            updateRequirement(
                              field.key,
                              enabled
                                ? isCountry(field.key)
                                  ? "IE"
                                  : "yes"
                                : undefined,
                            )
                          }
                        />
                      </View>
                      {value !== undefined &&
                        (isCountry(field.key) ? (
                          <Pressable
                            style={s.selector}
                            accessibilityRole="button"
                            accessibilityLabel={`Required ${field.label}: ${countryLabel(value)}`}
                            onPress={() => {
                              setQuery("");
                              setCountryField(field.key);
                            }}
                          >
                            <Text style={s.countryText}>
                              {countryLabel(value)}
                            </Text>
                            <Feather
                              accessible={false}
                              accessibilityElementsHidden
                              importantForAccessibility="no"
                              name="chevron-down"
                              size={18}
                              color={C.green}
                            />
                          </Pressable>
                        ) : (
                          <View style={s.segment}>
                            {["yes", "no"].map((option) => (
                              <Pressable
                                key={option}
                                style={[
                                  s.segmentOption,
                                  value === option && s.segmentSelected,
                                ]}
                                accessibilityRole="radio"
                                accessibilityState={{
                                  checked: value === option,
                                }}
                                onPress={() =>
                                  updateRequirement(field.key, option)
                                }
                              >
                                <Text
                                  style={[
                                    s.small,
                                    value === option && s.actionLabel,
                                  ]}
                                >
                                  {valueLabel(field.key, option)}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        ))}
                    </View>
                  );
                })}
                {!!draftError && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {draftError}
                  </Text>
                )}
                <Button
                  isDisabled={saving}
                  style={s.refresh}
                  onPress={() => void saveDraft()}
                >
                  <Button.Label style={s.white}>
                    {saving ? "Saving…" : "Save profile"}
                  </Button.Label>
                </Button>
                <Text style={s.footnote}>
                  Saved only on this device. These checks do not change your
                  connection or location.
                </Text>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    padding: 24,
    paddingTop: 18,
    maxWidth: 590,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 32,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  appTile: {
    width: "48%",
    flexGrow: 0,
    padding: 16,
    minHeight: 116,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  logoWrap: { position: "relative" },
  cornerStatus: {
    position: "absolute",
    top: -5,
    right: -7,
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  tileName: {
    color: C.ink,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 3,
  },
  status: { color: C.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  detailHeading: {
    alignItems: "center",
    gap: 9,
    paddingTop: 2,
    paddingBottom: 25,
  },
  detailTitle: { color: C.ink, fontSize: 25, fontWeight: "600", marginTop: 4 },
  checklist: {
    backgroundColor: "white",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 19,
    paddingVertical: 5,
  },
  pickerContent: { padding: 24, paddingTop: 22 },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: "3%",
    rowGap: 12,
  },
  pickerTile: {
    width: "31.3%",
    minHeight: 128,
    paddingVertical: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  pickerName: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  formLogo: { alignItems: "center", paddingBottom: 6 },
  title: { color: C.ink, fontSize: 29, fontWeight: "600", letterSpacing: -0.9 },
  subtitle: { color: C.muted, fontSize: 14, lineHeight: 21 },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  addButton: {
    backgroundColor: C.green,
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  white: { color: "white", fontSize: 14, fontWeight: "600" },
  notice: { padding: 16 },
  error: { color: C.red, fontSize: 14, lineHeight: 21 },
  empty: { backgroundColor: "white", borderRadius: 24, padding: 26, gap: 14 },
  emptyTitle: { color: C.ink, fontSize: 21, fontWeight: "600" },
  small: { color: C.muted, fontSize: 12, lineHeight: 18 },
  result: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderColor: C.line,
  },
  resultEmoji: { fontSize: 18, paddingTop: 2 },
  resultLabel: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
  },
  actual: { color: C.ink, fontSize: 14, lineHeight: 21 },
  textButton: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionLabel: { color: C.green, fontSize: 13, fontWeight: "600" },
  checkActions: { marginTop: 15, gap: 4 },
  refresh: { backgroundColor: C.green, borderRadius: 16, minHeight: 50 },
  footnote: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 12,
  },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { color: C.ink, fontSize: 17, fontWeight: "600" },
  form: { padding: 24, gap: 14, paddingBottom: 40 },
  inputLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginTop: 5,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: C.ink,
  },
  requirement: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  requirementHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  selector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: C.bg,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  countryText: { fontSize: 15, color: C.ink, flexShrink: 1 },
  countryOption: {
    minHeight: 54,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: C.bg,
    padding: 3,
    borderRadius: 12,
  },
  segmentOption: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    padding: 7,
  },
  segmentSelected: { backgroundColor: C.pale },
});
