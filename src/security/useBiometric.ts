import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getSecureObject,
    removeSecureItem,
    setSecureObject
} from '../storage/secureStore';
import { BIOMETRIC_STORAGE_KEY, BiometricConfig } from './biometric.types';
import { getMemoryKey, MEMORY_KEYS } from './memory';

const BIOMETRIC_KEY_STORAGE = 'vault_biometric_key';

// Timeout for biometric operations (prevents hanging)
const BIOMETRIC_TIMEOUT_MS = 30000;

interface BiometricCapabilities {
    /** Whether device has biometric hardware */
    hasHardware: boolean;
    /** Whether biometrics are enrolled */
    isEnrolled: boolean;
    /** Available biometric types */
    supportedTypes: LocalAuthentication.AuthenticationType[];
}

interface UseBiometricReturn {
    /** Biometric capabilities of the device */
    capabilities: BiometricCapabilities | null;
    /** Current biometric configuration */
    config: BiometricConfig | null;
    /** Whether biometric is currently enabled */
    isEnabled: boolean;
    /** Loading state */
    isLoading: boolean;
    /** Error state */
    error: string | null;
    /** Check if biometrics are available */
    checkAvailability: () => Promise<BiometricCapabilities>;
    /** Authenticate with biometrics */
    authenticate: (promptMessage?: string) => Promise<boolean>;
    /** Enable biometric authentication */
    enableBiometric: () => Promise<boolean>;
    /** Disable biometric authentication */
    disableBiometric: () => Promise<void>;
    /** Get friendly name for biometric type */
    getBiometricTypeName: () => string;
    /** Refresh config from storage (useful after external changes) */
    refreshConfig: () => Promise<void>;
    /** Clear error state */
    clearError: () => void;
}

/**
 * Store the derived key with OS-level biometric protection
 * The key can only be retrieved after successful biometric authentication
 */
async function storeBiometricProtectedKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRIC_KEY_STORAGE, key, {
        // Key is only accessible when device is unlocked
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
        // CRITICAL: Requires biometric auth to access this item
        // On iOS: Uses Secure Enclave with biometric gate
        // On Android: Uses Android Keystore with biometric binding
        requireAuthentication: true,
        // Prompt shown when accessing the key
        authenticationPrompt: 'Authenticate to unlock your vault',
    });
}

/**
 * Retrieve the biometric-protected key
 * This will trigger OS-level biometric prompt automatically
 */
async function getBiometricProtectedKey(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(BIOMETRIC_KEY_STORAGE, {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to unlock your vault',
        });
    } catch (error) {
        // User cancelled or biometric failed
        if (__DEV__) {
            console.log('[Biometric] Key retrieval cancelled or failed:', error);
        }
        return null;
    }
}

/**
 * Hook for managing biometric authentication
 */
