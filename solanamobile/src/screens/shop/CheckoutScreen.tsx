import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = { Checkout: { invoiceId: string } };
type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

export function CheckoutScreen({ route }: Props) {
  const { invoiceId } = route.params;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checkout</Text>
      <Text style={styles.subtitle}>Invoice: {invoiceId}</Text>
      <Text style={styles.placeholder}>Solana Pay flow will be wired here (no design yet).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 8 },
  placeholder: { marginTop: 24, color: '#999' },
});
