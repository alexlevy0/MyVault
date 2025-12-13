/**
 * Setup Screen - Initial password creation with strong validation
 * @module app/setup
 */

import { Href, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useToaster } from '../src/contexts/ToasterContext';
import { useSecurity } from '../src/security/SecurityContext';

// NIST recommendation: minimum 12 characters for high-security applications
const MIN_PASSWORD_LENGTH = 12;

// Common passwords to reject (top 100 most common)
const COMMON_PASSWORDS = new Set([
    'password', 'password1', 'password123', '123456', '12345678', '123456789',
    'qwerty', 'abc123', 'monkey', 'master', 'dragon', 'letmein', 'login',
    'admin', 'welcome', 'password1!', 'iloveyou', 'princess', 'sunshine',
    'passw0rd', 'shadow', 'qwerty123', 'password!', '1234567890', 'trustno1',
]);

/**
 * Password strength levels
 */
type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

/**
 * Calculate password strength
 */
function calculatePasswordStrength(password: string): {
    strength: PasswordStrength;
    score: number;
    feedback: string[];
} {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= MIN_PASSWORD_LENGTH) {
        score += 2;
    } else if (password.length >= 8) {
        score += 1;
        feedback.push(`Use at least ${MIN_PASSWORD_LENGTH} characters`);
    } else {
        feedback.push(`Use at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    // Extra points for longer passwords
    if (password.length >= 16) score += 1;
    if (password.length >= 20) score += 1;

    // Character variety checks
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (hasLowercase) score += 1;
    if (hasUppercase) score += 1;
    if (hasNumbers) score += 1;
    if (hasSymbols) score += 1;

    // Variety feedback
    const missingTypes: string[] = [];
    if (!hasLowercase) missingTypes.push('lowercase');
    if (!hasUppercase) missingTypes.push('uppercase');
    if (!hasNumbers) missingTypes.push('numbers');
    if (!hasSymbols) missingTypes.push('symbols');

    if (missingTypes.length > 0 && missingTypes.length <= 2) {
        feedback.push(`Add ${missingTypes.join(' and ')}`);
    }

    // Penalize common patterns
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowerPassword)) {
        score = Math.max(0, score - 4);
        feedback.push('Avoid common passwords');
    }

    // Penalize sequential or repeated characters
    if (/(.)\1{2,}/.test(password)) {
        score = Math.max(0, score - 1);
        feedback.push('Avoid repeated characters');
    }
    if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
        score = Math.max(0, score - 1);
        feedback.push('Avoid sequential characters');
    }

    // Determine strength level
    let strength: PasswordStrength;
    if (score >= 7) {
        strength = 'strong';
    } else if (score >= 5) {
        strength = 'good';
    } else if (score >= 3) {
        strength = 'fair';
    } else {
        strength = 'weak';
    }

    return { strength, score, feedback };
}

/**
 * Get color for password strength
 */
function getStrengthColor(strength: PasswordStrength): string {
    switch (strength) {
        case 'weak': return '#EF4444';
        case 'fair': return '#F59E0B';
        case 'good': return '#10B981';
        case 'strong': return '#22C55E';
    }
}

export default function SetupScreen() {
    const router = useRouter();
    const { setupAction, isLoading } = useSecurity();
    const { showToast } = useToaster();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Calculate password strength
    const passwordAnalysis = useMemo(() => {
        if (!password) return null;
        return calculatePasswordStrength(password);
    }, [password]);

    const validatePassword = (): boolean => {
        // Check minimum length
        if (password.length < MIN_PASSWORD_LENGTH) {
            showToast('error', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
            return false;
        }

        // Check against common passwords
        if (COMMON_PASSWORDS.has(password.toLowerCase())) {
            showToast('error', 'This password is too common. Please choose a stronger one.');
            return false;
        }

        // Check password strength
        if (passwordAnalysis && (passwordAnalysis.strength === 'weak')) {
            showToast('error', 'Password is too weak. Please add more variety.');
            return false;
        }

        // Check confirmation
        if (password !== confirmPassword) {
            showToast('error', 'Passwords do not match');
            return false;
        }

        return true;
    };

    const handleSetup = async () => {
        if (!validatePassword()) {
            return;
        }

        const success = await setupAction(password);

        // Clear password from state immediately
        setPassword('');
        setConfirmPassword('');

        if (success) {
            showToast('success', 'Password created successfully!');
            router.replace('/home' as Href);
        } else {
            showToast('error', 'Failed to create password. Please try again.');
        }
    };

    const passwordsMatch = password === confirmPassword && password.length > 0;
    const meetsLength = password.length >= MIN_PASSWORD_LENGTH;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.icon}>🔐</Text>
                    <Text style={styles.title}>Create Your Vault</Text>
                    <Text style={styles.subtitle}>
                        Set a strong master password to secure your vault.
                        This password will be used to encrypt all your data.
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {/* Password Field */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Master Password</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Enter master password"
                                placeholderTextColor="#6B6B80"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Password Strength Indicator */}
                        {password.length > 0 && passwordAnalysis && (
                            <View style={styles.strengthContainer}>
                                <View style={styles.strengthBar}>
                                    <View
                                        style={[
                                            styles.strengthFill,
                                            {
                                                width: `${Math.min(100, (passwordAnalysis.score / 8) * 100)}%`,
                                                backgroundColor: getStrengthColor(passwordAnalysis.strength),
                                            }
                                        ]}
                                    />
                                </View>
                                <Text style={[
                                    styles.strengthText,
                                    { color: getStrengthColor(passwordAnalysis.strength) }
                                ]}>
                                    {passwordAnalysis.strength.charAt(0).toUpperCase() + passwordAnalysis.strength.slice(1)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Confirm Password Field */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Confirm Password</Text>
                        <TextInput
                            style={styles.input}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm master password"
                            placeholderTextColor="#6B6B80"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Password Requirements */}
                    <View style={styles.requirements}>
                        <Text style={styles.requirementsTitle}>Requirements:</Text>
                        <View style={styles.requirementItem}>
                            <Text style={[
                                styles.requirementCheck,
                                meetsLength && styles.requirementMet
                            ]}>
                                {meetsLength ? '✓' : '○'}
                            </Text>
                            <Text style={styles.requirementText}>
                                At least {MIN_PASSWORD_LENGTH} characters
                            </Text>
                        </View>
                        <View style={styles.requirementItem}>
                            <Text style={[
                                styles.requirementCheck,
                                passwordsMatch && styles.requirementMet
                            ]}>
                                {passwordsMatch ? '✓' : '○'}
                            </Text>
                            <Text style={styles.requirementText}>
                                Passwords match
                            </Text>
                        </View>
                        <View style={styles.requirementItem}>
                            <Text style={[
                                styles.requirementCheck,
                                passwordAnalysis && passwordAnalysis.strength !== 'weak' && styles.requirementMet
                            ]}>
                                {passwordAnalysis && passwordAnalysis.strength !== 'weak' ? '✓' : '○'}
                            </Text>
                            <Text style={styles.requirementText}>
                                Not a common password
                            </Text>
                        </View>
                    </View>

                    {/* Strength Feedback */}
                    {passwordAnalysis && passwordAnalysis.feedback.length > 0 && (
                        <View style={styles.feedbackBox}>
                            <Text style={styles.feedbackTitle}>💡 Tips:</Text>
                            {passwordAnalysis.feedback.slice(0, 2).map((tip, index) => (
                                <Text key={index} style={styles.feedbackText}>• {tip}</Text>
                            ))}
                        </View>
                    )}

                    {/* Create Button */}
                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleSetup}
                        disabled={isLoading}
                    >
                        <Text style={styles.buttonText}>
                            {isLoading ? 'Creating...' : 'Create Vault'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Security Info */}
                <View style={styles.securityInfo}>
                    <Text style={styles.securityIcon}>🛡️</Text>
                    <Text style={styles.securityText}>
                        Your password is processed with PBKDF2 (150,000 HMAC-SHA256 iterations)
                        and never leaves your device.
                    </Text>
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
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 40,
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
        lineHeight: 24,
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
    eyeButton: {
        position: 'absolute',
        right: 16,
        padding: 4,
    },
    eyeIcon: {
        fontSize: 20,
    },
    strengthContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    strengthBar: {
        flex: 1,
        height: 4,
        backgroundColor: '#2A2A3E',
        borderRadius: 2,
        marginRight: 12,
        overflow: 'hidden',
    },
    strengthFill: {
        height: '100%',
        borderRadius: 2,
    },
    strengthText: {
        fontSize: 12,
        fontWeight: '600',
        width: 50,
    },
    requirements: {
        backgroundColor: '#1A1A2E',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    requirementsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    requirementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    requirementCheck: {
        fontSize: 14,
        color: '#6B6B80',
        marginRight: 10,
        width: 20,
    },
    requirementMet: {
        color: '#10B981',
    },
    requirementText: {
        fontSize: 14,
        color: '#A0A0B2',
    },
    feedbackBox: {
        backgroundColor: '#1E3A5F',
        borderRadius: 12,
        padding: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    feedbackTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#93C5FD',
        marginBottom: 6,
    },
    feedbackText: {
        fontSize: 13,
        color: '#BFDBFE',
        marginBottom: 2,
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
    securityInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A2E',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2A2A3E',
    },
    securityIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    securityText: {
        flex: 1,
        fontSize: 12,
        color: '#6B6B80',
        lineHeight: 18,
    },
});
