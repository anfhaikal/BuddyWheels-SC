import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Tabs } from "expo-router";
import React from "react";

export default function DriverTabLayout() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? "light"];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#67BA03",
        tabBarInactiveTintColor: "#888",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#eee",
          height: 80,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="house.fill" size={26} color={color} />
          ),
        }}
      />

      {/* 🚗 Pickup Tab */}
      <Tabs.Screen
        name="pickup"
        options={{
          title: "Pickup",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="car.fill" size={26} color={color} />
          ),
        }}
      />

      {/* 🔔 Notifications (Hidden) */}
      <Tabs.Screen
        name="notification"
        options={{
          href: null, // hides from tab bar
          tabBarStyle: { display: "none" }, // hides tab bar when this page is open
        }}
      />

      {/* 👤 Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <IconSymbol
              name="person.crop.circle.fill"
              size={26}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
