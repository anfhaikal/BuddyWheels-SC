import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  updateDoc,
} from "firebase/firestore";

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

// 🏫 Map class names → letters
const classMap = {
  CERDIK: "C",
  BIJAK: "B",
  DINAMIK: "D",
  AMANAH: "A",
  // Add more mappings here if you have other class names
};

async function updateStudents() {
  const studentsRef = collection(db, "students");
  const snapshot = await getDocs(studentsRef);

  for (const student of snapshot.docs) {
    const data = student.data();

    // Find the mapped class letter
    const classLetter =
      classMap[data.class?.toUpperCase()] ||
      data.class?.[0]?.toUpperCase() ||
      "X";

    // Example: grade=5, classLetter=C → 5C
    const classID = `${data.grade}${classLetter}`;
    const parentID = null; // placeholder for later use

    await updateDoc(doc(db, "students", student.id), {
      classID,
      parentID,
    });

    console.log(`✅ Updated ${data.name} → classID: ${classID}`);
  }

  console.log("🎉 All students updated successfully!");
}

updateStudents();
