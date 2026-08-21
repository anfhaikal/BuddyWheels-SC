// utilities/sendNotification.js
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseServerConfig.js";

/**
 * Save a notification to Firestore for a specific user.
 */
export const sendNotification = async (
  userId,
  title,
  message,
  type = "info"
) => {
  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      title,
      message,
      type, // "info", "success", "warning", "error"
      isRead: false,
      timestamp: serverTimestamp(),
    });

    console.log(`✅ Notification sent to user: ${userId}`);
  } catch (error) {
    console.error("❌ Error sending notification:", error);
  }
};
