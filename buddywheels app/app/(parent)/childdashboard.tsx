import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
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
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
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

interface Child {
  id: string;
  fullName: string;
  studentId: string;
  classGrade?: string;
  className?: string;
  ppic?: string;
  commuteType?: "parent" | "bus" | "self";
  driverID?: string;
  selfCommuteType?: string;
}

export default function ChildDashboard() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCommuteModal, setShowCommuteModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [searchStudentId, setSearchStudentId] = useState("");
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commuteType, setCommuteType] = useState<"parent" | "bus" | "self">(
    "parent"
  );
  const [driverID, setDriverID] = useState("");
  const [selfCommuteType, setSelfCommuteType] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    initializeParentAndListener();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const initializeParentAndListener = async () => {
    try {
      setLoading(true);
      //@ts-ignore
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const parentQuery = query(
        collection(db, "Parent"),
        where("email", "==", user.email)
      );
      const parentSnapshot = await getDocs(parentQuery);

      if (parentSnapshot.empty) {
        console.log("Parent not found");
        setLoading(false);
        return;
      }

      const parentData = parentSnapshot.docs[0].data();
      const fetchedParentId = parentData.id;
      setParentId(fetchedParentId);

      // Set up real-time listener
      setupRealtimeListener(fetchedParentId);
    } catch (error) {
      console.error("Error initializing:", error);
      Alert.alert("Error", "Failed to initialize");
      setLoading(false);
    }
  };

  const setupRealtimeListener = (parentId: string) => {
    // Clean up existing listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const studentsQuery = query(
      collection(db, "students"),
      where("parentID", "==", parentId)
    );

    const unsubscribe = onSnapshot(
      studentsQuery,
      (snapshot) => {
        const childrenData: Child[] = snapshot.docs.map((doc) => {
          const studentData = doc.data();
          return {
            id: doc.id,
            fullName: studentData.name || "Unknown",
            studentId: studentData.studentID,
            classGrade: studentData.grade || "N/A",
            className: studentData.class || "N/A",
            ppic: studentData.ppic,
            commuteType: studentData.commuteType || "parent",
            driverID: studentData.driverID || "",
            selfCommuteType: studentData.selfCommuteType || "",
          };
        });

        setChildren(childrenData);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("Error in real-time listener:", error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    unsubscribeRef.current = unsubscribe;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // The real-time listener will automatically update the data
    // We just need to re-fetch to ensure we have the latest
    if (parentId) {
      // Listener will handle the update
      setTimeout(() => {
        setRefreshing(false);
      }, 500);
    } else {
      await initializeParentAndListener();
    }
  };

  const searchStudent = async () => {
    if (!searchStudentId.trim()) {
      Alert.alert("Error", "Please enter a Student ID");
      return;
    }

    try {
      setSearching(true);

      const studentQuery = query(
        collection(db, "students"),
        where("studentID", "==", searchStudentId.trim())
      );
      const studentSnapshot = await getDocs(studentQuery);

      if (studentSnapshot.empty) {
        Alert.alert("Not Found", "No student found with this ID");
        return;
      }

      const studentDoc = studentSnapshot.docs[0];
      const studentData = studentDoc.data();

      if (studentData.parentID) {
        Alert.alert(
          "Student Already Taken",
          "This student is already assigned to another parent. Please contact admin."
        );
        return;
      }

      const alreadyAdded = children.some(
        (child) => child.studentId === searchStudentId.trim()
      );
      if (alreadyAdded) {
        Alert.alert("Already Added", "This child is already in your list");
        return;
      }

      Alert.alert(
        "Confirm Addition",
        `Add ${studentData.name} (${studentData.studentID}) to your children list?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add",
            onPress: () => addChild(studentDoc.id),
          },
        ]
      );
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert("Error", "Failed to search for student");
    } finally {
      setSearching(false);
    }
  };

  const addChild = async (firestoreDocId: string) => {
    try {
      setAdding(true);

      if (!parentId) {
        Alert.alert("Error", "Parent profile not found");
        return;
      }

      await updateDoc(doc(db, "students", firestoreDocId), {
        parentID: parentId,
      });

      setShowAddModal(false);
      setSearchStudentId("");
      Alert.alert("Success", "Child added successfully!");
    } catch (error) {
      console.error("Add child error:", error);
      Alert.alert("Error", `Failed to add child: ${error}`);
    } finally {
      setAdding(false);
    }
  };

  const openCommuteModal = (child: Child) => {
    setSelectedChild(child);
    setCommuteType(child.commuteType || "parent");
    setDriverID(child.driverID || "");
    setSelfCommuteType(child.selfCommuteType || "");
    setShowCommuteModal(true);
  };

  const saveCommute = async () => {
    if (!selectedChild) return;

    if (commuteType === "bus") {
      if (!driverID.trim()) {
        Alert.alert("Error", "Please enter a Driver ID");
        return;
      }

      try {
        setSaving(true);

        const driverQuery = query(
          collection(db, "Driver"),
          where("id", "==", driverID.trim())
        );
        const driverSnapshot = await getDocs(driverQuery);

        if (driverSnapshot.empty) {
          Alert.alert(
            "Error",
            "Driver ID not found. Please check and try again."
          );
          setSaving(false);
          return;
        }

        const studentQuery = query(
          collection(db, "students"),
          where("studentID", "==", selectedChild.studentId)
        );
        const studentSnapshot = await getDocs(studentQuery);

        if (!studentSnapshot.empty) {
          const studentDocId = studentSnapshot.docs[0].id;
          await updateDoc(doc(db, "students", studentDocId), {
            commuteType: "bus",
            driverID: driverID.trim(),
            selfCommuteType: null,
          });
        }

        setShowCommuteModal(false);
        Alert.alert("Success", "Commute information saved successfully!");
      } catch (error) {
        console.error("Save commute error:", error);
        Alert.alert("Error", "Failed to save commute information");
      } finally {
        setSaving(false);
      }
    } else if (commuteType === "self") {
      if (!selfCommuteType.trim()) {
        Alert.alert("Error", "Please enter commute method");
        return;
      }

      try {
        setSaving(true);

        const studentQuery = query(
          collection(db, "students"),
          where("studentID", "==", selectedChild.studentId)
        );
        const studentSnapshot = await getDocs(studentQuery);

        if (!studentSnapshot.empty) {
          const studentDocId = studentSnapshot.docs[0].id;
          await updateDoc(doc(db, "students", studentDocId), {
            commuteType: "self",
            selfCommuteType: selfCommuteType.trim(),
            driverID: null,
          });
        }

        setShowCommuteModal(false);
        Alert.alert("Success", "Commute information saved successfully!");
      } catch (error) {
        console.error("Save commute error:", error);
        Alert.alert("Error", "Failed to save commute information");
      } finally {
        setSaving(false);
      }
    } else {
      try {
        setSaving(true);

        const studentQuery = query(
          collection(db, "students"),
          where("studentID", "==", selectedChild.studentId)
        );
        const studentSnapshot = await getDocs(studentQuery);

        if (!studentSnapshot.empty) {
          const studentDocId = studentSnapshot.docs[0].id;
          await updateDoc(doc(db, "students", studentDocId), {
            commuteType: "parent",
            driverID: null,
            selfCommuteType: null,
          });
        }

        setShowCommuteModal(false);
        Alert.alert("Success", "Commute information saved successfully!");
      } catch (error) {
        console.error("Save commute error:", error);
        Alert.alert("Error", "Failed to save commute information");
      } finally {
        setSaving(false);
      }
    }
  };

  const removeChild = async () => {
    if (!selectedChild) return;

    Alert.alert(
      "Remove Child",
      `Are you sure you want to remove ${selectedChild.fullName} from your list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const studentQuery = query(
                collection(db, "students"),
                where("studentID", "==", selectedChild.studentId)
              );
              const studentSnapshot = await getDocs(studentQuery);

              if (studentSnapshot.empty) return;

              const studentDocId = studentSnapshot.docs[0].id;

              await updateDoc(doc(db, "students", studentDocId), {
                parentID: null,
                commuteType: null,
                driverID: null,
                selfCommuteType: null,
              });

              setShowCommuteModal(false);
              Alert.alert("Success", "Child removed successfully");
            } catch (error) {
              console.error("Remove child error:", error);
              Alert.alert("Error", "Failed to remove child");
            }
          },
        },
      ]
    );
  };

  const handlePressIn = (id: string) => {
    if (!scaleAnims[id]) {
      scaleAnims[id] = new Animated.Value(1);
    }
    Animated.spring(scaleAnims[id], {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (id: string) => {
    if (!scaleAnims[id]) {
      scaleAnims[id] = new Animated.Value(1);
    }
    Animated.spring(scaleAnims[id], {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#67BA03" />
        <Text style={styles.loadingText}>Loading children...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        backgroundColor="#67BA03"
        barStyle="light-content"
        translucent={false}
      />
      <View style={styles.container}>
        <LinearGradient
          colors={["#67BA03", "#5AA002", "#4D8902"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.circleDecor1} />
          <View style={styles.circleDecor2} />
          <View style={styles.circleDecor3} />

          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <View style={styles.backButtonBg}>
                <Ionicons name="chevron-back" size={24} color="#67BA03" />
              </View>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Child Dashboard</Text>
              <Text style={styles.headerSubtitle}>
                Manage your children's commute
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#67BA03"
              colors={["#67BA03"]}
              progressViewOffset={0}
            />
          }
        >
          {/* Stats Card */}
          <Animated.View style={[styles.statsCard, { opacity: fadeAnim }]}>
            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: "#E8F5E9" }]}>
                <Ionicons name="people" size={22} color="#67BA03" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>{children.length}</Text>
                <Text style={styles.statLabel}>Children</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: "#E3F2FD" }]}>
                <Ionicons name="bus" size={22} color="#2196F3" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>
                  {children.filter((c) => c.commuteType === "bus").length}
                </Text>
                <Text style={styles.statLabel}>By Bus</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: "#FFF3E0" }]}>
                <Ionicons name="car" size={22} color="#FF9800" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>
                  {children.filter((c) => c.commuteType === "parent").length}
                </Text>
                <Text style={styles.statLabel}>By Parent</Text>
              </View>
            </View>
          </Animated.View>

          {/* Section Header */}
          {children.length > 0 && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Children</Text>
              <View style={styles.sectionLine} />
            </View>
          )}

          {/* Children List */}
          <View style={styles.content}>
            {children.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="people-outline" size={48} color="#67BA03" />
                </View>
                <Text style={styles.emptyText}>No children added yet</Text>
                <Text style={styles.emptySubtext}>
                  Tap the + button below to add your first child
                </Text>
              </View>
            ) : (
              children.map((child) => {
                if (!scaleAnims[child.id]) {
                  scaleAnims[child.id] = new Animated.Value(1);
                }
                return (
                  <Animated.View
                    key={child.id}
                    style={{ transform: [{ scale: scaleAnims[child.id] }] }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPressIn={() => handlePressIn(child.id)}
                      onPressOut={() => handlePressOut(child.id)}
                      onPress={() => openCommuteModal(child)}
                      style={styles.childCard}
                    >
                      <View style={styles.childCardPattern} />
                      <View style={styles.childCardContent}>
                        <View style={styles.childImageContainer}>
                          <Image
                            source={{
                              uri:
                                child.ppic ||
                                "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                            }}
                            style={styles.childImage}
                          />
                          {child.commuteType === "bus" && (
                            <View
                              style={[
                                styles.commuteBadge,
                                { backgroundColor: "#2196F3" },
                              ]}
                            >
                              <Ionicons name="bus" size={12} color="#fff" />
                            </View>
                          )}
                          {child.commuteType === "parent" && (
                            <View
                              style={[
                                styles.commuteBadge,
                                { backgroundColor: "#67BA03" },
                              ]}
                            >
                              <Ionicons name="car" size={12} color="#fff" />
                            </View>
                          )}
                          {child.commuteType === "self" && (
                            <View
                              style={[
                                styles.commuteBadge,
                                { backgroundColor: "#FF9800" },
                              ]}
                            >
                              <Ionicons name="walk" size={12} color="#fff" />
                            </View>
                          )}
                        </View>

                        <View style={styles.childInfo}>
                          <Text style={styles.childName}>{child.fullName}</Text>
                          <Text style={styles.childID}>
                            ID: {child.studentId}
                          </Text>
                          <View style={styles.childDetailsRow}>
                            <View style={styles.classBadge}>
                              <Ionicons name="school" size={12} color="#666" />
                              <Text style={styles.childClass}>
                                {child.classGrade} {child.className}
                              </Text>
                            </View>
                          </View>
                          {child.commuteType === "bus" && child.driverID && (
                            <View style={styles.commuteInfoContainer}>
                              <Ionicons name="bus" size={14} color="#2196F3" />
                              <Text
                                style={[
                                  styles.commuteInfo,
                                  { color: "#2196F3" },
                                ]}
                              >
                                Driver: {child.driverID}
                              </Text>
                            </View>
                          )}
                          {child.commuteType === "parent" && (
                            <View style={styles.commuteInfoContainer}>
                              <Ionicons name="car" size={14} color="#67BA03" />
                              <Text
                                style={[
                                  styles.commuteInfo,
                                  { color: "#67BA03" },
                                ]}
                              >
                                Parent Drop-off
                              </Text>
                            </View>
                          )}
                          {child.commuteType === "self" &&
                            child.selfCommuteType && (
                              <View style={styles.commuteInfoContainer}>
                                <Ionicons
                                  name="walk"
                                  size={14}
                                  color="#FF9800"
                                />
                                <Text
                                  style={[
                                    styles.commuteInfo,
                                    { color: "#FF9800" },
                                  ]}
                                >
                                  {child.selfCommuteType}
                                </Text>
                              </View>
                            )}
                        </View>

                        <View style={styles.arrowButton}>
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color="#999"
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })
            )}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#67BA03", "#5AA002"]}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Add Child Modal */}
        <Modal
          visible={showAddModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAddModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
            <TouchableOpacity
              style={styles.modalOverlayTouchable}
              activeOpacity={1}
              onPress={() => {
                setShowAddModal(false);
                setSearchStudentId("");
              }}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={styles.modalContent}
              >
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <View style={styles.modalIconContainer}>
                    <LinearGradient
                      colors={["#67BA03", "#5AA002"]}
                      style={styles.modalIconBg}
                    >
                      <Ionicons name="person-add" size={24} color="#fff" />
                    </LinearGradient>
                  </View>
                  <Text style={styles.modalTitle}>Add Child</Text>
                  <Text style={styles.modalSubtitle}>
                    Enter your child's student ID to add them
                  </Text>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.label}>Student ID</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="id-card-outline" size={20} color="#999" />
                    <TextInput
                      style={styles.input}
                      value={searchStudentId}
                      onChangeText={setSearchStudentId}
                      placeholder="Enter student ID (e.g., S001)"
                      placeholderTextColor="#999"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowAddModal(false);
                      setSearchStudentId("");
                    }}
                    disabled={searching || adding}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.searchButton,
                      (searching || adding) && styles.searchButtonDisabled,
                    ]}
                    onPress={searchStudent}
                    disabled={searching || adding}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={["#67BA03", "#5AA002"]}
                      style={styles.searchButtonGradient}
                    >
                      {searching || adding ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="search" size={18} color="#fff" />
                          <Text style={styles.searchButtonText}>
                            Search & Add
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Modal>

        {/* Commute Settings Modal */}
        <Modal
          visible={showCommuteModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCommuteModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.commuteModalOverlay}
          >
            <TouchableOpacity
              style={styles.commuteModalOverlayTouchable}
              activeOpacity={1}
              onPress={() => setShowCommuteModal(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={styles.commuteModalContent}
              >
                <View style={styles.modalHeader}>
                  <View style={styles.modalIconContainer}>
                    <LinearGradient
                      colors={["#2196F3", "#1976D2"]}
                      style={styles.modalIconBg}
                    >
                      <Ionicons name="settings" size={24} color="#fff" />
                    </LinearGradient>
                  </View>
                  <Text style={styles.modalTitle}>Commute Settings</Text>
                  <TouchableOpacity
                    onPress={() => setShowCommuteModal(false)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close-circle" size={28} color="#999" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.commuteModalBody}>
                  {selectedChild && (
                    <>
                      <View style={styles.childInfoSection}>
                        <View style={styles.modalChildImageContainer}>
                          <Image
                            source={{
                              uri:
                                selectedChild.ppic ||
                                "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                            }}
                            style={styles.modalChildImage}
                          />
                        </View>
                        <Text style={styles.modalChildName}>
                          {selectedChild.fullName}
                        </Text>
                        <View style={styles.modalClassBadge}>
                          <Ionicons name="school" size={14} color="#666" />
                          <Text style={styles.modalChildClass}>
                            {selectedChild.classGrade} {selectedChild.className}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.sectionTitle}>
                        How will {selectedChild.fullName.split(" ")[0]} commute?
                      </Text>

                      <View style={styles.commuteOptions}>
                        <TouchableOpacity
                          style={[
                            styles.commuteOption,
                            commuteType === "parent" &&
                              styles.commuteOptionSelected,
                          ]}
                          onPress={() => setCommuteType("parent")}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.commuteOptionIconBg,
                              commuteType === "parent" && {
                                backgroundColor: "#E8F5E9",
                              },
                            ]}
                          >
                            <Ionicons
                              name="car"
                              size={28}
                              color={
                                commuteType === "parent" ? "#67BA03" : "#999"
                              }
                            />
                          </View>
                          <Text
                            style={[
                              styles.commuteOptionText,
                              commuteType === "parent" &&
                                styles.commuteOptionTextSelected,
                            ]}
                          >
                            By Parent
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.commuteOption,
                            commuteType === "bus" &&
                              styles.commuteOptionSelected,
                          ]}
                          onPress={() => setCommuteType("bus")}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.commuteOptionIconBg,
                              commuteType === "bus" && {
                                backgroundColor: "#E3F2FD",
                              },
                            ]}
                          >
                            <Ionicons
                              name="bus"
                              size={28}
                              color={commuteType === "bus" ? "#2196F3" : "#999"}
                            />
                          </View>
                          <Text
                            style={[
                              styles.commuteOptionText,
                              commuteType === "bus" &&
                                styles.commuteOptionTextSelected,
                            ]}
                          >
                            By Bus
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.commuteOption,
                            commuteType === "self" &&
                              styles.commuteOptionSelected,
                          ]}
                          onPress={() => setCommuteType("self")}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.commuteOptionIconBg,
                              commuteType === "self" && {
                                backgroundColor: "#FFF3E0",
                              },
                            ]}
                          >
                            <Ionicons
                              name="walk"
                              size={28}
                              color={
                                commuteType === "self" ? "#FF9800" : "#999"
                              }
                            />
                          </View>
                          <Text
                            style={[
                              styles.commuteOptionText,
                              commuteType === "self" &&
                                styles.commuteOptionTextSelected,
                            ]}
                          >
                            Self Commute
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {commuteType === "bus" && (
                        <View style={styles.driverSection}>
                          <Text style={styles.label}>Driver ID *</Text>
                          <View style={styles.inputContainer}>
                            <Ionicons
                              name="person-outline"
                              size={20}
                              color="#999"
                            />
                            <TextInput
                              style={styles.input}
                              value={driverID}
                              onChangeText={setDriverID}
                              placeholder="Enter driver ID"
                              placeholderTextColor="#999"
                            />
                          </View>
                          <Text style={styles.helperText}>
                            Enter the ID of the bus driver assigned to this
                            route
                          </Text>
                        </View>
                      )}
                      {commuteType === "self" && (
                        <View style={styles.driverSection}>
                          <Text style={styles.label}>Commute Method *</Text>
                          <View style={styles.inputContainer}>
                            <Ionicons
                              name="bicycle-outline"
                              size={20}
                              color="#999"
                            />
                            <TextInput
                              style={styles.input}
                              value={selfCommuteType}
                              onChangeText={setSelfCommuteType}
                              placeholder="e.g., Walk, Bicycle, Motorcycle"
                              placeholderTextColor="#999"
                            />
                          </View>
                          <Text style={styles.helperText}>
                            Specify how the student will commute to school
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </ScrollView>

                <View style={styles.commuteModalFooter}>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={removeChild}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.saveCommuteButton,
                      saving && styles.saveCommuteButtonDisabled,
                    ]}
                    onPress={saveCommute}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={["#67BA03", "#5AA002"]}
                      style={styles.saveCommuteButtonGradient}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#fff"
                          />
                          <Text style={styles.saveCommuteButtonText}>
                            Save Changes
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
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
    paddingTop: 16,
    overflow: "hidden",
    height: 140,
    elevation: 8,
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
  circleDecor3: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    top: 40,
    left: "50%",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
    marginTop: 60,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 13,
    marginTop: 2,
  },
  statsCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statTextContainer: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: "#E0E0E0",
  },
  sectionHeader: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  sectionLine: {
    width: 40,
    height: 3,
    backgroundColor: "#67BA03",
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  childCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  childCardPattern: {
    position: "absolute",
    right: -30,
    top: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(103, 186, 3, 0.05)",
  },
  childCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  childImageContainer: {
    position: "relative",
  },
  childImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  commuteBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  childInfo: {
    flex: 1,
    marginLeft: 16,
  },
  childName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 2,
  },
  childID: {
    fontSize: 12,
    color: "#999",
    marginBottom: 6,
  },
  childDetailsRow: {
    marginBottom: 6,
  },
  classBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    gap: 4,
  },
  childClass: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  commuteInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  commuteInfo: {
    fontSize: 12,
    fontWeight: "600",
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalOverlayTouchable: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "70%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    alignItems: "center",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalIconContainer: {
    marginBottom: 12,
  },
  modalIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#999",
  },
  closeButton: {
    position: "absolute",
    top: 20,
    right: 20,
  },
  modalBody: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9F9F9",
    gap: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    color: "#333",
  },
  helperText: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  searchButton: {
    flex: 1.5,
    borderRadius: 12,
    overflow: "hidden",
  },
  searchButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  commuteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  commuteModalOverlayTouchable: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  commuteModalContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "100%",
    maxWidth: 500,
    maxHeight: "85%",
    overflow: "hidden",
  },
  commuteModalBody: {
    padding: 24,
  },
  childInfoSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalChildImageContainer: {
    position: "relative",
    marginBottom: 12,
  },
  modalChildImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    borderWidth: 3,
    borderColor: "#E8F5E9",
  },
  modalChildName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
  },
  modalClassBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  modalChildClass: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  commuteOptions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  commuteOption: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#F9F9F9",
  },
  commuteOptionSelected: {
    borderColor: "#67BA03",
    backgroundColor: "#F0F9E8",
  },
  commuteOptionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  commuteOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
  },
  commuteOptionTextSelected: {
    color: "#67BA03",
  },
  driverSection: {
    marginTop: 8,
  },
  commuteModalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 12,
  },
  removeButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#E53935",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  saveCommuteButton: {
    flex: 1.5,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveCommuteButtonGradient: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  saveCommuteButtonDisabled: {
    opacity: 0.6,
  },
  saveCommuteButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
