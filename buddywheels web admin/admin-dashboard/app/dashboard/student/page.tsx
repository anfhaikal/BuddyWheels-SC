"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";
import { motion, AnimatePresence } from "framer-motion";
// @ts-ignore
import Papa from "papaparse";
import {
  X,
  Edit2,
  User,
  BookOpen,
  Users,
  BarChart3,
  Car,
  Shield,
  Bell,
  LogOut,
  UserCog,
  ShieldCheck,
  Menu,
  Home,
} from "lucide-react";

interface Student {
  studentID: string;
  id: string;
  name: string;
  classID: string | null;
  grade: string | null;
  gender: string;
  parentID: string | null;
  busNumber?: string | null;
  ppic?: string | null;
}

export default function StudentPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("student");
  const [filters, setFilters] = useState({
    studentID: "",
    name: "",
    gender: "",
    classID: "",
    grade: "",
  });

  const DEFAULT_PROFILE_PIC =
    "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "students"));
      const studentList: Student[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Student[];

      const sortedList = studentList.sort((a, b) =>
        a.studentID.localeCompare(b.studentID, undefined, { numeric: true })
      );
      setStudents(sortedList);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        setCsvData(results.data);
      },
    });
  };

  const handleConfirmUpload = async () => {
    if (csvData.length === 0) return alert("No data to upload.");

    setUploading(true);
    try {
      const studentRef = collection(db, "students");
      for (const rawStudent of csvData) {
        const cleanedStudent = Object.fromEntries(
          Object.entries(rawStudent).map(([key, value]) => [
            key,
            value === "" ? null : value,
          ])
        );
        if (!cleanedStudent.studentID) continue;

        await setDoc(
          doc(studentRef, String(cleanedStudent.studentID)),
          cleanedStudent
        );
      }

      alert("✅ Students uploaded successfully!");
      setCsvData([]);
      setShowModal(false);
      fetchStudents();
    } catch (error) {
      console.error("Error uploading students:", error);
    } finally {
      setUploading(false);
    }
  };

  const toggleSelectStudent = (studentID: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentID)
        ? prev.filter((id) => id !== studentID)
        : [...prev, studentID]
    );
  };

  const handleDeleteStudents = async () => {
    if (selectedStudents.length === 0) return alert("No students selected.");
    const confirmed = confirm(
      "⚠️ Are you sure you want to delete these students?"
    );
    if (!confirmed) return;

    try {
      for (const id of selectedStudents) {
        await deleteDoc(doc(db, "students", id));
      }
      alert("🗑️ Selected students deleted successfully.");
      setSelectedStudents([]);
      setEditMode(false);
      fetchStudents();
    } catch (error) {
      console.error("Error deleting students:", error);
      alert("Error deleting some students.");
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent({ ...student });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;

    try {
      const studentRef = doc(db, "students", editingStudent.studentID);
      await updateDoc(studentRef, {
        name: editingStudent.name,
        gender: editingStudent.gender,
        grade: editingStudent.grade || null,
        classID: editingStudent.classID || null,
        parentID: editingStudent.parentID || null,
        busNumber: editingStudent.busNumber || null,
        ppic: editingStudent.ppic || null,
      });

      alert("✅ Student updated successfully!");
      setShowEditModal(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (error) {
      console.error("Error updating student:", error);
      alert("Error updating student.");
    }
  };

  const filteredStudents = students.filter((student) => {
    return (
      student.studentID
        ?.toLowerCase()
        .includes(filters.studentID.toLowerCase()) &&
      student.name?.toLowerCase().includes(filters.name.toLowerCase()) &&
      student.gender?.toLowerCase().includes(filters.gender.toLowerCase()) &&
      (student.classID ?? "")
        .toLowerCase()
        .includes(filters.classID.toLowerCase()) &&
      (student.grade ?? "").toLowerCase().includes(filters.grade.toLowerCase())
    );
  });

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
                <span className="absolute left-20 ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
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
                Student Records
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage and view all registered students
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

        <div className="p-8">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-500 text-lg">Loading student data...</p>
              </div>
            </div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white shadow-lg rounded-xl p-6 border border-gray-200"
              >
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-xl font-semibold text-gray-800">
                      Registered Students
                    </h2>
                    <span className="bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full">
                      Total: {filteredStudents.length}
                    </span>
                  </div>

                  <div className="flex space-x-3">
                    {editMode && (
                      <button
                        onClick={handleDeleteStudents}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 active:scale-95 transition"
                      >
                        🗑 Delete Selected
                      </button>
                    )}
                    <button
                      onClick={() => setEditMode(!editMode)}
                      className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 active:scale-95 transition"
                    >
                      {editMode ? "Cancel Edit" : "✏️ Edit"}
                    </button>
                    <button
                      onClick={() => setShowModal(true)}
                      className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 active:scale-95 transition"
                    >
                      + Register Students
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto overflow-y-hidden w-full">
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="p-3 text-left w-[15%]">Student ID</th>
                        <th className="p-3 text-left w-[30%]">Name</th>
                        <th className="p-3 text-left w-[10%]">Gender</th>
                        <th className="p-3 text-left w-[10%]">Grade</th>
                        <th className="p-3 text-left w-[15%]">Class ID</th>
                        {editMode && (
                          <>
                            <th className="p-3 text-center w-[10%]">Edit</th>
                            <th className="p-3 text-center w-[10%]">Select</th>
                          </>
                        )}
                      </tr>

                      <tr className="bg-gray-50">
                        {[
                          "studentID",
                          "name",
                          "gender",
                          "grade",
                          "classID",
                        ].map((key) => (
                          <th key={key} className="p-2">
                            <input
                              type="text"
                              placeholder={`Search ${key}`}
                              value={(filters as any)[key]}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  [key]: e.target.value,
                                })
                              }
                              className="border border-gray-300 p-1 rounded w-full text-sm placeholder-gray-400 text-gray-600"
                            />
                          </th>
                        ))}
                        {editMode && (
                          <>
                            <th></th>
                            <th></th>
                          </>
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td
                            colSpan={editMode ? 7 : 5}
                            className="text-center py-4 text-gray-500"
                          >
                            No matching students found.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student, index) => (
                          <motion.tr
                            key={student.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="hover:bg-gray-50 border-b border-gray-100"
                          >
                            <td className="p-3 text-gray-600">
                              {student.studentID}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={student.ppic || DEFAULT_PROFILE_PIC}
                                  alt={student.name}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      DEFAULT_PROFILE_PIC;
                                  }}
                                />
                                <span className="text-gray-800 font-medium">
                                  {student.name}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-gray-600">
                              {student.gender}
                            </td>
                            <td className="p-3 text-gray-600">
                              {student.grade || "—"}
                            </td>
                            <td className="p-3 text-gray-600">
                              {student.classID || "—"}
                            </td>
                            {editMode && (
                              <>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => handleEditStudent(student)}
                                    className="text-blue-500 hover:text-blue-700 transition"
                                  >
                                    <Edit2 className="w-5 h-5" />
                                  </button>
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedStudents.includes(
                                      student.studentID
                                    )}
                                    onChange={() =>
                                      toggleSelectStudent(student.studentID)
                                    }
                                    className="cursor-pointer"
                                  />
                                </td>
                              </>
                            )}
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              <footer className="text-center text-gray-500 mt-8">
                <p>
                  © {new Date().getFullYear()} BuddyWheels Admin Panel. All
                  rights reserved.
                </p>
              </footer>
            </>
          )}
        </div>
      </main>

      {/* CSV UPLOAD MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 shadow-xl w-[90%] max-w-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-xl font-semibold text-gray-700 mb-4">
                Upload Student CSV
              </h3>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="mb-4 border p-2 rounded w-full"
              />

              {csvData.length > 0 && (
                <>
                  <div className="overflow-x-auto border rounded-lg mt-4 max-h-64">
                    <table className="w-full text-sm table-auto">
                      <thead>
                        <tr className="bg-gray-100">
                          {Object.keys(csvData[0]).map((key) => (
                            <th
                              key={key}
                              className="px-3 py-2 border text-left"
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b">
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-3 py-2 border truncate">
                                {val as string}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-gray-500 mt-2 text-sm">
                    Showing first 5 of {csvData.length} rows
                  </p>
                </>
              )}

              <div className="flex justify-end mt-6 space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUpload}
                  disabled={uploading}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Confirm Upload"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT STUDENT MODAL */}
      <AnimatePresence>
        {showEditModal && editingStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4"
            onClick={() => {
              setShowEditModal(false);
              setEditingStudent(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 shadow-xl w-[90%] max-w-lg relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingStudent(null);
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-xl font-semibold text-gray-700 mb-6">
                Edit Student Details
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Student ID (Read-only)
                  </label>
                  <input
                    type="text"
                    value={editingStudent.studentID}
                    disabled
                    className="w-full border rounded-lg p-2 bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profile Picture URL
                  </label>
                  <div className="flex items-center gap-3">
                    <img
                      src={editingStudent.ppic || DEFAULT_PROFILE_PIC}
                      alt="Preview"
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          DEFAULT_PROFILE_PIC;
                      }}
                    />
                    <input
                      type="text"
                      value={editingStudent.ppic || ""}
                      onChange={(e) =>
                        setEditingStudent({
                          ...editingStudent,
                          ppic: e.target.value,
                        })
                      }
                      placeholder="Enter image URL or leave empty for default"
                      className="flex-1 border rounded-lg p-2 placeholder-gray-400 text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={editingStudent.name}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        name: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg p-2 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender *
                  </label>
                  <select
                    value={editingStudent.gender}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        gender: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg p-2 text-gray-600"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grade
                  </label>
                  <input
                    type="text"
                    value={editingStudent.grade || ""}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        grade: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg p-2 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class ID
                  </label>
                  <input
                    type="text"
                    value={editingStudent.classID || ""}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        classID: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg p-2 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent ID
                  </label>
                  <input
                    type="text"
                    value={editingStudent.parentID || ""}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        parentID: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg p-2 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bus Number
                  </label>
                  <input
                    type="text"
                    value={editingStudent.busNumber || ""}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        busNumber: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg p-2 text-gray-600"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-6 space-x-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
