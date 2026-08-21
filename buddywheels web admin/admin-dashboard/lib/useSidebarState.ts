import { useState, useEffect, useRef } from "react";

export function useSidebarState() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isInitialized = useRef(false);

  // Load saved state on mount - only once
  useEffect(() => {
    const savedOpen = localStorage.getItem("sidebarOpen");

    if (savedOpen !== null) {
      setSidebarOpen(savedOpen === "true");
    }

    isInitialized.current = true;

    // Restore scroll position after a short delay to ensure DOM is ready
    setTimeout(() => {
      const savedScroll = localStorage.getItem("sidebarScroll");
      const sidebar = document.getElementById("admin-sidebar");

      if (sidebar && savedScroll) {
        sidebar.scrollTop = parseInt(savedScroll, 10);
      }
    }, 100);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const newValue = !prev;
      localStorage.setItem("sidebarOpen", String(newValue));
      return newValue;
    });
  };

  // Use a ref to debounce scroll saves
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveSidebarScroll = (position: number) => {
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce: only save after scrolling stops for 150ms
    scrollTimeoutRef.current = setTimeout(() => {
      localStorage.setItem("sidebarScroll", String(position));
    }, 150);
  };

  // Save scroll position before navigation
  const saveScrollBeforeNavigation = () => {
    const sidebar = document.getElementById("admin-sidebar");
    if (sidebar) {
      localStorage.setItem("sidebarScroll", String(sidebar.scrollTop));
    }
  };

  return {
    sidebarOpen,
    toggleSidebar,
    saveSidebarScroll,
    saveScrollBeforeNavigation,
  };
}
