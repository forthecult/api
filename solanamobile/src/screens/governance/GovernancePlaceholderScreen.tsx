import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function GovernancePlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Governance</Text>
      <Text style={styles.subtitle}>Membership, proposals, and voting.</Text>
      <Text style={styles.placeholder}>Staking UI and design deferred; will be implemented for hackathon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 8 },
  placeholder: { marginTop: 24, color: '#999', textAlign: 'center' },
});
