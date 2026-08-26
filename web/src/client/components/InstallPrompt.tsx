import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isInStandaloneMode() {
  return ('standalone' in navigator && (navigator as any).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
}
function isSupportedBrowser() {
  // Chrome, Edge, Samsung Browser, Firefox support beforeinstallprompt
  return 'BeforeInstallPromptEvent' in window || 'onbeforeinstallprompt' in window
}

const DISMISSED_KEY = 'gymaura_install_dismissed'
const DISMISSED_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 days

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSBanner, setShowIOSBanner] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Already installed as PWA — don't show
    if (isInStandaloneMode()) return

    // Check if user recently dismissed
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed && Date.now() - parseInt(dismissed) < DISMISSED_EXPIRY) return

    // iOS: Safari doesn't support beforeinstallprompt, show manual instructions
    if (isIOS()) {
      const timer = setTimeout(() => setShowIOSBanner(true), 3000)
      return () => clearTimeout(timer)
    }

    // Android / Chrome / Edge / Desktop: capture the install event
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setDeferredPrompt(null)
    setShowIOSBanner(false)
  }

  const installAndroid = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        localStorage.setItem(DISMISSED_KEY, String(Date.now()))
      }
    } finally {
      setDeferredPrompt(null)
      setInstalling(false)
    }
  }

  // Android / Chrome / Edge banner
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-[82px] left-3 right-3 z-40 animate-[fadeIn_0.3s_ease]">
        <div className="bg-white rounded-2xl shadow-xl shadow-black/15 border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#007AFF] flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200">
            <img src="/icons/icon-192.png" alt="GymAura" className="w-10 h-10 rounded-lg object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">Instalar GymAura</p>
            <p className="text-xs text-gray-500 mt-0.5">Acceso rapido desde tu pantalla de inicio</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={dismiss} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
              <X className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={installAndroid} disabled={installing}
              className="flex items-center gap-1.5 bg-[#007AFF] text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-60">
              <Download className="w-3.5 h-3.5" />
              {installing ? 'Instalando...' : 'Instalar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // iOS Safari banner
  if (showIOSBanner) {
    return (
      <div className="fixed bottom-[82px] left-3 right-3 z-40 animate-[fadeIn_0.3s_ease]">
        <div className="bg-white rounded-2xl shadow-xl shadow-black/15 border border-gray-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                <img src="/icons/icon-180.png" alt="GymAura" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Instalar GymAura</p>
                <p className="text-xs text-gray-500 mt-0.5">Disponible para tu iPhone</p>
              </div>
            </div>
            <button onClick={dismiss} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform mt-0.5">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
          <div className="mt-3 bg-[#007AFF]/5 rounded-xl p-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              Toca <span className="inline-flex items-center gap-0.5 text-[#007AFF] font-semibold"><Share className="w-3 h-3" /> Compartir</span> y luego{' '}
              <span className="font-semibold text-gray-800">&ldquo;Anadir a pantalla de inicio&rdquo;</span> para instalar la app.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
