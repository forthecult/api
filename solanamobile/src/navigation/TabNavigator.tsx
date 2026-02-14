import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ProductListScreen } from '../screens/shop/ProductListScreen';
import { GovernancePlaceholderScreen } from '../screens/governance/GovernancePlaceholderScreen';
import { EsimListScreen } from '../screens/esim/EsimListScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tab.Screen
        name="Shop"
        component={ProductListScreen}
        options={{ tabBarLabel: 'Shop', title: 'Shop' }}
      />
      <Tab.Screen
        name="Governance"
        component={GovernancePlaceholderScreen}
        options={{ tabBarLabel: 'Governance', title: 'Governance' }}
      />
      <Tab.Screen
        name="eSIM"
        component={EsimListScreen}
        options={{ tabBarLabel: 'eSIM', title: 'eSIM Store' }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Dashboard', title: 'Dashboard' }}
      />
    </Tab.Navigator>
  );
}
