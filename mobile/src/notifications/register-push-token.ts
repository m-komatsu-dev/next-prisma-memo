import Constants from "expo-constants";
import { Platform } from "react-native";
import { registerMobilePushSubscription } from "../api/push-subscriptions";

type NotificationsModule = typeof import("expo-notifications");
type PushRegistrationResult =
  | { registered: true; token: string }
  | {
      registered: false;
      reason: "expo-go" | "permission-denied" | "registration-failed";
    };

let notificationHandlerConfigured = false;

async function loadNotifications() {
  const Notifications = await import("expo-notifications");

  if (!notificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerConfigured = true;
  }

  return Notifications;
}

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

async function configureAndroidChannel(Notifications: NotificationsModule) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("todo-reminders", {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: "Todo reminders",
      sound: "default",
    });
  }
}

export async function registerPushTokenAfterLogin(
  accessToken: string,
): Promise<PushRegistrationResult> {
  if (Constants.appOwnership === "expo") {
    return { registered: false, reason: "expo-go" };
  }

  try {
    const Notifications = await loadNotifications();

    await configureAndroidChannel(Notifications);

    const currentPermissions = await Notifications.getPermissionsAsync();
    const finalPermissions =
      currentPermissions.status === "granted"
        ? currentPermissions
        : await Notifications.requestPermissionsAsync();

    if (finalPermissions.status !== "granted") {
      return { registered: false, reason: "permission-denied" };
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
  } catch {
    return { registered: false, reason: "registration-failed" };
  }
}
