import { useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export function useDesktopNotifications(profileId?: string) {
  useEffect(() => {
    // Only run this logic if we are inside Tauri
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    
    if (!isTauri || !profileId) return;

    let mounted = true;
    let activeChannel: any = null;

    async function setupNotifications() {
      try {
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === 'granted';
        }
        
        if (!permissionGranted || !mounted) return;

        // Subscribe to Supabase realtime Broadcasts sent by /api/send-push
        activeChannel = supabase
          .channel('desktop-notifications')
          .on(
            'broadcast',
            { event: 'os-push' },
            (payload) => {
              // Check user preference toggle dynamically
              const pushPref = localStorage.getItem('push_subscribed_pref_' + profileId);
              if (pushPref === 'false') return;

              const { targetUserIds, title, body } = payload.payload;
              
              // Only trigger if this notification was meant for the current user
              if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.includes(profileId)) {
                sendNotification({
                  title: title || 'Chuti Tracker',
                  body: body || 'You have a new notification'
                });
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Failed to setup desktop notifications:', err);
      }
    }

    setupNotifications();

    return () => {
      mounted = false;
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [profileId]);
}
