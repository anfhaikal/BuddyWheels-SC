"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { motion } from "framer-motion";
import {
  User,
  BookOpen,
  Users,
  BarChart3,
  Shield,
  Car,
  Bell,
  LogOut,
  Menu,
  UserCog,
  ShieldCheck,
  Home,
  X,
} from "lucide-react";

type Student = {
  id: string;
  studentID?: string;
  studentName?: string;
  name?: string;
  gender?: string;
  grade?: number;
  classID?: string | null;
  class?: string | null;
};

type ClassData = {
  classID: string;
  className: string;
  grade: number;
  teacherID: string;
  studentCount?: number;
};

export default function ClassDetailsPage() {
  const { classID } = useParams();
  const router = useRouter();

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<ClassData>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [gradeStudents, setGradeStudents] = useState<Student[]>([]);
  const [loadingGradeStudents, setLoadingGradeStudents] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("class");

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const getGenderCounts = () => {
    const maleCount = students.filter((s) => s.gender === "M").length;
    const femaleCount = students.filter((s) => s.gender === "F").length;
    return { maleCount, femaleCount };
  };

  useEffect(() => {
    const fetchClassAndStudents = async () => {
      if (!classID) return;
      try {
        const classRef = doc(db, "classes", String(classID));
        const classSnap = await getDoc(classRef);

        if (classSnap.exists()) {
          const classInfo = classSnap.data() as ClassData;
          setClassData(classInfo);
          setEditData(classInfo);
        }

        const studentsRef = collection(db, "students");
        const q = query(studentsRef, where("classID", "==", String(classID)));
        const studentSnap = await getDocs(q);
        const studentList = studentSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Student)
        );
        setStudents(studentList);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClassAndStudents();
  }, [classID]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditData((prev) => ({
      ...prev,
      [name]: name === "grade" ? Number(value) : value,
    }));
  };

  const handleSave = async () => {
    if (!classID) return;
    setSaving(true);
    try {
      const docRef = doc(db, "classes", String(classID));
      await updateDoc(docRef, {
        ...editData,
        studentCount: students.length,
      });
      alert("✅ Class updated successfully!");
      setClassData({
        ...(editData as ClassData),
        studentCount: students.length,
      });
      setEditMode(false);
    } catch (error) {
      console.error("Error updating class:", error);
      alert("❌ Failed to update class.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddStudent = async () => {
    if (!classData?.grade) {
      alert("Class grade not found.");
      return;
    }

    setLoadingGradeStudents(true);
    setShowAddModal(true);

    try {
      const studentsRef = collection(db, "students");
      const q = query(
        studentsRef,
        where("grade", "==", String(classData.grade))
      );
      const snap = await getDocs(q);

      const allStudents = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Student)
      );

      const sortedStudents = allStudents.sort((a, b) => {
        if (!a.classID && b.classID) return -1;
        if (a.classID && !b.classID) return 1;
        return 0;
      });

      setGradeStudents(sortedStudents);
    } catch (error) {
      console.error("Error fetching grade students:", error);
    } finally {
      setLoadingGradeStudents(false);
    }
  };

  const handleAssignStudent = async (student: Student) => {
    const confirmAction = confirm(
      `Assign ${student.studentName || student.name} to class ${
        classData?.className
      }?`
    );
    if (!confirmAction) return;

    try {
      const studentRef = doc(db, "students", student.id);

      await updateDoc(studentRef, {
        classID: String(classID),
        class: classData?.className || "",
      });

      alert(
        `✅ ${student.studentName || student.name} added to ${
          classData?.className
        }`
      );

      setGradeStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? { ...s, classID: String(classID), class: classData?.className }
            : s
        )
      );

      setStudents((prev) => [
        ...prev,
        { ...student, classID: String(classID), class: classData?.className },
      ]);
    } catch (error) {
      console.error("Error assigning student:", error);
      alert("❌ Failed to assign student.");
    }
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const handleDeleteStudents = async () => {
    if (selectedStudents.length === 0) {
      alert("Please select at least one student to delete.");
      return;
    }

    const confirmDelete = confirm("Confirm to delete selected students?");
    if (!confirmDelete) return;

    try {
      for (const id of selectedStudents) {
        const studentRef = doc(db, "students", id);
        await updateDoc(studentRef, {
          classID: null,
          class: null,
        });
      }

      alert("✅ Selected students removed from this class.");

      setStudents((prev) =>
        prev.filter((s) => !selectedStudents.includes(s.id))
      );

      setSelectedStudents([]);
      setIsDeleteMode(false);
    } catch (error) {
      console.error("Error deleting students:", error);
      alert("❌ Failed to delete students.");
    }
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
                Class: {classData?.className || "Loading..."}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage class details and student roster
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition text-gray-700 text-sm"
              >
                ⬅ Back
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
                <p className="text-gray-500 text-lg">
                  Loading class details...
                </p>
              </div>
            </div>
          ) : !classData ? (
            <div className="flex justify-center items-center py-20">
              <p className="text-red-500 text-lg">
                Class not found or deleted.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col lg:flex-row items-start gap-8">
                {/* Left section - Class Info */}
                <div className="w-full lg:w-[35%]">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold text-gray-800">
                        Class Information
                      </h2>

                      {!editMode ? (
                        <button
                          onClick={() => setEditMode(true)}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          ✏️ Edit
                        </button>
                      ) : (
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className={`px-3 py-1 rounded-lg text-white text-sm font-semibold transition ${
                            saving
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          {saving ? "Saving..." : "💾 Save"}
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {["classID", "className", "grade", "teacherID"].map(
                        (field) => (
                          <div key={field}>
                            <label className="block text-gray-700 font-medium mb-1 capitalize text-sm">
                              {field === "classID"
                                ? "Class ID"
                                : field === "className"
                                ? "Class Name"
                                : field === "teacherID"
                                ? "Teacher ID"
                                : "Grade"}
                            </label>
                            <input
                              type={field === "grade" ? "number" : "text"}
                              name={field}
                              value={(editData as any)[field] ?? ""}
                              onChange={handleChange}
                              disabled={!editMode}
                              className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-600 focus:ring-2 ${
                                editMode
                                  ? "focus:ring-green-500 bg-white"
                                  : "bg-gray-100 cursor-not-allowed"
                              }`}
                            />
                          </div>
                        )
                      )}

                      <div>
                        <label className="block text-gray-700 font-medium mb-1 text-sm">
                          Student Count
                        </label>
                        <input
                          type="number"
                          value={students.length}
                          disabled
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Right section - Student List */}
                <div className="w-full lg:w-[65%]">
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
                  >
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-semibold text-gray-800">
                          Students
                        </h2>
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                          {students.length}
                        </span>
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                          👨 {getGenderCounts().maleCount}
                        </span>
                        <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm">
                          👩 {getGenderCounts().femaleCount}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleOpenAddStudent}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          ➕ Add Student
                        </button>
                        <button
                          onClick={() => {
                            setIsDeleteMode((prev) => !prev);
                            setSelectedStudents([]);
                          }}
                          className={`px-3 py-2 rounded-lg text-sm text-white ${
                            isDeleteMode
                              ? "bg-gray-500 hover:bg-gray-600"
                              : "bg-red-600 hover:bg-red-700"
                          }`}
                        >
                          {isDeleteMode ? "Cancel" : "🗑 Edit"}
                        </button>
                      </div>
                    </div>

                    {isDeleteMode && selectedStudents.length > 0 && (
                      <div className="mb-3 flex justify-end">
                        <button
                          onClick={handleDeleteStudents}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                        >
                          Confirm Delete ({selectedStudents.length})
                        </button>
                      </div>
                    )}

                    {students.length === 0 ? (
                      <p className="text-gray-500 italic text-center py-8">
                        No students in this class.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-100 text-gray-700">
                              <th className="py-3 px-4 text-left border-b">
                                Student ID
                              </th>
                              <th className="py-3 px-4 text-left border-b">
                                Name
                              </th>
                              {isDeleteMode && (
                                <th className="py-3 px-4 text-center border-b">
                                  ✔
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((student) => (
                              <tr
                                key={student.id}
                                className="hover:bg-gray-50 transition border-b"
                              >
                                <td className="py-3 px-4 text-gray-600">
                                  {student.studentID}
                                </td>
                                <td className="py-3 px-4 text-gray-800">
                                  {student.studentName || student.name}
                                </td>
                                {isDeleteMode && (
                                  <td className="py-3 px-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedStudents.includes(
                                        student.id
                                      )}
                                      onChange={() =>
                                        toggleSelectStudent(student.id)
                                      }
                                      className="cursor-pointer"
                                    />
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>

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

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl w-11/12 max-w-4xl p-6 shadow-xl relative max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-semibold text-gray-800">
                Add Students (Grade {classData?.grade || "N/A"})
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-red-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {loadingGradeStudents ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading students...</p>
                </div>
              </div>
            ) : gradeStudents.length === 0 ? (
              <p className="text-gray-500 text-center py-12 italic">
                No students found for this grade.
              </p>
            ) : (
              <div className="overflow-y-auto flex-1">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr className="text-gray-700">
                      <th className="py-3 px-4 text-left border-b">
                        Student ID
                      </th>
                      <th className="py-3 px-4 text-left border-b">Name</th>
                      <th className="py-3 px-4 text-left border-b">Gender</th>
                      <th className="py-3 px-4 text-left border-b">Grade</th>
                      <th className="py-3 px-4 text-left border-b">Class ID</th>
                      <th className="py-3 px-4 text-center border-b">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeStudents.map((student) => (
                      <tr
                        key={student.id}
                        className={`transition hover:bg-gray-50 border-b ${
                          student.classID ? "opacity-70 bg-gray-50" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-gray-600">
                          {student.studentID}
                        </td>
                        <td className="py-3 px-4 text-gray-800">
                          {student.studentName || student.name}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {student.gender}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {student.grade}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {student.classID || "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleAssignStudent(student)}
                            disabled={student.classID === String(classID)}
                            className={`px-3 py-1 rounded-md text-white text-sm ${
                              !student.classID
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-blue-500 hover:bg-blue-600"
                            }`}
                          >
                            {student.classID ? "🔁 Reassign" : "➕ Add"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
