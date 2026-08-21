import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// @ts-ignore
import { auth, db } from "../../firebaseConfig";

interface Student {
  id: string;
  name: string;
  studentID: string;
  ppic?: string;
  parentID?: string;
  className?: string;
}

interface ParentInfo {
  fullName: string;
  phone: string;
}

interface TodayPickup {
  status: "No status" | "On the way" | "Arrived" | "Dismissed";
  timeSlot?: string;
  plateNumber?: string;
  studentCount: number;
}

export default function DriverHome() {
  const [userData, setUserData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [todayPickup, setTodayPickup] = useState<TodayPickup | null>(null);
  const [driverID, setDriverID] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [parentInfo, setParentInfo] = useState<ParentInfo | null>(null);
  const [loadingParent, setLoadingParent] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const scaleAnim1 = useRef(new Animated.Value(1)).current;
  const scaleAnim2 = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const getMalaysiaDateString = (date: Date): string => {
    const options = {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    } as const;
    const formatter = new Intl.DateTimeFormat("en-CA", options);
    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const day = parts.find((p) => p.type === "day")?.value || "";
    return `${year}-${month}-${day}`;
  };

  // Real-time listener for user data
  useEffect(() => {
    // @ts-ignore
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setDriverID(data.id);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for students
  useEffect(() => {
    if (!driverID) return;

    setLoadingStudents(true);

    const studentsQuery = query(
      collection(db, "students"),
      where("driverID", "==", driverID)
    );

    const unsubscribe = onSnapshot(
      studentsQuery,
      (snapshot) => {
        const studentList: Student[] = snapshot.docs.map((docItem) => {
          const data = docItem.data() as DocumentData;
          return {
            id: docItem.id,
            name: data.name,
            studentID: data.studentID,
            ppic: data.ppic,
            parentID: data.parentID,
            className: data.className,
          };
        });

        setStudents(studentList);
        setLoadingStudents(false);
      },
      (error) => {
        console.error("Error listening to students:", error);
        setLoadingStudents(false);
      }
    );

    return () => unsubscribe();
  }, [driverID]);

  // Real-time listener for today's pickup
  useEffect(() => {
    if (!driverID) return;

    const dateStr = getMalaysiaDateString(new Date());
    const pickupDocRef = doc(db, "pickups", `${dateStr}_${driverID}`);

    const unsubscribe = onSnapshot(
      pickupDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTodayPickup({
            status: data.status || "No status",
            timeSlot: data.timeSlot,
            plateNumber: data.plateNumber,
            studentCount: data.studentIDs?.length || 0,
          });
        } else {
          setTodayPickup(null);
        }
      },
      (error) => {
        console.error("Error listening to pickup:", error);
        setTodayPickup(null);
      }
    );

    return () => unsubscribe();
  }, [driverID]);

  const fetchParentInfo = async (parentID: string) => {
    setLoadingParent(true);
    try {
      const parentRef = doc(db, "Parent", parentID);
      const parentSnap = await getDoc(parentRef);

      if (parentSnap.exists()) {
        const data = parentSnap.data();
        setParentInfo({
          fullName: data.fullName || "N/A",
          phone: data.phone || "N/A",
        });
      } else {
        setParentInfo(null);
      }
    } catch (error) {
      console.error("Error fetching parent info:", error);
      setParentInfo(null);
    } finally {
      setLoadingParent(false);
    }
  };

  const handleStudentPress = async (student: Student) => {
    setSelectedStudent(student);
    setShowOverlay(true);

    Animated.spring(overlayAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();

    if (student.parentID) {
      await fetchParentInfo(student.parentID);
    } else {
      setParentInfo(null);
    }
  };

  const closeOverlay = () => {
    Animated.timing(overlayAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowOverlay(false);
      setSelectedStudent(null);
      setParentInfo(null);
    });
  };

  const handleCallParent = () => {
    if (parentInfo?.phone) {
      Linking.openURL(`tel:${parentInfo.phone}`);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handlePressIn = (anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "On the way":
        return "#FF9800";
      case "Arrived":
        return "#4CAF50";
      case "Dismissed":
        return "#2196F3";
      default:
        return "#9E9E9E";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "On the way":
        return "#FFF3E0";
      case "Arrived":
        return "#E8F5E9";
      case "Dismissed":
        return "#E3F2FD";
      default:
        return "#F5F5F5";
    }
  };

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
            <View style={styles.avatarContainer}>
              <View style={styles.avatarGlow} />
              <Image
                source={{
                  uri:
                    userData?.ppic ||
                    "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                }}
                style={styles.avatar}
              />
              <View style={styles.onlineIndicator} />
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerSubtitle}>Welcome back,</Text>
              <Text style={styles.headerTitle}>
                {userData?.fullName || "Driver"} 👋
              </Text>
              <View style={styles.roleBadge}>
                <Ionicons name="car-sport" size={12} color="#67BA03" />
                <Text style={styles.roleText}>Driver</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/(driver)/notification")}
              style={styles.notificationButton}
            >
              <View style={styles.notificationIconContainer}>
                <Ionicons name="notifications" size={24} color="#67BA03" />
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>2</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#67BA03"
              colors={["#67BA03"]}
            />
          }
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Pickup</Text>
            <View style={styles.sectionLine} />
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/pickup")}
            style={{ marginHorizontal: 20, marginTop: 16 }}
          >
            <Animated.View style={[styles.pickupCard, { opacity: fadeAnim }]}>
              {todayPickup ? (
                <>
                  <View style={styles.pickupHeader}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getStatusBgColor(todayPickup.status),
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: getStatusColor(todayPickup.status),
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(todayPickup.status) },
                        ]}
                      >
                        {todayPickup.status}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </View>

                  <View style={styles.pickupDetails}>
                    {todayPickup.plateNumber && (
                      <View style={styles.pickupDetailItem}>
                        <Ionicons name="car" size={18} color="#666" />
                        <Text style={styles.pickupDetailText}>
                          {todayPickup.plateNumber}
                        </Text>
                      </View>
                    )}
                    {todayPickup.timeSlot && (
                      <View style={styles.pickupDetailItem}>
                        <Ionicons name="time" size={18} color="#666" />
                        <Text style={styles.pickupDetailText}>
                          {todayPickup.timeSlot}
                        </Text>
                      </View>
                    )}
                    <View style={styles.pickupDetailItem}>
                      <Ionicons name="people" size={18} color="#666" />
                      <Text style={styles.pickupDetailText}>
                        {todayPickup.studentCount} student(s)
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.noPickupContainer}>
                  <View style={styles.noPickupIconBg}>
                    <Ionicons name="calendar-outline" size={32} color="#999" />
                  </View>
                  <Text style={styles.noPickupTitle}>No Pickup Queued Yet</Text>
                  <Text style={styles.noPickupSubtitle}>
                    Queue a pickup to start your route
                  </Text>
                  <View style={styles.queueButtonHint}>
                    <Text style={styles.queueButtonHintText}>
                      Tap to queue pickup
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#67BA03" />
                  </View>
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Students</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={{ marginHorizontal: 20, marginTop: 16 }}>
            <Animated.View style={[styles.studentsCard, { opacity: fadeAnim }]}>
              <View style={styles.studentsHeader}>
                <View style={styles.studentsIconBg}>
                  <Ionicons name="people" size={24} color="#FF9800" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentsTitle}>Assigned Students</Text>
                  <Text style={styles.studentsSubtitle}>
                    {students.length} student(s) under your care
                  </Text>
                </View>
              </View>

              {loadingStudents ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FF9800" />
                </View>
              ) : (
                <>
                  {students.length > 0 ? (
                    <View style={styles.studentList}>
                      {students.map((student, index) => (
                        <View key={student.id}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => handleStudentPress(student)}
                            style={styles.studentItem}
                          >
                            <View style={styles.studentAvatar}>
                              {student.ppic ? (
                                <Image
                                  source={{ uri: student.ppic }}
                                  style={styles.studentAvatarImage}
                                />
                              ) : (
                                <Text style={styles.studentAvatarText}>
                                  {student.name.charAt(0).toUpperCase()}
                                </Text>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.studentName}>
                                {student.name}
                              </Text>
                              <Text style={styles.studentID}>
                                ID: {student.studentID}
                              </Text>
                              {student.className && (
                                <Text style={styles.studentClass}>
                                  Class: {student.className}
                                </Text>
                              )}
                            </View>
                            <Ionicons
                              name="information-circle"
                              size={24}
                              color="#FF9800"
                            />
                          </TouchableOpacity>
                          {index < students.length - 1 && (
                            <View style={styles.studentDivider} />
                          )}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.noDataContainer}>
                      <Ionicons name="people-outline" size={48} color="#ccc" />
                      <Text style={styles.noDataText}>
                        No students assigned yet
                      </Text>
                    </View>
                  )}

                  <View style={styles.studentsFooter}>
                    <Text style={styles.studentsFooterText}>
                      Tap on a student to view parent contact
                    </Text>
                  </View>
                </>
              )}
            </Animated.View>
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>

        {/* Student Details Overlay */}
        <Modal
          visible={showOverlay}
          transparent={true}
          animationType="none"
          onRequestClose={closeOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeOverlay}
            style={styles.overlayContainer}
          >
            <Animated.View
              style={[
                styles.overlayContent,
                {
                  opacity: overlayAnim,
                  transform: [
                    {
                      scale: overlayAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity activeOpacity={1}>
                {/* Header */}
                <View style={styles.overlayHeader}>
                  <Text style={styles.overlayTitle}>Student Details</Text>
                  <TouchableOpacity
                    onPress={closeOverlay}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Student Info */}
                {selectedStudent && (
                  <View style={styles.overlayStudentInfo}>
                    <View style={styles.overlayStudentAvatar}>
                      {selectedStudent.ppic ? (
                        <Image
                          source={{ uri: selectedStudent.ppic }}
                          style={styles.overlayAvatarImage}
                        />
                      ) : (
                        <Text style={styles.overlayAvatarText}>
                          {selectedStudent.name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.overlayStudentName}>
                      {selectedStudent.name}
                    </Text>
                    <Text style={styles.overlayStudentID}>
                      ID: {selectedStudent.studentID}
                    </Text>
                    {selectedStudent.className && (
                      <Text style={styles.overlayStudentClass}>
                        Class: {selectedStudent.className}
                      </Text>
                    )}
                  </View>
                )}

                {/* Emergency Contact Section */}
                <View style={styles.emergencySection}>
                  <View style={styles.emergencySectionHeader}>
                    <Ionicons name="alert-circle" size={20} color="#E53935" />
                    <Text style={styles.emergencySectionTitle}>
                      Emergency Contact
                    </Text>
                  </View>

                  {loadingParent ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#FF9800" />
                      <Text style={styles.loadingText}>
                        Loading parent info...
                      </Text>
                    </View>
                  ) : parentInfo ? (
                    <View style={styles.parentInfoContainer}>
                      <View style={styles.infoRow}>
                        <View style={styles.infoIconBg}>
                          <Ionicons name="person" size={20} color="#67BA03" />
                        </View>
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>Parent Name</Text>
                          <Text style={styles.infoValue}>
                            {parentInfo.fullName}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.infoRow}>
                        <View style={styles.infoIconBg}>
                          <Ionicons name="call" size={20} color="#2196F3" />
                        </View>
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>Phone Number</Text>
                          <Text style={styles.infoValue}>
                            {parentInfo.phone}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleCallParent}
                        style={styles.callButton}
                      >
                        <Ionicons name="call" size={20} color="#fff" />
                        <Text style={styles.callButtonText}>Call Parent</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.noParentInfo}>
                      <Ionicons
                        name="information-circle-outline"
                        size={48}
                        color="#ccc"
                      />
                      <Text style={styles.noParentText}>
                        No parent information available
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
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
    paddingVertical: 30,
    paddingHorizontal: 20,
    paddingTop: 50,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    height: 180,
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
    marginTop: 20,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarGlow: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    top: -5,
    left: -5,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "#E8F5E9",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 13,
    fontWeight: "500",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: "flex-start",
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    color: "#67BA03",
    fontWeight: "700",
  },
  notificationButton: {
    marginLeft: 10,
  },
  notificationIconContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    position: "relative",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#E53935",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  sectionHeader: {
    marginHorizontal: 20,
    marginTop: 30,
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
  pickupCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: "rgba(103, 186, 3, 0.1)",
  },
  pickupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pickupDetails: {
    gap: 10,
  },
  pickupDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pickupDetailText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  noPickupContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noPickupIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  noPickupTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  noPickupSubtitle: {
    fontSize: 13,
    color: "#999",
    marginBottom: 16,
  },
  queueButtonHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F9E8",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  queueButtonHintText: {
    fontSize: 13,
    color: "#67BA03",
    fontWeight: "600",
  },
  studentsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: "rgba(255, 152, 0, 0.1)",
  },
  studentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  studentsIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FFF3E0",
    alignItems: "center",
    justifyContent: "center",
  },
  studentsTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
  },
  studentsSubtitle: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: "center",
  },
  studentList: {
    gap: 0,
  },
  studentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF3E0",
    alignItems: "center",
    justifyContent: "center",
  },
  studentAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  studentAvatarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF9800",
  },
  studentName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  studentID: {
    fontSize: 12,
    color: "#999",
  },
  studentClass: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  studentDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 0,
  },
  noDataContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
  },
  studentsFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    alignItems: "center",
    marginTop: 12,
  },
  studentsFooterText: {
    fontSize: 12,
    color: "#FF9800",
    fontWeight: "500",
  },
  // Overlay Styles
  overlayContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  overlayContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  overlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayStudentInfo: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  overlayStudentAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF3E0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#FF9800",
  },
  overlayAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  overlayAvatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FF9800",
  },
  overlayStudentName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  overlayStudentID: {
    fontSize: 14,
    color: "#999",
    marginBottom: 4,
  },
  overlayStudentClass: {
    fontSize: 13,
    color: "#666",
  },
  emergencySection: {
    padding: 24,
  },
  emergencySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  emergencySectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#E53935",
  },
  parentInfoContainer: {
    gap: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8F9FA",
    padding: 16,
    borderRadius: 12,
  },
  infoIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  callButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  noParentInfo: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noParentText: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
    textAlign: "center",
  },
  loadingText: {
    fontSize: 13,
    color: "#999",
    marginTop: 8,
  },
});
