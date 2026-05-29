import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerMobilePushSubscription } from "../api/push-subscriptions";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

function getPushPlatform() {
  if (Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "web") {
    return Platform.OS;
  }

  return "unknown";
}

export async function registerPushTokenAfterLogin(accessToken: string) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("todo-reminders", {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: "Todo reminders",
      sound: "default",
    });
  }

  const currentPermissions = await Notifications.getPermissionsAsync();
  const finalPermissions =
    currentPermissions.status === "granted"
      ? currentPermissions
      : await Notifications.requestPermissionsAsync();

  if (finalPermissions.status !== "granted") {
    return { registered: false, reason: "permission-denied" as const };
  }

  const projectId = getProjectId();
  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  await registerMobilePushSubscription(accessToken, {
    deviceName: Constants.deviceName ?? null,
    expoPushToken: tokenResult.data,
    platform: getPushPlatform(),
  });

  return { registered: true, token: tokenResult.data };
}
