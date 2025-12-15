/**
 * Login Screen - Secure unlock screen with brute-force protection
 * @module app/login
 */

import { Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useToaster } from '../src/contexts/ToasterContext';
import {
    BruteForceCheckResult,
    checkBruteForce,
    clearAttempts,
    recordFailedAttempt,
} from '../src/security/bruteForce';
import { useSecurity } from '../src/security/SecurityContext';
import { useBiometric } from '../src/security/useBiometric';

export default function LoginScreen() {
    const router = useRouter();
    const { loginAction, resetAppAction, isLoading, biometricLoginAction } = useSecurity();
    const { showToast } = useToaster();

    const { 
        isEnabled: biometricEnabled, 
        authenticate: authenticateBiometric,
        getBiometricTypeName 
    } = useBiometric();

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [bruteForceStatus, setBruteForceStatus] = useState<BruteForceCheckResult | null>(null);
    const [lockoutCountdown, setLockoutCountdown] = useState<number | null>(null);

    // Check brute-force status on mount and after attempts
    const refreshBruteForceStatus = useCallback(async () => {
        const status = await checkBruteForce();
        setBruteForceStatus(status);

        if (status.lockoutSecondsRemaining) {
            setLockoutCountdown(status.lockoutSecondsRemaining);
        } else {
            setLockoutCountdown(null);
        }
    }, []);

    useEffect(() => {
        refreshBruteForceStatus();
    }, [refreshBruteForceStatus]);

    // Countdown timer for lockout
    useEffect(() => {
        if (lockoutCountdown === null || lockoutCountdown <= 0) return;

        const timer = setInterval(() => {
            setLockoutCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(timer);
                    refreshBruteForceStatus();
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [lockoutCountdown, refreshBruteForceStatus]);

    useEffect(() => {
        if (biometricEnabled) {
            handleBiometricLogin();
        }
    }, [biometricEnabled]);

    const handleBiometricLogin = async () => {
        const biometricSuccess = await authenticateBiometric();
        if (biometricSuccess) {
            // ✨ Utilise la nouvelle action au lieu de router.replace direct
            const loginSuccess = await biometricLoginAction();
            if (loginSuccess) {
                showToast('success', 'Vault unlocked with biometrics');
                router.replace('/home' as Href);
            } else {
                showToast('error', 'Biometric unlock failed. Use password instead.');
            }
        }
    };

    const handleLogin = async () => {
        // Check brute-force protection first
        const bfCheck = await checkBruteForce();
        if (!bfCheck.allowed) {
            if (bfCheck.lockoutSecondsRemaining) {
                showToast('error', `Account locked. Try again in ${bfCheck.lockoutSecondsRemaining}s`);
                setLockoutCountdown(bfCheck.lockoutSecondsRemaining);
            } else if (bfCheck.requiredDelayMs > 0) {
                showToast('error', `Please wait ${Math.ceil(bfCheck.requiredDelayMs / 1000)}s before trying again`);
            }
            return;
        }

        if (!password.trim()) {
            showToast('error', 'Please enter your password');
            return;
        }

        const success = await loginAction(password);

        // Clear password immediately after use
        setPassword('');

        if (success) {
            // Clear failed attempts on success
            await clearAttempts();
            showToast('success', 'Vault unlocked!');
            router.replace('/home' as Href);
        } else {
            // Record failed attempt
            const result = await recordFailedAttempt();
            await refreshBruteForceStatus();

            if (result.isLockedOut) {
                showToast('error', `Too many attempts. Locked for ${result.lockoutSecondsRemaining}s`);
            } else {
                const remaining = 5 - result.attemptCount;
                if (remaining <= 2) {
                    showToast('error', `Invalid password. ${remaining} attempts remaining`);
                } else {
                    showToast('error', 'Invalid password. Please try again.');
                }
            }
        }
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
                        await clearAttempts();
                        await resetAppAction();
                        showToast('info', 'Vault has been reset');
                        router.replace('/setup' as Href);
                    },
                },
            ]
        );
    };

    const isLocked = lockoutCountdown !== null && lockoutCountdown > 0;
    const remainingAttempts = bruteForceStatus?.remainingAttempts ?? 5;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.icon}>{isLocked ? '🔐' : biometricEnabled ? '👆' : '🔒'}</Text>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>
                        {biometricEnabled 
                            ? `Use ${getBiometricTypeName()} to unlock your vault`
                            : 'Enter your master password to unlock your vault'
                        }
                    </Text>
                </View>

                {biometricEnabled && !isLocked && (
                    <TouchableOpacity
                        style={styles.biometricButton}
                        onPress={handleBiometricLogin}
                        disabled={isLoading}
                    >
                        <Text style={styles.biometricIcon}>👆</Text>
                        <Text style={styles.biometricText}>
                            Unlock with {getBiometricTypeName()}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Lockout Warning */}
                {isLocked && (
                    <View style={styles.lockoutBox}>
                        <Text style={styles.lockoutIcon}>⏱️</Text>
                        <Text style={styles.lockoutText}>
                            Account temporarily locked.{'\n'}
                            Try again in {lockoutCountdown}s
                        </Text>
                    </View>
                )}

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Master Password</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={[styles.input, isLocked && styles.inputDisabled]}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Enter your password"
                                placeholderTextColor="#6B6B80"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading && !isLocked}
                                returnKeyType="go"
                                onSubmitEditing={handleLogin}
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Attempts warning */}
                    {remainingAttempts <= 2 && remainingAttempts > 0 && !isLocked && (
                        <View style={styles.warningBox}>
                            <Text style={styles.warningIcon}>⚠️</Text>
                            <Text style={styles.warningText}>
                                {remainingAttempts} {remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining before lockout
                            </Text>
                        </View>
                    )}

                    {/* Unlock Button */}
                    <TouchableOpacity
                        style={[
                            styles.button,
                            (isLoading || isLocked) && styles.buttonDisabled
                        ]}
                        onPress={handleLogin}
                        disabled={isLoading || isLocked}
                    >
                        <Text style={styles.buttonText}>
                            {isLoading ? 'Unlocking...' : isLocked ? `Locked (${lockoutCountdown}s)` : 'Unlock Vault'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.resetButton}
                        onPress={handleResetApp}
                        disabled={isLoading}
                    >
                        <Text style={styles.resetButtonText}>
                            Forgot password? Reset Vault
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Security Badge */}
                <View style={styles.securityBadge}>
                    <Text style={styles.securityIcon}>🛡️</Text>
                    <Text style={styles.securityText}>
                        PBKDF2 (150k iterations) • Brute-force protection
                    </Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    biometricButton: {
        backgroundColor: '#8B5CF6',
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 24,
        marginBottom: 24,
        alignItems: 'center',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    biometricIcon: {
        fontSize: 48,
        marginBottom: 8,
    },
    biometricText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    container: {
        flex: 1,
        backgroundColor: '#0F0F23',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    icon: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#A0A0B2',
        textAlign: 'center',
    },
    lockoutBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7F1D1D',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    lockoutIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    lockoutText: {
        flex: 1,
        fontSize: 14,
        color: '#FCA5A5',
        lineHeight: 20,
    },
    form: {
        marginBottom: 32,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#1A1A2E',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 16,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#2A2A3E',
    },
    inputDisabled: {
        opacity: 0.5,
        backgroundColor: '#151525',
    },
    eyeButton: {
        position: 'absolute',
        right: 16,
        padding: 4,
    },
    eyeIcon: {
        fontSize: 20,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#422006',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#854D0E',
    },
    warningIcon: {
        fontSize: 18,
        marginRight: 10,
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        color: '#FCD34D',
    },
    button: {
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
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    footer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    resetButton: {
        padding: 12,
    },
    resetButtonText: {
        fontSize: 14,
        color: '#EF4444',
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1A1A2E',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignSelf: 'center',
    },
    securityIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    securityText: {
        fontSize: 12,
        color: '#6B6B80',
    },
});
