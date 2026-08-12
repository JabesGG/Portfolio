import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support is a bonus, never a blocker: if registration fails the app
// still runs, it just needs the network to start.
// Resolved against the document, so the worker's scope is whatever directory
// the app is served from — no absolute path to keep in sync. This also keeps
// sw.js out of the bundler's dependency graph on purpose: it is generated
// after the build by tools/make-sw.cjs, once the asset hashes are known.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', document.baseURI).href
    navigator.serviceWorker.register(swUrl).catch(() => {})
  })
}
