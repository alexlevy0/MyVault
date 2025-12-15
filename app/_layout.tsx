/**
 * Root Layout - App entry point with providers
 * @module app/_layout
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { PrivacyScreen } from '@/src/security/PrivacyScreen';
import { useAppLifecycle } from '@/src/security/lifecycle';
import { FallbackLoader } from '../src/components/FallbackLoader';
import { ToasterProvider } from '../src/contexts/ToasterContext';
import { SecurityProvider } from '../src/security/SecurityContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure proper initial route handling
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return <FallbackLoader message="Loading fonts..." />;
  }

  return (
    <SecurityProvider>
      <ToasterProvider>
        <RootLayoutNav />
      </ToasterProvider>
    </SecurityProvider>
  );
}

function RootLayoutNav() {
  const { showPrivacyScreen, recordActivity } = useAppLifecycle({
    inactivityTimeout: 15000,
  });
  return (
    <>
      <StatusBar style="light" />
      <View style={{ flex: 1 }} onTouchStart={recordActivity}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#0F0F23',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: '600',
            },
            contentStyle: {
              backgroundColor: '#0F0F23',
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="setup"
            options={{
              title: 'Create Password',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="login"
            options={{
              title: 'Unlock Vault',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="home"
            options={{
              title: 'My Vault',
              headerShown: false,
              gestureEnabled: false, // Prevent swipe back
            }}
          />
          <Stack.Screen
            name="add-item"
            options={{
              title: 'Add Item',
            }}
          />
        </Stack>
      </View>
      <PrivacyScreen visible={showPrivacyScreen} />
    </>
  );
}
