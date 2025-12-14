/**
 * Memory Storage - Volatile in-memory storage for sensitive session data
 * @module security/memory
 * 
 * This module provides secure in-memory storage for sensitive data like
 * derived encryption keys. Data is NEVER persisted to disk and is cleared
 * on logout or app termination.
 */

// Private storage - not exported directly
const memoryStore: Map<string, string> = new Map();

// Storage keys constants
export const MEMORY_KEYS = {
    DERIVED_KEY: 'derived_key',
    SESSION_TOKEN: 'session_token',
} as const;

/**
 * Store a sensitive value in memory
 * @param key - Storage key identifier
 * @param value - Value to store (will be kept in memory only)
 */
export function setMemoryKey(key: string, value: string): void {
    memoryStore.set(key, value);
}

/**
 * Retrieve a value from memory storage
 * @param key - Storage key identifier
 * @returns The stored value or null if not found
 */
export function getMemoryKey(key: string): string | null {
    return memoryStore.get(key) ?? null;
}

/**
 * Remove a specific key from memory storage
 * Overwrites the value multiple times before deletion to minimize memory exposure
 * @param key - Storage key to remove
 */
export function removeMemoryKey(key: string): void {
    const value = memoryStore.get(key);
    if (value !== undefined) {
        // Multiple overwrites to minimize memory exposure
        // Note: This is a best-effort approach in JavaScript's GC environment
        const length = value.length;
        memoryStore.set(key, '\0'.repeat(length));
        memoryStore.set(key, '\xFF'.repeat(length));
        memoryStore.set(key, '\0'.repeat(length));
        memoryStore.set(key, '\xAA'.repeat(length));
        memoryStore.set(key, '\0'.repeat(length));
    }
    memoryStore.delete(key);
}

/**
 * Clear all sensitive data from memory
 * Overwrites all values multiple times before clearing to minimize memory exposure
 * Should be called on logout, lock, or app termination
 */
export function clearAllMemory(): void {
    // Multiple overwrites to minimize memory exposure
    // This is a best-effort approach to minimize memory exposure
    // in JavaScript's garbage-collected environment
    const entries = Array.from(memoryStore.entries());
    
    for (const [key, value] of entries) {
        const length = value.length;
        // Multiple overwrite passes
        memoryStore.set(key, '\0'.repeat(length));
        memoryStore.set(key, '\xFF'.repeat(length));
        memoryStore.set(key, '\0'.repeat(length));
        memoryStore.set(key, '\xAA'.repeat(length));
        memoryStore.set(key, '\0'.repeat(length));
    }
    
    memoryStore.clear();
    
    // Force garbage collection hint (if available)
    if (global.gc && typeof global.gc === 'function') {
        try {
            global.gc();
        } catch (e) {
            // Ignore GC errors
        }
    }
}

/**
 * Check if a key exists in memory
 * @param key - Storage key to check
 * @returns True if the key exists
 */
export function hasMemoryKey(key: string): boolean {
    return memoryStore.has(key);
}

/**
 * Get the current size of the memory store (for debugging in DEV only)
 * @returns Number of items in memory
 */
export function getMemorySize(): number {
    if (__DEV__) {
        return memoryStore.size;
    }
    return -1; // Don't expose in production
}