export function useBiometric(): UseBiometricReturn {
    const [capabilities, setCapabilities] = useState<BiometricCapabilities | null>(null);
    const [config, setConfig] = useState<BiometricConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Mutex to prevent concurrent operations
    const operationInProgressRef = useRef(false);
    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true);

    /**
     * Check device biometric capabilities
     */
    const checkAvailability = useCallback(async (): Promise<BiometricCapabilities> => {
        try {
            const [hasHardware, supportedTypes, isEnrolled] = await Promise.all([
                LocalAuthentication.hasHardwareAsync(),
                LocalAuthentication.supportedAuthenticationTypesAsync(),
                LocalAuthentication.isEnrolledAsync(),
            ]);

            const caps: BiometricCapabilities = {
                hasHardware,
                isEnrolled,
                supportedTypes,
            };

            if (isMountedRef.current) {
                setCapabilities(caps);
            }
            return caps;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to check biometric availability';
            if (isMountedRef.current) {
                setError(message);
            }
            
            const emptyCaps: BiometricCapabilities = {
                hasHardware: false,
                isEnrolled: false,
                supportedTypes: [],
            };
            if (isMountedRef.current) {
                setCapabilities(emptyCaps);
            }
            return emptyCaps;
        }
    }, []);

    /**
     * Load biometric configuration from storage
     */
    const loadConfig = useCallback(async (): Promise<BiometricConfig | null> => {
        try {
            const storedConfig = await getSecureObject<BiometricConfig>(BIOMETRIC_STORAGE_KEY);
            if (isMountedRef.current) {
                setConfig(storedConfig);
            }
            return storedConfig;
        } catch (err) {
            if (__DEV__) {
                console.error('[Biometric] Failed to load config:', err);
            }
            if (isMountedRef.current) {
                setConfig(null);
            }
            return null;
        }
    }, []);

    /**
     * Refresh config from storage (public method)
     */
    const refreshConfig = useCallback(async (): Promise<void> => {
        await loadConfig();
    }, [loadConfig]);

    /**
     * Clear error state
     */
    const clearError = useCallback(() => {
        if (isMountedRef.current) {
            setError(null);
        }
    }, []);

    /**
     * Initialize on mount
     */
    useEffect(() => {
        isMountedRef.current = true;
        
        const init = async () => {
            if (isMountedRef.current) {
                setIsLoading(true);
                setError(null);
            }
            
            try {
                await Promise.all([
                    checkAvailability(),
                    loadConfig(),
                ]);
            } catch (err) {
                if (__DEV__) {
                    console.error('[Biometric] Initialization error:', err);
                }
            } finally {
                if (isMountedRef.current) {
                    setIsLoading(false);
                }
            }
        };
        
        init();
        
        return () => {
            isMountedRef.current = false;
        };
    }, [checkAvailability, loadConfig]);

    /**
     * Authenticate using biometrics (for UI confirmation, not key retrieval)
     * Note: For actual key retrieval, use getBiometricProtectedKey which
     * triggers OS-level authentication automatically
     */
    const authenticate = useCallback(async (
        promptMessage: string = 'Authenticate to unlock your vault'
    ): Promise<boolean> => {
        // Prevent concurrent authentication attempts
        if (operationInProgressRef.current) {
            if (__DEV__) {
                console.warn('[Biometric] Authentication already in progress');
            }
            return false;
        }

        operationInProgressRef.current = true;
        if (isMountedRef.current) {
            setError(null);
        }

        try {
            // Add timeout to prevent hanging
            const authPromise = LocalAuthentication.authenticateAsync({
                promptMessage,
                cancelLabel: 'Use Password',
                disableDeviceFallback: true,
                fallbackLabel: 'Use Password',
            });

            const timeoutPromise = new Promise<LocalAuthentication.LocalAuthenticationResult>((_, reject) => {
                setTimeout(() => reject(new Error('Authentication timeout')), BIOMETRIC_TIMEOUT_MS);
            });

            const result = await Promise.race([authPromise, timeoutPromise]);

            if (result.success) {
                // Update last used timestamp
                const currentConfig = await getSecureObject<BiometricConfig>(BIOMETRIC_STORAGE_KEY);
                if (currentConfig) {
                    const updatedConfig: BiometricConfig = {
                        ...currentConfig,
                        lastUsed: Date.now(),
                    };
                    await setSecureObject(BIOMETRIC_STORAGE_KEY, updatedConfig);
                    if (isMountedRef.current) {
                        setConfig(updatedConfig);
                    }
                }
                return true;
            }

            // Handle specific failure reasons
            if ('error' in result && result.error) {
                let errorMessage: string | null = null;
                switch (result.error) {
                    case 'user_cancel':
                        // User cancelled - not an error
                        break;
                    case 'lockout':
                        errorMessage = 'Too many failed attempts. Please try again later.';
                        break;
                    case 'lockout_permanent':
                        errorMessage = 'Biometric is locked. Please use your device passcode to re-enable.';
                        break;
                    default:
                        errorMessage = 'Authentication failed. Please try again.';
                }
                if (errorMessage && isMountedRef.current) {
                    setError(errorMessage);
                }
            }

            return false;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Authentication error';
            if (__DEV__) {
                console.error('[Biometric] Authentication error:', err);
            }
            if (isMountedRef.current) {
                setError(message);
            }
            return false;
        } finally {
            operationInProgressRef.current = false;
        }
    }, []);

    /**
     * Enable biometric authentication
     * Stores the derived key with OS-level biometric protection
     */
    const enableBiometric = useCallback(async (): Promise<boolean> => {
        // Prevent concurrent operations
        if (operationInProgressRef.current) {
            if (__DEV__) {
                console.warn('[Biometric] Operation already in progress');
            }
            return false;
        }

        operationInProgressRef.current = true;
        if (isMountedRef.current) {
            setError(null);
        }

        try {
            // Check availability first
            const caps = await checkAvailability();

            if (!caps.hasHardware) {
                if (isMountedRef.current) {
                    setError('Biometric hardware not available on this device');
                }
                return false;
            }
            
            if (!caps.isEnrolled) {
                if (isMountedRef.current) {
                    setError('No biometrics enrolled. Please set up biometrics in device settings.');
                }
                return false;
            }

            // Get derived key from memory (user must be logged in)
            const derivedKey = getMemoryKey(MEMORY_KEYS.DERIVED_KEY);
            if (!derivedKey) {
                if (isMountedRef.current) {
                    setError('Please login with your password first');
                }
                if (__DEV__) {
                    console.error('[Biometric] Cannot enable: user not logged in');
                }
                return false;
            }

            // Verify user intent with biometric authentication
            const authenticated = await authenticate('Confirm to enable biometric unlock');
            if (!authenticated) {
                // Error already set by authenticate()
                return false;
            }

            // Determine biometric type for display purposes
            let type: BiometricConfig['type'] = 'none';
            if (caps.supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                type = 'face';
            } else if (caps.supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                type = 'fingerprint';
            } else if (caps.supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
                type = 'iris';
            }

            // Store the key with OS-level biometric protection
            // This is the secure approach - the key can only be retrieved
            // after successful biometric authentication at the OS level
            await storeBiometricProtectedKey(derivedKey);

            // Store configuration (not sensitive, just metadata)
            const newConfig: BiometricConfig = {
                enabled: true,
                type,
                lastUsed: Date.now(),
            };

            await setSecureObject(BIOMETRIC_STORAGE_KEY, newConfig);
            if (isMountedRef.current) {
                setConfig(newConfig);
            }

            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to enable biometric';
            if (__DEV__) {
                console.error('[Biometric] Enable error:', err);
            }
            if (isMountedRef.current) {
                setError(message);
            }
            return false;
        } finally {
            operationInProgressRef.current = false;
        }
    }, [checkAvailability, authenticate]);

    /**
     * Disable biometric authentication
     */
    const disableBiometric = useCallback(async (): Promise<void> => {
        // Prevent concurrent operations
        if (operationInProgressRef.current) {
            if (__DEV__) {
                console.warn('[Biometric] Operation already in progress');
            }
            return;
        }

        operationInProgressRef.current = true;
        if (isMountedRef.current) {
            setError(null);
        }

        try {
            // Remove the biometric-protected key
            await SecureStore.deleteItemAsync(BIOMETRIC_KEY_STORAGE);
            // Remove configuration
            await removeSecureItem(BIOMETRIC_STORAGE_KEY);
            
            if (isMountedRef.current) {
                setConfig(null);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to disable biometric';
            if (__DEV__) {
                console.error('[Biometric] Disable error:', err);
            }
            if (isMountedRef.current) {
                setError(message);
            }
        } finally {
            operationInProgressRef.current = false;
        }
    }, []);

    /**
     * Get friendly name for current biometric type
     */
    const getBiometricTypeName = useCallback((): string => {
        if (!config?.enabled) {
            // Fallback to capabilities if config not loaded yet
            if (capabilities?.supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                return 'Face ID';
            }
            if (capabilities?.supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                return 'Fingerprint';
            }
            return 'Biometric';
        }

        switch (config.type) {
            case 'face':
                return 'Face ID';
            case 'fingerprint':
                return 'Fingerprint';
            case 'iris':
                return 'Iris';
            default:
                return 'Biometric';
        }
    }, [config, capabilities]);

    return {
        capabilities,
        config,
        isEnabled: config?.enabled ?? false,
        isLoading,
        error,
        checkAvailability,
        authenticate,
        enableBiometric,
        disableBiometric,
        getBiometricTypeName,
        refreshConfig,
        clearError,
    };
}

/**
 * Retrieve the stored derived key using biometric authentication
 * This triggers OS-level biometric prompt automatically
 * 
 * @returns The derived key if authentication succeeds, null otherwise
 */
export async function retrieveBiometricKey(): Promise<string | null> {
    return getBiometricProtectedKey();
}