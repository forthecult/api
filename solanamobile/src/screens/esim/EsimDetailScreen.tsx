import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getEsimPackageById, type EsimPackage } from '../../api/esim';

type RootStackParamList = { EsimDetail: { packageId: string } };
type Props = NativeStackScreenProps<RootStackParamList, 'EsimDetail'>;

export function EsimDetailScreen({ route }: Props) {
  const { packageId } = route.params;
  const [pkg, setPkg] = useState<EsimPackage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEsimPackageById(packageId)
      .then(setPkg)
      .finally(() => setLoading(false));
  }, [packageId]);

  if (loading) return <View style={styles.centered}><Text>Loading...</Text></View>;
  if (!pkg) return <View style={styles.centered}><Text>Package not found</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{pkg.name ?? pkg.id}</Text>
      <Text style={styles.meta}>
        Data: {pkg.data_quantity != null && pkg.data_unit ? `${pkg.data_quantity} ${pkg.data_unit}` : '—'}
        · Validity: {pkg.package_validity != null && pkg.package_validity_unit ? `${pkg.package_validity} ${pkg.package_validity_unit}` : '—'}
      </Text>
      <Text style={styles.price}>${pkg.price ?? '0'}</Text>
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Purchase with Solana Pay</Text>
      </TouchableOpacity>
      <Text style={styles.placeholder}>Checkout flow to be wired (no design yet).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 16 },
  name: { fontSize: 22, fontWeight: '600' },
  meta: { fontSize: 14, color: '#666', marginTop: 8 },
  price: { fontSize: 18, marginTop: 8 },
  button: { marginTop: 24, backgroundColor: '#000', padding: 16, borderRadius: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  placeholder: { marginTop: 16, color: '#999' },
});
