// deleteStudents.js
import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
} from "firebase/firestore";

// 🔧 Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyB_rHt5HtQgk7DhXwAtasFxmlkgbaD_G34",
  authDomain: "buddywheels-2211719.firebaseapp.com",
  projectId: "buddywheels-2211719",
  storageBucket: "buddywheels-2211719.firebasestorage.app",
  messagingSenderId: "126392678797",
  appId: "1:126392678797:web:52c63c55e01544df4d65c4",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🚀 Function to Delete Everything in 'students' Collection
async function deleteAllStudents() {
  const snapshot = await getDocs(collection(db, "students"));

  if (snapshot.empty) {
    console.log("⚠️ No documents found in 'students' collection.");
    return;
  }

  const deletions = snapshot.docs.map(async (docSnap) => {
    await deleteDoc(doc(db, "students", docSnap.id));
    console.log(`🗑️ Deleted: ${docSnap.id}`);
  });

  await Promise.all(deletions);
  console.log("✅ All documents in 'students' collection have been deleted.");
}

// 🏁 Run the cleanup
deleteAllStudents();
