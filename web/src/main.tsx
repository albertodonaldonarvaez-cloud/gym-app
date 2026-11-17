import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Captura global del evento de instalación PWA antes de que se monte el layout
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  ;(window as any).__gymauraInstallPrompt = e
  window.dispatchEvent(new CustomEvent('gymaura-install-available'))
})

window.addEventListener('appinstalled', () => {
  ;(window as any).__gymauraInstallPrompt = null
  window.dispatchEvent(new CustomEvent('gymaura-install-available'))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
