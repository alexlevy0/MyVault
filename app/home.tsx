/**
 * Home Screen - Protected main screen after authentication
 * @module app/home
 */

import { Href, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useToaster } from '../src/contexts/ToasterContext';
import { DEFAULT_PBKDF2_CONFIG } from '../src/security/security.types';
import { useSecurity } from '../src/security/SecurityContext';

export default function HomeScreen() {
    const router = useRouter();
    const { logoutAction, resetAppAction, isLoading, isLoggedIn } = useSecurity();
    const { showToast } = useToaster();

    // Watch for logout/lock events and redirect to login
    useEffect(() => {
        if (!isLoggedIn) {
            router.replace('/login' as Href);
        }
    }, [isLoggedIn, router]);

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

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.icon}>✅</Text>
                <Text style={styles.title}>Vault Unlocked</Text>
                <Text style={styles.subtitle}>
                    Your secure vault is ready to use
                </Text>
            </View>

            {/* Access Granted Card */}
            <View style={styles.successCard}>
                <View style={styles.successHeader}>
                    <Text style={styles.successIcon}>🔓</Text>
                    <Text style={styles.successTitle}>Access Granted</Text>
                </View>
                <Text style={styles.successText}>
                    You have successfully authenticated using your master password.
                    Your encryption key is now available in memory for secure operations.
                </Text>
            </View>

            {/* Technical Details */}
            <View style={styles.technicalSection}>
                <Text style={styles.sectionTitle}>Security Details</Text>

                <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Key Derivation</Text>
                        <Text style={styles.detailValue}>PBKDF2</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Hash Algorithm</Text>
                        <Text style={styles.detailValue}>{DEFAULT_PBKDF2_CONFIG.algorithm}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Iterations</Text>
                        <Text style={styles.detailValue}>
                            {DEFAULT_PBKDF2_CONFIG.iterations.toLocaleString()}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Salt Length</Text>
                        <Text style={styles.detailValue}>
                            {DEFAULT_PBKDF2_CONFIG.saltLength} bytes
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Key Length</Text>
                        <Text style={styles.detailValue}>
                            {DEFAULT_PBKDF2_CONFIG.keyLength} bytes (256-bit)
                        </Text>
                    </View>
                    <View style={[styles.detailRow, styles.lastRow]}>
                        <Text style={styles.detailLabel}>Comparison</Text>
                        <Text style={styles.detailValue}>Timing-Safe ✓</Text>
                    </View>
                </View>
            </View>

            {/* Security Features */}
            <View style={styles.featureSection}>
                <Text style={styles.sectionTitle}>Security Features</Text>

                <View style={styles.featureGrid}>
                    <View style={styles.featureItem}>
                        <Text style={styles.featureIcon}>⏱️</Text>
                        <Text style={styles.featureText}>Auto-lock on background</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Text style={styles.featureIcon}>💾</Text>
                        <Text style={styles.featureText}>Keys in memory only</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Text style={styles.featureIcon}>🔐</Text>
                        <Text style={styles.featureText}>Keychain protected</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Text style={styles.featureIcon}>🚫</Text>
                        <Text style={styles.featureText}>No cloud storage</Text>
                    </View>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    disabled={isLoading}
                >
                    <Text style={styles.logoutButtonText}>🔒 Lock Vault</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.resetButton}
                    onPress={handleResetApp}
                    disabled={isLoading}
                >
                    <Text style={styles.resetButtonText}>⚠️ Reset Vault</Text>
                </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    MyVault v1.0.0 • Production Ready
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F23',
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    icon: {
        fontSize: 64,
        marginBottom: 16,
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
    successCard: {
        backgroundColor: '#064E3B',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    successHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    successIcon: {
        fontSize: 24,
        marginRight: 10,
    },
    successTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#10B981',
    },
    successText: {
        fontSize: 14,
        color: '#A7F3D0',
        lineHeight: 22,
    },
    technicalSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    detailCard: {
        backgroundColor: '#1A1A2E',
        borderRadius: 16,
        overflow: 'hidden',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A3E',
    },
    lastRow: {
        borderBottomWidth: 0,
    },
    detailLabel: {
        fontSize: 14,
        color: '#A0A0B2',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    featureSection: {
        marginBottom: 32,
    },
    featureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -6,
    },
    featureItem: {
        width: '50%',
        paddingHorizontal: 6,
        marginBottom: 12,
    },
    featureIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    featureText: {
        fontSize: 13,
        color: '#A0A0B2',
    },
    actions: {
        marginBottom: 32,
    },
    logoutButton: {
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    logoutButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    resetButton: {
        backgroundColor: '#1A1A2E',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    resetButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#EF4444',
    },
    footer: {
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#6B6B80',
    },
});
