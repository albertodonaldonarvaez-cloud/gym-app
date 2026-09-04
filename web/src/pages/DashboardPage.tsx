import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, UserCheck, Dumbbell, Shield, TrendingUp, 
  UserX, Activity, Plus, Loader2, AlertCircle, 
  Mail, MailCheck, Crown, ChevronRight 
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { getAdminStats, getAthletes, getExercises } from '../api';

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isCoach = user?.role === 'COACH';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (isAdmin) {
          const adminStats = await getAdminStats();
          setStats(adminStats);
        } else if (isCoach) {
          const [athletesData, exercisesData] = await Promise.all([
            getAthletes(),
            getExercises({ limit: 1 })
          ]);
          setAthletes(athletesData);
          setStats({
            totalExercises: exercisesData.total,
            myQuota: user?.maxClients || 0,
            myClients: athletesData.length
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

  const today = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 fade-in">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-400">Cargando tu panel de control...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 fade-in">
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 flex items-start gap-4 text-red-500 max-w-2xl mx-auto">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg mb-1">Error de conexión</h3>
            <p className="text-red-400/80">{error}</p>
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
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
            Hola, {user?.name?.split(' ')[0] || 'Usuario'}
          </h1>
          <p className="text-gray-400 capitalize">{today}</p>
        </div>
        {isCoach && (
          <Link 
            to="/clients/new" 
            className={`btn-primary flex items-center gap-2 ${stats?.myClients >= stats?.myQuota ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          >
            <Plus className="w-5 h-5" />
            <span>Añadir Cliente</span>
          </Link>
        )}
      </div>

      {isAdmin && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-400">Usuarios</p>
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-400">Coaches</p>
                <Crown className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.totalCoaches || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-400">Clientes</p>
                <UserCheck className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.totalClients || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-400">Ejercicios</p>
                <Dumbbell className="w-5 h-5 text-orange-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.totalExercises || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-400">Sin Asignar</p>
                <UserX className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.unassigned || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-400">Sin Verificar</p>
                <Shield className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.unverified || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Acciones Rápidas */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Acciones Rápidas</h2>
              <div className="grid gap-3">
                <Link to="/users" className="card p-4 flex items-center hover:bg-gray-800/50 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mr-4 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white">Gestión de Usuarios</h3>
                    <p className="text-sm text-gray-400">Ver y administrar todos</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </Link>
                <Link to="/exercises" className="card p-4 flex items-center hover:bg-gray-800/50 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center mr-4 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white">Base de Ejercicios</h3>
                    <p className="text-sm text-gray-400">Catálogo de movimientos</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </Link>
                <Link to="/assignments" className="card p-4 flex items-center hover:bg-gray-800/50 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mr-4 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white">Asignaciones</h3>
                    <p className="text-sm text-gray-400">Vincular atletas y coaches</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </Link>
              </div>
            </div>

            {/* Coaches y Cuotas */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-semibold text-white">Coaches y Cuotas</h2>
              <div className="card p-0 overflow-hidden">
                {stats?.coachQuotas?.length > 0 ? (
                  <div className="divide-y divide-gray-800/50">
                    {stats.coachQuotas.map((coach: any) => {
                      const percent = coach.max > 0 ? (coach.current / coach.max) * 100 : 0;
                      const isFull = coach.current >= coach.max;
                      return (
                        <div key={coach.id} className="p-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-purple-400 font-bold">
                            {coach.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-white truncate">{coach.name}</h4>
                            <p className="text-xs text-gray-400 truncate">{coach.email}</p>
                          </div>
                          <div className="w-1/3 min-w-[120px]">
                            <div className="flex justify-between text-xs mb-1">
                              <span className={isFull ? 'text-red-400' : 'text-gray-400'}>
                                {coach.current} de {coach.max}
                              </span>
                              <span className="text-gray-500">{Math.round(percent)}%</span>
                            </div>
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
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
                  <div className="p-8 text-center text-gray-400">
                    No hay coaches registrados
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {isCoach && (
        <>
          {/* Coach Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-400">Mis Atletas</p>
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.myClients || 0}</p>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-400">Mi Cuota</p>
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div className="mt-1">
                <p className="text-2xl font-bold text-white">{stats?.myClients || 0} / {stats?.myQuota || 0}</p>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-purple-500 rounded-full" 
                    style={{ width: `${Math.min(((stats?.myClients || 0) / (stats?.myQuota || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-400">Ejercicios DB</p>
                <Dumbbell className="w-5 h-5 text-orange-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.totalExercises || 0}</p>
            </div>
          </div>

          {/* Athletes List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Mis Atletas</h2>
            <div className="card p-0 overflow-hidden">
              {athletes.length > 0 ? (
                <div className="divide-y divide-gray-800/50">
                  {athletes.map((athlete) => (
                    <div key={athlete.id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                          {athlete.name?.charAt(0) || 'A'}
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{athlete.name}</h4>
                          <p className="text-sm text-gray-400">{athlete.email}</p>
                        </div>
                      </div>
                      <Link 
                        to={`/athletes/${athlete.id}`}
                        className="btn-ghost"
                      >
                        Ver Perfil
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                  <Users className="w-12 h-12 text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-gray-300 mb-1">Aún no tienes atletas</h3>
                  <p className="text-gray-500 mb-6">Añade a tu primer cliente para comenzar.</p>
                  <Link 
                    to="/clients/new" 
                    className="btn-primary"
                  >
                    Añadir Atleta
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
