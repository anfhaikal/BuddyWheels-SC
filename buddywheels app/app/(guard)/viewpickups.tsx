import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

interface Student {
  id: string;
  name: string;
  studentID: string;
  ppic?: string;
}

interface Pickup {
  id: string;
  plateNumber: string;
  status: "On the way" | "Arrived" | string;
  date: string;
  timeSlot: string;
  studentIDs: string[];
  driverID?: string;
  parentID?: string;
}

export default function ViewPickups() {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [filteredPickups, setFilteredPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<"All" | "On the way" | "Arrived">("All");
  const [searchText, setSearchText] = useState("");
  const [selectedPickup, setSelectedPickup] = useState<Pickup | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scrollViewRef = useRef<ScrollView>(null);

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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-MY", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kuala_Lumpur",
    });
  };

  const sortPickups = (list: Pickup[]) => {
    return list.sort((a, b) => {
      const statusOrder = { Arrived: 0, "On the way": 1 };
      const statusCompare =
        //@ts-ignore
        (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
      if (statusCompare !== 0) return statusCompare;
      return a.timeSlot.localeCompare(b.timeSlot);
    });
  };

  const filterAndSortPickups = (
    list: Pickup[],
    statusFilter: typeof filter,
    search?: string
  ) => {
    let filtered = list;

    if (statusFilter !== "All")
      filtered = filtered.filter((p) => p.status === statusFilter);

    if (search && search.trim() !== "") {
      const text = search.trim().toLowerCase();
      filtered = filtered.filter((p) => {
        // Check plate number
        if (p.plateNumber.toLowerCase().includes(text)) {
          return true;
        }

        // Check student names
        return p.studentIDs.some((studentID) => {
          const student = allStudents.find((s) => s.studentID === studentID);
          return student?.name.toLowerCase().includes(text);
        });
      });
    }

    return sortPickups(filtered);
  };

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      setLoading(true);
      setCurrentDate(new Date());
      setFilter("All");
      setSearchText("");

      fadeAnim.setValue(0);
      slideAnim.setValue(50);
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

      // Fetch all students for search purposes
      const fetchAllStudents = async () => {
        try {
          const studentsSnapshot = await getDocs(collection(db, "students"));
          const studentsData: Student[] = [];
          studentsSnapshot.forEach((doc) => {
            const data = doc.data();
            studentsData.push({
              id: doc.id,
              name: data.name,
              studentID: data.studentID,
              ppic: data.ppic,
            });
          });
          setAllStudents(studentsData);
        } catch (error) {
          console.error("Error fetching all students:", error);
        }
      };

      fetchAllStudents();

      const todayStr = getMalaysiaDateString(new Date());
      const q = query(collection(db, "pickups"), where("date", "==", todayStr));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const todayPickups: Pickup[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Pickup;
          if (data.status === "On the way" || data.status === "Arrived") {
            todayPickups.push({ ...data, id: doc.id });
          }
        });
        const sortedPickups = sortPickups(todayPickups);
        setPickups(sortedPickups);
        setFilteredPickups(filterAndSortPickups(sortedPickups, "All"));
        setLoading(false);
      });

      return () => unsubscribe();
    }, [])
  );

  const handleFilterChange = (status: "All" | "On the way" | "Arrived") => {
    setFilter(status);
    setFilteredPickups(filterAndSortPickups(pickups, status, searchText));
  };

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    setFilteredPickups(filterAndSortPickups(pickups, filter, text));
  };

  const handlePickupPress = async (pickup: Pickup) => {
    setSelectedPickup(pickup);
    setLoadingStudents(true);

    try {
      const studentsData: Student[] = [];

      for (const studentID of pickup.studentIDs) {
        const studentQuery = query(
          collection(db, "students"),
          where("studentID", "==", studentID)
        );
        const studentSnap = await getDocs(studentQuery);

        studentSnap.forEach((doc) => {
          const data = doc.data();
          studentsData.push({
            id: doc.id,
            name: data.name,
            studentID: data.studentID,
            ppic: data.ppic,
          });
        });
      }

      setStudents(studentsData);
    } catch (error) {
      console.error("Error fetching students:", error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "On the way":
        return "#FF9800";
      case "Arrived":
        return "#4CAF50";
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
      default:
        return "#F5F5F5";
    }
  };

  const renderPickupCard = ({ item }: { item: Pickup }) => (
    <TouchableOpacity
      style={styles.pickupCard}
      onPress={() => handlePickupPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardLeft}>
          <View style={styles.plateIconBg}>
            <Ionicons name="car-sport" size={28} color="#67BA03" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.plateNumber}>{item.plateNumber}</Text>
            <Text style={styles.timeSlot}>
              <Ionicons name="time-outline" size={12} color="#999" />{" "}
              {item.timeSlot}
            </Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusBgColor(item.status) },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(item.status) },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {item.status}
            </Text>
          </View>

          <View style={styles.studentCount}>
            <Ionicons name="people" size={16} color="#666" />
            <Text style={styles.studentCountText}>
              {item.studentIDs.length}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#999" />
        </View>
      </View>
    </TouchableOpacity>
  );

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
            <Text style={styles.headerTitle}>View Pickups</Text>
          </View>
        </LinearGradient>

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.dateCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.dateHeader}>
              <View style={styles.dateIconBg}>
                <Ionicons name="calendar-outline" size={24} color="#67BA03" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>Today's Date</Text>
                <Text style={styles.dateText}>{formatDate(currentDate)}</Text>
              </View>
            </View>
            <View style={styles.reminderBox}>
              <Ionicons name="alert-circle" size={20} color="#FF9800" />
              <Text style={styles.reminderText}>
                Pickup schedule resets daily at midnight.
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.filterHeader}>
              <Text style={styles.filterLabel}>Filter by Status</Text>
              <View style={styles.vehicleCountBadge}>
                <Text style={styles.vehicleCountText}>
                  {filteredPickups.length} vehicle
                  {filteredPickups.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            <View style={styles.filterContainer}>
              {(["All", "On the way", "Arrived"] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterButton,
                    filter === status && styles.filterButtonActive,
                  ]}
                  onPress={() => handleFilterChange(status)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filter === status && styles.filterButtonTextActive,
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by plate or student name"
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={handleSearchChange}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => handleSearchChange("")}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#67BA03" />
              <Text style={styles.loadingText}>Loading pickups...</Text>
            </View>
          ) : filteredPickups.length === 0 ? (
            <Animated.View
              style={[
                styles.emptyState,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Ionicons name="car-outline" size={64} color="#E0E0E0" />
              <Text style={styles.emptyStateText}>
                {searchText
                  ? "No pickups match your search"
                  : "No ongoing pickups for today"}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {searchText
                  ? "Try adjusting your search criteria"
                  : "Pickups will appear here when drivers are on the way"}
              </Text>
            </Animated.View>
          ) : (
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              <FlatList
                data={filteredPickups}
                keyExtractor={(item) => item.id}
                renderItem={renderPickupCard}
                scrollEnabled={false}
                contentContainerStyle={styles.listContainer}
              />
            </Animated.View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>

        <Modal
          visible={selectedPickup !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedPickup(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>
                    {selectedPickup?.plateNumber}
                  </Text>
                  <View style={styles.modalSubtitle}>
                    <Ionicons name="time-outline" size={14} color="#666" />
                    <Text style={styles.modalTimeText}>
                      {selectedPickup?.timeSlot}
                    </Text>
                    <View
                      style={[
                        styles.modalStatusBadge,
                        {
                          backgroundColor: getStatusBgColor(
                            selectedPickup?.status || ""
                          ),
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: getStatusColor(
                              selectedPickup?.status || ""
                            ),
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.modalStatusText,
                          {
                            color: getStatusColor(selectedPickup?.status || ""),
                          },
                        ]}
                      >
                        {selectedPickup?.status}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedPickup(null)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.studentsHeader}>
                  <View style={styles.studentsHeaderLeft}>
                    <Ionicons name="people" size={20} color="#67BA03" />
                    <Text style={styles.studentsHeaderText}>
                      Students ({students.length})
                    </Text>
                  </View>
                </View>

                {loadingStudents ? (
                  <View style={styles.modalLoadingContainer}>
                    <ActivityIndicator size="small" color="#67BA03" />
                    <Text style={styles.modalLoadingText}>
                      Loading students...
                    </Text>
                  </View>
                ) : students.length === 0 ? (
                  <View style={styles.modalEmptyState}>
                    <Ionicons name="people-outline" size={48} color="#E0E0E0" />
                    <Text style={styles.modalEmptyText}>
                      No student information available
                    </Text>
                  </View>
                ) : (
                  <View style={styles.studentsList}>
                    {students.map((student) => (
                      <View key={student.id} style={styles.studentItem}>
                        <View style={styles.studentAvatar}>
                          <Text style={styles.studentAvatarText}>
                            {student.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentName}>{student.name}</Text>
                          <Text style={styles.studentID}>
                            ID: {student.studentID}
                          </Text>
                        </View>
                        <View style={styles.checkBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={24}
                            color="#4CAF50"
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
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
    justifyContent: "center",
    zIndex: 1,
    marginTop: 60,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  dateCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: "rgba(103, 186, 3, 0.1)",
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  dateIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabel: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  reminderBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF3E0",
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  reminderText: {
    fontSize: 13,
    color: "#E65100",
    flex: 1,
    lineHeight: 20,
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
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  vehicleCountBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vehicleCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#67BA03",
  },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#67BA03",
    borderColor: "#67BA03",
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  filterButtonTextActive: {
    color: "#fff",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    padding: 0,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#999",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 4,
  },
  listContainer: {
    gap: 12,
    paddingBottom: 16,
  },
  pickupCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  plateIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  plateNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  timeSlot: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  studentCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  studentCountText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "80%",
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  modalSubtitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTimeText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  modalStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  modalStatusText: {
    fontSize: 11,
    fontWeight: "600",
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
  studentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  studentsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  studentsHeaderText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  modalLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 13,
    color: "#999",
  },
  modalEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  modalEmptyText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  studentsList: {
    gap: 12,
  },
  studentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  studentAvatarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#67BA03",
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
  checkBadge: {
    opacity: 0.6,
  },
});
