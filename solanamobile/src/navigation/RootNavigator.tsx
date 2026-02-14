import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../providers/AuthProvider';
import { ConnectWalletScreen } from '../screens/auth/ConnectWalletScreen';
import { TabNavigator } from './TabNavigator';
import { ProductDetailScreen } from '../screens/shop/ProductDetailScreen';
import { CheckoutScreen } from '../screens/shop/CheckoutScreen';
import { EsimDetailScreen } from '../screens/esim/EsimDetailScreen';
import { SupportChatScreen } from '../screens/dashboard/SupportChatScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      {!isAuthenticated ? (
        <Stack.Screen
          name="Connect"
          component={ConnectWalletScreen}
          options={{ title: 'Connect Wallet', headerBackVisible: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Product' }} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
          <Stack.Screen name="EsimDetail" component={EsimDetailScreen} options={{ title: 'eSIM Package' }} />
          <Stack.Screen name="SupportChat" component={SupportChatScreen} options={{ title: 'Support' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
