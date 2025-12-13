/**
 * Lifecycle Hook - Auto-lock and app state management
 * @module security/lifecycle
 * 
 * Handles automatic locking when app goes to background or after inactivity.
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSecurity } from './SecurityContext';

/**
 * Configuration for auto-lock behavior
 */
export interface LifecycleConfig {
    /** Lock when app goes to background */
    lockOnBackground: boolean;
    /** Inactivity timeout in milliseconds (0 = disabled) */
    inactivityTimeout: number;
    /** Grace period before locking on background (ms) */
    backgroundGracePeriod: number;
}

/**
 * Default lifecycle configuration
 */
export const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
    lockOnBackground: true,
    inactivityTimeout: 5 * 60 * 1000, // 5 minutes
    backgroundGracePeriod: 5000, // 5 seconds grace period
};

/**
 * Hook for managing app lifecycle and auto-lock
 * @param config - Optional configuration overrides
 */
export function useAppLifecycle(config: Partial<LifecycleConfig> = {}) {
    const { isLoggedIn, lockAction } = useSecurity();
    const mergedConfig = { ...DEFAULT_LIFECYCLE_CONFIG, ...config };

    // Track when app went to background
    const backgroundTimeRef = useRef<number | null>(null);
    // Track last activity time for inactivity timeout
    const lastActivityRef = useRef<number>(Date.now());
    // Inactivity timer reference
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Reset the inactivity timer
     */
    const resetInactivityTimer = useCallback(() => {
        lastActivityRef.current = Date.now();

        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }

        if (mergedConfig.inactivityTimeout > 0 && isLoggedIn) {
            inactivityTimerRef.current = setTimeout(() => {
                console.log('[Lifecycle] Inactivity timeout - locking app');
                lockAction();
            }, mergedConfig.inactivityTimeout);
        }
    }, [isLoggedIn, lockAction, mergedConfig.inactivityTimeout]);

    /**
     * Handle app state changes (background/foreground)
     */
    const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
        if (!isLoggedIn) {
            return;
        }

        if (nextAppState === 'background' || nextAppState === 'inactive') {
            // App going to background
            backgroundTimeRef.current = Date.now();
            console.log('[Lifecycle] App going to background');
        } else if (nextAppState === 'active') {
            // App coming back to foreground
            const backgroundTime = backgroundTimeRef.current;

            if (backgroundTime && mergedConfig.lockOnBackground) {
                const timeInBackground = Date.now() - backgroundTime;

                if (timeInBackground > mergedConfig.backgroundGracePeriod) {
                    console.log(`[Lifecycle] Locking after ${timeInBackground}ms in background`);
                    lockAction();
                } else {
                    console.log('[Lifecycle] Within grace period, not locking');
                }
            }

            backgroundTimeRef.current = null;
            resetInactivityTimer();
        }
    }, [isLoggedIn, lockAction, mergedConfig, resetInactivityTimer]);

    // Set up app state listener
    useEffect(() => {
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [handleAppStateChange]);

    // Set up inactivity timer when logged in
    useEffect(() => {
        if (isLoggedIn) {
            resetInactivityTimer();
        } else {
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
                inactivityTimerRef.current = null;
            }
        }

        return () => {
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
            }
        };
    }, [isLoggedIn, resetInactivityTimer]);

    /**
     * Call this on user activity to reset the inactivity timer
     */
    const recordActivity = useCallback(() => {
        resetInactivityTimer();
    }, [resetInactivityTimer]);

    return {
        /** Call this to record user activity and reset inactivity timer */
        recordActivity,
        /** Current inactivity timeout setting */
        inactivityTimeout: mergedConfig.inactivityTimeout,
        /** Whether lock on background is enabled */
        lockOnBackground: mergedConfig.lockOnBackground,
    };
}

/**
 * Higher-order component wrapper for lifecycle management
 * Can be used to wrap the entire app
 */
export function LifecycleManager({
    children,
    config
}: {
    children: React.ReactNode;
    config?: Partial<LifecycleConfig>;
}) {
    useAppLifecycle(config);
    return <>{children}</>;
}
