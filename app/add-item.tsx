/**
 * Add Item Screen - Modal for creating new vault items
 * @module app/add-item
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useToaster } from '../src/contexts/ToasterContext';
import { useVaultItem } from '../src/security/useVaultItem';
import { VaultItemType } from '../src/vault/vault.types';

export default function AddItemScreen() {
    const router = useRouter();
    const { createItem, isLoading, error, clearError } = useVaultItem();
    const { showToast } = useToaster();

    const [name, setName] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<VaultItemType>('password');
    const [showContent, setShowContent] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) {
            showToast('error', 'Item name is required');
            return;
        }

        if (!content.trim()) {
            showToast('error', 'Item content is required');
            return;
        }

        clearError();
        const item = await createItem(name.trim(), content.trim(), type);

        if (item) {
            showToast('success', 'Item created successfully');
            router.back();
        } else if (error) {
            showToast('error', error);
        }
    };

    const handleCancel = () => {
        router.back();
    };

    const itemTypes: { value: VaultItemType; label: string; icon: string }[] = [
        { value: 'password', label: 'Password', icon: '🔑' },
        { value: 'note', label: 'Note', icon: '📝' },
        { value: 'card', label: 'Card', icon: '💳' },
        { value: 'identity', label: 'Identity', icon: '🆔' },
        { value: 'other', label: 'Other', icon: '📦' },
    ];

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Add New Item</Text>
                    <Text style={styles.subtitle}>
                        Create a new encrypted vault item
                    </Text>
                </View>

                {/* Type Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>Item Type</Text>
                    <View style={styles.typeGrid}>
                        {itemTypes.map((itemType) => (
                            <TouchableOpacity
                                key={itemType.value}
                                style={[
                                    styles.typeButton,
                                    type === itemType.value && styles.typeButtonActive,
                                ]}
                                onPress={() => setType(itemType.value)}
                            >
                                <Text style={styles.typeIcon}>{itemType.icon}</Text>
                                <Text
                                    style={[
                                        styles.typeLabel,
                                        type === itemType.value && styles.typeLabelActive,
                                    ]}
                                >
                                    {itemType.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Name Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>Name *</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter item name"
                        placeholderTextColor="#6B6B80"
                        autoCapitalize="words"
                        autoCorrect={false}
                    />
                </View>

                {/* Content Input */}
                <View style={styles.section}>
                    <View style={styles.contentHeader}>
                        <Text style={styles.label}>Content *</Text>
                        <TouchableOpacity
                            onPress={() => setShowContent(!showContent)}
                            style={styles.eyeButton}
                        >
                            <Text style={styles.eyeIcon}>
                                {showContent ? '👁️' : '👁️‍🗨️'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={[styles.input, styles.contentInput]}
                        value={content}
                        onChangeText={setContent}
                        placeholder={
                            type === 'password'
                                ? 'Enter password'
                                : type === 'note'
                                ? 'Enter note content'
                                : type === 'card'
                                ? 'Enter card details'
                                : 'Enter content'
                        }
                        placeholderTextColor="#6B6B80"
                        secureTextEntry={!showContent && type === 'password'}
                        multiline
                        numberOfLines={type === 'note' ? 6 : 3}
                        textAlignVertical="top"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                {/* Error Display */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancel}
                        disabled={isLoading}
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={isLoading || !name.trim() || !content.trim()}
                    >
                        <Text style={styles.saveButtonText}>
                            {isLoading ? 'Saving...' : 'Save Item'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F23',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#A0A0B2',
        textAlign: 'center',
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -6,
    },
    typeButton: {
        width: '30%',
        aspectRatio: 1,
        backgroundColor: '#1A1A2E',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 6,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    typeButtonActive: {
        borderColor: '#8B5CF6',
        backgroundColor: '#2A1A3E',
    },
    typeIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    typeLabel: {
        fontSize: 12,
        color: '#A0A0B2',
        fontWeight: '500',
    },
    typeLabelActive: {
        color: '#8B5CF6',
        fontWeight: '600',
    },
    input: {
        backgroundColor: '#1A1A2E',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 16,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#2A2A3E',
    },
    contentInput: {
        minHeight: 100,
        paddingTop: 16,
    },
    contentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    eyeButton: {
        padding: 4,
    },
    eyeIcon: {
        fontSize: 20,
    },
    errorContainer: {
        backgroundColor: '#7F1D1D',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    errorText: {
        fontSize: 14,
        color: '#FCA5A5',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#1A1A2E',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2A2A3E',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#A0A0B2',
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
