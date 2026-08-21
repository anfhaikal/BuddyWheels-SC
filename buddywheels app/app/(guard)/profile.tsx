import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { getAuth, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
//@ts-ignore
import { auth, db } from "../../firebaseConfig";

export default function Profile() {
  const [userData, setUserData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedPhone, setEditedPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    const fetchProfile = async () => {
      //@ts-ignore
      const user = auth.currentUser;
      if (!user) return;

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          console.log("No user data found");
          return;
        }

        let userData = docSnap.data();

        // Fetch Guard-specific data if role is Guard
        if (userData.role === "Guard") {
          const guardQuery = query(
            collection(db, "Guard"),
            where("email", "==", user.email)
          );
          const guardSnapshot = await getDocs(guardQuery);

          if (!guardSnapshot.empty) {
            const guardData = guardSnapshot.docs[0].data();
            userData = { ...userData, ...guardData };
          }
        }

        setUserData(userData);

        // Animate on load
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, []);

  const handleSignOut = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              const auth = getAuth();
              await signOut(auth);
              console.log("🚪 User signed out");
              router.replace("/(auth)/loginscreen");
            } catch (error: any) {
              console.error("Sign-out error:", error.message);
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const openEditModal = () => {
    setEditedName(userData.fullName || "");
    setEditedPhone(userData.phone || "");
    setShowEditModal(true);
  };

  const saveProfile = async () => {
    if (!editedName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    if (!editedPhone.trim()) {
      Alert.alert("Error", "Phone number cannot be empty");
      return;
    }

    try {
      setSaving(true);
      //@ts-ignore
      const user = auth.currentUser;
      if (!user) return;

      // Update users collection
      await updateDoc(doc(db, "users", user.uid), {
        fullName: editedName,
        phone: editedPhone,
      });

      // Update Guard collection
      const guardQuery = query(
        collection(db, "Guard"),
        where("email", "==", user.email)
      );
      const guardSnapshot = await getDocs(guardQuery);

      if (!guardSnapshot.empty) {
        const guardDocId = guardSnapshot.docs[0].id;
        await updateDoc(doc(db, "Guard", guardDocId), {
          fullName: editedName,
          phone: editedPhone,
        });
      }

      // Update local state
      setUserData({
        ...userData,
        fullName: editedName,
        phone: editedPhone,
      });

      setShowEditModal(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Denied", "Please allow access to your gallery.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setUploading(true);
      //@ts-ignore
      const user = auth.currentUser;
      if (!user) {
        Alert.alert(
          "Error",
          "You must be logged in to upload a profile picture"
        );
        return;
      }

      console.log("Starting image compression...");

      const compressedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 300 } }],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      console.log("Image compressed, converting to base64...");

      const response = await fetch(compressedImage.uri);
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log("Base64 conversion complete, updating Firestore...");

      await updateDoc(doc(db, "users", user.uid), {
        ppic: base64,
      });

      setUserData({ ...userData, ppic: base64 });

      Alert.alert("Success", "Profile picture updated!");
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert(
        "Error",
        `Failed to upload profile picture: ${error.message}`
      );
    } finally {
      setUploading(false);
    }
  };

  if (!userData) {
    return (
      <>
        <StatusBar backgroundColor="#67BA03" barStyle="light-content" />
        <View style={styles.container}>
          <LinearGradient
            colors={["#67BA03", "#5AA002", "#4D8902"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.circleDecor1} />
            <View style={styles.circleDecor2} />
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>My Profile</Text>
            </View>
          </LinearGradient>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#67BA03" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar backgroundColor="#67BA03" barStyle="light-content" />
      <View style={styles.container}>
        <LinearGradient
          colors={["#67BA03", "#5AA002", "#4D8902"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.circleDecor1} />
          <View style={styles.circleDecor2} />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>My Profile</Text>
            <TouchableOpacity onPress={openEditModal} style={styles.editButton}>
              <Ionicons name="create-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <Animated.View
            style={[
              styles.profileCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={pickImage}
              style={styles.avatarContainer}
            >
              <View style={styles.avatarGlow} />
              <Image
                source={{
                  uri:
                    userData.ppic ||
                    "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                }}
                style={styles.avatar}
              />
              {uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            </TouchableOpacity>

            <Text style={styles.userName}>{userData.fullName}</Text>

            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#67BA03" />
              <Text style={styles.roleText}>{userData.role || "User"}</Text>
            </View>

            <View style={styles.contactInfo}>
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={18} color="#666" />
                <Text style={styles.contactText}>
                  {userData.phone || "+60XXXXXXXXX"}
                </Text>
              </View>
              <View style={styles.contactRow}>
                <Ionicons name="mail-outline" size={18} color="#666" />
                <Text style={styles.contactText}>
                  {
                    //@ts-ignore
                    auth.currentUser?.email
                  }
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Account Info Card */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBg}>
                <Ionicons name="person-outline" size={24} color="#2196F3" />
              </View>
              <Text style={styles.cardTitle}>Account Information</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>User Type</Text>
              <Text style={styles.infoValue}>{userData.userType || "N/A"}</Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Guard ID</Text>
              <Text style={styles.infoValue}>{userData.id || "N/A"}</Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>ID Number</Text>
              <Text style={styles.infoValue}>{userData.idNumber || "N/A"}</Text>
            </View>
          </Animated.View>

          {/* Logout Button */}
          <Animated.View
            style={[
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#DC3545", "#C82333"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoutGradient}
              >
                <Ionicons name="log-out-outline" size={22} color="#fff" />
                <Text style={styles.logoutText}>Log Out</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 30 }} />
        </ScrollView>

        {/* Edit Modal */}
        <Modal
          visible={showEditModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    <Ionicons name="person" size={16} color="#666" /> Full Name
                    *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    <Ionicons name="call" size={16} color="#666" /> Phone Number
                    *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={editedPhone}
                    onChangeText={setEditedPhone}
                    placeholder="+60123456789"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Read-only fields */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    <Ionicons name="mail" size={16} color="#666" /> Email
                    (Read-only)
                  </Text>
                  <View style={styles.readOnlyInput}>
                    <Ionicons
                      name="lock-closed"
                      size={16}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <Text style={styles.readOnlyText}>
                      {
                        //@ts-ignore
                        auth.currentUser?.email
                      }
                    </Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    <Ionicons name="card" size={16} color="#666" /> ID Number
                    (Read-only)
                  </Text>
                  <View style={styles.readOnlyInput}>
                    <Ionicons
                      name="lock-closed"
                      size={16}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <Text style={styles.readOnlyText}>
                      {userData.idNumber || "N/A"}
                    </Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    <Ionicons name="briefcase" size={16} color="#666" /> User
                    Type (Read-only)
                  </Text>
                  <View style={styles.readOnlyInput}>
                    <Ionicons
                      name="lock-closed"
                      size={16}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <Text style={styles.readOnlyText}>
                      {userData.userType || "N/A"}
                    </Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    <Ionicons name="shield" size={16} color="#666" /> Role
                    (Read-only)
                  </Text>
                  <View style={styles.readOnlyInput}>
                    <Ionicons
                      name="lock-closed"
                      size={16}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <Text style={styles.readOnlyText}>
                      {userData.role || "N/A"}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowEditModal(false)}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButtonWrapper]}
                  onPress={saveProfile}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#67BA03", "#5AA002"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveButtonGradient}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingVertical: 20,
    paddingHorizontal: 20,
    overflow: "hidden",
    elevation: 8,
    height: 140,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  circleDecor1: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    top: -50,
    right: -30,
  },
  circleDecor2: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    bottom: -20,
    left: -20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
    marginTop: 60,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },
  content: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatarGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(103, 186, 3, 0.15)",
    top: -10,
    left: -10,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: "#E8F5E9",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#67BA03",
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    elevation: 3,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 20,
  },
  roleText: {
    fontSize: 13,
    color: "#67BA03",
    fontWeight: "600",
  },
  contactInfo: {
    width: "100%",
    gap: 12,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  contactText: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  cardIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  infoDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
  },
  logoutButton: {
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  logoutGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "85%",
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#333",
    backgroundColor: "#fff",
  },
  inputIcon: {
    marginRight: 10,
  },
  readOnlyInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#F5F7FA",
  },
  readOnlyText: {
    fontSize: 15,
    color: "#666",
    flex: 1,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  saveButtonWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
  },
  saveButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
