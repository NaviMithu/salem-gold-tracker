import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface GoldRateToday22K {
  city: string;
  currency: string;
  purity: '22K';
  date: string;
  displayDate: string;
  rate22K: number;
  sovereign22K: number;
  yesterdayRate22K: number;
  change22K: number;
  changePercentage: number;
}

export interface DayRate22K {
  date: string;
  shortDate: string;
  rate22K: number;
  change22K: number;
}

export interface GoldApiResponse {
  success: boolean;
  cached: boolean;
  scrapedAt: string;
  today: GoldRateToday22K;
  history: DayRate22K[];
}

const STORAGE_KEY_LATEST = '@salem_gold_latest_rate_22k';
const STORAGE_KEY_HISTORY = '@salem_gold_saved_history_30days';

// Replace with your Render URL once deployed (e.g. 'https://salem-gold-api.onrender.com')
export const RENDER_CLOUD_URL: string = '';

/**
 * Resolves the backend API URL.
 * Uses Render cloud URL if set, otherwise automatically detects developer machine IP from Expo.
 */
export function getBackendBaseUrl(): string {
  // 1. If Render Cloud URL or EXPO_PUBLIC_API_URL is configured, use it
  if (RENDER_CLOUD_URL && RENDER_CLOUD_URL.trim() !== '') {
    return RENDER_CLOUD_URL.trim().replace(/\/+$/, '');
  }

  const envUrl = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 2. If running under Expo Go, hostUri contains the PC IP e.g. "192.168.1.7:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) {
      return `http://${ip}:3000`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://192.168.1.7:3000';
  }

  return 'http://localhost:3000';
}

/**
 * Fetch latest gold rates from backend API.
 * Always requests fresh data from the backend.
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
      throw new Error('Incomplete data received from server');
    }

    // Persist to local storage for offline use
    await saveGoldDataLocally(data);

    return data;
  } catch (error) {
    console.warn('Network request failed, attempting local storage fallback:', error);

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
 * Save rates and 30-day historical entries to phone storage.
 */
export async function saveGoldDataLocally(data: GoldApiResponse): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_LATEST, JSON.stringify(data));
    await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(data.history || []));
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
 * Read the 30-day historical records saved in phone storage.
 */
export async function getStoredHistory(): Promise<DayRate22K[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading historical gold rates:', err);
    return [];
  }
}