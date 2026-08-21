// app/(auth)/_layout.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, useSegments } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
// @ts-ignore
import { auth } from "../../firebaseConfig";

export default function AuthLayout() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // @ts-ignore
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // ✅ Check if signup is in progress
      const isSigningUp = await AsyncStorage.getItem("isSigningUp");

      // ✅ Only set user if NOT during signup
      if (isSigningUp !== "true") {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const currentScreen = segments[1];

    if (user && inAuthGroup) {
      // User is logged in, redirect to loading screen
      router.replace("/(auth)/loadingscreen");
    } else if (!user && inAuthGroup && !currentScreen) {
      // User not logged in and no specific screen, go to login screen
      router.replace("/(auth)/loginscreen");
    }
  }, [user, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="loginscreen" />
      <Stack.Screen name="signupscreen" />
      <Stack.Screen name="rolescreen" />
      <Stack.Screen name="forgot" />
      <Stack.Screen name="loadingscreen" />
    </Stack>
  );
}
