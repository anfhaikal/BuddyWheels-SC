import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { db } from "../../../../firebaseConfig";

type ExcuseLetter = {
  id: string;
  studentID: string;
  studentName: string;
  className: string;
  date: string;
  file?: string;
  fileName?: string;
  reason?: string;
  status: "Pending" | "Approved" | "Denied";
  time: string;
  teacherComment?: string;
};

type FilterType = "All" | "Pending" | "Approved" | "Denied";

type GroupedLetters = {
  [key: string]: ExcuseLetter[];
};

export default function ExcuseLetterDashboard() {
  const { classID } = useLocalSearchParams<{ classID: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [excuseLetters, setExcuseLetters] = useState<ExcuseLetter[]>([]);
  const [filteredLetters, setFilteredLetters] = useState<ExcuseLetter[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<ExcuseLetter | null>(
    null
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [comment, setComment] = useState("");

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
    if (!classID) {
      console.log("❌ No classID provided");
      setLoading(false);
      return;
    }

    console.log("📌 Starting fetch for classID:", classID);

    let unsubscribeExcuse: (() => void) | undefined;

    const fetchExcuseLetters = async () => {
      try {
        const studentQuery = query(
          collection(db, "students"),
          where("classID", "==", classID)
        );
        const studentSnapshot = await getDocs(studentQuery);

        console.log(
          `📊 Found ${studentSnapshot.size} students in class ${classID}`
        );

        const studentMap = new Map();
        studentSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          studentMap.set(data.studentID, data.name);
          console.log(`👤 Student: ${data.studentID} -> ${data.name}`);
        });

        const classQuery = query(
          collection(db, "classes"),
          where("classID", "==", classID)
        );
        const classSnapshot = await getDocs(classQuery);
        let className = "Unknown Class";
        if (!classSnapshot.empty) {
          const classData = classSnapshot.docs[0].data();
          className = `${classData.grade} ${classData.className}`;
          console.log(`🏫 Class name: ${className}`);
        } else {
          console.log("⚠️ No class found with classID:", classID);
        }

        const excuseQuery = query(
          collection(db, "excuseLetter"),
          where("classID", "==", classID)
        );

        console.log(
          "🔍 Setting up listener for excuse letters with classID:",
          classID
        );

        unsubscribeExcuse = onSnapshot(
          excuseQuery,
          (snapshot) => {
            console.log(
              `📬 Received ${snapshot.size} excuse letters from Firestore`
            );

            const letters: ExcuseLetter[] = [];

            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              console.log(`📄 Excuse letter doc ID: ${docSnap.id}`, {
                studentID: data.studentID,
                classID: data.classID,
                status: data.status,
                date: data.date,
              });

              const studentName =
                studentMap.get(data.studentID) || "Unknown Student";

              letters.push({
                id: docSnap.id,
                studentID: data.studentID,
                studentName,
                className,
                date: data.date,
                file: data.file,
                fileName: data.fileName,
                reason: data.reason,
                status: data.status || "Pending",
                time: data.time,
                teacherComment: data.teacherComment,
              });
            });

            letters.sort((a, b) => {
              if (a.status === "Pending" && b.status !== "Pending") return -1;
              if (a.status !== "Pending" && b.status === "Pending") return 1;
              return new Date(b.time).getTime() - new Date(a.time).getTime();
            });

            console.log(`✅ Total excuse letters processed: ${letters.length}`);
            setExcuseLetters(letters);
            setLoading(false);
          },
          (error) => {
            console.error("❌ Error in excuse letter listener:", error);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error("❌ Error fetching excuse letters:", error);
        setLoading(false);
      }
    };

    fetchExcuseLetters();

    return () => {
      if (unsubscribeExcuse) {
        unsubscribeExcuse();
      }
    };
  }, [classID]);

  useEffect(() => {
    let filtered = excuseLetters;

    if (selectedFilter !== "All") {
      filtered = filtered.filter((letter) => letter.status === selectedFilter);
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (letter) =>
          letter.studentName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          letter.date.includes(searchQuery)
      );
    }

    setFilteredLetters(filtered);
  }, [excuseLetters, selectedFilter, searchQuery]);

  const getDateLabel = (dateString: string): string => {
    const letterDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time to compare dates only
    letterDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    if (letterDate.getTime() === today.getTime()) {
      return "Today";
    } else if (letterDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      return formatDateHeader(dateString);
    }
  };

  const groupLettersByDate = (letters: ExcuseLetter[]): GroupedLetters => {
    const grouped: GroupedLetters = {};

    letters.forEach((letter) => {
      const dateLabel = getDateLabel(letter.date);
      if (!grouped[dateLabel]) {
        grouped[dateLabel] = [];
      }
      grouped[dateLabel].push(letter);
    });

    return grouped;
  };

  const openDetailModal = (letter: ExcuseLetter) => {
    setSelectedLetter(letter);
    setComment(letter.teacherComment || "");
    setShowPdf(false);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedLetter(null);
    setShowPdf(false);
    setComment("");
  };

  const updateExcuseStatus = async (newStatus: "Approved" | "Denied") => {
    if (!selectedLetter) return;

    try {
      const docRef = doc(db, "excuseLetter", selectedLetter.id);
      await setDoc(
        docRef,
        {
          status: newStatus,
          teacherComment: comment || "",
        },
        { merge: true }
      );

      Alert.alert("Success", `Excuse letter ${newStatus.toLowerCase()}.`);
      closeDetailModal();
    } catch (err) {
      console.error("Error updating status:", err);
      Alert.alert("Error", "Failed to update excuse letter status.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "#FF9800";
      case "Approved":
        return "#4CAF50";
      case "Denied":
        return "#E53935";
      default:
        return "#999";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pending":
        return "time-outline";
      case "Approved":
        return "checkmark-circle";
      case "Denied":
        return "close-circle";
      default:
        return "help-circle";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-MY", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-MY", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-MY", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pendingCount = excuseLetters.filter(
    (l) => l.status === "Pending"
  ).length;
  const approvedCount = excuseLetters.filter(
    (l) => l.status === "Approved"
  ).length;
  const deniedCount = excuseLetters.filter((l) => l.status === "Denied").length;

  const groupedLetters = groupLettersByDate(filteredLetters);
  const dateGroups = Object.keys(groupedLetters);

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
              <TouchableOpacity
                onPress={() => router.push(`/(tabs)/excuseLetter`)}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Excuse Letters</Text>
              <View style={styles.headerPlaceholder} />
            </View>
          </LinearGradient>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#67BA03" />
            <Text style={styles.loadingText}>Loading excuse letters...</Text>
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
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/excuseLetter")}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Excuse Letters</Text>
            <View style={styles.headerPlaceholder} />
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Statistics Cards */}
          <View style={styles.statsContainer}>
            <Animated.View
              style={[
                styles.statCard,
                { backgroundColor: "#FFF3E0" },
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.statIconBg}>
                <Ionicons name="time-outline" size={28} color="#FF9800" />
              </View>
              <Text style={[styles.statNumber, { color: "#FF9800" }]}>
                {pendingCount}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.statCard,
                { backgroundColor: "#E8F5E9" },
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.statIconBg}>
                <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
              </View>
              <Text style={[styles.statNumber, { color: "#4CAF50" }]}>
                {approvedCount}
              </Text>
              <Text style={styles.statLabel}>Approved</Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.statCard,
                { backgroundColor: "#FFEBEE" },
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.statIconBg}>
                <Ionicons name="close-circle" size={28} color="#E53935" />
              </View>
              <Text style={[styles.statNumber, { color: "#E53935" }]}>
                {deniedCount}
              </Text>
              <Text style={styles.statLabel}>Denied</Text>
            </Animated.View>
          </View>

          {/* Search Bar */}
          <Animated.View
            style={[
              styles.searchContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by student name or date..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterContainer}
          >
            {(["All", "Pending", "Approved", "Denied"] as FilterType[]).map(
              (filter) => (
                <Animated.View
                  key={filter}
                  style={{
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.filterTab,
                      selectedFilter === filter && styles.filterTabActive,
                    ]}
                    onPress={() => setSelectedFilter(filter)}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        selectedFilter === filter && styles.filterTabTextActive,
                      ]}
                    >
                      {filter}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )
            )}
          </ScrollView>

          {/* Excuse Letters List - Grouped by Date */}
          {dateGroups.length === 0 ? (
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
                <Ionicons
                  name="document-text-outline"
                  size={64}
                  color="#67BA03"
                />
              </View>
              <Text style={styles.emptyTitle}>No Letters Found</Text>
              <Text style={styles.emptyText}>
                {selectedFilter !== "All"
                  ? `No ${selectedFilter.toLowerCase()} letters for this class`
                  : "No excuse letters submitted yet"}
              </Text>
            </Animated.View>
          ) : (
            dateGroups.map((dateLabel) => (
              <View key={dateLabel}>
                {/* Date Header */}
                <Animated.View
                  style={[
                    styles.dateHeader,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                    },
                  ]}
                >
                  <View style={styles.dateHeaderLine} />
                  <Text style={styles.dateHeaderText}>{dateLabel}</Text>
                  <View style={styles.dateHeaderLine} />
                </Animated.View>

                {/* Letters for this date */}
                {groupedLetters[dateLabel].map((letter) => (
                  <Animated.View
                    key={letter.id}
                    style={{
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                    }}
                  >
                    <TouchableOpacity
                      style={styles.letterCard}
                      onPress={() => openDetailModal(letter)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.letterHeader}>
                        <View style={styles.studentIconBg}>
                          <Ionicons name="person" size={24} color="#67BA03" />
                        </View>

                        <View style={styles.letterInfo}>
                          <Text style={styles.studentName}>
                            {letter.studentName}
                          </Text>
                          <Text style={styles.className}>
                            {letter.className}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusColor(letter.status) },
                          ]}
                        >
                          <Ionicons
                            name={getStatusIcon(letter.status) as any}
                            size={14}
                            color="#fff"
                          />
                          <Text style={styles.statusText}>{letter.status}</Text>
                        </View>
                      </View>

                      <View style={styles.letterDetails}>
                        <View style={styles.detailRow}>
                          <Ionicons
                            name="calendar-outline"
                            size={16}
                            color="#999"
                          />
                          <Text style={styles.detailText}>
                            <Text style={{ fontWeight: "bold" }}>
                              Absent on:{" "}
                            </Text>
                            {formatDate(letter.date)}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons
                            name="time-outline"
                            size={16}
                            color="#999"
                          />
                          <Text style={styles.detailText}>
                            <Text style={{ fontWeight: "bold" }}>
                              Submitted on:{" "}
                            </Text>
                            {formatDateTime(letter.time)}
                          </Text>
                        </View>
                        {letter.fileName && (
                          <View style={styles.detailRow}>
                            <Ionicons
                              name="document-attach"
                              size={16}
                              color="#999"
                            />
                            <Text style={styles.detailText} numberOfLines={1}>
                              {letter.fileName}
                            </Text>
                          </View>
                        )}
                      </View>

                      {letter.reason && (
                        <View style={styles.reasonContainer}>
                          <Text style={styles.reasonLabel}>Reason:</Text>
                          <Text style={styles.reasonText} numberOfLines={2}>
                            {letter.reason}
                          </Text>
                        </View>
                      )}

                      <View style={styles.arrowIndicator}>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#999"
                        />
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            ))
          )}

          <View style={{ height: 30 }} />
        </ScrollView>

        {/* Detail Modal */}
        <Modal
          visible={showDetailModal}
          animationType="slide"
          transparent={true}
          onRequestClose={closeDetailModal}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Letter Details</Text>
                <TouchableOpacity
                  onPress={closeDetailModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
              >
                {selectedLetter && (
                  <>
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Student Name</Text>
                      <View style={styles.detailValueBox}>
                        <Ionicons name="person" size={18} color="#67BA03" />
                        <Text style={styles.detailValue}>
                          {selectedLetter.studentName}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Class</Text>
                      <View style={styles.detailValueBox}>
                        <Ionicons name="school" size={18} color="#2196F3" />
                        <Text style={styles.detailValue}>
                          {selectedLetter.className}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Absent Date</Text>
                      <View style={styles.detailValueBox}>
                        <Ionicons name="calendar" size={18} color="#FF9800" />
                        <Text style={styles.detailValue}>
                          {formatDate(selectedLetter.date)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Submitted On</Text>
                      <View style={styles.detailValueBox}>
                        <Ionicons name="time" size={18} color="#9C27B0" />
                        <Text style={styles.detailValue}>
                          {formatDateTime(selectedLetter.time)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Status</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          styles.statusBadgeLarge,
                          {
                            backgroundColor: getStatusColor(
                              selectedLetter.status
                            ),
                          },
                        ]}
                      >
                        <Ionicons
                          name={getStatusIcon(selectedLetter.status) as any}
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.statusTextLarge}>
                          {selectedLetter.status}
                        </Text>
                      </View>
                    </View>

                    {selectedLetter.reason && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Reason</Text>
                        <View style={styles.reasonBox}>
                          <Text style={styles.reasonFullText}>
                            {selectedLetter.reason}
                          </Text>
                        </View>
                      </View>
                    )}

                    {selectedLetter.fileName && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Attachment</Text>
                        <TouchableOpacity
                          onPress={() => setShowPdf(!showPdf)}
                          style={styles.attachmentButton}
                        >
                          <Ionicons
                            name="document-text"
                            size={20}
                            color="#67BA03"
                          />
                          <Text style={styles.attachmentText}>
                            {selectedLetter.fileName}
                          </Text>
                          <Ionicons
                            name={showPdf ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#67BA03"
                          />
                        </TouchableOpacity>
                      </View>
                    )}

                    {showPdf && selectedLetter.file && (
                      <View style={styles.pdfContainer}>
                        <WebView
                          originWhitelist={["*"]}
                          source={{
                            uri: `data:application/pdf;base64,${selectedLetter.file}`,
                          }}
                          style={styles.pdfViewer}
                        />
                      </View>
                    )}

                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Teacher Comments</Text>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Add your comments..."
                        placeholderTextColor="#999"
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        numberOfLines={4}
                      />
                    </View>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() =>
                          Alert.alert(
                            "Approve",
                            "Approve this excuse letter?",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Approve",
                                onPress: () => updateExcuseStatus("Approved"),
                              },
                            ]
                          )
                        }
                      >
                        <LinearGradient
                          colors={["#4CAF50", "#45A049"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.actionButtonGradient}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color="#fff"
                          />
                          <Text style={styles.actionButtonText}>APPROVE</Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.denyButton}
                        onPress={() =>
                          Alert.alert("Deny", "Deny this excuse letter?", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Deny",
                              onPress: () => updateExcuseStatus("Denied"),
                            },
                          ])
                        }
                      >
                        <LinearGradient
                          colors={["#E53935", "#D32F2F"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.actionButtonGradient}
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color="#fff"
                          />
                          <Text style={styles.actionButtonText}>DENY</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
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
  statsContainer: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  statIconBg: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: "#333",
  },
  filterContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
  },
  filterTabActive: {
    backgroundColor: "#67BA03",
    borderColor: "#67BA03",
  },
  filterTabText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  filterTabTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 12,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dateHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#67BA03",
    paddingHorizontal: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
    lineHeight: 22,
  },
  letterCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    position: "relative",
  },
  letterHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  studentIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  letterInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 2,
  },
  className: {
    fontSize: 13,
    color: "#999",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  statusTextLarge: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  letterDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  reasonContainer: {
    backgroundColor: "#F5F7FA",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  reasonLabel: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 20,
  },
  arrowIndicator: {
    position: "absolute",
    bottom: 16,
    right: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "90%",
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
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 13,
    color: "#999",
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValueBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  detailValue: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },
  reasonBox: {
    backgroundColor: "#F5F7FA",
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#67BA03",
  },
  reasonFullText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 22,
  },
  attachmentButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  attachmentText: {
    flex: 1,
    fontSize: 14,
    color: "#67BA03",
    fontWeight: "600",
  },
  pdfContainer: {
    height: 400,
    marginBottom: 20,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  pdfViewer: {
    flex: 1,
  },
  commentInput: {
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#333",
    textAlignVertical: "top",
    minHeight: 100,
    backgroundColor: "#fff",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  approveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  denyButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  actionButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },
  circleDecor2: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    top: -20,
    right: -20,
  },
});
