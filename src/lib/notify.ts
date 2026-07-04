// Local (client-side) notifications for feed reminders and the sleep timer.
//
// This app has no backend, so we can't do true server push (which is what wakes
// a fully-closed app). Instead we use the Notifications API via the service
// worker: notifications fire while the app is open (foreground or a live
// background tab). Action buttons (the "Wake up" button) work on Android; iOS
// ignores them and just opens the app on tap, and iOS only allows notifications
// at all once the PWA is installed to the Home Screen (iOS 16.4+).
import { createSignal } from 'solid-js';

const KEY = 'lactalog.notify';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

const [notifyPermission, setNotifyPermission] = createSignal<NotificationPermission>(
  notificationsSupported() ? Notification.permission : 'denied'
);
export { notifyPermission };

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
const [notifyEnabled, setEnabledSig] = createSignal<boolean>(loadEnabled());
export { notifyEnabled };

export function setNotifyEnabled(v: boolean): void {
  setEnabledSig(v);
  try {
    if (v) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

// Request permission (must be called from a user gesture) and turn reminders on.
export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  setNotifyPermission(perm);
  const ok = perm === 'granted';
  setNotifyEnabled(ok);
  return ok;
}

export function notificationsActive(): boolean {
  return notifyEnabled() && notifyPermission() === 'granted';
}

type NotifyOptions = NotificationOptions & {
  actions?: { action: string; title: string }[];
  renotify?: boolean;
};

async function getReg(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

export async function showNotify(title: string, options: NotifyOptions = {}): Promise<void> {
  if (!notificationsActive()) return;
  const reg = await getReg();
  if (reg) {
    await reg.showNotification(title, options);
    return;
  }
  // No service worker (e.g. dev server): fall back to a page-level notification.
  // Action buttons aren't available on this path.
  try {
    new Notification(title, options);
  } catch {
    // ignore (some browsers only allow notifications from a service worker)
  }
}

export async function closeNotify(tag: string): Promise<void> {
  const reg = await getReg();
  if (!reg) return;
  try {
    const ns = await reg.getNotifications({ tag });
    ns.forEach((n) => n.close());
  } catch {
    // ignore
  }
}
