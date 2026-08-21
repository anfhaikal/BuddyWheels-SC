import csv from "csv-parser";
import { initializeApp } from "firebase/app";
import { addDoc, collection, getFirestore } from "firebase/firestore";
import * as fs from "fs";

// 🔧 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyB_rHt5HtQgk7DhXwAtasFxmlkgbaD_G34",
  authDomain: "buddywheels-2211719.firebaseapp.com",
  projectId: "buddywheels-2211719",
  storageBucket: "buddywheels-2211719.firebasestorage.app",
  messagingSenderId: "126392678797",
  appId: "1:126392678797:web:52c63c55e01544df4d65c4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🚀 Upload function
async function uploadStudents() {
  fs.createReadStream("students.csv")
    .pipe(csv())
    .on("data", async (row) => {
      await addDoc(collection(db, "students"), row);
      console.log(`✅ Added ${row.name}`);
    })
    .on("end", () => {
      console.log("🎉 All students uploaded!");
    });
}

uploadStudents();
