import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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

      // Animate on data load
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
    <>
      <StatusBar backgroundColor="#67BA03" barStyle="light-content" />
      <View style={styles.container}>
        {/* ✅ Header with Gradient (matching Profile style) */}
        <LinearGradient
          colors={["#67BA03", "#5AA002", "#4D8902"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.circleDecor1} />
          <View style={styles.circleDecor2} />
          <View style={styles.headerContent}>
            <Text style={styles.headerText}>Notifications</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

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
              activeOpacity={0.7}
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
                  name="notifications-off-outline"
                  size={64}
                  color="#ccc"
                />
              </View>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.empty}>
                {selectedFilter === "all"
                  ? "You don't have any notifications yet"
                  : `No ${selectedFilter} notifications found`}
              </Text>
            </Animated.View>
          ) : (
            <FlatList
              ref={setScrollRef}
              data={groupedNotifications}
              keyExtractor={(item) => item.date}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: group }) => (
                <Animated.View
                  style={[
                    styles.dateGroup,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                    },
                  ]}
                >
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
                        <View style={styles.emojiContainer}>
                          <Text style={styles.categoryEmoji}>
                            {getCategoryEmoji(noti.notiType)}
                          </Text>
                        </View>
                        <Text style={styles.title}>{noti.title}</Text>
                      </View>
                      <Text style={styles.message}>{noti.message}</Text>
                      <View style={styles.cardFooter}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.category}>
                            {noti.notiType
                              ? noti.notiType.charAt(0).toUpperCase() +
                                noti.notiType.slice(1)
                              : "General"}
                          </Text>
                        </View>
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
                </Animated.View>
              )}
            />
          )}
        </View>
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
    flexDirection: "column",
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
  headerText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  placeholder: {
    width: 40,
  },
  filterContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
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
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#67BA03",
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: "#67BA03",
    borderColor: "#67BA03",
    elevation: 2,
    shadowColor: "#67BA03",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
    padding: 20,
    backgroundColor: "#F5F7FA",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F5F7FA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#666",
    marginBottom: 8,
  },
  empty: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
    paddingHorizontal: 40,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dateText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    marginHorizontal: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  emojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  title: {
    fontWeight: "700",
    fontSize: 16,
    flex: 1,
    color: "#333",
  },
  message: {
    color: "#555",
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F5F7FA",
  },
  categoryBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
    fontWeight: "500",
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
