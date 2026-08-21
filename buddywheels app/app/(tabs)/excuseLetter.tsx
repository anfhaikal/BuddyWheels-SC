import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

type ClassInfo = {
  classID: string;
  grade: number;
  className: string;
  pendingCount: number;
};

export default function ExcuseLetterClassSelector() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!currentUser) {
      console.log("❌ No user logged in");
      setLoading(false);
      return;
    }

    let unsubscribeClasses: (() => void) | undefined;
    let excuseUnsubscribers: (() => void)[] = [];

    const setupRealtimeListeners = async () => {
      try {
        // Step 1: Get teacher's ID from users collection
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          console.log("❌ No user document found");
          setLoading(false);
          return;
        }

        const userData = userDocSnap.data();
        const teacherID = userData.id;

        console.log("👨‍🏫 Teacher ID:", teacherID);

        // Step 2: Set up real-time listener for classes
        const classQuery = query(
          collection(db, "classes"),
          where("teacherID", "==", teacherID)
        );

        unsubscribeClasses = onSnapshot(classQuery, (classSnapshot) => {
          console.log(`📚 Found ${classSnapshot.size} classes`);

          // Clean up previous excuse letter listeners
          excuseUnsubscribers.forEach((unsub) => unsub());
          excuseUnsubscribers = [];

          const classDataList = classSnapshot.docs.map((doc) => ({
            classID: doc.data().classID,
            grade: doc.data().grade,
            className: doc.data().className,
          }));

          // Step 3: For each class, set up real-time listener for pending excuse letters
          const tempClasses: ClassInfo[] = [];
          const pendingCounts: Record<string, number> = {};

          classDataList.forEach((classData) => {
            const excuseQuery = query(
              collection(db, "excuseLetter"),
              where("classID", "==", classData.classID),
              where("status", "==", "Pending")
            );

            const unsubExcuse = onSnapshot(excuseQuery, (excuseSnapshot) => {
              // Update pending count for this class
              pendingCounts[classData.classID] = excuseSnapshot.size;

              console.log(
                `📬 Class ${classData.classID}: ${excuseSnapshot.size} pending letters`
              );

              // Rebuild the classes array with updated counts
              const updatedClasses = classDataList.map((cls) => ({
                classID: cls.classID,
                grade: cls.grade,
                className: cls.className,
                pendingCount: pendingCounts[cls.classID] || 0,
              }));

              setClasses(updatedClasses);
              setLoading(false);
            });

            excuseUnsubscribers.push(unsubExcuse);
          });

          // If no classes, set loading to false
          if (classDataList.length === 0) {
            setClasses([]);
            setLoading(false);
          }
        });
      } catch (error) {
        console.error("❌ Error setting up listeners:", error);
        setLoading(false);
      }
    };

    setupRealtimeListeners();

    // Cleanup function
    return () => {
      if (unsubscribeClasses) {
        unsubscribeClasses();
      }
      excuseUnsubscribers.forEach((unsub) => unsub());
    };
  }, [currentUser]);

  const navigateToDashboard = (classID: string) => {
    router.push(`/(tabs)/excuseLetter/${classID}/page`);
  };

  // Calculate total pending letters
  const totalPending = classes.reduce((sum, cls) => sum + cls.pendingCount, 0);

  if (loading) {
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
              <Text style={styles.headerTitle}>Excuse Letters</Text>
              <View style={styles.headerPlaceholder} />
            </View>
          </LinearGradient>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#67BA03" />
            <Text style={styles.loadingText}>Loading classes...</Text>
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
            <View style={styles.headerPlaceholder} />
            <Text style={styles.headerTitle}>Excuse Letters</Text>
            <View style={styles.headerPlaceholder} />
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Stats Card */}
          <Animated.View
            style={[
              styles.statsCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.statsIconBg}>
              <Ionicons name="mail" size={32} color="#FF9800" />
            </View>
            <View style={styles.statsInfo}>
              <Text style={styles.statsValue}>{totalPending}</Text>
              <Text style={styles.statsLabel}>Pending Letters</Text>
            </View>
            <View style={styles.statsIconBg2}>
              <Ionicons name="school" size={28} color="#67BA03" />
            </View>
            <View style={styles.statsInfo}>
              <Text style={styles.statsValue}>{classes.length}</Text>
              <Text style={styles.statsLabel}>Total Classes</Text>
            </View>
          </Animated.View>

          {/* Info Card */}
          <Animated.View
            style={[
              styles.infoCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.infoIconBg}>
              <Ionicons name="information-circle" size={24} color="#2196F3" />
            </View>
            <Text style={styles.infoText}>
              Select a class to view and manage excuse letters
            </Text>
          </Animated.View>

          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Classes</Text>
            <View style={styles.sectionLine} />
          </View>

          {classes.length === 0 ? (
            <Animated.View
              style={[
                styles.emptyContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.emptyIconContainer}>
                <Ionicons name="school-outline" size={64} color="#67BA03" />
              </View>
              <Text style={styles.emptyTitle}>No Classes Assigned</Text>
              <Text style={styles.emptyText}>
                You don't have any classes assigned yet
              </Text>
            </Animated.View>
          ) : (
            <View style={styles.classList}>
              {classes.map((classInfo, index) => (
                <Animated.View
                  key={classInfo.classID}
                  style={{
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }}
                >
                  <TouchableOpacity
                    style={styles.classCard}
                    onPress={() => navigateToDashboard(classInfo.classID)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={
                        index % 2 === 0
                          ? ["#67BA03", "#5AA002"]
                          : ["#5AA002", "#4D8902"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.classGradient}
                    >
                      {/* Decorative Pattern */}
                      <View style={styles.classPattern}>
                        <View style={styles.classCircle1} />
                        <View style={styles.classCircle2} />
                      </View>

                      <View style={styles.classContent}>
                        <View style={styles.classIconContainer}>
                          <View style={styles.classIconBg}>
                            <Ionicons name="book" size={28} color="#67BA03" />
                          </View>
                        </View>

                        <View style={styles.classInfo}>
                          <View style={styles.gradeBadge}>
                            <Text style={styles.gradeBadgeText}>
                              Grade {classInfo.grade}
                            </Text>
                          </View>
                          <Text style={styles.className}>
                            {classInfo.className}
                          </Text>
                          <Text style={styles.classID}>
                            ID: {classInfo.classID}
                          </Text>
                        </View>

                        <View style={styles.classActions}>
                          {classInfo.pendingCount > 0 && (
                            <View style={styles.pendingBadge}>
                              <Ionicons
                                name="mail-unread"
                                size={14}
                                color="#fff"
                              />
                              <Text style={styles.badgeText}>
                                {classInfo.pendingCount}
                              </Text>
                            </View>
                          )}
                          <View style={styles.arrowButton}>
                            <Ionicons
                              name="chevron-forward"
                              size={20}
                              color="#fff"
                            />
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
    marginTop: 8,
  },
  headerPlaceholder: {
    width: 40,
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
  scrollContent: {
    padding: 20,
  },
  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statsIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFF3E0",
    alignItems: "center",
    justifyContent: "center",
  },
  statsIconBg2: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  statsInfo: {
    alignItems: "center",
    gap: 4,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  statsLabel: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  infoCard: {
    backgroundColor: "#E3F2FD",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#90CAF9",
  },
  infoIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#1565C0",
    fontWeight: "500",
    lineHeight: 20,
  },
  sectionHeader: {
    marginTop: 8,
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
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
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
  },
  classList: {
    gap: 16,
  },
  classCard: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  classGradient: {
    borderRadius: 20,
    overflow: "hidden",
  },
  classPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  classCircle1: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    top: -30,
    right: -20,
  },
  classCircle2: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    bottom: -20,
    left: -10,
  },
  classContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    zIndex: 1,
  },
  classIconContainer: {
    marginRight: 16,
  },
  classIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classInfo: {
    flex: 1,
  },
  gradeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  gradeBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  className: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  classID: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
  },
  classActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  pendingBadge: {
    backgroundColor: "#FF9800",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
});
