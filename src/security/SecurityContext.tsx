/**
 * Security Context - Main authentication context with PBKDF2 key derivation
 * @module security/SecurityContext
 * 
 * Provides secure password-based authentication with:
 * - PBKDF2 key derivation (150k iterations, SHA-256)
 * - Timing-safe password comparison
 * - Secure session management
 */

import * as Crypto from 'expo-crypto';
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState
} from 'react';
import {
    clearAllSecureStorage,
    getSecureItem,
    getSecureObject,
    removeSecureItem,
    setSecureObject,
    STORAGE_KEYS,
} from '../storage/secureStore';
import { BIOMETRIC_STORAGE_KEY } from './biometric.types';
import {
    clearAllMemory,
    MEMORY_KEYS,
    setMemoryKey
} from './memory';
import {
    DEFAULT_PBKDF2_CONFIG,
    DerivedKeyInfo,
    SecurityContextValue,
    SecurityState
} from './security.types';

// Initial state
const initialState: SecurityState = {
    isInitialized: false,
    isLoggedIn: false,
    hasAccount: false,
    isLoading: true,
    error: null,
};

const BIOMETRIC_KEY_STORAGE = 'vault_biometric_key';

// Create context with undefined default
const SecurityContext = createContext<SecurityContextValue | undefined>(undefined);

/**
 * Convert Uint8Array to Base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * HMAC-SHA256 implementation using expo-crypto
 * HMAC(key, message) = H((key XOR opad) || H((key XOR ipad) || message))
 */
async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    const BLOCK_SIZE = 64; // SHA-256 block size

    // If key is longer than block size, hash it
    let keyBytes = key;
    if (keyBytes.length > BLOCK_SIZE) {
        const hash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            uint8ArrayToBase64(keyBytes),
            { encoding: Crypto.CryptoEncoding.BASE64 }
        );
        keyBytes = base64ToUint8Array(hash);
    }

    // Pad key to block size
    const paddedKey = new Uint8Array(BLOCK_SIZE);
    paddedKey.set(keyBytes);

    // Create ipad and opad
    const ipad = new Uint8Array(BLOCK_SIZE);
    const opad = new Uint8Array(BLOCK_SIZE);
    for (let i = 0; i < BLOCK_SIZE; i++) {
        ipad[i] = paddedKey[i] ^ 0x36;
        opad[i] = paddedKey[i] ^ 0x5c;
    }

    // Inner hash: H(ipad || message)
    const innerData = new Uint8Array(BLOCK_SIZE + message.length);
    innerData.set(ipad);
    innerData.set(message, BLOCK_SIZE);

    const innerHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uint8ArrayToBase64(innerData),
        { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    const innerHashBytes = base64ToUint8Array(innerHash);

    // Outer hash: H(opad || innerHash)
    const outerData = new Uint8Array(BLOCK_SIZE + innerHashBytes.length);
    outerData.set(opad);
    outerData.set(innerHashBytes, BLOCK_SIZE);

    const outerHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uint8ArrayToBase64(outerData),
        { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    return base64ToUint8Array(outerHash);
}

/**
 * XOR two Uint8Arrays of equal length
 */
function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) {
        result[i] = a[i] ^ b[i];
    }
    return result;
}

/**
 * Proper PBKDF2 implementation using HMAC-SHA256
 * Following RFC 2898 specification
 */
async function deriveKey(
    password: string,
    salt: Uint8Array,
    iterations: number = DEFAULT_PBKDF2_CONFIG.iterations,
    keyLength: number = DEFAULT_PBKDF2_CONFIG.keyLength
): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);

    // PBKDF2 parameters
    const hLen = 32; // SHA-256 output length
    const dkLen = keyLength;
    const numBlocks = Math.ceil(dkLen / hLen);

    const derivedKeyParts: Uint8Array[] = [];

    for (let blockNum = 1; blockNum <= numBlocks; blockNum++) {
        // U_1 = PRF(Password, Salt || INT(i))
        // INT(i) is a four-octet encoding of the integer i, most significant octet first
        const blockIndex = new Uint8Array(4);
        blockIndex[0] = (blockNum >> 24) & 0xff;
        blockIndex[1] = (blockNum >> 16) & 0xff;
        blockIndex[2] = (blockNum >> 8) & 0xff;
        blockIndex[3] = blockNum & 0xff;

        const saltWithIndex = new Uint8Array(salt.length + 4);
        saltWithIndex.set(salt);
        saltWithIndex.set(blockIndex, salt.length);

        // First iteration
        let u = await hmacSha256(passwordBytes, saltWithIndex);
        let result = new Uint8Array(u);

        // Subsequent iterations: U_j = PRF(Password, U_{j-1})
        // T_i = U_1 ^ U_2 ^ ... ^ U_c
        for (let j = 1; j < iterations; j++) {
            u = await hmacSha256(passwordBytes, u);
            result = xorBytes(result, u);
        }

        derivedKeyParts.push(result);
    }

    // Concatenate all parts and truncate to desired length
    const fullKey = new Uint8Array(numBlocks * hLen);
    for (let i = 0; i < derivedKeyParts.length; i++) {
        fullKey.set(derivedKeyParts[i], i * hLen);
    }

    return fullKey.slice(0, dkLen);
}

