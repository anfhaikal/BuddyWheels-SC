// firebaseServerConfig.js
import { getApp, getApps, initializeApp } from "firebase/app";
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

// Only Firestore is needed for Node scripts
export const db = getFirestore(app);
