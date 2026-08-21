"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Edit2,
  User,
  BookOpen,
  Users,
  BarChart3,
  Shield,
  Bell,
  LogOut,
  Menu,
  Home,
  UserCog,
  ShieldCheck,
  Car,
} from "lucide-react";

interface Driver {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  idNumber: string;
  ppic?: string;
}

export default function DriverPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("driver");

  const DEFAULT_PROFILE_PIC =
    "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  const getSafeImageSrc = (img?: string) => {
    const fallback = DEFAULT_PROFILE_PIC;

    if (!img) return fallback;

    if (/^data:image\/(png|jpeg|jpg|gif);base64,[A-Za-z0-9+/=]+$/.test(img)) {
      return img;
    }

    if (/^[A-Za-z0-9+/=]+$/.test(img)) {
      return `data:image/png;base64,${img}`;
    }

    return img;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const driversRef = collection(db, "Driver");
      const snapshot = await getDocs(driversRef);

      const driverList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();

          const usersQuery = query(
            collection(db, "users"),
            where("id", "==", data.id)
          );
          const userQuerySnapshot = await getDocs(usersQuery);

          let ppic = "";
          if (!userQuerySnapshot.empty) {
            const userData = userQuerySnapshot.docs[0].data();
            ppic = userData.ppic || "";
          }

          return { ...data, ppic } as Driver;
        })
      );

      setDrivers(driverList);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const toggleSelectDriver = (driverID: string) => {
    setSelectedDrivers((prev) =>
      prev.includes(driverID)
        ? prev.filter((id) => id !== driverID)
        : [...prev, driverID]
    );
  };

  const handleDeleteDrivers = async () => {
    if (selectedDrivers.length === 0) return alert("No drivers selected.");
    const confirmed = confirm(
      "⚠️ Are you sure you want to delete these drivers?"
    );
    if (!confirmed) return;

    try {
      for (const id of selectedDrivers) {
        await deleteDoc(doc(db, "Driver", id));
      }
      alert("🗑️ Selected drivers deleted successfully.");
      setSelectedDrivers([]);
      setEditMode(false);
      fetchDrivers();
    } catch (error) {
      console.error("Error deleting drivers:", error);
      alert("Error deleting some drivers.");
    }
  };

  const handleEditDriver = (driver: Driver) => {
    setEditingDriver({ ...driver });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDriver) return;

    try {
      const driverRef = doc(db, "Driver", editingDriver.id);
      await updateDoc(driverRef, {
        fullName: editingDriver.fullName,
        email: editingDriver.email,
        phone: editingDriver.phone,
        idNumber: editingDriver.idNumber,
      });

      const usersQuery = query(
        collection(db, "users"),
        where("id", "==", editingDriver.id)
      );
      const userQuerySnapshot = await getDocs(usersQuery);

      if (!userQuerySnapshot.empty) {
        const userDocRef = userQuerySnapshot.docs[0].ref;
        await updateDoc(userDocRef, {
          fullName: editingDriver.fullName, // Add this
          phone: editingDriver.phone,
          email: editingDriver.email,
          ppic: editingDriver.ppic || "",
        });
      }

      alert("✅ Driver updated successfully!");
      setShowEditModal(false);
      setEditingDriver(null);
      fetchDrivers();
    } catch (error) {
      console.error("Error updating driver:", error);
      alert("Error updating driver.");
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
              <h1 className="text-2xl font-bold text-gray-800">Drivers</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage and view all registered drivers
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
                <p className="text-gray-500 text-lg">Loading drivers...</p>
              </div>
            </div>
          ) : (
            <>
              {drivers.length === 0 ? (
                <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                  <p className="text-gray-500 italic text-lg">
                    No drivers found.
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="bg-white shadow-lg rounded-xl p-6 border border-gray-200"
                >
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-3">
                      <h2 className="text-xl font-semibold text-gray-800">
                        Driver List
                      </h2>
                      <span className="bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full">
                        Total: {drivers.length}
                      </span>
                    </div>

                    <div className="flex space-x-3">
                      {editMode && (
                        <button
                          onClick={handleDeleteDrivers}
                          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 active:scale-95 transition"
                        >
                          🗑 Delete Selected
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditMode(!editMode);
                          setSelectedDrivers([]);
                        }}
                        className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 active:scale-95 transition"
                      >
                        {editMode ? "Cancel Edit" : "✏️ Edit"}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="py-3 px-4 text-left border-b">
                            Profile
                          </th>
                          <th className="py-3 px-4 text-left border-b">ID</th>
                          <th className="py-3 px-4 text-left border-b">
                            Full Name
                          </th>
                          <th className="py-3 px-4 text-left border-b">
                            Email
                          </th>
                          <th className="py-3 px-4 text-left border-b">
                            Phone
                          </th>
                          <th className="py-3 px-4 text-left border-b">
                            IC Number
                          </th>
                          {editMode && (
                            <>
                              <th className="py-3 px-4 text-center border-b">
                                Edit
                              </th>
                              <th className="py-3 px-4 text-center border-b">
                                Select
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {drivers.map((driver, index) => (
                          <motion.tr
                            key={driver.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="hover:bg-gray-50 border-b border-gray-100"
                          >
                            <td className="py-3 px-4">
                              <img
                                src={getSafeImageSrc(driver.ppic)}
                                alt={driver.fullName}
                                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    DEFAULT_PROFILE_PIC;
                                }}
                              />
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              {driver.id}
                            </td>
                            <td className="py-3 px-4 text-gray-800 font-medium">
                              {driver.fullName}
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              {driver.email}
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              {driver.phone}
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              {driver.idNumber}
                            </td>
                            {editMode && (
                              <>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => handleEditDriver(driver)}
                                    className="text-blue-500 hover:text-blue-700 transition"
                                  >
                                    <Edit2 className="w-5 h-5" />
                                  </button>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedDrivers.includes(
                                      driver.id
                                    )}
                                    onChange={() =>
                                      toggleSelectDriver(driver.id)
                                    }
                                    className="cursor-pointer"
                                  />
                                </td>
                              </>
                            )}
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

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

      {/* EDIT DRIVER MODAL */}
      <AnimatePresence>
        {showEditModal && editingDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4"
            onClick={() => {
              setShowEditModal(false);
              setEditingDriver(null);
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
                  setEditingDriver(null);
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-xl font-semibold text-gray-700 mb-6">
                Edit Driver Details
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Driver ID (Read-only)
                  </label>
                  <input
                    type="text"
                    value={editingDriver.id}
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
                      src={getSafeImageSrc(editingDriver.ppic)}
                      alt="Preview"
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          DEFAULT_PROFILE_PIC;
                      }}
                    />
                    <input
                      type="text"
                      value={editingDriver.ppic || ""}
                      onChange={(e) =>
                        setEditingDriver({
                          ...editingDriver,
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
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={editingDriver.fullName}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        fullName: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg p-2 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={editingDriver.email}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        email: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg p-2 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="text"
                    value={editingDriver.phone}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        phone: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg p-2 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IC Number *
                  </label>
                  <input
                    type="text"
                    value={editingDriver.idNumber}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        idNumber: e.target.value,
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
                    setEditingDriver(null);
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
