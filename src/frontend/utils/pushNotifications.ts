import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import notificationService, {
  type NotificationPlatform,
} from '@/api/services/notificationService';

const PUSH_TOKEN_KEY = '@push_device_token_v1';
const isExpoGo = Constants.executionEnvironment === 'storeClient';
let notificationsConfigured = false;

const currentPlatform = (): NotificationPlatform => {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
};

export async function registerPushNotifications(userId?: string | null): Promise<void> {
  if (isExpoGo) {
    return;
  }

  // Push is only meaningful on real mobile devices.
  if (Platform.OS === 'web' || !Device.isDevice || !userId) {
    return;
  }

  try {
    const Notifications = await import('expo-notifications');

    if (!notificationsConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      notificationsConfigured = true;
    }

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notifications permission not granted');
      return;
    }

    // Native token (FCM on Android / APNs on iOS).
    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    const deviceToken = String(tokenResponse?.data || '').trim();

    if (!deviceToken) {
      console.warn('No native device push token available');
      return;
    }

    const previousToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (previousToken === deviceToken) {
      return;
    }

    await notificationService.registerToken(deviceToken, currentPlatform());
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, deviceToken);

    // Android notification channel is required for visible notifications.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  } catch (error) {
    console.warn('Failed to register push notifications', error);
  }
}
