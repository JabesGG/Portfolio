import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Entry for the single-file artifact build. Identical to main.tsx except that
// it registers no service worker: the artifact is one self-contained page with
// no sibling sw.js to fetch, so registering would only 404.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
