"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  BookOpen,
  Users,
  CheckSquare,
  Shield,
  X,
  Bell,
  LogOut,
  Menu,
  Car,
  Home,
  BarChart3,
  UserCog,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [analyticsData, setAnalyticsData] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalDrivers: 0,
    totalParents: 0,
    totalGuards: 0,
    totalClasses: 0,
    attendanceRate: 0,
    presentToday: 0,
    absentToday: 0,
  });
  const [loading, setLoading] = useState(true);

  // Notification form state
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    message: "",
    type: "info",
    recipient: "all",
    notiType: "general",
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    fetchAnalyticsOverview();
  }, []);

  const fetchAnalyticsOverview = async () => {
    setLoading(true);
    try {
      const studentsSnapshot = await getDocs(collection(db, "students"));
      const teachersSnapshot = await getDocs(collection(db, "Teacher"));
      const driversSnapshot = await getDocs(collection(db, "Driver"));
      const parentsSnapshot = await getDocs(collection(db, "Parent"));
      const guardsSnapshot = await getDocs(collection(db, "Guard"));
      const classesSnapshot = await getDocs(collection(db, "classes"));

      const today = new Date().toISOString().split("T")[0];
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("date", "==", today)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);

      let presentToday = 0;
      const studentsWithAttendance = new Set();

      // Count students with attendance records
      attendanceSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        studentsWithAttendance.add(data.studentId); // Track which students have records

        if (data.status === 1) {
          presentToday++;
        }
      });

      // Calculate absent: students marked absent + students without any attendance record
      const totalStudents = studentsSnapshot.size;
      const absentToday = totalStudents - presentToday;

      const attendanceRate =
        totalStudents > 0 ? (presentToday / totalStudents) * 100 : 0;

      setAnalyticsData({
        totalStudents: studentsSnapshot.size,
        totalTeachers: teachersSnapshot.size,
        totalDrivers: driversSnapshot.size,
        totalParents: parentsSnapshot.size,
        totalGuards: guardsSnapshot.size,
        totalClasses: classesSnapshot.size,
        attendanceRate,
        presentToday,
        absentToday,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const generateVerificationCode = async () => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    setGeneratedCode(code);

    const ref = doc(db, "verification", "register");
    await setDoc(ref, { code });

    setShowModal(true);
  };

  const sendNotificationToUser = async (
    userId: string,
    title: string,
    message: string,
    type: string,
    notiType: string
  ) => {
    try {
      await addDoc(collection(db, "notifications"), {
        userId,
        title,
        message,
        type,
        notiType,
        isRead: false,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending notification:", error);
      throw error;
    }
  };

  const handleSendNotification = async () => {
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      alert("⚠️ Please fill in both title and message.");
      return;
    }

    setSending(true);
    try {
      if (notificationForm.recipient === "all") {
        const usersSnapshot = await getDocs(collection(db, "users"));

        if (usersSnapshot.empty) {
          alert("⚠️ No users found in the system.");
          setSending(false);
          return;
        }

        const promises = usersSnapshot.docs.map((doc) =>
          sendNotificationToUser(
            doc.id,
            notificationForm.title,
            notificationForm.message,
            notificationForm.type,
            notificationForm.notiType
          )
        );

        await Promise.all(promises);
        alert(
          `✅ Notification sent to ${usersSnapshot.size} users successfully!`
        );
      } else {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const filteredUsers = usersSnapshot.docs.filter(
          (doc) => doc.data().role === notificationForm.recipient
        );

        if (filteredUsers.length === 0) {
          alert(`⚠️ No users found with role: ${notificationForm.recipient}`);
          setSending(false);
          return;
        }

        const promises = filteredUsers.map((doc) =>
          sendNotificationToUser(
            doc.id,
            notificationForm.title,
            notificationForm.message,
            notificationForm.type,
            notificationForm.notiType
          )
        );

        await Promise.all(promises);
        alert(
          `✅ Notification sent to ${filteredUsers.length} ${notificationForm.recipient}(s) successfully!`
        );
      }

      setNotificationForm({
        title: "",
        message: "",
        type: "info",
        recipient: "all",
        notiType: "general",
      });
      setShowNotificationModal(false);
    } catch (error) {
      console.error("Error sending notifications:", error);
      alert("❌ Failed to send notifications. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const navigationSections = [
    {
      title: "Main",
      items: [
        { id: "home", name: "Dashboard", icon: Home, path: "/dashboard" },
      ],
    },
    {
      title: "Academic",
      items: [
        {
          id: "student",
          name: "Students",
          icon: User,
          path: "/dashboard/student",
        },
        {
          id: "class",
          name: "Classes",
          icon: BookOpen,
          path: "/dashboard/class",
        },
      ],
    },
    {
      title: "Personnel",
      items: [
        {
          id: "teacher",
          name: "Teachers",
          icon: Users,
          path: "/dashboard/teacher",
        },
        {
          id: "driver",
          name: "Drivers",
          icon: Car,
          path: "/dashboard/driver",
        },
        {
          id: "parent",
          name: "Parents",
          icon: UserCog,
          path: "/dashboard/parent",
        },
        {
          id: "guard",
          name: "Guards",
          icon: ShieldCheck,
          path: "/dashboard/guard",
        },
      ],
    },
    {
      title: "Reports",
      items: [
        {
          id: "analytics",
          name: "Analytics",
          icon: BarChart3,
          path: "/dashboard/analytics",
        },
      ],
    },
  ];

  const dashboardSections = [
    {
      title: "Academic Management",
      color: "blue",
      items: [
        {
          name: "Students",
          icon: User,
          description: "View and manage student profiles and data",
          path: "/dashboard/student",
          count: analyticsData.totalStudents,
        },
        {
          name: "Classes",
          icon: BookOpen,
          description:
            "Organize and assign students to their respective classes",
          path: "/dashboard/class",
          count: analyticsData.totalClasses,
        },
      ],
    },
    {
      title: "Personnel Management",
      color: "orange",
      items: [
        {
          name: "Teachers",
          icon: Users,
          description: "Manage teacher accounts and subject assignments",
          path: "/dashboard/teacher",
          count: analyticsData.totalTeachers,
        },
        {
          name: "Drivers",
          icon: Car,
          description: "Manage school transport drivers",
          path: "/dashboard/driver",
          count: analyticsData.totalDrivers,
        },
        {
          name: "Parents",
          icon: UserCog,
          description: "View and manage parent accounts",
          path: "/dashboard/parent",
          count: analyticsData.totalParents,
        },
        {
          name: "Guards",
          icon: ShieldCheck,
          description: "Manage security personnel",
          path: "/dashboard/guard",
          count: analyticsData.totalGuards,
        },
      ],
    },
    {
      title: "Reports & Analytics",
      color: "green",
      items: [
        {
          name: "Analytics",
          icon: BarChart3,
          description: "Review attendance analytics and system reports",
          path: "/dashboard/analytics",
          count: null,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-50 overflow-y-auto">
        {/* Logo Section */}
        <div className="p-4 border-b border-gray-200 flex items-center space-x-3 sticky top-0 bg-white z-10">
          <img
            src="/logo2.png"
            alt="BuddyWheels Logo"
            className="w-8 h-8 cursor-pointer"
            onClick={() => router.push("/dashboard")}
          />
          <span className="font-semibold text-gray-800">BuddyWheels</span>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 p-4 space-y-6">
          {navigationSections.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              {sidebarOpen && (
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">
                  {section.title}
                </h3>
              )}
              {!sidebarOpen && sectionIdx > 0 && (
                <div className="border-t border-gray-200 my-2"></div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (item.path) router.push(item.path);
                      }}
                      className={`${
                        isActive
                          ? "bg-green-50 text-green-700 border-green-500"
                          : "text-gray-700 hover:bg-gray-50 border-transparent"
                      } w-full flex items-center ${
                        sidebarOpen ? "justify-start px-4" : "justify-center"
                      } py-3 rounded-lg transition border-l-4 group relative`}
                    >
                      <Icon
                        className={`${
                          isActive ? "text-green-600" : "text-gray-500"
                        } w-5 h-5 ${sidebarOpen ? "mr-3" : ""}`}
                      />
                      {sidebarOpen && (
                        <span className="font-medium">{item.name}</span>
                      )}
                      {!sidebarOpen && (
                        <span className="absolute left-20 ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                          {item.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Admin Tools Section */}
          <div className="pt-4 border-t border-gray-200">
            {sidebarOpen && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">
                Admin Tools
              </h3>
            )}
            <div className="space-y-1">
              <button
                onClick={generateVerificationCode}
                className={`w-full flex items-center ${
                  sidebarOpen ? "justify-start px-4" : "justify-center"
                } py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition group relative`}
              >
                <Shield
                  className={`w-5 h-5 text-gray-500 group-hover:text-green-600 ${
                    sidebarOpen ? "mr-3" : ""
                  }`}
                />
                {sidebarOpen && <span className="font-medium">Staff Code</span>}
                {!sidebarOpen && (
                  <span className="absolute left-20 ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    Staff Code
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowNotificationModal(true)}
                className={`w-full flex items-center ${
                  sidebarOpen ? "justify-start px-4" : "justify-center"
                } py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition group relative`}
              >
                <Bell
                  className={`w-5 h-5 text-gray-500 group-hover:text-green-600 ${
                    sidebarOpen ? "mr-3" : ""
                  }`}
                />
                {sidebarOpen && (
                  <span className="font-medium">Notifications</span>
                )}
                {!sidebarOpen && (
                  <span className="absolute left-20 ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    Notifications
                  </span>
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${
              sidebarOpen ? "justify-start px-4" : "justify-center"
            } py-3 rounded-lg text-red-600 hover:bg-red-50 transition group relative`}
          >
            <LogOut className={`w-5 h-5 ${sidebarOpen ? "mr-3" : ""}`} />
            {sidebarOpen && <span className="font-medium">Logout</span>}
            {!sidebarOpen && (
              <span className="absolute left-20 ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-40">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Welcome back, Administrator
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">
                  {auth.currentUser?.email}
                </p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-500 text-lg">Loading dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Analytics Overview Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
              >
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Today's Overview
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <TrendingUp className="w-8 h-8 opacity-80" />
                      <span className="text-3xl font-bold">
                        {analyticsData.attendanceRate.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-sm opacity-90">Attendance Rate</p>
                    <p className="text-xs opacity-75 mt-1">Today's average</p>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <CheckSquare className="w-8 h-8 text-green-600" />
                      <span className="text-3xl font-bold text-gray-800">
                        {analyticsData.presentToday}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Present Today</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Students checked in
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <AlertTriangle className="w-8 h-8 text-orange-600" />
                      <span className="text-3xl font-bold text-gray-800">
                        {analyticsData.absentToday}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Absent Today</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Students marked absent
                    </p>
                  </div>

                  <button
                    onClick={() => router.push("/dashboard/analytics")}
                    className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <BarChart3 className="w-8 h-8 opacity-80" />
                      <span className="text-sm opacity-90 group-hover:opacity-100">
                        View All →
                      </span>
                    </div>
                    <p className="text-sm opacity-90">Full Analytics</p>
                    <p className="text-xs opacity-75 mt-1">
                      Detailed reports & insights
                    </p>
                  </button>
                </div>
              </motion.div>

              {/* Dashboard Sections */}
              {dashboardSections.map((section, sectionIdx) => (
                <motion.div
                  key={sectionIdx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: sectionIdx * 0.1 }}
                  className="mb-8"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-1 h-6 rounded-full bg-${section.color}-500`}
                    ></div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      {section.title}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                    {section.items.map((item, idx) => {
                      const Icon = item.icon;

                      return (
                        <motion.button
                          key={idx}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => router.push(item.path)}
                          className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all text-left group"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div
                              className={`w-12 h-12 bg-${section.color}-50 rounded-lg flex items-center justify-center group-hover:bg-${section.color}-100 transition`}
                            >
                              <Icon
                                className={`w-6 h-6 text-${section.color}-600`}
                              />
                            </div>
                            {item.count !== null && (
                              <span
                                className={`text-2xl font-bold text-${section.color}-600`}
                              >
                                {item.count}
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {item.description}
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </>
          )}

          <footer className="text-center text-gray-500 mt-16">
            <p>
              © {new Date().getFullYear()} BuddyWheels Admin Panel. All rights
              reserved.
            </p>
          </footer>
        </div>
      </main>

      {/* VERIFICATION CODE MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-lg p-8 w-[90%] max-w-md text-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <h2 className="text-2xl font-bold text-green-700 mb-4">
                Staff Registration Code
              </h2>
              <p className="text-gray-600 mb-6">
                Share this code with authorized staff for registration:
              </p>
              <div className="bg-green-100 text-green-800 font-mono text-lg p-3 rounded-md mb-4">
                {generatedCode}
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOTIFICATION MODAL */}
      <AnimatePresence>
        {showNotificationModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNotificationModal(false)}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowNotificationModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <Bell className="w-7 h-7 text-green-600" />
                <h2 className="text-2xl font-bold text-gray-800">
                  Send Notification
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notification Title *
                  </label>
                  <input
                    type="text"
                    value={notificationForm.title}
                    onChange={(e) =>
                      setNotificationForm({
                        ...notificationForm,
                        title: e.target.value,
                      })
                    }
                    placeholder="e.g., System Maintenance Alert"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-500 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    value={notificationForm.message}
                    onChange={(e) =>
                      setNotificationForm({
                        ...notificationForm,
                        message: e.target.value,
                      })
                    }
                    placeholder="Enter your notification message here..."
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none placeholder:text-gray-500 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 ">
                    Notification Type
                  </label>
                  <select
                    value={notificationForm.type}
                    onChange={(e) =>
                      setNotificationForm({
                        ...notificationForm,
                        type: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-500"
                  >
                    <option value="info">ℹ️ Info</option>
                    <option value="success">✅ Success</option>
                    <option value="warning">⚠️ Warning</option>
                    <option value="error">❌ Error</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={notificationForm.notiType}
                    onChange={(e) =>
                      setNotificationForm({
                        ...notificationForm,
                        notiType: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-500"
                  >
                    <option value="general">📢 General</option>
                    <option value="attendance">📋 Attendance</option>
                    <option value="system">⚙️ System</option>
                    <option value="transport">🚌 Transport</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Send To
                  </label>
                  <select
                    value={notificationForm.recipient}
                    onChange={(e) =>
                      setNotificationForm({
                        ...notificationForm,
                        recipient: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-500"
                  >
                    <option value="all">👥 All Users</option>
                    <option value="Parent">👨‍👩‍👧 Parents Only</option>
                    <option value="Teacher">👨‍🏫 Teachers Only</option>
                    <option value="Driver">🚌 Drivers Only</option>
                  </select>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-2">Preview:</p>
                  <div className="bg-white border-l-4 border-green-500 p-3 rounded">
                    <p className="font-semibold text-gray-800">
                      {notificationForm.title || "Notification Title"}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {notificationForm.message ||
                        "Your message will appear here..."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNotificationModal(false)}
                  disabled={sending}
                  className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendNotification}
                  disabled={sending}
                  className="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {sending ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      Send Notification
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
