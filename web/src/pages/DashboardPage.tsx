import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, UserCheck, Dumbbell, Shield, TrendingUp, 
  UserX, Activity, Plus, Loader2, AlertCircle, 
  Mail, MailCheck, Crown, ChevronRight, Send, Clock, Target, Weight
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { getAdminStats, getAthletes, getExercises, getCoachQuota } from '../api';

const BASE = import.meta.env.VITE_API_URL ?? '';

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isCoach = user?.role === 'COACH';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<{type: 'success' | 'error', message: string, url?: string} | null>(null);
  const [inviting, setInviting] = useState(false);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (isAdmin) {
          const adminStats = await getAdminStats();
          setStats(adminStats);
        } else if (isCoach) {
          const [athletesData, quotaData] = await Promise.all([
            getAthletes(),
            getCoachQuota()
          ]);
          setAthletes(athletesData);
          setStats({
            myQuota: quotaData.max || 0,
            myClients: quotaData.current || 0,
            pending: athletesData.filter(a => a.pending).length
          });
        }
      } catch (err: any) {
        setError(err.message || 'Error al cargar los datos del dashboard');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [isAdmin, isCoach, user]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteStatus(null);
    
    try {
      const res = await fetch(`${BASE}/api/v1/coach/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gymaura_token')}`
        },
        body: JSON.stringify({ email: inviteEmail })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar invitación');
      }
      
      setInviteStatus({
        type: 'success',
        message: data.message || 'Invitación enviada correctamente',
        url: data.inviteUrl
      });
      setInviteEmail('');
      
      // Refresh athletes list and quota
      const [updatedAthletes, quotaData] = await Promise.all([
        getAthletes(),
        getCoachQuota()
      ]);
      setAthletes(updatedAthletes);
      setStats((prev: any) => ({
        ...prev,
        myClients: quotaData.current || 0,
        pending: updatedAthletes.filter(a => a.pending).length
      }));
      
    } catch (err: any) {
      setInviteStatus({
        type: 'error',
        message: err.message
      });
    } finally {
      setInviting(false);
    }
  };

  const today = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 fade-in">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500">Cargando tu panel de control...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 fade-in">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4 text-red-600 max-w-2xl mx-auto">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg mb-1">Error de conexión</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-1">
            Hola, {user?.name?.split(' ')[0] || 'Usuario'}
          </h1>
          <p className="text-gray-500 capitalize">{today}</p>
        </div>
      </div>

      {isAdmin && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500">Usuarios</p>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500">Coaches</p>
                <Crown className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalCoaches || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500">Clientes</p>
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalClients || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500">Ejercicios</p>
                <Dumbbell className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalExercises || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500">Sin Asignar</p>
                <UserX className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.unassigned || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500">Sin Verificar</p>
                <Shield className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.unverified || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Acciones Rápidas */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Acciones Rápidas</h2>
              <div className="grid gap-3">
                <Link to="/dashboard/users" className="card p-4 flex items-center hover:bg-gray-50 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mr-4 group-hover:bg-blue-500 group-hover:text-gray-900 transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Gestión de Usuarios</h3>
                    <p className="text-sm text-gray-500">Ver y administrar todos</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </Link>
                <Link to="/dashboard/exercises" className="card p-4 flex items-center hover:bg-gray-50 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mr-4 group-hover:bg-orange-500 group-hover:text-gray-900 transition-colors">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Base de Ejercicios</h3>
                    <p className="text-sm text-gray-500">Catálogo de movimientos</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </Link>
                <Link to="/dashboard/assignments" className="card p-4 flex items-center hover:bg-gray-50 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mr-4 group-hover:bg-purple-500 group-hover:text-gray-900 transition-colors">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Asignaciones</h3>
                    <p className="text-sm text-gray-500">Vincular atletas y coaches</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </Link>
              </div>
            </div>

            {/* Coaches y Cuotas */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Coaches y Cuotas</h2>
              <div className="card p-0 overflow-hidden">
                {stats?.coachQuotas?.length > 0 ? (
                  <div className="divide-y divide-gray-800/50">
                    {stats.coachQuotas.map((coach: any) => {
                      const percent = coach.max > 0 ? (coach.current / coach.max) * 100 : 0;
                      const isFull = coach.current >= coach.max;
                      return (
                        <div key={coach.id} className="p-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-purple-600 font-bold">
                            {coach.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{coach.name}</h4>
                            <p className="text-xs text-gray-500 truncate">{coach.email}</p>
                          </div>
                          <div className="w-1/3 min-w-[120px]">
                            <div className="flex justify-between text-xs mb-1">
                              <span className={isFull ? 'text-red-600' : 'text-gray-500'}>
                                {coach.current} de {coach.max}
                              </span>
                              <span className="text-gray-500">{Math.round(percent)}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${isFull ? 'bg-red-500' : 'bg-purple-500'}`}
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    No hay coaches registrados
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {isCoach && (
        <div className="space-y-6">
          {/* Coach Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500">Mis Atletas</p>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.myClients || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500">Mi Cuota</p>
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div className="mt-1">
                <p className="text-2xl font-bold text-gray-900">{stats?.myClients || 0} / {stats?.myQuota || 0}</p>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-purple-500 rounded-full" 
                    style={{ width: `${Math.min(((stats?.myClients || 0) / (stats?.myQuota || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500">Pendientes</p>
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.pending || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions & Invite */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Acciones</h2>
                <div className="grid gap-3">
                  <Link to="/dashboard/routines" className="card p-4 flex items-center hover:bg-gray-50 transition-colors group">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mr-4 group-hover:bg-blue-500 group-hover:text-gray-900 transition-colors">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">Rutinas</h3>
                      <p className="text-sm text-gray-500">Gestionar entrenamientos</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </Link>
                  <Link to="/dashboard/exercises" className="card p-4 flex items-center hover:bg-gray-50 transition-colors group">
                    <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mr-4 group-hover:bg-orange-500 group-hover:text-gray-900 transition-colors">
                      <Dumbbell className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">Ejercicios</h3>
                      <p className="text-sm text-gray-500">Catálogo de movimientos</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </Link>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Invitar Atleta</h2>
                <div className="card p-5">
                  <form onSubmit={handleInvite} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="label">Correo del atleta</label>
                      <input 
                        type="email" 
                        id="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="atleta@ejemplo.com"
                        className="input"
                        required
                        disabled={inviting || (stats?.myClients >= stats?.myQuota)}
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="btn-primary w-full flex items-center justify-center gap-2"
                      disabled={inviting || !inviteEmail || (stats?.myClients >= stats?.myQuota)}
                    >
                      {inviting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      <span>{inviting ? 'Enviando...' : 'Enviar invitación'}</span>
                    </button>
                    {stats?.myClients >= stats?.myQuota && (
                      <p className="text-xs text-red-600 text-center mt-2">
                        Has alcanzado tu cuota máxima de atletas
                      </p>
                    )}
                  </form>
                  
                  {inviteStatus && (
                    <div className={`mt-4 p-3 rounded-lg text-sm ${inviteStatus.type === 'success' ? 'bg-green-50 text-green-600 border border-green-500/20' : 'bg-red-50 text-red-600 border border-red-500/20'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {inviteStatus.type === 'success' ? <MailCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span className="font-medium">{inviteStatus.message}</span>
                      </div>
                      {inviteStatus.url && (
                        <div className="mt-2 text-xs overflow-hidden">
                          <p className="text-gray-500 mb-1">Enlace manual (si no llegó el correo):</p>
                          <div className="bg-gray-50 p-2 rounded border border-gray-200 break-all select-all">
                            {inviteStatus.url}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Athletes List */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Mis Atletas</h2>
              <div className="grid gap-4">
                {athletes.length > 0 ? (
                  athletes.map((athlete) => (
                    <Link 
                      key={athlete.id}
                      to={`/dashboard/routines?athlete=${athlete.id}`}
                      className="card p-5 hover:border-blue-500/50 transition-colors group block"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                              {athlete.pending ? <Clock className="w-5 h-5" /> : (athlete.name?.charAt(0) || 'A')}
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${athlete.pending ? 'bg-yellow-400' : 'bg-green-500'}`} title={athlete.pending ? 'Pendiente' : 'Activo'} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                              {athlete.pending ? '⏳ Pendiente' : athlete.name}
                            </h4>
                            <p className="text-sm text-gray-500">{athlete.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-600">Último entreno</p>
                          <p className="text-xs text-gray-500">
                            {athlete.lastWorkout ? new Date(athlete.lastWorkout).toLocaleDateString() : 'Sin entrenamientos'}
                          </p>
                        </div>
                      </div>
                      
                      {!athlete.pending && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
                          {athlete.goal && athlete.goal !== 'Acondicionamiento Físico' && (
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <Target className="w-4 h-4 text-blue-600" />
                              <span>{athlete.goal}</span>
                            </div>
                          )}
                          {athlete.weightKg && athlete.weightKg !== 70 && (
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <Weight className="w-4 h-4 text-orange-600" />
                              <span>{athlete.weightKg}kg</span>
                            </div>
                          )}
                          {athlete.heightCm && athlete.heightCm !== 170 && (
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <span>📏 {athlete.heightCm}cm</span>
                            </div>
                          )}
                          {(!athlete.goal || athlete.goal === 'Acondicionamiento Físico') && (!athlete.weightKg || athlete.weightKg === 70) && (!athlete.heightCm || athlete.heightCm === 170) && (
                            <p className="text-gray-400 text-xs italic">El atleta aún no ha completado su perfil</p>
                          )}
                        </div>
                      )}
                    </Link>
                  ))
                ) : (
                  <div className="card p-12 flex flex-col items-center justify-center text-center">
                    <Users className="w-12 h-12 text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-1">Aún no tienes atletas</h3>
                    <p className="text-gray-500 mb-6">Utiliza el panel de invitación para añadir a tu primer cliente.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

