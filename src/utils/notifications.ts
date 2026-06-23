export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function areNotificationsGranted(): boolean {
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

/**
 * Send a local notification (only works if permission is granted).
 * If a service worker is registered, it uses the SW to display the notification
 * so it works more reliably on mobile/PWAs.
 */
export async function sendLocalNotification(title: string, options?: NotificationOptions) {
  if (!areNotificationsGranted()) return;

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration && 'showNotification' in registration) {
      await registration.showNotification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      });
    } else {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        ...options,
      });
    }
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}
