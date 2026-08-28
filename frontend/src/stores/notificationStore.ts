import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'REMINDER' | 'SUBSCRIPTION' | 'PAYROLL' | 'SYSTEM' | 'DEBT';
  created_at: string;
  is_read: boolean;
  is_archived: boolean;
  link?: string;
  expiry_date?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'created_at' | 'is_read' | 'is_archived'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  archiveNotification: (id: string) => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  syncDynamicNotifications: (wsId: string) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (notif) => {
        const newNotif: AppNotification = {
          ...notif,
          id: 'notif-' + Date.now() + '-' + Math.random().toString().slice(2, 6),
          created_at: new Date().toISOString(),
          is_read: false,
          is_archived: false,
        };
        set((state) => ({
          notifications: [newNotif, ...state.notifications],
        }));
      },

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        })),

      archiveNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, is_archived: true } : n)),
        })),

      deleteNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearAll: () => set({ notifications: [] }),

      // Syncs dynamic notifications from Important Dates, Expiring Subscriptions, and MySQL DB
      syncDynamicNotifications: (wsId: string) => {
        const current = get().notifications;
        const generated: AppNotification[] = [];

        // 1. Scan Important Dates & Reminders
        try {
          const savedReminders = localStorage.getItem(`important_events_${wsId}`);
          if (savedReminders) {
            const events = JSON.parse(savedReminders);
            events.forEach((ev: any) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const target = new Date(ev.event_date);
              target.setHours(0, 0, 0, 0);
              const diffMs = target.getTime() - today.getTime();
              const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

              if (daysLeft >= 0 && daysLeft <= (ev.advance_days || 3)) {
                const notifId = `dyn-rem-${ev.id}`;
                if (!current.some((n) => n.id === notifId)) {
                  generated.push({
                    id: notifId,
                    title: `🔔 Upcoming Event: ${ev.title}`,
                    message: daysLeft === 0 ? 'Happening TODAY!' : `Scheduled in ${daysLeft} day(s) (${ev.event_date})`,
                    type: 'REMINDER',
                    created_at: new Date().toISOString(),
                    is_read: false,
                    is_archived: false,
                    link: '/reminders',
                    expiry_date: ev.event_date,
                  });
                }
              }
            });
          }
        } catch {}

        // 2. Scan Free Trial Subscriptions
        try {
          const savedSubs = localStorage.getItem(`smart_subscriptions_${wsId}`);
          if (savedSubs) {
            const subs = JSON.parse(savedSubs);
            subs.forEach((sub: any) => {
              if (sub.is_trial) {
                const notifId = `dyn-sub-${sub.id}`;
                if (!current.some((n) => n.id === notifId)) {
                  generated.push({
                    id: notifId,
                    title: `⚠️ Trial Expiring: ${sub.name}`,
                    message: `Free trial renewal scheduled on ${sub.next_date}. Cancel to avoid charge.`,
                    type: 'SUBSCRIPTION',
                    created_at: new Date().toISOString(),
                    is_read: false,
                    is_archived: false,
                    link: '/hub',
                    expiry_date: sub.next_date,
                  });
                }
              }
            });
          }
        } catch {}

        if (generated.length > 0) {
          set((state) => ({
            notifications: [...generated, ...state.notifications],
          }));
        }
      },
    }),
    {
      name: 'notification-storage',
    }
  )
);
