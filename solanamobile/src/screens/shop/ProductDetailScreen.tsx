import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getProductBySlug, type Product } from '../../api/products';

type RootStackParamList = {
  ProductDetail: { slug: string };
  Checkout: { invoiceId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProductBySlug(slug)
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <View style={styles.centered}><Text>Loading...</Text></View>;
  if (!product) return <View style={styles.centered}><Text>Product not found</Text></View>;

  const onCheckout = () => {
    // Placeholder: create order then navigate to Checkout
    navigation.navigate('Checkout', { invoiceId: 'placeholder' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>${product.price ?? 0}</Text>
      {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={onCheckout}>
        <Text style={styles.buttonText}>Checkout with Solana Pay</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 16 },
  name: { fontSize: 22, fontWeight: '600' },
  price: { fontSize: 18, marginTop: 8 },
  desc: { marginTop: 16, color: '#666' },
  button: { marginTop: 24, backgroundColor: '#000', padding: 16, borderRadius: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
