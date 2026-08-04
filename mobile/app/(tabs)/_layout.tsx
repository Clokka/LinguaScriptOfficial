import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const Icon = ({ label, color }: { label: string; color: string }) => (
  <Text style={{ fontSize: 22, color }}>{label}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#0b1215',
          borderTopColor: '#243239',
          borderTopWidth: 1,
        },
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
        name="flashcards"
        options={{
          title: 'Review',
          tabBarIcon: ({ color }) => <Icon label="🃏" color={color} />,
        }}
      />
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: 'Vocab',
          tabBarIcon: ({ color }) => <Icon label="📚" color={color} />,
        }}
      />
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
