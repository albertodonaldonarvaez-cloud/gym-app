import { useEffect, useState } from 'react'
import {
  Settings, Mail, Save, Loader2, AlertCircle, Check, X,
  Send, Server, Key, Globe, Shield, Zap, ChevronDown, ChevronUp
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? ''

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('gymaura_token') ?? ''}`,
})

interface SettingSection {
  title: string
  icon: React.ElementType
  description: string
  category: string
  fields: SettingField[]
}

interface SettingField {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'toggle' | 'email'
  placeholder?: string
  help?: string
}

const SECTIONS: SettingSection[] = [
  {
    title: 'Correo SMTP',
    icon: Mail,
    description: 'Configura el servidor de correo para enviar verificaciones y notificaciones.',
    category: 'smtp',
    fields: [
      { key: 'smtp_enabled', label: 'Activar envío de correos', type: 'toggle', help: 'Activa para enviar emails de verificación' },
      { key: 'smtp_host', label: 'Servidor SMTP', type: 'text', placeholder: 'smtp.gmail.com', help: 'Gmail: smtp.gmail.com | Outlook: smtp.office365.com' },
      { key: 'smtp_port', label: 'Puerto', type: 'number', placeholder: '587', help: '587 (TLS) o 465 (SSL)' },
      { key: 'smtp_user', label: 'Usuario / Email', type: 'email', placeholder: 'tu-email@gmail.com' },
      { key: 'smtp_pass', label: 'Contraseña / App Password', type: 'password', placeholder: '••••••••', help: 'Para Gmail usa una App Password de Google' },
      { key: 'smtp_from', label: 'Remitente (From)', type: 'text', placeholder: 'GymAura <noreply@gymaura.com>' },
    ]
  },
  {
    title: 'General',
    icon: Globe,
    description: 'Configuración general de la aplicación.',
    category: 'general',
    fields: [
      { key: 'app_name', label: 'Nombre de la app', type: 'text', placeholder: 'GymAura' },
      { key: 'default_max_clients', label: 'Máx. clientes por coach (default)', type: 'number', placeholder: '10' },
      { key: 'require_email_verify', label: 'Requiere verificación de email', type: 'toggle', help: 'Si se activa, usuarios sin verificar no pueden acceder' },
    ]
  },
  {
    title: 'APIs Externas',
    icon: Zap,
    description: 'Configura integraciones con servicios externos (próximamente).',
    category: 'api',
    fields: [
      { key: 'api_webhook_url', label: 'Webhook URL (notificaciones)', type: 'text', placeholder: 'https://hooks.slack.com/...' },
      { key: 'api_analytics_key', label: 'Analytics API Key', type: 'password', placeholder: 'Clave de API' },
    ]
  },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['smtp']))

  useEffect(() => {
    fetch(`${BASE}/api/admin/settings`, { headers: getHeaders() })
      .then(r => r.json())
      .then(data => {
        setSettings(data)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const getValue = (category: string, key: string) => settings[category]?.[key] ?? ''

  const setValue = (category: string, key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [category]: { ...prev[category], [key]: value }
    }))
    setDirty(prev => new Set(prev).add(key))
  }

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const allSettings: { key: string; value: string; category: string }[] = []
      for (const section of SECTIONS) {
        for (const field of section.fields) {
          if (dirty.has(field.key)) {
            const val = getValue(section.category, field.key)
            allSettings.push({ key: field.key, value: val, category: section.category })
          }
        }
      }
      if (allSettings.length === 0) { setSuccess('Sin cambios'); setSaving(false); return }
      const res = await fetch(`${BASE}/api/admin/settings`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ settings: allSettings })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(data.message || 'Guardado')
      setDirty(new Set())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleTestSmtp = async () => {
    setTesting(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`${BASE}/api/admin/settings/test-smtp`, {
        method: 'POST', headers: getHeaders()
      })
      const data = await res.json()
      if (data.ok) setSuccess(data.message)
      else setError(data.error)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally { setTesting(false) }
  }

  const handleSendTestEmail = async () => {
    setSendingTest(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`${BASE}/api/admin/settings/test-smtp-email`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify({ to: testEmail })
      })
      const data = await res.json()
      if (data.ok) setSuccess(data.message)
      else setError(data.error)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally { setSendingTest(false) }
  }

  const toggleSection = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t) }
  }, [success])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando configuración...
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-500 text-sm mt-1">Administra el correo, integraciones y opciones del sistema</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || dirty.size === 0}
          className="btn-primary"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {dirty.size > 0 ? `Guardar (${dirty.size})` : 'Guardar'}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm">
          <Check className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Sections */}
      {SECTIONS.map(section => {
        const SIcon = section.icon
        const isExpanded = expanded.has(section.category)
        return (
          <div key={section.category} className="card p-0 overflow-hidden">
            <button
              onClick={() => toggleSection(section.category)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <SIcon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {isExpanded && (
              <div className="px-6 pb-5 pt-2 border-t border-gray-100 space-y-4">
                {section.fields.map(field => (
                  <div key={field.key}>
                    {field.type === 'toggle' ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700">{field.label}</label>
                          {field.help && <p className="text-xs text-gray-400 mt-0.5">{field.help}</p>}
                        </div>
                        <button
                          onClick={() => setValue(section.category, field.key, getValue(section.category, field.key) === 'true' ? 'false' : 'true')}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            getValue(section.category, field.key) === 'true' ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            getValue(section.category, field.key) === 'true' ? 'translate-x-5' : ''
                          }`} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label className="label">{field.label}</label>
                        <input
                          className="input"
                          type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : field.type === 'email' ? 'email' : 'text'}
                          placeholder={field.placeholder}
                          value={getValue(section.category, field.key)}
                          onChange={e => setValue(section.category, field.key, e.target.value)}
                        />
                        {field.help && <p className="text-xs text-gray-400 mt-1">{field.help}</p>}
                      </div>
                    )}
                  </div>
                ))}

                {/* SMTP-specific: Test buttons */}
                {section.category === 'smtp' && (
                  <div className="pt-3 border-t border-gray-100 space-y-3">
                    <div>
                      <label className="label">Enviar correo de prueba</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          className="input flex-1"
                          type="email"
                          placeholder="tu-email@ejemplo.com"
                          value={testEmail}
                          onChange={e => setTestEmail(e.target.value)}
                        />
                        <button
                          onClick={handleSendTestEmail}
                          disabled={sendingTest || !testEmail}
                          className="btn-primary whitespace-nowrap"
                        >
                          {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Enviar prueba
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleTestSmtp}
                        disabled={testing}
                        className="btn-ghost text-sm"
                      >
                        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                        Probar conexión
                      </button>
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Key className="w-4 h-4" />
                        Crear App Password (Gmail)
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Info card */}
      <div className="card bg-blue-50/50 border-blue-200">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Seguridad</p>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Las contraseñas y API keys se almacenan cifradas en la base de datos y nunca se muestran completas.
              Solo los administradores pueden acceder a esta página.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
