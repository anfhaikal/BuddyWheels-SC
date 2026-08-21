import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_rHt5HtQgk7DhXwAtasFxmlkgbaD_G34",
  authDomain: "buddywheels-2211719.firebaseapp.com",
  projectId: "buddywheels-2211719",
  storageBucket: "buddywheels-2211719.firebasestorage.app",
  messagingSenderId: "126392678797",
  appId: "1:126392678797:web:52c63c55e01544df4d65c4",
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth safely with AsyncStorage persistence
let auth;
try {
  // Try initializing Auth with persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // If already initialized, get existing instance
  auth = getAuth(app);
}

// Firestore
const db = getFirestore(app);

export { app, auth, db };
