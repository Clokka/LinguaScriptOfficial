import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';

// Google sign-in returns to linguascript://auth-callback. app/index.tsx reads
// that URL itself (openAuthSessionAsync, or Linking.getInitialURL after a cold
// start), but expo-router also opens it as a route, which showed
// "Unmatched Route". This screen just steps back to the site.
export default function AuthCallback() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  return (
    <View style={styles.loading}>
      <ActivityIndicator color="#22c55e" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0b1215', alignItems: 'center', justifyContent: 'center' },
});
