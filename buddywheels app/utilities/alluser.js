// utilities/notifyAllUser.js
import { sendNotificationToAllUsers } from "./triggerNotification.js";

/**
 * Example function to notify all users (can be triggered manually or from admin UI)
 */
export const notifyAllUsers = async () => {
  await sendNotificationToAllUsers("test", "a", "info");
};

// Uncomment below line to test manually when running this file standalone
notifyAllUsers();
