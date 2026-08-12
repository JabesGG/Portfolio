import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Preferences } from '@capacitor/preferences'
import { LocalNotifications } from '@capacitor/local-notifications'
import './index.css'
import App from './App.tsx'
import { setStorageBackend } from './lib/storage'
import { setReminderScheduler, type Due } from './lib/reminders'

/**
 * Entry for the Android/iOS shell — the only module that imports Capacitor, so
 * the web bundle never carries the bridge. It installs the native backends
 * before rendering, then hands over to the same App as the web build.
 */

// Preferences maps to SharedPreferences / UserDefaults: app-private, included in
// device backups, and not evictable the way WKWebView localStorage is.
setStorageBackend({
  async get(key) {
    const { value } = await Preferences.get({ key })
    return value ?? null
  },
  async set(key, value) {
    await Preferences.set({ key, value })
  },
})

/** Capacitor notification ids must be 32-bit ints, so fold the string id down. */
function idOf(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  return Math.abs(h) % 2147483647
}

setReminderScheduler({
  async sync(due: Due[]) {
    // Rebuild from scratch every time: simpler than diffing, and impossible to
    // leave a reminder behind for something you have already done.
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map(n => ({ id: n.id })),
      })
    }
    if (!due.length) return

    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') {
      const asked = await LocalNotifications.requestPermissions()
      if (asked.display !== 'granted') return
    }

    await LocalNotifications.schedule({
      notifications: due.slice(0, 60).map(d => ({
        id: idOf(d.id),
        title: d.title,
        body: d.body,
        schedule: { at: d.at, allowWhileIdle: true },
      })),
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
