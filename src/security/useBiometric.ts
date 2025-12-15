import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import {
    getSecureObject,
    removeSecureItem,
    setSecureItem,
    setSecureObject
} from '../storage/secureStore';
import { BIOMETRIC_STORAGE_KEY, BiometricConfig } from './biometric.types';
import { getMemoryKey, MEMORY_KEYS } from './memory';

const BIOMETRIC_KEY_STORAGE = 'vault_biometric_key';


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
}

/**
 * Hook for managing biometric authentication
 */
export function useBiometric(): UseBiometricReturn {
    const [capabilities, setCapabilities] = useState<BiometricCapabilities | null>(null);
    const [config, setConfig] = useState<BiometricConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    /**
     * Check device biometric capabilities
     */
    const checkAvailability = useCallback(async (): Promise<BiometricCapabilities> => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        const capabilities: BiometricCapabilities = {
            hasHardware,
            isEnrolled,
            supportedTypes,
        };

        setCapabilities(capabilities);
        return capabilities;
    }, []);

    /**
     * Load biometric configuration
     */
    const loadConfig = useCallback(async () => {
        const storedConfig = await getSecureObject<BiometricConfig>(BIOMETRIC_STORAGE_KEY);
        setConfig(storedConfig);
    }, []);

    /**
     * Initialize on mount
     */
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            await checkAvailability();
            await loadConfig();
            setIsLoading(false);
        };
        init();
    }, [checkAvailability, loadConfig]);

    /**
     * Authenticate using biometrics
     */
    const authenticate = useCallback(async (
        promptMessage: string = 'Authenticate to unlock your vault'
    ): Promise<boolean> => {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage,
                cancelLabel: 'Use Password',
                disableDeviceFallback: true, // Force biometric only, no device PIN
                fallbackLabel: 'Use Password',
            });

            if (result.success) {
                // Update last used timestamp
                if (config) {
                    const updatedConfig: BiometricConfig = {
                        ...config,
                        lastUsed: Date.now(),
                    };
                    await setSecureObject(BIOMETRIC_STORAGE_KEY, updatedConfig);
                    setConfig(updatedConfig);
                }
                return true;
            }

            return false;
        } catch (error) {
            if (__DEV__) {
                console.error('[Biometric] Authentication error:', error);
            }
            return false;
        }
    }, [config]);

    /**
     * Enable biometric authentication
     */
    const enableBiometric = useCallback(async (): Promise<boolean> => {
        // Check availability first
        const caps = await checkAvailability();

        if (!caps.hasHardware || !caps.isEnrolled) {
            return false;
        }

        const derivedKey = getMemoryKey(MEMORY_KEYS.DERIVED_KEY);
        if (!derivedKey) {
            if (__DEV__) {
                console.error('[Biometric] Cannot enable: user not logged in');
            }
            return false;
        }

        // Test authentication before enabling
        const authenticated = await authenticate('Confirm to enable biometric unlock');

        if (!authenticated) {
            return false;
        }

        // Determine biometric type
        let type: BiometricConfig['type'] = 'none';
        if (caps.supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            type = 'face';
        } else if (caps.supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            type = 'fingerprint';
        } else if (caps.supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
            type = 'iris';
        }

        await setSecureItem(BIOMETRIC_KEY_STORAGE, derivedKey);

        const newConfig: BiometricConfig = {
            enabled: true,
            type,
            lastUsed: Date.now(),
        };

        await setSecureObject(BIOMETRIC_STORAGE_KEY, newConfig);
        setConfig(newConfig);

        return true;
    }, [checkAvailability, authenticate]);

    /**
     * Disable biometric authentication
     */
    const disableBiometric = useCallback(async () => {
        await removeSecureItem(BIOMETRIC_KEY_STORAGE);
        await removeSecureItem(BIOMETRIC_STORAGE_KEY);
        setConfig(null);
    }, []);

    /**
     * Get friendly name for current biometric type
     */
    const getBiometricTypeName = useCallback((): string => {
        if (!config || !config.enabled) {
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
    }, [config]);

    return {
        capabilities,
        config,
        isEnabled: config?.enabled ?? false,
        isLoading,
        checkAvailability,
        authenticate,
        enableBiometric,
        disableBiometric,
        getBiometricTypeName,
    };
}
