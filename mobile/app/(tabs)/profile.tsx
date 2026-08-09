import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Profile {
  display_name: string | null;
  native_language: string | null;
  learning_language: string | null;
}

interface Stats {
  greenWords: number;
  totalWords: number;
  streak: number;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ greenWords: 0, totalWords: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, wordsRes, activityRes] = await Promise.all([
        supabase.from('profiles').select('display_name, native_language, learning_language').eq('user_id', user.id).single(),
        supabase.from('saved_words').select('id, state', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('activity_log').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(365),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      const wordData = wordsRes.data ?? [];
      const greenCount = wordData.filter((w: any) => w.state === 'green').length;

      let streak = 0;
      const today = new Date();
      const dates = new Set((activityRes.data ?? []).map((d: any) => d.date));
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        if (dates.has(key)) streak++;
        else if (i > 0) break;
      }

      setStats({ greenWords: greenCount, totalWords: wordData.length, streak });
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="person-circle-outline" size={64} color="#6b7280" />
          <Text style={styles.emptyTitle}>Sign in to see your profile</Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.replace('/auth')}>
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      </SafeAreaView>
    );
  }

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Learner';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.greenWords}</Text>
            <Text style={styles.statLabel}>Green words</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalWords}</Text>
            <Text style={styles.statLabel}>Total words</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
        </View>

        {/* Language info */}
        {(profile?.native_language || profile?.learning_language) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
            <View style={styles.card}>
              {profile?.native_language && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Native</Text>
                  <Text style={styles.infoValue}>{profile.native_language.toUpperCase()}</Text>
                </View>
              )}
              {profile?.learning_language && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Learning</Text>
                  <Text style={styles.infoValue}>{profile.learning_language.toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.dangerBtnText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  avatarSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#14532d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#22c55e',
  },
  avatarInitial: { fontSize: 34, fontWeight: '700', color: '#22c55e' },
  displayName: { fontSize: 22, fontWeight: '700', color: '#f0fdf4' },
  email: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  statValue: { fontSize: 24, fontWeight: '700', color: '#22c55e' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  infoLabel: { fontSize: 14, color: '#9ca3af' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#f0fdf4' },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  dangerBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f0fdf4', textAlign: 'center' },
  signInBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  signInBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
