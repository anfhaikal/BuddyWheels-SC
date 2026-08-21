// app/(auth)/loadingscreen.tsx
import { router } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// @ts-ignore
import { auth, db } from "../../firebaseConfig";

export default function LoadingScreen() {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    // Fade in and scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Fetch user role and redirect accordingly
    const navigateBasedOnRole = async () => {
      try {
        // @ts-ignore
        const currentUser = auth.currentUser;

        if (!currentUser) {
          console.log("❌ No user found, redirecting to login");
          router.replace("/(auth)/loginscreen");
          return;
        }

        // Fetch user data from Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          console.log("❌ User document not found");
          router.replace("/(auth)/loginscreen");
          return;
        }

        const userData = userDoc.data();
        const userRole = userData.role;

        console.log(`✅ User role: ${userRole}`);

        // Navigate based on role
        switch (userRole) {
          case "Teacher":
            router.replace("/(tabs)/home");
            break;
          case "Parent":
            router.replace("/(parent)/home");
            break;
          case "Guard":
            router.replace("/(guard)/viewpickups");
            break;
          case "Driver":
            router.replace("/(driver)/home");
            break;
          default:
            console.log("⚠️ Unknown role, redirecting to default");
            router.replace("/(tabs)/home");
        }
      } catch (error) {
        console.error("❌ Error fetching user role:", error);
        router.replace("/(auth)/loginscreen");
      }
    };

    // Wait 2 seconds before navigation
    const timeout = setTimeout(() => {
      navigateBasedOnRole();
    }, 2000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require("C:/Users/haika/Documents/IIUM DEGREE/BuddyWheels/buddywheels/assets/images/Logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#67BA03" style={styles.loader} />
        <Text style={styles.text}>Loading your account...</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 280,
    height: 150,
    marginBottom: 30,
  },
  loader: {
    marginVertical: 20,
  },
  text: {
    fontSize: 16,
    color: "#3B8D33",
    marginTop: 10,
    fontWeight: "500",
  },
});