/**
 * Timing-safe comparison of two strings
 * Prevents timing attacks by ensuring constant-time comparison
 * Does NOT leak string length
 */
function timingSafeEqual(a: string, b: string): boolean {
    const aLen = a.length;
    const bLen = b.length;
    const maxLen = Math.max(aLen, bLen);

    // XOR the lengths first - this will be non-zero if lengths differ
    let result = aLen ^ bLen;

    // Compare all characters up to maxLen
    // Use 0 for out-of-bounds to avoid leaking length through early exit
    for (let i = 0; i < maxLen; i++) {
        const aChar = i < aLen ? a.charCodeAt(i) : 0;
        const bChar = i < bLen ? b.charCodeAt(i) : 0;
        result |= aChar ^ bChar;
    }

    return result === 0;
}

/**
 * Security Provider Props
 */
interface SecurityProviderProps {
    children: ReactNode;
}

/**
 * Security Provider Component
 * Wraps the app with security context
 */
export function SecurityProvider({ children }: SecurityProviderProps) {
    const [state, setState] = useState<SecurityState>(initialState);

    // Initialize on mount
    useEffect(() => {
        initializeSecurity();
    }, []);

    /**
     * Initialize security context
     * Check if account exists in secure storage
     */
    const initializeSecurity = useCallback(async () => {
        try {
            const storedKeyInfo = await getSecureObject<DerivedKeyInfo>(
                STORAGE_KEYS.DERIVED_KEY_INFO
            );

            setState({
                isInitialized: true,
                isLoggedIn: false,
                hasAccount: storedKeyInfo !== null,
                isLoading: false,
                error: null,
            });
        } catch (error) {
            if (__DEV__) {
                console.error('[Security] Initialization error:', error instanceof Error ? error.message : 'Unknown error');
            }
            setState(prev => ({
                ...prev,
                isInitialized: true,
                isLoading: false,
                error: 'Failed to initialize security',
            }));
        }
    }, []);

    /**
     * Set up a new account with password
     * Derives key and stores hash in SecureStore
     */
    const setupAction = useCallback(async (password: string): Promise<boolean> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Generate random salt
            const saltBytes = await Crypto.getRandomBytesAsync(DEFAULT_PBKDF2_CONFIG.saltLength);
            const salt = new Uint8Array(saltBytes);

            // Derive key from password using proper PBKDF2
            const derivedKey = await deriveKey(
                password,
                salt,
                DEFAULT_PBKDF2_CONFIG.iterations,
                DEFAULT_PBKDF2_CONFIG.keyLength
            );
            const derivedKeyBase64 = uint8ArrayToBase64(derivedKey);

            // Store derived key info
            const keyInfo: DerivedKeyInfo = {
                salt: uint8ArrayToBase64(salt),
                hash: derivedKeyBase64,
                iterations: DEFAULT_PBKDF2_CONFIG.iterations,
                createdAt: Date.now(),
            };

            await setSecureObject(STORAGE_KEYS.DERIVED_KEY_INFO, keyInfo);

            // Store derived key in memory for encryption operations
            setMemoryKey(MEMORY_KEYS.DERIVED_KEY, derivedKeyBase64);

            setState({
                isInitialized: true,
                isLoggedIn: true,
                hasAccount: true,
                isLoading: false,
                error: null,
            });

            return true;
        } catch (error) {
            if (__DEV__) {
                console.error('[Security] Setup error:', error instanceof Error ? error.message : 'Unknown error');
            }
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Failed to set up account',
            }));
            return false;
        }
    }, []);

    /**
     * Login with password
     * Verifies password using timing-safe comparison
     */
    const loginAction = useCallback(async (password: string): Promise<boolean> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Get stored key info
            const storedKeyInfo = await getSecureObject<DerivedKeyInfo>(
                STORAGE_KEYS.DERIVED_KEY_INFO
            );

            if (!storedKeyInfo) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'No account found',
                }));
                return false;
            }

            // Derive key from entered password using proper PBKDF2
            const salt = base64ToUint8Array(storedKeyInfo.salt);
            const derivedKey = await deriveKey(
                password,
                salt,
                storedKeyInfo.iterations,
                DEFAULT_PBKDF2_CONFIG.keyLength
            );
            const derivedKeyBase64 = uint8ArrayToBase64(derivedKey);

            // Timing-safe comparison (no length leakage)
            if (!timingSafeEqual(derivedKeyBase64, storedKeyInfo.hash)) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'Invalid password',
                }));
                return false;
            }

            // Store derived key in memory for encryption operations
            setMemoryKey(MEMORY_KEYS.DERIVED_KEY, derivedKeyBase64);

            setState({
                isInitialized: true,
                isLoggedIn: true,
                hasAccount: true,
                isLoading: false,
                error: null,
            });

            return true;
        } catch (error) {
            if (__DEV__) {
                console.error('[Security] Login error:', error instanceof Error ? error.message : 'Unknown error');
            }
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Login failed',
            }));
            return false;
        }
    }, []);

    /**
     * Logout - clears session but keeps account
     */
    const logoutAction = useCallback(() => {
        clearAllMemory();
        setState(prev => ({
            ...prev,
            isLoggedIn: false,
            error: null,
        }));
    }, []);

    /**
     * Lock action - same as logout but triggered by auto-lock
     */
    const lockAction = useCallback(() => {
        clearAllMemory();
        setState(prev => ({
            ...prev,
            isLoggedIn: false,
            error: null,
        }));
    }, []);

    /**
     * Reset app - clears all data including account
     */
    const resetAppAction = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true }));

        try {
            clearAllMemory();
            await clearAllSecureStorage();
            await removeSecureItem(BIOMETRIC_KEY_STORAGE);
            await removeSecureItem(BIOMETRIC_STORAGE_KEY);

            setState({
                isInitialized: true,
                isLoggedIn: false,
                hasAccount: false,
                isLoading: false,
                error: null,
            });
        } catch (error) {
            if (__DEV__) {
                console.error('[Security] Reset error:', error instanceof Error ? error.message : 'Unknown error');
            }
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Failed to reset app',
            }));
        }
    }, []);

    /**
    * Login with biometric authentication
    * Retrieves stored derived key and restores session
    */
    const biometricLoginAction = useCallback(async (): Promise<boolean> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Get stored derived key (only available if biometric is enabled)
            const storedKey = await getSecureItem(BIOMETRIC_KEY_STORAGE);

            if (!storedKey) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'Biometric key not found. Please use password.',
                }));
                return false;
            }

            // Verify we still have account
            const storedKeyInfo = await getSecureObject<DerivedKeyInfo>(
                STORAGE_KEYS.DERIVED_KEY_INFO
            );

            if (!storedKeyInfo) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'No account found',
                }));
                return false;
            }

            // Store derived key in memory for encryption operations
            setMemoryKey(MEMORY_KEYS.DERIVED_KEY, storedKey);

            setState({
                isInitialized: true,
                isLoggedIn: true,
                hasAccount: true,
                isLoading: false,
                error: null,
            });

            return true;
        } catch (error) {
            if (__DEV__) {
                console.error('[Security] Biometric login error:', error instanceof Error ? error.message : 'Unknown error');
            }
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Biometric login failed',
            }));
            return false;
        }
    }, []);

    // Combine state and actions
    const value: SecurityContextValue = {
        ...state,
        setupAction,
        loginAction,
        logoutAction,
        biometricLoginAction,
        lockAction,
        resetAppAction,
    };

    return (
        <SecurityContext.Provider value={value}>
            {children}
        </SecurityContext.Provider>
    );
}

/**
 * Hook to use security context
 * @throws Error if used outside SecurityProvider
 */
export function useSecurity(): SecurityContextValue {
    const context = useContext(SecurityContext);
    if (!context) {
        throw new Error('useSecurity must be used within a SecurityProvider');
    }
    return context;
}
