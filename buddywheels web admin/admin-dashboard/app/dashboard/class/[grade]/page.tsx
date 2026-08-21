"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlusCircle,
  Car,
  BookOpen,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  BarChart3,
  Shield,
  Bell,
  LogOut,
  UserCog,
  ShieldCheck,
  Menu,
  Home,
} from "lucide-react";

export default function GradeClassPage() {
  const params = useParams();
  const grade = params?.grade ? String(params.grade) : "";
  const router = useRouter();

  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("class");

  const [classID, setClassID] = useState("");
  const [className, setClassName] = useState("");
  const [studentCount, setStudentCount] = useState("");
  const [teacherID, setTeacherID] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchClasses = async () => {
    if (!grade) return;
    setLoading(true);

    try {
      const q = query(
        collection(db, "classes"),
        where("grade", "==", Number(grade))
      );
      const snapshot = await getDocs(q);
      const fetched: any[] = [];
      snapshot.forEach((doc) => fetched.push({ id: doc.id, ...doc.data() }));
      setClasses(fetched);
    } catch (err) {
      console.error("Error fetching classes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [grade]);

  const handleAddClass = async () => {
    if (!classID.trim()) return alert("Please enter a Class ID.");
    if (!className.trim()) return alert("Please enter a Class Name.");

    const cleanedData = {
      classID: classID.trim(),
      className: className.trim(),
      grade: Number(grade),
      studentCount: studentCount.trim() ? Number(studentCount) : 0,
      teacherID: teacherID.trim() || "",
    };

    await setDoc(doc(db, "classes", cleanedData.classID), cleanedData);

    setClassID("");
    setClassName("");
    setStudentCount("");
    setTeacherID("");

    fetchClasses();
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-50 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center space-x-3 sticky top-0 bg-white z-10">
          <img
            src="/logo2.png"
            alt="BuddyWheels Logo"
            className="w-8 h-8 cursor-pointer"
            onClick={() => router.push("/dashboard")}
          />
          <span className="font-semibold text-gray-800">BuddyWheels</span>
        </div>

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

          <div className="pt-4 mt-4 border-t border-gray-200">
            {sidebarOpen && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4">
                Admin Tools
              </h3>
            )}
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
                <span className="absolute left-20 ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
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
                <span className="absolute left-20 ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Notifications
                </span>
              )}
            </button>
          </div>
        </nav>

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
              <span className="absolute left-20 ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 ml-64">
        <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-40">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {grade
                  ? `Grade ${grade} - Class Management`
                  : "Loading Grade..."}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Add, view, and manage all classes for this grade
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard/class")}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition text-gray-700 text-sm"
              >
                ⬅ Back to Grades
              </button>
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

        <div className="p-8">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-500 text-lg">Loading classes...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Add Class Card (Collapsible) */}
              <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-xl border border-gray-200 mb-10 overflow-hidden">
                <button
                  onClick={() => setIsAddOpen(!isAddOpen)}
                  className="w-full flex justify-between items-center p-6 bg-gray-50 hover:bg-gray-100 transition"
                >
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                    <PlusCircle className="w-6 h-6 mr-2 text-green-600" /> Add a
                    New Class
                  </h3>
                  {isAddOpen ? (
                    <ChevronUp className="w-6 h-6 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                <AnimatePresence>
                  {isAddOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="p-8 border-t border-gray-100"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                        <input
                          type="text"
                          placeholder="Class ID (e.g. CLS001)"
                          value={classID}
                          onChange={(e) => setClassID(e.target.value)}
                          className="border border-gray-300 rounded-lg p-3 shadow-sm focus:ring-2 focus:ring-green-400 placeholder-gray-400 text-gray-600"
                        />
                        <input
                          type="text"
                          placeholder="Class Name (e.g. 1A)"
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                          className="border border-gray-300 rounded-lg p-3 shadow-sm focus:ring-2 focus:ring-green-400 placeholder-gray-400 text-gray-600"
                        />
                        <input
                          type="number"
                          placeholder="Student Count"
                          value={studentCount}
                          onChange={(e) => setStudentCount(e.target.value)}
                          className="border border-gray-300 rounded-lg p-3 shadow-sm focus:ring-2 focus:ring-green-400 placeholder-gray-400 text-gray-600"
                        />
                        <input
                          type="text"
                          placeholder="Teacher ID"
                          value={teacherID}
                          onChange={(e) => setTeacherID(e.target.value)}
                          className="border border-gray-300 rounded-lg p-3 shadow-sm focus:ring-2 focus:ring-green-400 placeholder-gray-400 text-gray-600"
                        />
                      </div>

                      <button
                        onClick={handleAddClass}
                        className="w-full flex items-center justify-center bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 active:scale-95 transition"
                      >
                        <PlusCircle className="w-5 h-5 mr-2" /> Add Class
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Class List */}
              {classes.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                  <p className="text-gray-500 text-lg">
                    No classes found for Grade {grade}.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                  {classes.map((cls, index) => (
                    <motion.div
                      key={cls.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.03 }}
                      onClick={() =>
                        router.push(`/dashboard/class/${grade}/${cls.classID}`)
                      }
                      className="cursor-pointer bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold text-gray-800">
                          {cls.className || "Unnamed Class"}
                        </h3>
                        <BookOpen className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Class ID:</span>{" "}
                          {cls.classID || "—"}
                        </p>
                        <p>
                          <span className="font-medium">Grade:</span>{" "}
                          {cls.grade || "—"}
                        </p>
                        <p>
                          <span className="font-medium">Students:</span>{" "}
                          {cls.studentCount ?? "—"}
                        </p>
                        <p>
                          <span className="font-medium">Teacher ID:</span>{" "}
                          {cls.teacherID || "—"}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              <footer className="text-center text-gray-500 mt-16">
                <p>
                  © {new Date().getFullYear()} BuddyWheels Admin Panel. All
                  rights reserved.
                </p>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
