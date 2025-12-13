/**
 * Index Screen - Entry redirect based on auth state
 * @module app/index
 */

import { Href, Redirect } from 'expo-router';
import { FallbackLoader } from '../src/components/FallbackLoader';
import { useSecurity } from '../src/security/SecurityContext';

export default function IndexScreen() {
    const { isInitialized, isLoggedIn, hasAccount, isLoading } = useSecurity();

    // Show loader while security is initializing
    if (!isInitialized || isLoading) {
        return <FallbackLoader message="Initializing..." />;
    }

    // Redirect based on auth state using Redirect component
    if (!hasAccount) {
        // No account set up yet - go to setup
        return <Redirect href={'/setup' as Href} />;
    }

    if (!isLoggedIn) {
        // Has account but not logged in - go to login
        return <Redirect href={'/login' as Href} />;
    }

    // Logged in - go to home
    return <Redirect href={'/home' as Href} />;
}
