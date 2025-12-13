/**
 * Vault Repository - CRUD operations for encrypted vault items
 * @module vault/VaultRepository
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
 * Generate a unique ID for vault items
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
     * @param name - Display name for the item
     * @param content - Plaintext content to encrypt
     * @param type - Type of vault item
     * @returns The created VaultItem (encrypted)
     */
    async create(
        name: string,
        content: VaultItemContent,
        type: VaultItemType = 'other'
    ): Promise<VaultItem> {
        const encrypted = await encryptData(JSON.stringify(content));
        const now = Date.now();

        const item: VaultItem = {
            id: generateId(),
            name,
            type,
            encryptedData: encrypted.ciphertext,
            iv: encrypted.iv,
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
     */
    async read(id: string): Promise<VaultItemContent | null> {
        const vaultData = await loadVaultData();
        const item = vaultData.items.find(i => i.id === id);

        if (!item) {
            return null;
        }

        const decrypted = await decryptData({
            ciphertext: item.encryptedData,
            iv: item.iv,
        });

        return JSON.parse(decrypted) as VaultItemContent;
    },

    /**
     * Get a vault item without decrypting (metadata only)
     * @param id - Item ID
     * @returns VaultItem metadata or null
     */
    async getItem(id: string): Promise<VaultItem | null> {
        const vaultData = await loadVaultData();
        return vaultData.items.find(i => i.id === id) ?? null;
    },

    /**
     * Update an existing vault item
     * @param id - Item ID to update
     * @param content - New plaintext content
     * @param name - Optional new name
     * @returns Updated VaultItem or null if not found
     */
    async update(
        id: string,
        content: VaultItemContent,
        name?: string
    ): Promise<VaultItem | null> {
        const vaultData = await loadVaultData();
        const index = vaultData.items.findIndex(i => i.id === id);

        if (index === -1) {
            return null;
        }

        const encrypted = await encryptData(JSON.stringify(content));
        const item = vaultData.items[index];

        item.encryptedData = encrypted.ciphertext;
        item.iv = encrypted.iv;
        item.updatedAt = Date.now();
        if (name) {
            item.name = name;
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
