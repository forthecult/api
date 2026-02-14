import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getProducts, type Product } from '../../api/products';
import type { MainTabParamList } from '../../navigation/types';
import type { RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Shop'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function ProductListScreen({ navigation }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProducts({ limit: 24 })
      .then((res) => {
        if (!cancelled) setProducts(res.products ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <View style={styles.centered}><Text>Loading...</Text></View>;
  if (error) return <View style={styles.centered}><Text style={styles.error}>{error}</Text></View>;

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => (navigation.getParent() as unknown as { navigate: (name: 'ProductDetail', params: { slug: string }) => void })?.navigate('ProductDetail', { slug: item.slug ?? item.id })}
        >
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.price}>${item.price ?? 0}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: 'red' },
  list: { padding: 16 },
  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 16, fontWeight: '500' },
  price: { fontSize: 14, color: '#666', marginTop: 4 },
});
