import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../providers/AuthProvider';
import type { MainTabParamList } from '../../navigation/types';
import type { RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function DashboardScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>
        {user && typeof user === 'object' && 'name' in user
          ? String((user as { name?: string }).name ?? 'User')
          : 'User'}
      </Text>
      <TouchableOpacity
        style={styles.link}
        onPress={() => (navigation.getParent() as unknown as { navigate: (name: 'SupportChat', params?: object) => void })?.navigate('SupportChat', {})}
      >
        <Text style={styles.linkText}>Support Chat</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.link} onPress={() => signOut()}>
        <Text style={styles.linkText}>Sign out</Text>
      </TouchableOpacity>
      <Text style={styles.placeholder}>Orders, profile, affiliate to be added (no design yet).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 8 },
  link: { marginTop: 16 },
  linkText: { fontSize: 16, color: '#0066cc' },
  placeholder: { marginTop: 24, color: '#999' },
});
