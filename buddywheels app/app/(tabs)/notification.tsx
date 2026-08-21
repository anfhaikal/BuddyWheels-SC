import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// @ts-ignore
import { auth, db } from "../../firebaseConfig";

interface Notification {
  id: string;
  title: string;
  message: string;
  type?: "success" | "info" | "warning" | "error";
  notiType?: "general" | "attendance" | "system";
  isRead?: boolean;
  timestamp?: Timestamp;
  userId?: string;
}

interface GroupedNotifications {
  date: string;
  displayDate: string;
  notifications: Notification[];
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [scrollRef, setScrollRef] =
    useState<FlatList<GroupedNotifications> | null>(null);

  useEffect(() => {
    // @ts-ignore
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data() as Omit<Notification, "id">;
        return { id: doc.id, ...docData };
      });
      setNotifications(data);
    });

    return () => unsubscribe();
  }, []);

  // ✅ Reset scroll to top whenever user opens this tab
  useFocusEffect(
    React.useCallback(() => {
      scrollRef?.scrollToOffset({ animated: false, offset: 0 });
    }, [scrollRef])
  );

  // ✅ Filter notifications based on selected category
  const filteredNotifications = useMemo(() => {
    if (selectedFilter === "all") return notifications;
    return notifications.filter((noti) => noti.notiType === selectedFilter);
  }, [notifications, selectedFilter]);

  // ✅ Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: GroupedNotifications } = {};

    filteredNotifications.forEach((noti) => {
      if (!noti.timestamp) return;

      const date = noti.timestamp.toDate();
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateKey: string;
      let displayDate: string;

      // Check if it's today
      if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      ) {
        dateKey = "today";
        displayDate = "Today";
      }
      // Check if it's yesterday
      else if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        dateKey = "yesterday";
        displayDate = "Yesterday";
      }
      // Otherwise, use the actual date
      else {
        dateKey = date.toDateString();
        displayDate = date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year:
            date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
        });
      }

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          displayDate,
          notifications: [],
        };
      }

      groups[dateKey].notifications.push(noti);
    });

    // Convert to array and sort by date (most recent first)
    return Object.values(groups).sort((a, b) => {
      if (a.date === "today") return -1;
      if (b.date === "today") return 1;
      if (a.date === "yesterday") return -1;
      if (b.date === "yesterday") return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [filteredNotifications]);

  // ✅ Filter options
  const filters = [
    { label: "All", value: "all", icon: "apps" },
    { label: "General", value: "general", icon: "megaphone" },
    { label: "Attendance", value: "attendance", icon: "clipboard" },
    { label: "System", value: "system", icon: "settings" },
  ];

  // ✅ Type-safe mapping for notification type styles
  const notificationTypeStyles = {
    success: styles.success,
    info: styles.info,
    warning: styles.warning,
    error: styles.error,
  };

  // ✅ Get emoji for notification category
  const getCategoryEmoji = (notiType?: string) => {
    switch (notiType) {
      case "general":
        return "📢";
      case "attendance":
        return "📋";
      case "system":
      default:
        return "📌";
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ✅ Header Section */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/(tabs)/home")}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Notifications</Text>
      </View>

      {/* ✅ Filter Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterButton,
              selectedFilter === filter.value && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedFilter(filter.value)}
          >
            <Ionicons
              name={filter.icon as any}
              size={16}
              color={selectedFilter === filter.value ? "#fff" : "#67BA03"}
              style={styles.filterIcon}
            />
            <Text
              style={[
                styles.filterText,
                selectedFilter === filter.value && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ✅ Content Section */}
      <View style={styles.content}>
        {groupedNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
            <Text style={styles.empty}>
              {selectedFilter === "all"
                ? "No notifications yet"
                : `No ${selectedFilter} notifications`}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={setScrollRef}
            data={groupedNotifications}
            keyExtractor={(item) => item.date}
            renderItem={({ item: group }) => (
              <View style={styles.dateGroup}>
                {/* Date Header */}
                <View style={styles.dateHeader}>
                  <View style={styles.dateLine} />
                  <Text style={styles.dateText}>{group.displayDate}</Text>
                  <View style={styles.dateLine} />
                </View>

                {/* Notifications for this date */}
                {group.notifications.map((noti) => (
                  <View
                    key={noti.id}
                    style={[
                      styles.card,
                      notificationTypeStyles[noti.type || "info"],
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.categoryEmoji}>
                        {getCategoryEmoji(noti.notiType)}
                      </Text>
                      <Text style={styles.title}>{noti.title}</Text>
                    </View>
                    <Text style={styles.message}>{noti.message}</Text>
                    <View style={styles.cardFooter}>
                      <Text style={styles.category}>
                        {noti.notiType
                          ? noti.notiType.charAt(0).toUpperCase() +
                            noti.notiType.slice(1)
                          : "General"}
                      </Text>
                      <Text style={styles.time}>
                        {noti.timestamp
                          ? noti.timestamp
                              .toDate()
                              .toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })
                          : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#67BA03",
  },
  header: {
    backgroundColor: "#67BA03",
    paddingVertical: 22,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: "50%",
    transform: [{ translateY: 10 }],
  },
  headerText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  filterContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    maxHeight: 60,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F9E8",
    borderWidth: 1,
    borderColor: "#67BA03",
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: "#67BA03",
    borderColor: "#67BA03",
  },
  filterIcon: {
    marginRight: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#67BA03",
  },
  filterTextActive: {
    color: "#fff",
  },
  content: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F7F8FA",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 60,
  },
  empty: {
    textAlign: "center",
    marginTop: 16,
    color: "#999",
    fontSize: 16,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginHorizontal: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "white",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  title: {
    fontWeight: "bold",
    fontSize: 16,
    flex: 1,
    color: "#333",
  },
  message: {
    color: "#555",
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  category: {
    fontSize: 12,
    color: "#67BA03",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  time: {
    fontSize: 12,
    color: "#999",
  },
  success: {
    borderLeftColor: "#10b981",
    borderLeftWidth: 4,
  },
  info: {
    borderLeftColor: "#3b82f6",
    borderLeftWidth: 4,
  },
  warning: {
    borderLeftColor: "#f59e0b",
    borderLeftWidth: 4,
  },
  error: {
    borderLeftColor: "#ef4444",
    borderLeftWidth: 4,
  },
});
