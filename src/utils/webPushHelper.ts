import { supabase } from './supabase';
import { getApiUrl } from './apiUrlHelper';

// Helper function to convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUserToPush(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported in this browser');
    return false;
  }

  try {
    // Request permission with promise/callback compatibility
    let permission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = await new Promise<NotificationPermission>((resolve) => {
          Notification.requestPermission((res) => resolve(res));
        });
      }
    }

    if (permission !== 'granted') {
      console.warn('Notification permission not granted:', permission);
      return false;
    }

    // Ensure service worker is registered first to avoid hanging on ready
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }

    const activeReg = await navigator.serviceWorker.ready;

    // Get VAPID Public Key
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error('VAPID public key is missing');
      return false;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe to push service
    const subscription = await activeReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    // Extract details
    const rawSub = subscription.toJSON();
    const endpoint = rawSub.endpoint;
    const p256dh = rawSub.keys?.p256dh;
    const auth = rawSub.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      console.error('Failed to extract credentials from push subscription');
      return false;
    }

    // Store in Supabase
    // Use RPC function to handle RLS bypass and switch users smoothly on same endpoint
    const { error } = await supabase.rpc('register_push_subscription', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth
    });

    if (error) {
      console.error('Error saving push subscription to database via RPC:', error.message, error.details, error.hint, error.code);
      return false;
    }

    console.log('Successfully subscribed to Web Push notifications');
    return true;
  } catch (error) {
    console.error('Error subscribing to Web Push:', error);
    return false;
  }
}

export async function unsubscribeUserFromPush(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      
      // Unsubscribe from browser push service
      await subscription.unsubscribe();

      // Delete from database
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);

      if (error) {
        console.error('Error deleting push subscription from database:', error);
        return false;
      }
    } else {
      // Fallback clean database entries for this user
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error clearing push subscriptions from database:', error);
        return false;
      }
    }

    console.log('Successfully unsubscribed from Web Push notifications');
    return true;
  } catch (error) {
    console.error('Error unsubscribing from Web Push:', error);
    return false;
  }
}

export async function checkSubscriptionStatus(userId: string): Promise<{
  permission: NotificationPermission;
  isSubscribed: boolean;
}> {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  if (isTauri) {
    const savedPref = localStorage.getItem('push_subscribed_pref_' + userId);
    return { permission: 'granted', isSubscribed: savedPref === 'true' };
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { permission: 'default', isSubscribed: false };
  }

  const permission = Notification.permission;
  if (permission !== 'granted') {
    return { permission, isSubscribed: false };
  }

  try {
    // Ensure service worker is registered first to avoid hanging on ready
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }
    const readyReg = await navigator.serviceWorker.ready;
    const subscription = await readyReg.pushManager.getSubscription();

    if (!subscription) {
      return { permission, isSubscribed: false };
    }

    // Check if it exists in our database and belongs to the current user
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      // Subscription exists in browser but not in DB (or belongs to another user), sync it
      const rawSub = subscription.toJSON();
      const endpoint = rawSub.endpoint;
      const p256dh = rawSub.keys?.p256dh;
      const auth = rawSub.keys?.auth;

      if (endpoint && p256dh && auth) {
        const { error: rpcError } = await supabase.rpc('register_push_subscription', {
          p_user_id: userId,
          p_endpoint: endpoint,
          p_p256dh: p256dh,
          p_auth: auth
        });
        
        if (rpcError) {
          console.error('Error syncing push subscription via RPC:', rpcError.message, rpcError.details, rpcError.hint, rpcError.code);
          return { permission, isSubscribed: false };
        }
        return { permission, isSubscribed: true };
      }
      return { permission, isSubscribed: false };
    }

    return { permission, isSubscribed: true };
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return { permission, isSubscribed: false };
  }
}

export async function sendPushNotification(params: {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) {
      console.warn('No active session to send push notification');
      return false;
    }

    const response = await fetch(getApiUrl('/api/send-push'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(params)
    });

    const resData = await response.json();
    if (resData.success !== true) {
      console.warn('[WebPush] API failed to send notification:', resData.error || resData.message || JSON.stringify(resData));
    }
    return resData.success === true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

