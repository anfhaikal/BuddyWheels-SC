import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../firebaseConfig";

type Student = {
  id: string;
  studentID: string;
  name: string;
  status: "Present" | "Absent";
};

type ClassInfo = {
  grade: number;
  className: string;
  teacherName: string;
};

type ExcuseLetter = {
  studentID: string;
  name: string;
  date: string;
  file: string;
  fileName: string;
  reason: string;
  time: string;
  status: string;
};

export default function ClassAttendanceScreen() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [comment, setComment] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // New states for excuse letter
  const [excuseLetter, setExcuseLetter] = useState<ExcuseLetter | null>(null);
  const [submissionReview, setSubmissionReview] =
    useState<string>("No submission yet");
  const [timeRemainingText, setTimeRemainingText] = useState<string>("—");

  const slideAnim = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;

  const studentsPerPage = 10;
  const totalPages = Math.ceil(students.length / studentsPerPage);
  const startIdx = (page - 1) * studentsPerPage;
  const currentStudents = students.slice(startIdx, startIdx + studentsPerPage);

  const presentCount = students.filter((s) => s.status === "Present").length;
  const absentCount = students.filter((s) => s.status === "Absent").length;

  // 1️⃣ Always reset to Malaysia current date when the screen reopens
  useFocusEffect(
    React.useCallback(() => {
      const now = new Date();
      setSelectedDate(now);
    }, [])
  );

  // 2️⃣ Fetch class info and attendance every time selectedDate changes
  useEffect(() => {
    fetchClassInfo();
    fetchData();
  }, [selectedDate]);

  const fetchClassInfo = async () => {
    try {
      // TODO: Replace "5C" with dynamic classID from route params
      const classID = "5C";

      // 1️⃣ Fetch class details
      const classQuery = query(
        collection(db, "classes"),
        where("classID", "==", classID)
      );
      const classSnapshot = await getDocs(classQuery);

      if (!classSnapshot.empty) {
        const classData = classSnapshot.docs[0].data();

        // 2️⃣ Fetch teacher name
        let teacherName = "No teacher assigned";
        if (classData.teacherID) {
          const teacherQuery = query(
            collection(db, "Teacher"),
            where("id", "==", classData.teacherID)
          );
          const teacherSnapshot = await getDocs(teacherQuery);

          if (!teacherSnapshot.empty) {
            const teacherData = teacherSnapshot.docs[0].data();
            teacherName = teacherData.fullName || "Unknown Teacher";
          }
        }

        setClassInfo({
          grade: classData.grade,
          className: classData.className,
          teacherName: teacherName,
        });
      }
    } catch (error) {
      console.error("❌ Error fetching class info:", error);
    }
  };

  const fetchData = async () => {
    try {
      // TODO: Filter students by classID
      const classID = "5C";

      // 1️⃣ Fetch students for this class
      const studentQuery = query(
        collection(db, "students"),
        where("classID", "==", classID)
      );
      const studentSnap = await getDocs(studentQuery);
      const studentList = studentSnap.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      })) as { id: string; name: string; studentID: string }[];

      // 2️⃣ Fetch attendance for selected date (Malaysia timezone)
      const dateStr = getMalaysiaDateString(selectedDate);

      const attendanceRef = collection(db, "attendance");
      const q = query(attendanceRef, where("date", "==", dateStr));
      const attendanceSnap = await getDocs(q);

      const attendanceMap: Record<string, "Present" | "Absent"> = {};
      attendanceSnap.forEach((docItem) => {
        const data = docItem.data();
        const status = data.status === 1 ? "Present" : "Absent";
        attendanceMap[data.studentID] = status;
      });

      // 3️⃣ Combine student list with attendance
      const combined = studentList.map((student) => ({
        id: student.id,
        studentID: student.studentID,
        name: student.name,
        status: attendanceMap[student.studentID] || "Absent",
      }));

      setStudents(combined);
    } catch (error) {
      console.error("❌ Error fetching data:", error);
    }
  };

  const handleStatusChange = (id: string, status: "Present" | "Absent") => {
    const updated = students.map((s) => (s.id === id ? { ...s, status } : s));
    setStudents(updated);
  };

  const toggleEdit = async () => {
    if (isEditing) {
      try {
        const dateStr = getMalaysiaDateString(selectedDate);

        for (const student of students) {
          const attendanceRef = doc(
            db,
            "attendance",
            `${dateStr}_${student.studentID}`
          );

          await setDoc(attendanceRef, {
            studentID: student.studentID,
            name: student.name,
            date: dateStr,
            status: student.status === "Present" ? 1 : 0,
          });
        }

        console.log("✅ Attendance successfully updated in Firestore");
        alert("Attendance successfully updated!");
      } catch (error) {
        console.error("❌ Error updating attendance:", error);
        alert("Error updating attendance");
      }
    }

    setIsEditing((prev) => !prev);
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (date) {
      setSelectedDate(date);
    }
  };

  // Helper: Malaysia localized Date string (YYYY-MM-DD)
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

  // Get Malaysia Date object for "now"
  const getMalaysiaNow = (): Date => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 8 * 60 * 60 * 1000); // Malaysia = UTC+8
  };

  // Get start of excuse window (3:00 PM Malaysia time)
  const getExcuseWindowStart = (date: Date): Date => {
    const malaysia = new Date(date);
    const year = malaysia.getFullYear();
    const month = malaysia.getMonth();
    const day = malaysia.getDate();

    const start = new Date(Date.UTC(year, month, day, 7, 0, 0));
    // 3 PM MYT = 7 AM UTC
    return start;
  };

  // End = start + 4 days
  const getExcuseWindowEnd = (date: Date): Date => {
    const start = getExcuseWindowStart(date);
    return new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000);
  };

  // Friendly time diff string between two dates
  const getTimeDiffString = (reference: Date, target: Date): string => {
    if (
      !reference ||
      !target ||
      isNaN(reference.getTime()) ||
      isNaN(target.getTime())
    ) {
      return "Invalid time";
    }

    const diffMs = target.getTime() - reference.getTime();
    const abs = Math.abs(diffMs);

    const days = Math.floor(abs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((abs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return `${days} days ${hours} hours`;
  };

  // Compute display texts for Time Remaining
  const computePendingTimeText = (date: Date): string => {
    const now = getMalaysiaNow();
    const start = getExcuseWindowStart(date);
    const end = getExcuseWindowEnd(date);

    if (now < start) {
      const diff = getTimeDiffString(now, start);
      return `Opens in ${diff}`;
    } else if (now >= start && now <= end) {
      const diff = getTimeDiffString(now, end);
      return `${diff} left`;
    } else {
      return "Submission window closed";
    }
  };

  const openOverlay = async (student: Student) => {
    setSelectedStudent(student);
    setExcuseLetter(null);
    setSubmissionReview("No submission yet");
    setTimeRemainingText(computePendingTimeText(selectedDate));
    setComment("");

    try {
      const dateStr = getMalaysiaDateString(selectedDate);
      const docId = `${dateStr}_${student.studentID}`;
      const excuseDoc = await getDoc(doc(db, "excuseLetter", docId));

      if (excuseDoc.exists()) {
        const data = excuseDoc.data() as ExcuseLetter;
        setExcuseLetter(data);
        setSubmissionReview(data.status || "Pending");

        const submittedAt = data.time ? new Date(data.time) : null;
        if (submittedAt) {
          const end = getExcuseWindowEnd(selectedDate);
          const submittedRelText =
            submittedAt.getTime() <= end.getTime()
              ? `Submitted ${getTimeDiffString(submittedAt, end)} early`
              : `Submitted ${getTimeDiffString(end, submittedAt)} late`;

          setTimeRemainingText(submittedRelText);
        } else {
          setTimeRemainingText(computePendingTimeText(selectedDate));
        }
      } else {
        setSubmissionReview("No submission yet");
        setTimeRemainingText(computePendingTimeText(selectedDate));
      }
    } catch (err) {
      console.error("Error fetching excuse letter:", err);
    }

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeOverlay = () => {
    Animated.timing(slideAnim, {
      toValue: Dimensions.get("window").height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setSelectedStudent(null);
      setExcuseLetter(null);
      setComment("");
    });
  };

  // Open PDF file
  const openPDFFile = async () => {
    if (!excuseLetter || !excuseLetter.file) {
      Alert.alert("No File", "No excuse letter file available.");
      return;
    }

    try {
      // Create a data URI from base64
      const pdfDataUri = `data:application/pdf;base64,${excuseLetter.file}`;

      // Try to open with the device's default PDF viewer
      const canOpen = await Linking.canOpenURL(pdfDataUri);

      if (canOpen) {
        await Linking.openURL(pdfDataUri);
      } else {
        Alert.alert(
          "Cannot Open File",
          "Unable to open PDF file. The file data is available but no PDF viewer is configured on this device."
        );
      }
    } catch (err) {
      console.error("Error opening PDF:", err);
      Alert.alert("Error", "Failed to open PDF file.");
    }
  };

  // Approve excuse letter
  const approveExcuse = async () => {
    if (!selectedStudent || !excuseLetter) {
      Alert.alert("Error", "No excuse letter to approve.");
      return;
    }

    try {
      const dateStr = getMalaysiaDateString(selectedDate);
      const docId = `${dateStr}_${selectedStudent.studentID}`;

      await updateDoc(doc(db, "excuseLetter", docId), {
        status: "Approved",
        teacherComment: comment.trim(),
        reviewedAt: new Date().toISOString(),
      });

      setSubmissionReview("Approved");
      Alert.alert("Success", "✅ Excuse letter approved!");
      closeOverlay();
    } catch (err) {
      console.error("Error approving excuse:", err);
      Alert.alert("Error", "Failed to approve excuse letter.");
    }
  };

  // Deny excuse letter
  const denyExcuse = async () => {
    if (!selectedStudent || !excuseLetter) {
      Alert.alert("Error", "No excuse letter to deny.");
      return;
    }

    if (!comment.trim()) {
      Alert.alert(
        "Comment Required",
        "Please provide a reason for denying this excuse letter."
      );
      return;
    }

    try {
      const dateStr = getMalaysiaDateString(selectedDate);
      const docId = `${dateStr}_${selectedStudent.studentID}`;

      await updateDoc(doc(db, "excuseLetter", docId), {
        status: "Denied",
        teacherComment: comment.trim(),
        reviewedAt: new Date().toISOString(),
      });

      setSubmissionReview("Denied");
      Alert.alert("Success", "Excuse letter denied.");
      closeOverlay();
    } catch (err) {
      console.error("Error denying excuse:", err);
      Alert.alert("Error", "Failed to deny excuse letter.");
    }
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/home")}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {classInfo
            ? `${classInfo.grade} ${classInfo.className}`
            : "Loading..."}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Class Info with Background Image */}
      <ImageBackground
        source={require("C:/Users/haika/Documents/IIUM DEGREE/BuddyWheels/buddywheels/assets/images/card.png")}
        style={styles.classInfoBackground}
        resizeMode="cover"
      >
        <View style={styles.classInfoOverlay}>
          <Text style={styles.teacher}>
            Class Teacher: {classInfo?.teacherName || "Loading..."}
          </Text>

          {/* Date Navigation */}
          <View style={styles.dateNavigation}>
            <TouchableOpacity
              onPress={() => changeDate(-1)}
              style={styles.dateArrow}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={styles.dateDisplay}
            >
              <Ionicons name="calendar-outline" size={18} color="#2E7D32" />
              <Text style={styles.date}>{formatDate(selectedDate)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => changeDate(1)}
              style={styles.dateArrow}
            >
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}

          <View style={styles.statsContainer}>
            <View style={[styles.statBox, { backgroundColor: "#E8F8E0" }]}>
              <Text style={styles.statNumber}>{presentCount}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: "#FDE8E8" }]}>
              <Text style={[styles.statNumber, { color: "#E53935" }]}>
                {absentCount}
              </Text>
              <Text style={[styles.statLabel, { color: "#E53935" }]}>
                Absent
              </Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      {/* Table Section */}
      <ScrollView style={styles.tableContainer}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderText, { flex: 3 }]}>Name</Text>
          <Text
            style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}
          >
            Status
          </Text>
          <TouchableOpacity onPress={toggleEdit} style={styles.editButton}>
            <Text style={styles.editButtonText}>
              {isEditing ? "Save" : "Edit"}
            </Text>
          </TouchableOpacity>
        </View>

        {currentStudents.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.tableText, { flex: 3 }]}>{item.name}</Text>
            <View style={[styles.tableCell, { flex: 1 }]}>
              {isEditing ? (
                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={[
                      styles.statusBtn,
                      item.status === "Present"
                        ? styles.presentSelected
                        : styles.unselectedBtn,
                    ]}
                    onPress={() => handleStatusChange(item.id, "Present")}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        item.status === "Present"
                          ? { color: "#fff" }
                          : { color: "#000" },
                      ]}
                    >
                      P
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusBtn,
                      item.status === "Absent"
                        ? styles.absentSelected
                        : styles.unselectedBtn,
                    ]}
                    onPress={() => handleStatusChange(item.id, "Absent")}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        item.status === "Absent"
                          ? { color: "#fff" }
                          : { color: "#000" },
                      ]}
                    >
                      A
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  disabled={item.status !== "Absent"}
                  onPress={() => openOverlay(item)}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          item.status === "Present" ? "#388E3C" : "#E53935",
                        textDecorationLine:
                          item.status === "Absent" ? "underline" : "none",
                      },
                    ]}
                  >
                    {item.status}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Pagination */}
      <View style={styles.pagination}>
        <TouchableOpacity
          disabled={page === 1}
          onPress={() => setPage(page - 1)}
          style={[styles.pageButton, page === 1 && styles.disabledPage]}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.pageText}>
          Page {page} / {totalPages}
        </Text>
        <TouchableOpacity
          disabled={page === totalPages}
          onPress={() => setPage(page + 1)}
          style={[
            styles.pageButton,
            page === totalPages && styles.disabledPage,
          ]}
        >
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Overlay */}
      {selectedStudent && (
        <Animated.View
          style={[
            styles.overlayContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ maxHeight: "80%" }}
          >
            <ScrollView
              style={styles.overlayContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.overlayName}>{selectedStudent.name}</Text>
              <Text style={styles.overlayDate}>{formatDate(selectedDate)}</Text>
              <Text style={styles.excuseHeader}>Excuse Letter</Text>

              <View style={styles.excuseTable}>
                <View style={styles.excuseRow}>
                  <Text style={styles.excuseLabel}>Submission Review</Text>
                  <Text
                    style={[
                      styles.excuseValue,
                      submissionReview === "Pending" && {
                        color: "#FF9800",
                        fontWeight: "bold",
                      },
                      submissionReview === "Approved" && {
                        color: "#4CAF50",
                        fontWeight: "bold",
                      },
                      submissionReview === "Denied" && {
                        color: "#E53935",
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {submissionReview}
                  </Text>
                </View>

                <View style={styles.excuseRow}>
                  <Text style={styles.excuseLabel}>Time Remaining</Text>
                  <Text style={styles.excuseValue}>{timeRemainingText}</Text>
                </View>

                <View style={styles.excuseRow}>
                  <Text style={styles.excuseLabel}>File Submission</Text>
                  {excuseLetter && excuseLetter.file ? (
                    <TouchableOpacity onPress={openPDFFile}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flex: 2,
                        }}
                      >
                        <Ionicons
                          name="document-text"
                          size={16}
                          color="#67BA03"
                        />
                        <Text
                          style={{
                            color: "#67BA03",
                            fontWeight: "bold",
                            marginLeft: 5,
                          }}
                        >
                          {excuseLetter.fileName || "excuse.pdf"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={[
                        styles.excuseValue,
                        { fontStyle: "italic", color: "#999" },
                      ]}
                    >
                      No file submitted
                    </Text>
                  )}
                </View>

                {excuseLetter && excuseLetter.reason && (
                  <View style={styles.excuseRow}>
                    <Text style={styles.excuseLabel}>Parent's Reason</Text>
                    <Text style={styles.excuseValue}>
                      {excuseLetter.reason}
                    </Text>
                  </View>
                )}

                <View style={styles.excuseRow}>
                  <Text style={styles.excuseLabel}>Teacher Comments</Text>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add teacher comments..."
                    placeholderTextColor="#b9b3b3ff"
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    editable={
                      excuseLetter !== null && submissionReview === "Pending"
                    }
                  />
                </View>
              </View>

              {excuseLetter && submissionReview === "Pending" && (
                <View style={styles.overlayButtons}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={approveExcuse}
                  >
                    <Text style={styles.btnActionText}>APPROVE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.denyBtn} onPress={denyExcuse}>
                    <Text style={styles.btnActionText}>DENY</Text>
                  </TouchableOpacity>
                </View>
              )}

              {excuseLetter && submissionReview !== "Pending" && (
                <View style={styles.reviewedNotice}>
                  <Text style={styles.reviewedText}>
                    This excuse letter has been {submissionReview.toLowerCase()}
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={closeOverlay} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    backgroundColor: "#67BA03",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  classInfoBackground: {
    width: "100%",
  },
  classInfoOverlay: {
    paddingVertical: 15,
    alignItems: "center",
  },
  teacher: { fontSize: 14, color: "#fff", marginBottom: 10, fontWeight: "500" },
  dateNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  dateArrow: {
    padding: 8,
  },
  dateDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 10,
    gap: 8,
  },
  date: { fontSize: 14, color: "#2E7D32", fontWeight: "600" },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  statBox: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    alignItems: "center",
  },
  statNumber: { fontSize: 18, fontWeight: "bold", color: "#4CAF50" },
  statLabel: { fontSize: 13, color: "#4CAF50" },
  tableContainer: { marginTop: 10 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#E6F3D8",
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: "center",
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#333",
  },
  editButton: {
    backgroundColor: "#67BA03",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editButtonText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  tableRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 15,
    borderBottomWidth: 1,
    borderColor: "#EEE",
    paddingVertical: 10,
  },
  tableText: { fontSize: 13, color: "#333" },
  tableCell: { justifyContent: "center", alignItems: "center" },
  statusText: { fontSize: 13, fontWeight: "bold" },
  editButtons: { flexDirection: "row", gap: 8 },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CCC",
  },
  unselectedBtn: { backgroundColor: "#fff" },
  presentSelected: { backgroundColor: "#4CAF50", borderColor: "#4CAF50" },
  absentSelected: { backgroundColor: "#E53935", borderColor: "#E53935" },
  btnText: { fontWeight: "bold" },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 15,
    gap: 10,
  },
  pageButton: {
    backgroundColor: "#67BA03",
    borderRadius: 20,
    padding: 6,
  },
  disabledPage: { backgroundColor: "#BDBDBD" },
  pageText: { fontSize: 14, color: "#333" },
  overlayContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  overlayContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  overlayName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  overlayDate: { fontSize: 13, color: "#777", marginBottom: 10 },
  excuseHeader: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  excuseTable: {
    backgroundColor: "#E8F8E0",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    marginBottom: 15,
  },
  excuseRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#C8E6C9",
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  excuseLabel: {
    flex: 1,
    fontWeight: "bold",
    fontSize: 13,
    color: "#333",
  },
  excuseValue: {
    flex: 2,
    fontSize: 13,
    color: "#333",
  },
  commentInput: {
    flex: 2,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    borderRadius: 6,
    padding: 5,
    backgroundColor: "#fff",
    fontSize: 13,
    minHeight: 40,
  },
  overlayButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: "#4CAF50",
    borderRadius: 30,
    paddingVertical: 10,
    alignItems: "center",
    marginRight: 5,
  },
  denyBtn: {
    flex: 1,
    backgroundColor: "#E53935",
    borderRadius: 30,
    paddingVertical: 10,
    alignItems: "center",
    marginLeft: 5,
  },
  btnActionText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
  reviewedNotice: {
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 10,
  },
  reviewedText: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
  },
  closeBtn: {
    alignSelf: "center",
    marginTop: 8,
  },
  closeBtnText: {
    color: "#67BA03",
    fontWeight: "bold",
    fontSize: 15,
    marginBottom: 20,
  },
});
