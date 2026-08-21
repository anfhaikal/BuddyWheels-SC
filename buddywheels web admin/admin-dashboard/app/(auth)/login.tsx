import React, { useState } from "react";
import { motion } from "framer-motion"; // optional for smooth fade-in animations

export default function LoginPage() {
  const [icNumber, setIcNumber] = useState("");
  const [password, setPassword] = useState("");
  // @ts-ignore
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Logging in with:", { icNumber, password });
    // handle login logic (Firebase / API)
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gray-100 overflow-hidden">
      {/* Animated background gradients */}
      <motion.span
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 bg-gradient-to-tr from-blue-200 via-white to-blue-100 opacity-70"
      ></motion.span>
      <motion.span
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.2 }}
        className="absolute inset-0 bg-gradient-to-br from-blue-100 via-white to-blue-200 opacity-70"
      ></motion.span>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-md shadow-xl rounded-2xl p-8 border border-gray-200"
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/img/YTM_logo.png"
            alt="YTM Logo"
            className="w-3/4 max-w-[220px] drop-shadow-md"
          />
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-semibold text-gray-800">
            Welcome to YTM Scholar Site
          </h3>
          <p className="text-gray-500 mt-1">
            Please provide your login credential below.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              id="icNumber"
              name="icNumber"
              value={icNumber}
              onChange={(e) => setIcNumber(e.target.value)}
              placeholder="IC Number"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 active:scale-95 transition-transform"
          >
            Login
          </button>
        </form>

        {/* Forgot password */}
        <div className="mt-4 text-center">
          <a
            href="/forgot-password"
            className="text-blue-600 text-sm hover:underline"
          >
            Forgot password?
          </a>
        </div>
      </motion.div>
    </div>
  );
}
