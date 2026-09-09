import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  parseStoredProfiles,
  serializeProfiles,
  type Profile,
} from "./profiles";

const STORAGE_KEY = "safeguard.app-preferences.v1";

export async function loadProfiles(): Promise<Profile[]> {
  // I/O failures propagate so the UI can avoid overwriting unread preferences.
  return parseStoredProfiles(await AsyncStorage.getItem(STORAGE_KEY));
}

export async function saveProfiles(profiles: Profile[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, serializeProfiles(profiles));
}
