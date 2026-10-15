import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_IDENTIFIER_DAILY = 'salem-gold-daily-7am';

// Configure notification behavior when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions from the OS.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('gold-rate-alerts', {
      name: 'Salem Gold Rate Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F3D58A',
      sound: 'default',
    });
  }

  return true;
}

/**
 * Schedule recurring daily notification at 7:00 AM.
 */
export async function scheduleDaily7AMNotification(rate?: number): Promise<boolean> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return false;
  }

  // Cancel any existing daily gold alert first to avoid duplicates
  await cancelDailyNotification();

  const priceText = rate ? `₹${rate.toLocaleString('en-IN')}/g` : 'Check now';

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDENTIFIER_DAILY,
    content: {
      title: '🌟 Salem Gold Rate Today',
      body: `Good morning! Today's 22K Gold rate is ${priceText}. Tap to view chart & details.`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { screen: 'home' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 7,
      minute: 0,
    } as never,
  });

  return true;
}

/**
 * Cancel the scheduled 7:00 AM notification.
 */
export async function cancelDailyNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER_DAILY);
  } catch (err) {
    console.warn('Could not cancel scheduled notification:', err);
  }
}

/**
 * Check if the 7:00 AM notification is currently active.
 */
export async function isDailyNotificationScheduled(): Promise<boolean> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.some((item) => item.identifier === NOTIFICATION_IDENTIFIER_DAILY);
  } catch {
    return false;
  }
}

/**
 * Send an immediate test notification so the user can verify it works on their phone.
 */
export async function sendTestNotificationNow(rate: number): Promise<boolean> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Salem Gold Rate Alert (Test)',
      body: `Today's 22K Gold rate is ₹${rate.toLocaleString('en-IN')}/g in Salem. 7:00 AM alert is set!`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null, // Send immediately
  });

  return true;
}
