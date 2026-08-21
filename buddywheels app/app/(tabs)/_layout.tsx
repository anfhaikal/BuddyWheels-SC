import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Tabs } from "expo-router";

import React from "react";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? "light"];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colorScheme === "dark" ? "#67BA03" : "#67BA03",
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
      {/* 🏠 Home Tab */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="house.fill" size={26} color={color} />
          ),
        }}
      />

      {/* 🔔 Notifications Tab */}
      <Tabs.Screen
        name="excuseLetter"
        options={{
          title: "Excuse Letter",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="doc.text" size={26} color={color} />
          ),
        }}
      />

      {/* 🔔 Notifications Tab */}
      <Tabs.Screen
        name="notification"
        options={{
          href: null, // ✅ hides it from the tab bar navigation
          tabBarStyle: { display: "none" }, // ✅ hides tab bar entirely when on this page
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

      {/* 🎓 Class Screen (Hidden) */}
      <Tabs.Screen
        name="class"
        options={{
          href: null, // ✅ hides it from the tab bar navigation
          tabBarStyle: { display: "none" }, // ✅ hides tab bar entirely when on this page
        }}
      />

      <Tabs.Screen
        name="[classID]/page"
        options={{
          href: null, // ✅ hides it from the tab bar navigation
          tabBarStyle: { display: "none" }, // ✅ hides tab bar entirely when on this page
        }}
      />
      <Tabs.Screen
        name="analytics/[classID]/page"
        options={{
          href: null, // ✅ hides it from the tab bar navigation
          tabBarStyle: { display: "none" }, // ✅ hides tab bar entirely when on this page
        }}
      />
      <Tabs.Screen
        name="excuseLetter/[classID]/page"
        options={{
          href: null, // ✅ hides it from the tab bar navigation
          tabBarStyle: { display: "none" }, // ✅ hides tab bar entirely when on this page
        }}
      />
    </Tabs>
  );
}
