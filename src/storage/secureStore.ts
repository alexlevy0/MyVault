/**
 * SecureStore Wrapper - Abstraction over Expo SecureStore
 * @module storage/secureStore
 * 
 * Provides a consistent async API for secure key-value storage.
 * Uses Keychain on iOS and Keystore on Android.
 */

import * as SecureStore from 'expo-secure-store';

// Storage keys used by the app
export const STORAGE_KEYS = {
    DERIVED_KEY_INFO: 'vault_derived_key_info',
    VAULT_DATA: 'vault_data',
    SETTINGS: 'vault_settings',
} as const;

/**
 * Store a value securely
 * @param key - Storage key
 * @param value - Value to store (will be serialized as string)
 * @throws Error if storage fails
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(key, value, {
            // Use the most secure options available
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
    } catch (error) {
        if (__DEV__) {
            console.error(`[SecureStore] Failed to set item: ${key}`, error instanceof Error ? error.message : 'Unknown error');
        }
        throw new Error(`Failed to store secure item`);
    }
}

/**
 * Retrieve a securely stored value
 * @param key - Storage key
 * @returns The stored value or null if not found
 */
export async function getSecureItem(key: string): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(key);
    } catch (error) {
        if (__DEV__) {
            console.error(`[SecureStore] Failed to get item: ${key}`, error instanceof Error ? error.message : 'Unknown error');
        }
        return null;
    }
}

/**
 * Remove a securely stored value
 * @param key - Storage key to remove
 */
export async function removeSecureItem(key: string): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(key);
    } catch (error) {
        if (__DEV__) {
            console.error(`[SecureStore] Failed to remove item: ${key}`, error instanceof Error ? error.message : 'Unknown error');
        }
        // Don't throw - removal should be idempotent
    }
}

/**
 * Store a JSON object securely
 * @param key - Storage key
 * @param value - Object to store (will be JSON stringified)
 */
export async function setSecureObject<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    await setSecureItem(key, serialized);
}

/**
 * Retrieve a JSON object from secure storage
 * @param key - Storage key
 * @returns The parsed object or null if not found
 */
export async function getSecureObject<T>(key: string): Promise<T | null> {
    const serialized = await getSecureItem(key);
    if (!serialized) {
        return null;
    }
    try {
        return JSON.parse(serialized) as T;
    } catch (error) {
        if (__DEV__) {
            console.error(`[SecureStore] Failed to parse JSON for key: ${key}`, error instanceof Error ? error.message : 'Unknown error');
        }
        return null;
    }
}

/**
 * Check if a key exists in secure storage
 * @param key - Storage key
 * @returns True if the key exists
 */
export async function hasSecureItem(key: string): Promise<boolean> {
    const value = await getSecureItem(key);
    return value !== null;
}

/**
 * Clear all app-related secure storage keys
 * Used for full app reset
 */
export async function clearAllSecureStorage(): Promise<void> {
    const keys = Object.values(STORAGE_KEYS);
    await Promise.all(keys.map(key => removeSecureItem(key)));
}
