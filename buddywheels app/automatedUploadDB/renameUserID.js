// renameUserDocuments.js

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebaseRenamseStudentConfig.js"; // ✅ update this path to your Firestore config

async function renameUserDocuments() {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    for (const userDoc of snapshot.docs) {
      const data = userDoc.data();
      const userId = data.id; // 👈 field inside the document

      if (!userId) {
        console.log(`❌ Skipping doc ${userDoc.id} — missing 'id' attribute`);
        continue;
      }

      // Check if a doc with the same ID already exists
      const newDocRef = doc(db, "users", userId);
      const newDoc = { ...data };

      // 1️⃣ Copy data to new doc (overwrite if necessary)
      await setDoc(newDocRef, newDoc);

      // 2️⃣ Delete the old auto-generated doc
      await deleteDoc(userDoc.ref);

      console.log(`✅ Renamed ${userDoc.id} → ${userId}`);
    }

    console.log("🎉 All user documents renamed successfully!");
  } catch (error) {
    console.error("🔥 Error renaming user documents:", error);
  }
}

renameUserDocuments();
