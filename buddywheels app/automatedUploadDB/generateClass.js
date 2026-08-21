import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
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

// 🧠 Class mapping
const classMap = {
  CERDIK: "C",
  BIJAK: "B",
  RAJIN: "R",
  AMANAH: "A",
};

async function generateClasses() {
  const studentsSnap = await getDocs(collection(db, "students"));
  const classesMap = new Map();

  // 🔹 Step 1: Count how many students per class
  studentsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const classLetter =
      classMap[data.class?.toUpperCase()] ||
      data.class?.[0]?.toUpperCase() ||
      "X";
    const classID = `${data.grade}${classLetter}`;
    const key = `${classID}|${data.grade}|${data.class}`;

    if (!classesMap.has(key)) {
      classesMap.set(key, {
        count: 1,
        grade: data.grade,
        className: data.class,
      });
    } else {
      classesMap.get(key).count++;
    }
  });

  // 🔹 Step 2: Create / update class documents
  for (const [key, info] of classesMap) {
    const [classID, grade, className] = key.split("|");
    const classDoc = {
      classID,
      grade: Number(grade),
      className,
      teacherID: null, // placeholder
      studentCount: info.count,
    };

    await setDoc(doc(db, "classes", classID), classDoc);
    console.log(
      `✅ Created/Updated class ${classID} (${className}) with ${info.count} students`
    );
  }

  console.log("🎉 All class documents updated successfully!");
}

generateClasses();
