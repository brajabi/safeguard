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
      setOpen(saved[0]?.id ?? null);
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
  const edit = (profile?: Profile) => {
    setDraftError("");
    setCountryField(null);
    setQuery("");
    setDraft(
      profile
        ? { ...profile, requirements: { ...profile.requirements } }
        : {
            id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name: "",
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
            void persist(profiles.filter((item) => item.id !== profile.id));
          },
        },
      ],
    );

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          maxWidth: 590,
          width: "100%",
          alignSelf: "center",
          paddingBottom: 32,
        }}
      >
        <View style={s.heading}>
          <Text style={s.eyebrow}>BEFORE YOU OPEN</Text>
          <Text style={s.title}>App checker</Text>
          <Text style={s.subtitle}>
            Your apps. Your requirements. One quick check.
          </Text>
        </View>
        <View style={s.toolbar}>
          <Text style={s.sectionLabel}>
            SAVED PROFILES{loaded ? ` · ${profiles.length}` : ""}
          </Text>
          <Button
            size="sm"
            isDisabled={!loaded || saving}
            onPress={() => edit()}
            style={s.addButton}
            accessibilityLabel="Add app profile"
          >
            <Feather
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no"
              name="plus"
              size={18}
              color="white"
            />
            <Button.Label style={s.white}>Add app</Button.Label>
          </Button>
        </View>
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
        {!loaded && !error && (
          <ActivityIndicator color={C.green} style={{ margin: 30 }} />
        )}
        {loaded && profiles.length === 0 && (
          <View style={s.empty}>
            <Feather
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no"
              name="layers"
              size={30}
              color={C.green}
            />
            <Text style={s.emptyTitle}>A little check before you go</Text>
            <Text style={s.subtitle}>
              Add an app and choose the connection and location preferences you
              want to check.
            </Text>
          </View>
        )}
        {profiles.map((profile) => {
          const evaluation = evaluateProfile(
            profile,
            snapshot,
            Math.max(now, Date.now()),
          );
          const expanded = open === profile.id;
          const passing = evaluation.status === "pass";
          return (
            <View key={profile.id} style={s.card}>
              <Pressable
                style={s.accordion}
                accessibilityRole="button"
                accessibilityLabel={`${profile.name}, ${statusLabels[evaluation.status]}`}
                accessibilityState={{ expanded }}
                onPress={() => setOpen(expanded ? null : profile.id)}
              >
                <View style={s.appIcon}>
                  <Text style={s.appInitials}>
                    {profile.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={s.flex}>
                  <Text style={s.appName}>{profile.name}</Text>
                  <Text style={s.small}>
                    {evaluation.results.length} requirement
                    {evaluation.results.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <View style={[s.badge, passing && s.badgePass]}>
                  <Text style={[s.badgeText, passing && { color: C.green }]}>
                    {statusLabels[evaluation.status]}
                  </Text>
                </View>
                <Feather
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={17}
                  color={C.muted}
                />
              </Pressable>
              {expanded && (
                <View style={s.expanded}>
                  {evaluation.results.length === 0 && (
                    <Text style={s.subtitle}>
                      Edit this profile to choose what matters for this app.
                    </Text>
                  )}
                  {evaluation.results.map((result) => (
                    <View key={result.key} style={s.result}>
                      <Text style={s.resultEmoji}>
                        {statusEmoji[result.status]}
                      </Text>
                      <View style={s.flex}>
                        <Text style={s.resultLabel}>
                          {
                            fields.find((field) => field.key === result.key)
                              ?.label
                          }
                        </Text>
                        <Text style={s.actual}>
                          {valueLabel(result.key, result.actual)}
                        </Text>
                        <Text style={s.small}>
                          Required: {valueLabel(result.key, result.expected)}
                        </Text>
                      </View>
                    </View>
                  ))}
                  <View style={s.cardActions}>
                    <Pressable
                      style={s.textButton}
                      disabled={saving}
                      onPress={() => edit(profile)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${profile.name}`}
                    >
                      <Feather
                        accessible={false}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        name="sliders"
                        size={16}
                        color={C.green}
                      />
                      <Text style={s.actionLabel}>Edit preferences</Text>
                    </Pressable>
                    <Pressable
                      style={s.textButton}
                      disabled={saving}
                      onPress={() => remove(profile)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${profile.name}`}
                    >
                      <Feather
                        accessible={false}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        name="trash-2"
                        size={17}
                        color={C.muted}
                      />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}
        <View style={s.checkActions}>
          <Button
            isDisabled={snapshot.loading}
            onPress={onRefresh}
            style={s.refresh}
          >
            <Feather
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no"
              name="refresh-cw"
              size={17}
              color="white"
            />
            <Button.Label style={s.white}>
              {snapshot.loading ? "Checking…" : "Check again"}
            </Button.Label>
          </Button>
          <Button variant="ghost" isDisabled={locating} onPress={onLocate}>
            <Feather
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no"
              name="navigation"
              size={16}
              color={C.green}
            />
            <Button.Label style={s.actionLabel}>
              {locating ? "Locating…" : "Update GPS"}
            </Button.Label>
          </Button>
        </View>
        {!!locationError && <Text style={s.error}>{locationError}</Text>}
        <Text style={s.footnote}>
          Profiles are your own preferences, not official app requirements. N26
          is an editable example. Readings expire after five minutes. VPN and
          residential verification are unavailable with the free IP service. GPS
          country lookup sends coordinates to the device’s geocoding service.
          Open your app separately when you’re ready.
        </Text>
      </ScrollView>
      <Modal
        visible={draft !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!saving) {
            if (countryField) setCountryField(null);
            else setDraft(null);
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
                onPress={() =>
                  countryField ? setCountryField(null) : setDraft(null)
                }
              >
                <Text style={s.actionLabel}>
                  {countryField ? "Back" : "Cancel"}
                </Text>
              </Pressable>
              <Text style={s.modalTitle}>
                {countryField ? "Choose country" : "App preferences"}
              </Text>
              <View style={{ width: 58 }} />
            </View>
            {countryField ? (
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
                <View style={s.quickNames}>
                  {["N26", "Revolut", "Custom app"].map((name) => (
                    <Pressable
                      key={name}
                      style={s.chip}
                      accessibilityRole="button"
                      onPress={() =>
                        setDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                name: name === "Custom app" ? "" : name,
                              }
                            : null,
                        )
                      }
                    >
                      <Text style={s.actionLabel}>{name}</Text>
                    </Pressable>
                  ))}
                </View>
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
  heading: { gap: 8, marginBottom: 25 },
  eyebrow: {
    color: C.green,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: { color: C.ink, fontSize: 36, fontWeight: "600", letterSpacing: -1.4 },
  subtitle: { color: C.muted, fontSize: 14, lineHeight: 21 },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  addButton: {
    backgroundColor: C.green,
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 15,
  },
  white: { color: "white", fontSize: 14, fontWeight: "600" },
  notice: { padding: 16 },
  error: { color: C.red, fontSize: 14, lineHeight: 21 },
  empty: { backgroundColor: "white", borderRadius: 24, padding: 26, gap: 14 },
  emptyTitle: { color: C.ink, fontSize: 21, fontWeight: "600" },
  card: {
    backgroundColor: "white",
    borderRadius: 23,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 12,
    overflow: "hidden",
  },
  accordion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 17,
    minHeight: 89,
  },
  appIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: C.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  appInitials: { color: C.green, fontWeight: "700", fontSize: 15 },
  appName: { color: C.ink, fontSize: 18, fontWeight: "600", marginBottom: 4 },
  small: { color: C.muted, fontSize: 12, lineHeight: 18 },
  badge: {
    borderRadius: 20,
    backgroundColor: "#F8F1E5",
    paddingVertical: 6,
    paddingHorizontal: 9,
    maxWidth: 110,
  },
  badgePass: { backgroundColor: C.pale },
  badgeText: { color: C.amber, fontSize: 10, fontWeight: "600" },
  expanded: { paddingHorizontal: 20, paddingBottom: 6 },
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
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: C.line,
  },
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
  quickNames: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: C.pale,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 15,
    justifyContent: "center",
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
