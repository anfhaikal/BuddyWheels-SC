"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [id, setID] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // Sign in using Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(
        auth,
        id,
        password
      );
      const user = userCredential.user;

      // Restrict login to only admin email
      if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        setError("Access denied. You are not authorized.");
        return;
      }

      console.log("Admin logged in:", user.email);
      router.push("/dashboard"); // redirect after successful login
    } catch (err: any) {
      console.error(err);
      setError("You will not pass!");
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gray-100 overflow-hidden">
      {/* Background animation */}
      <motion.span
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 bg-gradient-to-tr from-green-200 via-white to-green-100 opacity-70"
      ></motion.span>
      <motion.span
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.2 }}
        className="absolute inset-0 bg-gradient-to-br from-green-100 via-white to-green-200 opacity-70"
      ></motion.span>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-md shadow-xl rounded-2xl p-8 border border-gray-200"
      >
        <div className="flex justify-center mb-6">
          <img
            src="/logo.png"
            alt="BuddyWheels Logo"
            className="w-3/4 max-w-[220px] drop-shadow-md"
          />
        </div>

        <div className="text-center mb-6">
          <h3 className="text-2xl font-semibold text-gray-800">
            Welcome to BuddyWheels Admin Dashboard
          </h3>
          <p className="text-gray-500 mt-1">Please log in below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={id}
            onChange={(e) => setID(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-400 text-gray-800 placeholder-gray-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-400 text-gray-800 placeholder-gray-500"
          />

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 active:scale-95 transition-transform"
          >
            Login
          </button>
        </form>
      </motion.div>
    </div>
  );
}
