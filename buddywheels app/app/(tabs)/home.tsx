import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
//@ts-ignore
import { auth, db } from "../../firebaseConfig";

type ClassData = {
  classID: string;
  grade: number;
  className: string;
  teacherID: string;
  fullName?: string;
  studentCount: number;
};

export default function HomeScreen() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teacherID, setTeacherID] = useState<string>("");
  const [teacherData, setTeacherData] = useState<any>(null);
  const [selectedClassMenu, setSelectedClassMenu] = useState<string | null>(
    null
  );
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    fetchCurrentTeacher();
  }, []);

  // Real-time listener for teacher data
  useEffect(() => {
    //@ts-ignore
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setTeacherData(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for classes
  useEffect(() => {
    if (!teacherID) return;

    setLoading(true);

    const classesQuery = query(
      collection(db, "classes"),
      where("teacherID", "==", teacherID)
    );

    const unsubscribe = onSnapshot(
      classesQuery,
      async (classesSnapshot) => {
        try {
          const classesData: ClassData[] = await Promise.all(
            classesSnapshot.docs.map(async (doc) => {
              const data = doc.data();

              let fullName = "";
              if (data.teacherID) {
                const teacherQuery = query(
                  collection(db, "Teacher"),
                  where("id", "==", data.teacherID)
                );
                const teacherSnapshot = await getDocs(teacherQuery);
                if (!teacherSnapshot.empty) {
                  fullName = teacherSnapshot.docs[0].data().fullName || "";
                }
              }

              return {
                classID: data.classID,
                grade: data.grade,
                className: data.className,
                teacherID: data.teacherID,
                fullName,
                studentCount: data.studentCount || 0,
              };
            })
          );

          setClasses(classesData);
          setLoading(false);
        } catch (error) {
          console.error("Error processing classes:", error);
          Alert.alert("Error", "Failed to load classes");
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error fetching classes:", error);
        Alert.alert("Error", "Failed to load classes");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teacherID]);

  const fetchCurrentTeacher = async () => {
    try {
      //@ts-ignore
      const user = auth.currentUser;
      if (user && user.email) {
        const teacherQuery = query(
          collection(db, "Teacher"),
          where("email", "==", user.email)
        );
        const teacherSnapshot = await getDocs(teacherQuery);

        if (!teacherSnapshot.empty) {
          const teacherData = teacherSnapshot.docs[0].data();
          setTeacherID(teacherData.id);
        } else {
          Alert.alert("Error", "Teacher profile not found");
          setLoading(false);
        }
      } else {
        Alert.alert("Error", "No user logged in or email not available");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching teacher:", error);
      Alert.alert("Error", "Failed to load teacher profile");
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      setLoading(true);

      const classesQuery = query(
        collection(db, "classes"),
        where("teacherID", "==", teacherID)
      );
      const classesSnapshot = await getDocs(classesQuery);

      const classesData: ClassData[] = await Promise.all(
        classesSnapshot.docs.map(async (doc) => {
          const data = doc.data();

          let fullName = "";
          if (data.teacherID) {
            const teacherQuery = query(
              collection(db, "Teacher"),
              where("id", "==", data.teacherID)
            );
            const teacherSnapshot = await getDocs(teacherQuery);
            if (!teacherSnapshot.empty) {
              fullName = teacherSnapshot.docs[0].data().fullName || "";
            }
          }

          return {
            classID: data.classID,
            grade: data.grade,
            className: data.className,
            teacherID: data.teacherID,
            fullName,
            studentCount: data.studentCount || 0,
          };
        })
      );

      setClasses(classesData);
    } catch (error) {
      console.error("Error fetching classes:", error);
      Alert.alert("Error", "Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClasses();
    setTimeout(() => setRefreshing(false), 800);
  }, [fetchClasses]);

  const openAnalytics = (classID: string) => {
    setSelectedClassMenu(null);
    router.push({
      pathname: "/(tabs)/analytics/[classID]/page",
      params: { classID },
    });
  };

  const getCardGradient = (index: number) => {
    const gradients = [
      ["#67BA03", "#5AA002"],
      ["#5AA002", "#4D8902"],
      ["#72C308", "#67BA03"],
      ["#4D8902", "#3F7301"],
    ];
    return gradients[index % gradients.length];
  };

  // Calculate total students across all classes
  const totalStudents = classes.reduce((sum, cls) => sum + cls.studentCount, 0);

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
          {/* Decorative circles */}
          <View style={styles.circleDecor1} />
          <View style={styles.circleDecor2} />
          <View style={styles.circleDecor3} />

          <View style={styles.headerContent}>
            {/* Avatar with glow effect */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatarGlow} />
              <Image
                source={{
                  uri:
                    teacherData?.ppic ||
                    "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                }}
                style={styles.avatar}
              />
              <View style={styles.onlineIndicator} />
            </View>

            {/* Text content */}
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerSubtitle}>Welcome back,</Text>
              <Text style={styles.headerTitle}>
                {teacherData?.fullName || "Teacher"} 👋
              </Text>
              <View style={styles.roleBadge}>
                <Ionicons name="school" size={12} color="#67BA03" />
                <Text style={styles.roleText}>Teacher</Text>
              </View>
            </View>

            {/* Notification with badge */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/(tabs)/notification")}
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
          {/* Quick Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: "#E8F5E9" }]}>
                <Ionicons name="school" size={24} color="#67BA03" />
              </View>
              <Text style={styles.statValue}>{classes.length}</Text>
              <Text style={styles.statLabel}>Classes</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: "#E3F2FD" }]}>
                <Ionicons name="people" size={24} color="#2196F3" />
              </View>
              <Text style={styles.statValue}>{totalStudents}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
          </View>

          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Classes</Text>
            <View style={styles.sectionLine} />
          </View>

          {/* Classes List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#67BA03" />
              <Text style={styles.loadingText}>Loading classes...</Text>
            </View>
          ) : classes.length === 0 ? (
            <Animated.View
              style={[styles.emptyContainer, { opacity: fadeAnim }]}
            >
              <View style={styles.emptyIconContainer}>
                <Ionicons name="school-outline" size={64} color="#67BA03" />
              </View>
              <Text style={styles.emptyTitle}>No Classes Yet</Text>
              <Text style={styles.emptyText}>
                Your classes will appear here once they're assigned to you
              </Text>
            </Animated.View>
          ) : (
            <View style={styles.classesContainer}>
              {classes.map((classItem, index) => (
                <View key={classItem.classID} style={styles.cardWrapper}>
                  <TouchableOpacity
                    style={styles.cardTouchable}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/[classID]/page",
                        params: { classID: classItem.classID },
                      })
                    }
                  >
                    <LinearGradient
                      //@ts-ignore
                      colors={getCardGradient(index)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.classCard}
                    >
                      {/* Decorative Pattern Overlay */}
                      <View style={styles.patternOverlay}>
                        <View style={styles.classCircleDecor1} />
                        <View style={styles.classCircleDecor2} />
                      </View>

                      <View style={styles.cardContent}>
                        <View style={styles.classInfo}>
                          <View style={styles.gradeBadge}>
                            <Text style={styles.gradeBadgeText}>
                              Grade {classItem.grade}
                            </Text>
                          </View>
                          <Text style={styles.classTitle}>
                            {classItem.className}
                          </Text>
                          <View style={styles.teacherInfo}>
                            <Ionicons
                              name="person-circle-outline"
                              size={16}
                              color="rgba(255, 255, 255, 0.9)"
                            />
                            <Text style={styles.classSubtitle}>
                              {classItem.fullName || classItem.teacherID}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.studentInfo}>
                          <View style={styles.studentBadge}>
                            <Ionicons name="people" size={20} color="#67BA03" />
                            <Text style={styles.studentCount}>
                              {classItem.studentCount}
                            </Text>
                          </View>
                          <Text style={styles.studentLabel}>Students</Text>
                        </View>
                      </View>

                      {/* Arrow indicator */}
                      <View style={styles.arrowIndicator}>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#fff"
                        />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Three Dot Menu Button */}
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => setSelectedClassMenu(classItem.classID)}
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
                  </TouchableOpacity>

                  {/* Menu Modal */}
                  <Modal
                    visible={selectedClassMenu === classItem.classID}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setSelectedClassMenu(null)}
                  >
                    <TouchableOpacity
                      style={styles.modalOverlay}
                      activeOpacity={1}
                      onPress={() => setSelectedClassMenu(null)}
                    >
                      <View style={styles.menuContainer}>
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => openAnalytics(classItem.classID)}
                        >
                          <View style={styles.menuIconContainer}>
                            <Ionicons
                              name="analytics-outline"
                              size={22}
                              color="#67BA03"
                            />
                          </View>
                          <View style={styles.menuTextContainer}>
                            <Text style={styles.menuText}>Analytics</Text>
                            <Text style={styles.menuSubtext}>
                              View reports and insights
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color="#CCC"
                          />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </Modal>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
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
  statsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
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
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    backgroundColor: "#F0F9E8",
    borderRadius: 60,
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    color: "#999",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  classesContainer: {
    marginHorizontal: 20,
    gap: 16,
  },
  cardWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTouchable: {
    flex: 1,
  },
  classCard: {
    borderRadius: 20,
    padding: 20,
    minHeight: 140,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  patternOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  classCircleDecor1: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    top: -40,
    right: -20,
  },
  classCircleDecor2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    bottom: -20,
    left: -10,
  },
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 1,
  },
  classInfo: {
    flex: 1,
    paddingRight: 12,
  },
  gradeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  gradeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  classTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  teacherInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  classSubtitle: {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: 14,
  },
  studentInfo: {
    alignItems: "center",
    justifyContent: "center",
  },
  studentBadge: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  studentCount: {
    color: "#333",
    fontSize: 20,
    fontWeight: "bold",
  },
  studentLabel: {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: 12,
    fontWeight: "600",
  },
  arrowIndicator: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  menuButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 20,
    padding: 10,
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 8,
    minWidth: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  menuIconContainer: {
    backgroundColor: "#F0F9E8",
    borderRadius: 10,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTextContainer: {
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
    marginBottom: 2,
  },
  menuSubtext: {
    fontSize: 13,
    color: "#999",
  },
});
