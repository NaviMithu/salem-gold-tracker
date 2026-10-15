import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface GoldRateToday {
  city: string;
  currency: string;
  date: string;
  displayDate: string;
  rate22K: number;
  rate24K: number;
  rate18K: number | null;
  yesterdayRate22K: number | null;
  change22K: number;
  changePercentage: number;
}

export interface HistoricalRateItem {
  date: string;
  shortDate: string;
  rate22K: number;
  change22K: number;
  rate24K: number;
  change24K: number;
}

export interface GoldApiResponse {
  success: boolean;
  cached: boolean;
  scrapedAt: string;
  today: GoldRateToday;
  history: HistoricalRateItem[];
}

const STORAGE_KEY_LATEST = '@salem_gold_latest_rate';
const STORAGE_KEY_HISTORY = '@salem_gold_saved_history';

/**
 * Resolves the backend API URL.
 * Automatically detects developer machine IP from Expo or falls back to local network IP.
 */
export function getBackendBaseUrl(): string {
  // 1. If running under Expo Go / Dev client, hostUri contains the PC IP e.g. "192.168.1.7:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) {
      return `http://${ip}:3000`;
    }
  }

  // 2. Android emulator uses 10.0.2.2 to reach host machine
  if (Platform.OS === 'android') {
    return 'http://192.168.1.7:3000';
  }

  // 3. Web / iOS / fallback
  return 'http://localhost:3000';
}

/**
 * Fetch latest gold rates from backend API.
 * Automatically saves successful response to local storage for offline use.
 */
export async function fetchGoldRates(forceRefresh = false): Promise<GoldApiResponse> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/api/gold-rates${forceRefresh ? '?refresh=true' : ''}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data: GoldApiResponse = await response.json();

    if (!data.success || !data.today) {
      throw new Error(data.today ? 'Incomplete data received' : 'Failed to fetch rates');
    }

    // Persist to local storage
    await saveGoldDataLocally(data);

    return data;
  } catch (error) {
    console.warn('Network request failed, falling back to locally saved rate:', error);

    const localData = await getStoredGoldData();
    if (localData) {
      return {
        ...localData,
        cached: true,
      };
    }

    throw error;
  }
}

/**
 * Save rates and historical entries to phone storage.
 */
export async function saveGoldDataLocally(data: GoldApiResponse): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_LATEST, JSON.stringify(data));

    // Also maintain a cumulative history array
    const existingRaw = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
    const existingHistory: HistoricalRateItem[] = existingRaw ? JSON.parse(existingRaw) : [];

    const dateMap = new Map<string, HistoricalRateItem>();
    existingHistory.forEach((item) => dateMap.set(item.date, item));
    (data.history || []).forEach((item) => dateMap.set(item.date, item));

    const merged = Array.from(dateMap.values());
    await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(merged));
  } catch (err) {
    console.error('Error saving gold rates to local storage:', err);
  }
}

/**
 * Read the last saved gold rates from phone storage.
 */
export async function getStoredGoldData(): Promise<GoldApiResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_LATEST);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Error reading locally stored gold rates:', err);
    return null;
  }
}

/**
 * Read the full historical records saved in phone storage.
 */
export async function getStoredHistory(): Promise<HistoricalRateItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading historical gold rates:', err);
    return [];
  }
}