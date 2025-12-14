/**
 * Vault Types - Type definitions for vault items
 * @module vault/vault.types
 */

/**
 * A single vault item (encrypted)
 */
export interface VaultItem {
    /** Unique identifier for the item */
    id: string;
    /** Encrypted name (Base64) - metadata is also encrypted */
    name: string;
    /** IV for name encryption (Base64) */
    nameIv?: string;
    /** HMAC for name integrity (Base64) */
    nameHmac?: string;
    /** Type of item for UI categorization */
    type: VaultItemType;
    /** Encrypted data payload (Base64) */
    encryptedData: string;
    /** Initialization vector used for encryption (Base64) */
    iv: string;
    /** HMAC-SHA256 for integrity verification (Base64) */
    hmac: string;
    /** Timestamp to prevent replay attacks */
    timestamp: number;
    /** Timestamp when created */
    createdAt: number;
    /** Timestamp when last modified */
    updatedAt: number;
}

/**
 * Types of vault items
 */
export type VaultItemType = 'password' | 'note' | 'card' | 'identity' | 'other';

/**
 * Decrypted vault item content (in memory only)
 */
export interface VaultItemContent {
    /** The decrypted plaintext content */
    content: string;
    /** Optional metadata */
    metadata?: Record<string, string>;
}

/**
 * Encryption parameters for vault operations
 */
export interface EncryptionParams {
    /** Encryption algorithm (AES-GCM recommended) */
    algorithm: 'AES-GCM' | 'AES-CBC';
    /** Key length in bits */
    keyLength: 128 | 192 | 256;
    /** IV size in bytes */
    ivSize: number;
    /** Authentication tag size for GCM (in bits) */
    tagSize?: 96 | 104 | 112 | 120 | 128;
}

/**
 * Default encryption parameters
 */
export const DEFAULT_ENCRYPTION_PARAMS: EncryptionParams = {
    algorithm: 'AES-GCM',
    keyLength: 256,
    ivSize: 12,
    tagSize: 128,
};

/**
 * Vault metadata stored alongside items
 */
export interface VaultMetadata {
    /** Total number of items */
    itemCount: number;
    /** Last modification timestamp */
    lastModified: number;
    /** Version for migration purposes */
    version: number;
}

/**
 * Default vault metadata
 */
export const DEFAULT_VAULT_METADATA: VaultMetadata = {
    itemCount: 0,
    lastModified: Date.now(),
    version: 1,
};

/**
 * Vault data structure stored in secure storage
 */
export interface VaultData {
    /** Metadata about the vault */
    metadata: VaultMetadata;
    /** Array of encrypted vault items */
    items: VaultItem[];
}
