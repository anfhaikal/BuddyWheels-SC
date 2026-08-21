import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function UserOptionScreen() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setSelectedOption(null);
    }, [])
  );

  const handleChoose = () => {
    if (selectedOption === "External") {
      // Go directly to sign up for external users
      router.push({
        pathname: "/(auth)/signupscreen",
        params: { userType: "External" },
      });
    } else if (selectedOption === "School") {
      // Go to verification screen first
      router.push({
        pathname: "/(auth)/verificationScreen",
        params: { userType: "School" },
      });
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push("/loginscreen")}
      >
        <Ionicons name="arrow-back" size={26} color="#000" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Choose an option</Text>
        <Text style={styles.subtitle}>
          Tell us who you are so we can personalize your experience
        </Text>

        <TouchableOpacity
          style={[
            styles.option,
            selectedOption === "School" && styles.optionSelected,
          ]}
          onPress={() => setSelectedOption("School")}
        >
          <Text
            style={[
              styles.optionText,
              selectedOption === "School" && styles.optionTextSelected,
            ]}
          >
            School
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.option,
            selectedOption === "External" && styles.optionSelected,
          ]}
          onPress={() => setSelectedOption("External")}
        >
          <Text
            style={[
              styles.optionText,
              selectedOption === "External" && styles.optionTextSelected,
            ]}
          >
            External
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chooseButton, !selectedOption && { opacity: 0.6 }]}
          disabled={!selectedOption}
          onPress={handleChoose}
        >
          <Text style={styles.chooseButtonText}>Choose</Text>
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
  option: {
    borderColor: "#E0E0E0",
    borderWidth: 2,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  optionSelected: { borderColor: "#67BA03" },
  optionText: { fontSize: 18, color: "#E0E0E0" },
  optionTextSelected: { color: "#67BA03" },
  chooseButton: {
    backgroundColor: "#67BA03",
    width: "100%",
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 30,
  },
  chooseButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
