export interface BiometricConfig {
    /** Whether biometric auth is enabled */
    enabled: boolean;
    /** Type of biometric available */
    type: 'fingerprint' | 'face' | 'iris' | 'none';
    /** Last time biometric was used successfully */
    lastUsed: number | null;
}

export const BIOMETRIC_STORAGE_KEY = 'vault_biometric_config';
