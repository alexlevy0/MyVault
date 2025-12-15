import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet } from 'react-native';

interface PrivacyScreenProps {
    visible: boolean;
}

/**
 * Privacy overlay with blur effect when app is in multitasking view
 * Prevents sensitive content from being visible in app switcher
 */
export function PrivacyScreen({ visible }: PrivacyScreenProps) {
    if (!visible) return null;

    return (
        <BlurView 
            intensity={100} 
            style={[StyleSheet.absoluteFillObject, { zIndex: 9999 }]}
            tint="dark"
            pointerEvents="none"
        />
    );
}