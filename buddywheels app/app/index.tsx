// app/index.tsx
import { Redirect } from "expo-router";

export default function Index() {
  // ✅ send non-logged-in users to login page
  return <Redirect href="/(auth)/loginscreen" />;
}
