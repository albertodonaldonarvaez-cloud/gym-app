import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Lock, Target, Weight, Ruler, Loader2, Check, AlertCircle, Dumbbell } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL ?? '';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
    goal: 'Acondicionamiento Físico',
    weightKg: '',
    heightCm: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const goalOptions = [
    'Acondicionamiento Físico',
    'Pérdida de peso',
    'Ganancia muscular',
    'Fuerza',
    'Resistencia',
    'Flexibilidad',
    'Rehabilitación'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (!token) {
      setError('Enlace de invitación inválido o expirado.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BASE}/api/v1/auth/complete-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: formData.name,
          password: formData.password,
          goal: formData.goal,
          weightKg: Number(formData.weightKg),
          heightCm: Number(formData.heightCm)
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Error al completar el registro. El enlace puede haber expirado.');
      }

      const data = await response.json();
      
      localStorage.setItem('gymaura_token', data.token);
      localStorage.setItem('gymaura_user', JSON.stringify(data.user));

      setSuccess(true);
      setTimeout(() => {
        navigate('/client');
      }, 3000);
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4">
        <div className="card-glass max-w-md w-full p-8 text-center fade-in bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">¡Registro completado!</h2>
          <p className="text-gray-500 mb-6">Tu cuenta ha sido creada exitosamente. Redirigiendo a tu panel...</p>
          <Loader2 className="w-6 h-6 text-[#007AFF] animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-2">
        <Dumbbell className="w-8 h-8 text-[#007AFF]" />
        <span className="text-2xl font-semibold text-gray-900 tracking-tight">GymAura</span>
      </div>

      <div className="card max-w-md w-full bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Completa tu perfil</h1>
          <p className="text-gray-500 text-sm">Estás a un paso de comenzar tu entrenamiento</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                required
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all outline-none"
                placeholder="Juan Pérez"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
              <div className="relative">
                <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  required
                  type="number"
                  step="0.1"
                  name="weightKg"
                  value={formData.weightKg}
                  onChange={handleChange}
                  className="input w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all outline-none"
                  placeholder="70.5"
                />
              </div>
            </div>
            <div>
              <label className="label block text-sm font-medium text-gray-700 mb-1">Altura (cm)</label>
              <div className="relative">
                <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  required
                  type="number"
                  name="heightCm"
                  value={formData.heightCm}
                  onChange={handleChange}
                  className="input w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all outline-none"
                  placeholder="175"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label block text-sm font-medium text-gray-700 mb-1">Objetivo principal</label>
            <div className="relative">
              <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                name="goal"
                value={formData.goal}
                onChange={handleChange}
                className="input w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all outline-none appearance-none"
              >
                {goalOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                required
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all outline-none"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
          </div>

          <div>
            <label className="label block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                required
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all outline-none"
                placeholder="Confirma tu contraseña"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full bg-[#007AFF] hover:bg-[#0056b3] text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Completar Registro'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
