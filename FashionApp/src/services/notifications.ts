import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import client from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushToken(userId: number): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5B6EF5',
      });
    }

    const existing = await Notifications.getPermissionsAsync() as { granted: boolean };
    const finalPerm = existing.granted
      ? existing
      : (await Notifications.requestPermissionsAsync()) as { granted: boolean };

    if (!finalPerm.granted) return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    await client.put(`/users/${userId}/push-token`, { token: tokenData.data });
  } catch {
    // Push setup is non-critical — swallow errors
  }
}
