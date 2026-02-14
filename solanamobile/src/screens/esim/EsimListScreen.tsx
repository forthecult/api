import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getEsimPackages, type EsimPackage } from '../../api/esim';
import type { MainTabParamList } from '../../navigation/types';
import type { RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'eSIM'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function EsimListScreen({ navigation }: Props) {
  const [packages, setPackages] = useState<EsimPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEsimPackages({ package_type: 'DATA-ONLY' })
      .then((res) => setPackages(res.data ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.centered}><Text>Loading...</Text></View>;
  if (error) return <View style={styles.centered}><Text style={styles.error}>{error}</Text></View>;

  return (
    <FlatList
      data={packages}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>No eSIM packages</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => (navigation.getParent() as unknown as { navigate: (name: 'EsimDetail', params: { packageId: string }) => void })?.navigate('EsimDetail', { packageId: item.id })}
        >
          <Text style={styles.name}>{item.name ?? item.id}</Text>
          <Text style={styles.meta}>
            {item.data_quantity != null && item.data_unit ? `${item.data_quantity} ${item.data_unit}` : ''}
            {item.package_validity != null && item.package_validity_unit ? ` · ${item.package_validity} ${item.package_validity_unit}` : ''}
          </Text>
          <Text style={styles.price}>${item.price ?? '0'}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: 'red' },
  empty: { padding: 24, color: '#666' },
  list: { padding: 16 },
  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 12, color: '#666', marginTop: 4 },
  price: { fontSize: 14, fontWeight: '600', marginTop: 4 },
});
