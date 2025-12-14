/**
 * Vault Repository - CRUD operations for encrypted vault items
 * @module vault/VaultRepository
 * 
 * Provides secure CRUD operations with:
 * - Encrypted content and metadata (names)
 * - Input validation and sanitization
 * - Integrity verification
 * - Size limits to prevent DoS
 */

import { decryptData, encryptData } from '../storage/encryptedStorage';
import {
    getSecureObject,
    setSecureObject,
    STORAGE_KEYS
} from '../storage/secureStore';
import {
    DEFAULT_VAULT_METADATA,
    VaultData,
    VaultItem,
    VaultItemContent,
    VaultItemType
} from './vault.types';

/**
 * Maximum length for item names (prevent DoS)
 */
const MAX_NAME_LENGTH = 256;

/**
 * Maximum length for item content (10MB)
 */
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024;

/**
 * Generate a unique ID for vault items
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate and sanitize item name
 */
function validateName(name: string): string {
    if (!name || typeof name !== 'string') {
        throw new Error('Item name is required and must be a string');
    }
    
    const trimmed = name.trim();
    if (trimmed.length === 0) {
        throw new Error('Item name cannot be empty');
    }
    
    if (trimmed.length > MAX_NAME_LENGTH) {
        throw new Error(`Item name too long. Maximum length is ${MAX_NAME_LENGTH} characters.`);
    }
    
    // Remove control characters and normalize
    return trimmed.replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Validate content
 */
function validateContent(content: string): void {
    if (typeof content !== 'string') {
        throw new Error('Content must be a string');
    }
    
    if (content.length > MAX_CONTENT_LENGTH) {
        throw new Error(`Content too large. Maximum size is ${MAX_CONTENT_LENGTH} bytes.`);
    }
}

/**
 * Load vault data from secure storage
 */
async function loadVaultData(): Promise<VaultData> {
    const data = await getSecureObject<VaultData>(STORAGE_KEYS.VAULT_DATA);
    return data ?? { metadata: DEFAULT_VAULT_METADATA, items: [] };
}

/**
 * Save vault data to secure storage
 */
async function saveVaultData(data: VaultData): Promise<void> {
    data.metadata.lastModified = Date.now();
    data.metadata.itemCount = data.items.length;
    await setSecureObject(STORAGE_KEYS.VAULT_DATA, data);
}

/**
 * Vault Repository - Manages encrypted vault items
 */
export const VaultRepository = {
    /**
     * Create a new vault item
     * @param name - Display name for the item (will be encrypted)
     * @param content - Plaintext content to encrypt
     * @param type - Type of vault item
     * @returns The created VaultItem (encrypted)
     */
    async create(
        name: string,
        content: VaultItemContent,
        type: VaultItemType = 'other'
    ): Promise<VaultItem> {
        // Validate inputs
        const sanitizedName = validateName(name);
        validateContent(content.content);

        // Encrypt content
        const encryptedContent = await encryptData(JSON.stringify(content));
        
        // Encrypt name (metadata)
        const encryptedName = await encryptData(sanitizedName);
        
        const now = Date.now();

        const item: VaultItem = {
            id: generateId(),
            name: encryptedName.ciphertext, // Store encrypted name
            nameIv: encryptedName.iv,
            nameHmac: encryptedName.hmac,
            type,
            encryptedData: encryptedContent.ciphertext,
            iv: encryptedContent.iv,
            hmac: encryptedContent.hmac,
            timestamp: encryptedContent.timestamp,
            createdAt: now,
            updatedAt: now,
        };

        const vaultData = await loadVaultData();
        vaultData.items.push(item);
        await saveVaultData(vaultData);

        return item;
    },

    /**
     * Read and decrypt a vault item by ID
     * @param id - Item ID to read
     * @returns Decrypted content or null if not found
     * @throws Error if integrity check fails
     */
    async read(id: string): Promise<VaultItemContent | null> {
        if (!id || typeof id !== 'string') {
            throw new Error('Invalid item ID');
        }

        const vaultData = await loadVaultData();
        const item = vaultData.items.find(i => i.id === id);

        if (!item) {
            return null;
        }

        // Verify we have all required fields (backward compatibility)
        if (!item.hmac || !item.timestamp) {
            throw new Error('Item format is outdated. The vault needs to be migrated to the new secure format.');
        }

        // Check if migration is needed
        if (item.hmac === 'MIGRATION_NEEDED') {
            throw new Error('Item needs re-encryption. Please contact support or reset the vault.');
        }

        try {
            const decrypted = await decryptData({
                ciphertext: item.encryptedData,
                iv: item.iv,
                hmac: item.hmac,
                timestamp: item.timestamp,
            });

            return JSON.parse(decrypted) as VaultItemContent;
        } catch (error) {
            if (error instanceof Error && error.message.includes('Integrity check failed')) {
                throw new Error('Data integrity verification failed. The item may have been tampered with.');
            }
            throw error;
        }
    },

    /**
     * Get a vault item without decrypting (metadata only)
     * @param id - Item ID
     * @returns VaultItem metadata or null
     */
    async getItem(id: string): Promise<VaultItem | null> {
        if (!id || typeof id !== 'string') {
            throw new Error('Invalid item ID');
        }

        const vaultData = await loadVaultData();
        return vaultData.items.find(i => i.id === id) ?? null;
    },

    /**
     * Decrypt and get item name
     * @param item - VaultItem with encrypted name
     * @returns Decrypted name or null if decryption fails
     */
    async getItemName(item: VaultItem): Promise<string | null> {
        try {
            // Backward compatibility: if name is not encrypted, return as-is
            if (!item.nameIv || !item.nameHmac) {
                return item.name;
            }

            const decrypted = await decryptData({
                ciphertext: item.name,
                iv: item.nameIv,
                hmac: item.nameHmac,
                timestamp: item.createdAt, // Use creation time as timestamp
            });

            return decrypted;
        } catch (error) {
            if (__DEV__) {
                console.error('[VaultRepository] Failed to decrypt item name:', error instanceof Error ? error.message : 'Unknown error');
            }
            return null;
        }
    },

    /**
     * Update an existing vault item
     * @param id - Item ID to update
     * @param content - New plaintext content
     * @param name - Optional new name
     * @returns Updated VaultItem or null if not found
     * @throws Error if validation fails or integrity check fails
     */
    async update(
        id: string,
        content: VaultItemContent,
        name?: string
    ): Promise<VaultItem | null> {
        if (!id || typeof id !== 'string') {
            throw new Error('Invalid item ID');
        }

        validateContent(content.content);

        const vaultData = await loadVaultData();
        const index = vaultData.items.findIndex(i => i.id === id);

        if (index === -1) {
            return null;
        }

        const encrypted = await encryptData(JSON.stringify(content));
        const item = vaultData.items[index];

        item.encryptedData = encrypted.ciphertext;
        item.iv = encrypted.iv;
        item.hmac = encrypted.hmac;
        item.timestamp = encrypted.timestamp;
        item.updatedAt = Date.now();
        
        if (name) {
            const sanitizedName = validateName(name);
            const encryptedName = await encryptData(sanitizedName);
            item.name = encryptedName.ciphertext;
            item.nameIv = encryptedName.iv;
            item.nameHmac = encryptedName.hmac;
        }

        await saveVaultData(vaultData);
        return item;
    },

    /**
     * Delete a vault item
     * @param id - Item ID to delete
     * @returns True if deleted, false if not found
     */
    async delete(id: string): Promise<boolean> {
        const vaultData = await loadVaultData();
        const initialLength = vaultData.items.length;
        vaultData.items = vaultData.items.filter(i => i.id !== id);

        if (vaultData.items.length === initialLength) {
            return false;
        }

        await saveVaultData(vaultData);
        return true;
    },

    /**
     * List all vault items (metadata only, not decrypted)
     * @returns Array of VaultItem metadata
     */
    async list(): Promise<VaultItem[]> {
        const vaultData = await loadVaultData();
        return vaultData.items;
    },

    /**
     * Migrate old format items to new secure format
     * This should be called once to upgrade existing vaults
     */
    async migrateToSecureFormat(): Promise<number> {
        const vaultData = await loadVaultData();
        let migratedCount = 0;

        for (const item of vaultData.items) {
            // Check if item needs migration (missing hmac or encrypted name)
            const needsMigration = !item.hmac || !item.timestamp || !item.nameIv;

            if (needsMigration) {
                try {
                    // If name is not encrypted, encrypt it
                    if (!item.nameIv) {
                        const encryptedName = await encryptData(item.name);
                        item.name = encryptedName.ciphertext;
                        item.nameIv = encryptedName.iv;
                        item.nameHmac = encryptedName.hmac;
                    }

                    // If content is missing hmac, we need to re-encrypt
                    // But we can't decrypt without the old format, so we'll mark it
                    // For now, we'll add a placeholder that will fail on read
                    if (!item.hmac || !item.timestamp) {
                        // Mark as needing re-encryption
                        item.hmac = 'MIGRATION_NEEDED';
                        item.timestamp = Date.now();
                    }

                    migratedCount++;
                } catch (error) {
                    if (__DEV__) {
                        console.error('[VaultRepository] Migration error for item:', item.id, error instanceof Error ? error.message : 'Unknown error');
                    }
                    // Continue with other items
                }
            }
        }

        if (migratedCount > 0) {
            await saveVaultData(vaultData);
        }

        return migratedCount;
    },

    /**
     * Get vault metadata
     * @returns VaultMetadata
     */
    async getMetadata() {
        const vaultData = await loadVaultData();
        return vaultData.metadata;
    },

    /**
     * Clear all vault items
     */
    async clear(): Promise<void> {
        await saveVaultData({
            metadata: DEFAULT_VAULT_METADATA,
            items: []
        });
    },
};
