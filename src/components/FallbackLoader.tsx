/**
 * Fallback Loader - Loading component during initialization
 * @module components/FallbackLoader
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface FallbackLoaderProps {
    message?: string;
}

/**
 * Full-screen loader component
 * Shows during security context initialization
 */
export function FallbackLoader({ message = 'Loading...' }: FallbackLoaderProps) {
    return (
        <View style={styles.container}>
            <View style={styles.loaderBox}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={styles.message}>{message}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F23',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderBox: {
        backgroundColor: '#1A1A2E',
        paddingVertical: 32,
        paddingHorizontal: 48,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    message: {
        marginTop: 16,
        fontSize: 16,
        color: '#A0A0B2',
        fontWeight: '500',
    },
});
