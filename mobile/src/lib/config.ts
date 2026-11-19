import Constants from 'expo-constants';

// Base URL of the backend (no trailing slash). Set per environment through
// `expo.extra.apiUrl` in app.json or the EXPO_PUBLIC_API_URL env var.
// On an Android emulator, localhost is the emulator itself — use http://10.0.2.2:5000.
const fromEnv = process.env.EXPO_PUBLIC_API_URL;
const fromConfig = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

export const API_URL = (fromEnv || fromConfig || 'http://localhost:5000').replace(/\/+$/, '');
export const API_BASE = `${API_URL}/api/v2`;
