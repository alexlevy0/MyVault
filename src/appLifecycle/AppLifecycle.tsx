/**
 * App Lifecycle Manager - Global lifecycle management component
 * @module app/AppLifecycle
 */

import React from 'react';
import { LifecycleConfig, LifecycleManager } from '../security/lifecycle';

interface AppLifecycleProps {
    children: React.ReactNode;
    config?: Partial<LifecycleConfig>;
}

/**
 * App Lifecycle wrapper component
 * Provides auto-lock functionality for the entire app
 */
export function AppLifecycle({ children, config }: AppLifecycleProps) {
    return (
        <LifecycleManager config={config}>
            {children}
        </LifecycleManager>
    );
}

/**
 * Default export for easy importing
 */
export default AppLifecycle;
