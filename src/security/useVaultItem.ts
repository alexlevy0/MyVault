/**
 * useVaultItem Hook - Secure CRUD operations for vault items
 * @module security/useVaultItem
 * 
 * Provides a React hook for managing vault items with encryption/decryption.
 */

import { useCallback, useState } from 'react';
import { VaultRepository } from '../vault/VaultRepository';
import { VaultItem, VaultItemContent, VaultItemType } from '../vault/vault.types';
import { useSecurity } from './SecurityContext';

/**
 * Hook return type
 */
interface UseVaultItemReturn {
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Create a new vault item */
    createItem: (name: string, content: string, type?: VaultItemType) => Promise<VaultItem | null>;
    /** Read and decrypt a vault item */
    readItem: (id: string) => Promise<VaultItemContent | null>;
    /** Update an existing vault item */
    updateItem: (id: string, content: string, name?: string) => Promise<VaultItem | null>;
    /** Delete a vault item */
    deleteItem: (id: string) => Promise<boolean>;
    /** List all vault items (metadata only) */
    listItems: () => Promise<VaultItem[]>;
    /** Clear error state */
    clearError: () => void;
}

/**
 * Hook for secure vault item operations
 * Must be used within a SecurityProvider and when user is logged in
 */
export function useVaultItem(): UseVaultItemReturn {
    const { isLoggedIn } = useSecurity();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Validate that user is logged in before operations
     */
    const validateAccess = useCallback((): boolean => {
        if (!isLoggedIn) {
            setError('You must be logged in to access vault items');
            return false;
        }
        return true;
    }, [isLoggedIn]);

    /**
     * Create a new vault item
     */
    const createItem = useCallback(async (
        name: string,
        content: string,
        type: VaultItemType = 'other'
    ): Promise<VaultItem | null> => {
        if (!validateAccess()) return null;

        setIsLoading(true);
        setError(null);

        try {
            const itemContent: VaultItemContent = { content };
            const item = await VaultRepository.create(name, itemContent, type);
            return item;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create item';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [validateAccess]);

    /**
     * Read and decrypt a vault item
     */
    const readItem = useCallback(async (id: string): Promise<VaultItemContent | null> => {
        if (!validateAccess()) return null;

        setIsLoading(true);
        setError(null);

        try {
            const content = await VaultRepository.read(id);
            if (!content) {
                setError('Item not found');
                return null;
            }
            return content;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to read item';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [validateAccess]);

    /**
     * Update an existing vault item
     */
    const updateItem = useCallback(async (
        id: string,
        content: string,
        name?: string
    ): Promise<VaultItem | null> => {
        if (!validateAccess()) return null;

        setIsLoading(true);
        setError(null);

        try {
            const itemContent: VaultItemContent = { content };
            const item = await VaultRepository.update(id, itemContent, name);
            if (!item) {
                setError('Item not found');
                return null;
            }
            return item;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update item';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [validateAccess]);

    /**
     * Delete a vault item
     */
    const deleteItem = useCallback(async (id: string): Promise<boolean> => {
        if (!validateAccess()) return false;

        setIsLoading(true);
        setError(null);

        try {
            const success = await VaultRepository.delete(id);
            if (!success) {
                setError('Item not found');
            }
            return success;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to delete item';
            setError(message);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [validateAccess]);

    /**
     * List all vault items (metadata only)
     */
    const listItems = useCallback(async (): Promise<VaultItem[]> => {
        if (!validateAccess()) return [];

        setIsLoading(true);
        setError(null);

        try {
            return await VaultRepository.list();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to list items';
            setError(message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [validateAccess]);

    /**
     * Clear error state
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        isLoading,
        error,
        createItem,
        readItem,
        updateItem,
        deleteItem,
        listItems,
        clearError,
    };
}
