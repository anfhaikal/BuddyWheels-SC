// renameStudentDocs.js

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebaseRenamseStudentConfig.js";

async function renameStudentDocuments() {
  try {
    const studentsRef = collection(db, "students");
    const snapshot = await getDocs(studentsRef);

    for (const studentDoc of snapshot.docs) {
      const data = studentDoc.data();
      const studentID = data.studentID;

      if (!studentID) {
        console.log(`❌ Skipping doc ${studentDoc.id} — missing studentID`);
        continue;
      }

      // Check if new doc already exists
      const newDocRef = doc(db, "students", studentID);
      const newDoc = { ...data };

      // 1️⃣ Copy data to new doc
      await setDoc(newDocRef, newDoc);

      // 2️⃣ Delete old auto-generated doc
      await deleteDoc(studentDoc.ref);

      console.log(`✅ Renamed ${studentDoc.id} → ${studentID}`);
    }

    console.log("🎉 All documents renamed successfully!");
  } catch (error) {
    console.error("🔥 Error renaming documents:", error);
  }
}

renameStudentDocuments();
