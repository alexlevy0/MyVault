/**
 * Toaster Context - Toast notification system
 * @module contexts/ToasterContext
 * 
 * Provides app-wide toast notifications with auto-dismiss.
 */

import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useState,
} from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

/**
 * Toast type for styling
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Toast item structure
 */
interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration: number;
}

/**
 * Toaster context value
 */
interface ToasterContextValue {
    /** Show a toast notification */
    showToast: (type: ToastType, message: string, duration?: number) => void;
    /** Dismiss a specific toast */
    dismissToast: (id: string) => void;
    /** Dismiss all toasts */
    dismissAllToasts: () => void;
}

// Create context
const ToasterContext = createContext<ToasterContextValue | undefined>(undefined);

/**
 * Generate unique ID for toasts
 */
function generateToastId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get background color based on toast type
 */
function getToastColor(type: ToastType): string {
    switch (type) {
        case 'success':
            return '#10B981'; // Green
        case 'error':
            return '#EF4444'; // Red
        case 'warning':
            return '#F59E0B'; // Amber
        case 'info':
        default:
            return '#3B82F6'; // Blue
    }
}

/**
 * Get icon based on toast type
 */
function getToastIcon(type: ToastType): string {
    switch (type) {
        case 'success':
            return '✓';
        case 'error':
            return '✕';
        case 'warning':
            return '⚠';
        case 'info':
        default:
            return 'ℹ';
    }
}

/**
 * Individual Toast Component
 */
function ToastItem({
    toast,
    onDismiss
}: {
    toast: Toast;
    onDismiss: (id: string) => void;
}) {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const translateY = React.useRef(new Animated.Value(-20)).current;

    React.useEffect(() => {
        // Animate in
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto dismiss
        const timeout = setTimeout(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: -20,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                onDismiss(toast.id);
            });
        }, toast.duration);

        return () => clearTimeout(timeout);
    }, [toast, fadeAnim, translateY, onDismiss]);

    return (
        <Animated.View
            style={[
                styles.toast,
                {
                    backgroundColor: getToastColor(toast.type),
                    opacity: fadeAnim,
                    transform: [{ translateY }],
                },
            ]}
        >
            <Text style={styles.toastIcon}>{getToastIcon(toast.type)}</Text>
            <Text style={styles.toastMessage} numberOfLines={2}>
                {toast.message}
            </Text>
            <TouchableOpacity onPress={() => onDismiss(toast.id)}>
                <Text style={styles.dismissButton}>✕</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

/**
 * Toaster Provider Component
 */
export function ToasterProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((
        type: ToastType,
        message: string,
        duration: number = 3000
    ) => {
        const newToast: Toast = {
            id: generateToastId(),
            type,
            message,
            duration,
        };
        setToasts(prev => [...prev, newToast]);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const dismissAllToasts = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToasterContext.Provider value={{ showToast, dismissToast, dismissAllToasts }}>
            {children}
            <View style={styles.container} pointerEvents="box-none">
                {toasts.map(toast => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onDismiss={dismissToast}
                    />
                ))}
            </View>
        </ToasterContext.Provider>
    );
}

/**
 * Hook to use toaster
 */
export function useToaster(): ToasterContextValue {
    const context = useContext(ToasterContext);
    if (!context) {
        throw new Error('useToaster must be used within a ToasterProvider');
    }
    return context;
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        zIndex: 9999,
        alignItems: 'center',
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
        maxWidth: '100%',
    },
    toastIcon: {
        fontSize: 16,
        color: '#FFFFFF',
        marginRight: 10,
        fontWeight: 'bold',
    },
    toastMessage: {
        flex: 1,
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    dismissButton: {
        fontSize: 14,
        color: '#FFFFFF',
        opacity: 0.8,
        marginLeft: 10,
        padding: 4,
    },
});
