import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';

// The home-screen widget and the gold-word card open linguascript://open/<page>
// (e.g. open/flashcards?deck=red). app/index.tsx turns that link into the site
// page (siteUrlFromLink), but expo-router also opens it as a route, which showed
// "Unmatched Route". Like auth-callback, this screen just steps back to the site.
export default function OpenPage() {
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
