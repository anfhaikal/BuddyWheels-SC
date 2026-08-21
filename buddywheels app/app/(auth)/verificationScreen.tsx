import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// @ts-ignore
import { db } from "../../firebaseConfig";

export default function VerificationScreen() {
  const { userType } = useLocalSearchParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert("Error", "Please enter a verification code");
      return;
    }

    try {
      setLoading(true);
      const docRef = doc(db, "verification", "register");
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        Alert.alert("Error", "Verification setup not found");
        return;
      }

      const validCode = docSnap.data().code;

      if (code.trim() === validCode) {
        Alert.alert("Success", "Verification successful!");
        router.push({
          pathname: "/(auth)/signupscreen",
          params: { userType },
        });
      } else {
        Alert.alert(
          "Invalid Code",
          "The verification code you entered is incorrect."
        );
      }
    } catch (error) {
      console.error("Verification error:", error);
      Alert.alert("Error", "Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={26} color="#000" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>School Verification</Text>
        <Text style={styles.subtitle}>
          Enter your school’s verification code to continue registration
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter verification code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          placeholderTextColor="#666"
        />

        <TouchableOpacity
          style={[styles.verifyButton, loading && { opacity: 0.7 }]}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.verifyText}>
            {loading ? "Verifying..." : "Verify"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 50,
  },
  content: { flex: 1, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 17, color: "#555", marginBottom: 30 },
  input: {
    borderColor: "#E0E0E0",
    borderWidth: 2,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  verifyButton: {
    backgroundColor: "#67BA03",
    width: "100%",
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: "center",
  },
  verifyText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
