// utilities/triggerNotification.js
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseServerConfig.js";
import { sendNotification } from "./sendNotification.js";

/**
 * Send a notification to a specific user.
 */
export const sendNotificationToUser = async (
  userId,
  title,
  message,
  type = "info"
) => {
  await sendNotification(userId, title, message, type);
};

/**
 * Send the same notification to all users in Firestore.
 */
export const sendNotificationToAllUsers = async (
  title,
  message,
  type = "info"
) => {
  try {
    console.log("📢 Fetching all users...");
    const usersSnapshot = await getDocs(collection(db, "users"));

    if (usersSnapshot.empty) {
      console.log("⚠️ No users found in Firestore.");
      return;
    }

    console.log(`📬 Sending notification to ${usersSnapshot.size} users...`);

    const promises = usersSnapshot.docs.map((doc) =>
      sendNotification(doc.id, title, message, type)
    );

    await Promise.all(promises);
    console.log("✅ Notifications sent to all users successfully!");
  } catch (error) {
    console.error("❌ Error sending notifications to all users:", error);
  }
};
