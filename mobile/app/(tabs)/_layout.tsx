import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth');
      return;
    }
    if (!loading && user) {
      // Check onboarding completion so users who bypass auth.tsx still land
      // on onboarding if they haven't finished it.
      supabase
        .from('profiles')
        .select('onboarded')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data?.onboarded) {
            router.replace('/onboarding');
          } else {
            setOnboardingChecked(true);
          }
        })
        .catch(() => setOnboardingChecked(true)); // on error, allow into tabs
    }
  }, [user, loading]);

  // While auth is initializing, show a centered spinner — the splash screen
  // has already been dismissed so we need something visible.  This spinner
  // resolves in at most 5 seconds (see AuthContext timeout).
  if (loading || (user && !onboardingChecked)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#0f1117',
          borderTopColor: '#1f2937',
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="albums" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vocab"
        options={{
          title: 'Vocab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
