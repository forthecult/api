import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../../providers/AuthProvider';

export function ConnectWalletScreen() {
  const { signInWithSolana } = useAuth();
  const [loading, setLoading] = useState(false);

  const onConnect = async () => {
    setLoading(true);
    try {
      await signInWithSolana();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect your Solana wallet</Text>
      <Text style={styles.subtitle}>Phantom, Solflare, or any MWA-compatible wallet on this device</Text>
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={onConnect}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Connect & Sign in</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24, textAlign: 'center' },
  button: { backgroundColor: '#000', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
