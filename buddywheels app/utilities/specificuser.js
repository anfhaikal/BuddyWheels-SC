// utilities/notifySpecificUser.js
import { sendNotificationToUser } from "./triggerNotification";

/**
 * Example function to send notification to one specific user
 */
export const notifySpecificUser = async (userId) => {
  await sendNotificationToUser(
    userId,
    "Booking Confirmed",
    "Your ride is on the way! 🚗",
    "success"
  );
};

// Uncomment to test manually
// notifySpecificUser("USER_FIREBASE_UID_HERE");
