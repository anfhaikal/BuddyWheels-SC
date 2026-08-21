"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Trophy,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Home,
  User,
  BookOpen,
  Shield,
  Bell,
  LogOut,
  Car,
  Menu,
  UserCog,
  ShieldCheck,
} from "lucide-react";

type ClassAnalytics = {
  classID: string;
  grade: number;
  className: string;
  teacherName: string;
  studentCount: number;
  totalPresent: number;
  totalAbsent: number;
  attendanceRate: number;
  lowAttendanceCount: number;
  perfectAttendanceCount: number;
};

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [classesData, setClassesData] = useState<ClassAnalytics[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [sortBy, setSortBy] = useState<"rate" | "students" | "name">("name");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("analytics");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    fetchAllClassesAnalytics();
  }, [selectedMonth]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isWeekend = (dateString: string): boolean => {
    const date = new Date(dateString);
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const fetchAllClassesAnalytics = async () => {
    setLoading(true);
    try {
      const startDate = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth(),
        1
      );
      const endDate = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + 1,
        0
      );
      const startStr = formatDateString(startDate);
      const endStr = formatDateString(endDate);

      const classesSnapshot = await getDocs(collection(db, "classes"));
      const analyticsPromises = classesSnapshot.docs.map(async (classDoc) => {
        const classData = classDoc.data();
        const classID = classData.classID;

        let teacherName = "No teacher assigned";
        if (classData.teacherID) {
          const teacherQuery = query(
            collection(db, "Teacher"),
            where("id", "==", classData.teacherID)
          );
          const teacherSnapshot = await getDocs(teacherQuery);
          if (!teacherSnapshot.empty) {
            teacherName = teacherSnapshot.docs[0].data().fullName || "Unknown";
          }
        }

        const attendanceQuery = query(
          collection(db, "attendance"),
          where("classID", "==", classID),
          where("date", ">=", startStr),
          where("date", "<=", endStr)
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);

        const records = attendanceSnapshot.docs
          .map((doc) => doc.data())
          .filter((data) => !isWeekend(data.date));

        const studentQuery = query(
          collection(db, "students"),
          where("classID", "==", classID)
        );
        const studentSnapshot = await getDocs(studentQuery);

        let lowAttendanceCount = 0;
        let perfectAttendanceCount = 0;

        studentSnapshot.docs.forEach((doc) => {
          const studentData = doc.data();
          const studentRecords = records.filter(
            (r: any) => r.studentID === studentData.studentID
          );
          const presentCount = studentRecords.filter(
            (r: any) => r.status === 1
          ).length;
          const absentCount = studentRecords.filter(
            (r: any) => r.status === 0
          ).length;
          const totalDays = presentCount + absentCount;
          const attendanceRate =
            totalDays > 0 ? (presentCount / totalDays) * 100 : 0;

          if (attendanceRate < 75 && totalDays > 0) lowAttendanceCount++;
          if (attendanceRate === 100 && presentCount > 0)
            perfectAttendanceCount++;
        });

        const totalPresent = records.filter((r: any) => r.status === 1).length;
        const totalAbsent = records.filter((r: any) => r.status === 0).length;
        const attendanceRate =
          totalPresent + totalAbsent > 0
            ? (totalPresent / (totalPresent + totalAbsent)) * 100
            : 0;

        return {
          classID,
          grade: classData.grade,
          className: classData.className,
          teacherName,
          studentCount: classData.studentCount || 0,
          totalPresent,
          totalAbsent,
          attendanceRate,
          lowAttendanceCount,
          perfectAttendanceCount,
        };
      });

      const analytics = await Promise.all(analyticsPromises);
      setClassesData(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (direction: number) => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedMonth(newDate);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("en-MY", {
      month: "long",
      year: "numeric",
    });
  };

  const getWeekdaysInMonth = (date: Date): number => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let weekdayCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        weekdayCount++;
      }
    }

    return weekdayCount;
  };

  const weekdaysInMonth = getWeekdaysInMonth(selectedMonth);

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

  // Group classes by grade
  const classesByGrade = classesData.reduce((acc, classData) => {
    if (!acc[classData.grade]) {
      acc[classData.grade] = [];
    }
    acc[classData.grade].push(classData);
    return acc;
  }, {} as Record<number, ClassAnalytics[]>);

  // Sort each grade's classes
  const sortedGrades = Object.keys(classesByGrade)
    .map(Number)
    .sort((a, b) => a - b);

  sortedGrades.forEach((grade) => {
    classesByGrade[grade].sort((a, b) => {
      if (sortBy === "rate") return b.attendanceRate - a.attendanceRate;
      if (sortBy === "students") return b.studentCount - a.studentCount;
      return a.className.localeCompare(b.className);
    });
  });

  const totalStudents = classesData.reduce((sum, c) => sum + c.studentCount, 0);
  const totalPresent = classesData.reduce((sum, c) => sum + c.totalPresent, 0);
  const totalAbsent = classesData.reduce((sum, c) => sum + c.totalAbsent, 0);
  const overallRate =
    totalPresent + totalAbsent > 0
      ? ((totalPresent / (totalPresent + totalAbsent)) * 100).toFixed(1)
      : "0";

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
                onClick={() => router.push("/dashboard")}
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
                onClick={() => router.push("/dashboard")}
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                School Analytics Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Overview of all classes attendance and performance
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

        {/* Content Area with Loading State */}
        <div className="p-8 max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading analytics...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Month Selector */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6"
              >
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <ChevronLeft className="w-6 h-6 text-green-600" />
                  </button>
                  <h2 className="text-xl font-semibold text-gray-800">
                    {formatMonthYear(selectedMonth)}
                  </h2>
                  <button
                    onClick={() => changeMonth(1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <ChevronRight className="w-6 h-6 text-green-600" />
                  </button>
                </div>
              </motion.div>

              {/* Overall Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-sm text-gray-600">Total Students</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-800">
                    {totalStudents}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Across {classesData.length} classes
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-sm text-gray-600">Total Present</p>
                  </div>
                  <p className="text-3xl font-bold text-green-600">
                    {totalPresent}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {totalStudents > 0 && weekdaysInMonth > 0
                      ? `${(
                          (totalPresent / (totalStudents * weekdaysInMonth)) *
                          100
                        ).toFixed(1)}% of expected attendances`
                      : "Student attendances"}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    </div>
                    <p className="text-sm text-gray-600">Total Absent</p>
                  </div>
                  <p className="text-3xl font-bold text-red-600">
                    {totalAbsent}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Student absences</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-sm text-gray-600">Overall Rate</p>
                  </div>
                  <p className="text-3xl font-bold text-green-600">
                    {overallRate}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">School average</p>
                </motion.div>
              </div>

              {/* Sort Options */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">
                  Class Performance by Grade
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortBy("rate")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      sortBy === "rate"
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    By Rate
                  </button>
                  <button
                    onClick={() => setSortBy("students")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      sortBy === "students"
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    By Size
                  </button>
                  <button
                    onClick={() => setSortBy("name")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      sortBy === "name"
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    By Name
                  </button>
                </div>
              </div>

              {/* Classes Grouped by Grade */}
              {sortedGrades.map((grade) => (
                <div key={grade} className="mb-8">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 mb-4">
                    <h3 className="text-xl font-bold text-white">
                      Grade {grade}
                    </h3>
                    <p className="text-sm text-green-50">
                      {classesByGrade[grade].length} class
                      {classesByGrade[grade].length !== 1 ? "es" : ""} •{" "}
                      {classesByGrade[grade].reduce(
                        (sum, c) => sum + c.studentCount,
                        0
                      )}{" "}
                      students
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {classesByGrade[grade].map((classData, idx) => (
                      <motion.div
                        key={classData.classID}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">
                              {classData.grade} {classData.className}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {classData.teacherName}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {classData.studentCount} students
                            </p>
                          </div>
                          <div
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              classData.attendanceRate >= 90
                                ? "bg-green-100 text-green-700"
                                : classData.attendanceRate >= 75
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {classData.attendanceRate.toFixed(1)}%
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-1">
                              Present
                            </p>
                            <p className="text-2xl font-bold text-green-600">
                              {classData.totalPresent}
                            </p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-1">Absent</p>
                            <p className="text-2xl font-bold text-red-600">
                              {classData.totalAbsent}
                            </p>
                          </div>
                        </div>

                        {/* Alerts */}
                        <div className="space-y-2">
                          {classData.lowAttendanceCount > 0 && (
                            <div className="flex items-center gap-2 bg-orange-50 rounded-lg p-2">
                              <AlertTriangle className="w-4 h-4 text-orange-600" />
                              <p className="text-xs text-orange-700">
                                {classData.lowAttendanceCount} student(s) below
                                75%
                              </p>
                            </div>
                          )}
                          {classData.perfectAttendanceCount > 0 && (
                            <div className="flex items-center gap-2 bg-green-50 rounded-lg p-2">
                              <Trophy className="w-4 h-4 text-green-600" />
                              <p className="text-xs text-green-700">
                                {classData.perfectAttendanceCount} perfect
                                attendance
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}

              {classesData.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No class data available</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
