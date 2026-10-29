import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const Icon = ({ label, color }: { label: string; color: string }) => (
  <Text style={{ fontSize: 20, color }}>{label}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#34C759',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#0b1215',
          borderTopColor: '#243239',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Icon label="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Watch',
          tabBarIcon: ({ color }) => <Icon label="📖" color={color} />,
        }}
      />
      {/* The Chameleon Method's three pillars: 📖 read & watch · ✍️ write · 🗣️ speak */}
      <Tabs.Screen
        name="write"
        options={{
          title: 'Write',
          tabBarIcon: ({ color }) => <Icon label="✍️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="speak"
        options={{
          title: 'Speak',
          tabBarIcon: ({ color }) => <Icon label="🗣️" color={color} />,
        }}
      />
      <Tabs.Screen name="linguascripts" options={{ href: null }} />
      <Tabs.Screen
        name="flashcards"
        options={{
          title: 'Review',
          tabBarIcon: ({ color }) => <Icon label="🃏" color={color} />,
        }}
      />
      <Tabs.Screen name="vocabulary" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Icon label="🦎" color={color} />,
        }}
      />
    </Tabs>
  );
}
