/**
 * Home Screen - Protected main screen after authentication
 * @module app/home
 */

import * as Clipboard from 'expo-clipboard';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useToaster } from '../src/contexts/ToasterContext';
import { useSecurity } from '../src/security/SecurityContext';
import { useBiometric } from '../src/security/useBiometric';
import { useVaultItem } from '../src/security/useVaultItem';
import { VaultItem } from '../src/vault/vault.types';
import { VaultRepository } from '../src/vault/VaultRepository';


interface ItemWithName extends VaultItem {
    decryptedName: string | null;
}

export default function HomeScreen() {
    const router = useRouter();
    const { logoutAction, resetAppAction, isLoading: securityLoading, isLoggedIn } = useSecurity();
    const { showToast } = useToaster();
    const { listItems, readItem, deleteItem, isLoading: vaultLoading } = useVaultItem();

    const [items, setItems] = useState<ItemWithName[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);

    // Watch for logout/lock events and redirect to login
    useEffect(() => {
        if (!isLoggedIn) {
            router.replace('/login' as Href);
        }
    }, [isLoggedIn, router]);

    // Load items and decrypt names
    const loadItems = useCallback(async () => {
        if (!isLoggedIn) return;

        setIsLoadingItems(true);
        try {
            const vaultItems = await listItems();
            const itemsWithNames: ItemWithName[] = await Promise.all(
                vaultItems.map(async (item) => {
                    const decryptedName = await VaultRepository.getItemName(item);
                    return { ...item, decryptedName };
                })
            );
            setItems(itemsWithNames);
        } catch (error) {
            showToast('error', 'Failed to load items');
        } finally {
            setIsLoadingItems(false);
        }
    }, [listItems, isLoggedIn, showToast]);

    // Refresh items when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadItems();
        }, [loadItems])
    );

    const handleAddItem = () => {
        router.push('/add-item' as Href);
    };

    const handleViewItem = async (item: ItemWithName) => {
        try {
            const content = await readItem(item.id);
            if (content) {
                Alert.alert(
                    item.decryptedName || 'Item',
                    content.content,
                    [
                        {
                            text: 'Copy',
                            onPress: async () => {
                                try {
                                    await Clipboard.setStringAsync(content.content);
                                    showToast('success', 'Content copied to clipboard');
                                } catch (error) {
                                    showToast('error', 'Failed to copy to clipboard');
                                }
                            },
                        },
                        { text: 'Close', style: 'cancel' },
                    ],
                    { cancelable: true }
                );
            } else {
                showToast('error', 'Failed to read item');
            }
        } catch (error) {
            showToast('error', 'Failed to read item');
        }
    };

    const handleDeleteItem = (item: ItemWithName) => {
        Alert.alert(
            'Delete Item',
            `Are you sure you want to delete "${item.decryptedName || 'this item'}"? This action cannot be undone.`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await deleteItem(item.id);
                        if (success) {
                            showToast('success', 'Item deleted');
                            loadItems();
                        } else {
                            showToast('error', 'Failed to delete item');
                        }
                    },
                },
            ]
        );
    };

    const handleLogout = () => {
        logoutAction();
        showToast('info', 'Vault locked');
        router.replace('/login');
    };

    const handleResetApp = () => {
        Alert.alert(
            'Reset Vault',
            'This will permanently delete all your data including your master password. This action cannot be undone.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        await resetAppAction();
                        showToast('info', 'Vault has been reset');
                        router.replace('/setup');
                    },
                },
            ]
        );
    };

    const getTypeIcon = (type: string): string => {
        switch (type) {
            case 'password':
                return '🔑';
            case 'note':
                return '📝';
            case 'card':
                return '💳';
            case 'identity':
                return '🆔';
            default:
                return '📦';
        }
    };

    const getTypeLabel = (type: string): string => {
        switch (type) {
            case 'password':
                return 'Password';
            case 'note':
                return 'Note';
            case 'card':
                return 'Card';
            case 'identity':
                return 'Identity';
            default:
                return 'Other';
        }
    };

    const renderItem = ({ item }: { item: ItemWithName }) => (
        <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemIcon}>{getTypeIcon(item.type)}</Text>
                    <View style={styles.itemTextContainer}>
                        <Text style={styles.itemName} numberOfLines={1}>
                            {item.decryptedName || 'Unknown Item'}
                        </Text>
                        <Text style={styles.itemType}>{getTypeLabel(item.type)}</Text>
                    </View>
                </View>
                <View style={styles.itemActions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleViewItem(item)}
                    >
                        <Text style={styles.actionButtonText}>👁️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteItem(item)}
                    >
                        <Text style={styles.actionButtonText}>🗑️</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const isLoading = securityLoading || vaultLoading || isLoadingItems;

    const {
        capabilities,
        isEnabled: biometricEnabled,
        isLoading: biometricLoading,
        enableBiometric,
        disableBiometric,
        getBiometricTypeName,
    } = useBiometric();

    const handleToggleBiometric = async () => {
        if (biometricEnabled) {
            Alert.alert(
                'Disable Biometric',
                `Turn off ${getBiometricTypeName()} unlock?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Disable',
                        style: 'destructive',
                        onPress: async () => {
                            await disableBiometric();
                            showToast('info', 'Biometric unlock disabled');
                        },
                    },
                ]
            );
        } else {
            if (!capabilities?.hasHardware) {
                showToast('error', 'Biometric hardware not available');
                return;
            }
            if (!capabilities?.isEnrolled) {
                showToast('error', 'No biometrics enrolled on device');
                return;
            }

            const success = await enableBiometric();
            if (success) {
                showToast('success', `${getBiometricTypeName()} unlock enabled`);
            } else {
                showToast('error', 'Failed to enable biometric unlock');
            }
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>My Vault</Text>
                    <Text style={styles.subtitle}>
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={handleLogout}
                    disabled={isLoading}
                >
                    <Text style={styles.settingsButtonText}>🔒</Text>
                </TouchableOpacity>
            </View>

            {capabilities?.hasHardware && capabilities?.isEnrolled && (
                <View style={styles.biometricSection}>
                    <TouchableOpacity
                        style={styles.biometricToggle}
                        onPress={handleToggleBiometric}
                        disabled={biometricLoading}
                    >
                        <View style={styles.biometricInfo}>
                            <Text style={styles.biometricIcon}>
                                {biometricEnabled ? '✓' : '○'}
                            </Text>
                            <View>
                                <Text style={styles.biometricLabel}>
                                    {getBiometricTypeName()} Unlock
                                </Text>
                                <Text style={styles.biometricSubtext}>
                                    {biometricEnabled ? 'Enabled' : 'Disabled'}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {items.length === 0 && !isLoadingItems ? (
                <ScrollView
                    style={styles.emptyContainer}
                    contentContainerStyle={styles.emptyContent}
                >
                    <Text style={styles.emptyIcon}>📭</Text>
                    <Text style={styles.emptyTitle}>No Items Yet</Text>
                    <Text style={styles.emptyText}>
                        Tap the + button to add your first vault item
                    </Text>
                </ScrollView>
            ) : (
                <FlatList
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshing={isLoadingItems}
                    onRefresh={loadItems}
                />
            )}

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={handleAddItem}
                disabled={isLoading}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            {/* Settings Menu (hidden, accessible via long press on FAB or header) */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.footerButton}
                    onPress={handleResetApp}
                    disabled={isLoading}
                >
                    <Text style={styles.footerButtonText}>Reset Vault</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F23',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#0F0F23',
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#A0A0B2',
    },
    settingsButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1A1A2E',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#2A2A3E',
    },
    settingsButtonText: {
        fontSize: 20,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 100,
    },
    itemCard: {
        backgroundColor: '#1A1A2E',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2A2A3E',
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    itemIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    itemTextContainer: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    itemType: {
        fontSize: 12,
        color: '#A0A0B2',
    },
    itemActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#2A2A3E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteButton: {
        backgroundColor: '#7F1D1D',
    },
    actionButtonText: {
        fontSize: 16,
    },
    emptyContainer: {
        flex: 1,
    },
    emptyContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 100,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#A0A0B2',
        textAlign: 'center',
    },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 100,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#8B5CF6',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    fabText: {
        fontSize: 32,
        color: '#FFFFFF',
        fontWeight: '300',
        lineHeight: 32,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        paddingBottom: 24,
        paddingTop: 12,
        backgroundColor: '#0F0F23',
        borderTopWidth: 1,
        borderTopColor: '#2A2A3E',
    },
    footerButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    footerButtonText: {
        fontSize: 14,
        color: '#EF4444',
        fontWeight: '600',
    },
    biometricSection: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#2A2A3E',
    },
    biometricToggle: {
        backgroundColor: '#1A1A2E',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2A2A3E',
    },
    biometricInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    biometricIcon: {
        fontSize: 24,
        marginRight: 12,
        color: '#8B5CF6',
    },
    biometricLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    biometricSubtext: {
        fontSize: 12,
        color: '#A0A0B2',
    },
});
