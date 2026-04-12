import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        
        // --- PENGATURAN TEMA GELAP (DARK MODE) ---
        // 1. Warna Icon/Teks saat aktif (Biru)
        tabBarActiveTintColor: '#3b82f6', 
        
        // 2. Warna Icon/Teks saat tidak aktif (Abu-abu)
        tabBarInactiveTintColor: '#64748b', 

        // 3. Styling Background Navbar
        tabBarStyle: {
            backgroundColor: '#0f172a', // Slate-900 (Gelap pekat)
            borderTopWidth: 0,          // Menghilangkan garis border atas biar mulus
            elevation: 0,               // Menghilangkan bayangan default Android
            height: Platform.OS === 'ios' ? 88 : 68, // Tinggi navbar yang pas
            paddingBottom: Platform.OS === 'ios' ? 28 : 10, // Jarak bawah
            paddingTop: 10,
        },
      }}>
      
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Histori',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="clock.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}