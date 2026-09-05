import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft, Dumbbell, Target, TrendingUp, Calendar, Clock,
  Activity, Loader2, AlertCircle, Weight, BarChart3, Flame
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL ?? '';

interface Athlete {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  goal: string;
  weightKg: number;
  heightCm: number;
  emailVerified: boolean;
  createdAt: string;
}

interface Workout {
  id: string;
  date: string;
  dayName: string;
  durationSeconds: number;
  caloriesBurned: number;
  totalSets: number;
  exercises: string[];
}

interface Data {
  athlete: Athlete;
  stats: { totalWorkouts: number; totalSets: number; maxWeight: number };
  workouts: Workout[];
  exerciseProgress: Record<string, Array<{ weight: number; reps: number; date: string }>>;
  weeklyFrequency: Record<string, number>;
}

export default function AthleteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('gymaura_token');
        const res = await fetch(`${BASE}/api/v1/coach/athletes/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error('Failed to fetch athlete data');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col gap-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-red-500 font-medium">{error || 'Athlete not found'}</p>
        <Link to="/dashboard" className="btn-primary">Volver al Dashboard</Link>
      </div>
    );
  }

  const { athlete, stats, workouts, exerciseProgress, weeklyFrequency } = data;

  const initials = athlete.name.substring(0, 2).toUpperCase();
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const showMetrics = athlete.weightKg !== 70 || athlete.heightCm !== 170;

  // Max values for charts
  const maxWeekly = Math.max(...Object.values(weeklyFrequency), 1);
  const progressEntries = Object.entries(exerciseProgress).slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 fade-in">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
            <ChevronLeft className="h-5 w-5 mr-1" />
            <span>Volver al Dashboard</span>
          </Link>
          
          <div className="flex gap-2">
            <Link to={`/dashboard/routines?athlete=${id}`} className="btn-secondary">
              Ver Rutinas
            </Link>
            <Link to={`/dashboard/routines?tab=templates`} className="btn-primary">
              Asignar Plantilla
            </Link>
          </div>
        </div>

        {/* Profile Card */}
        <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-3xl font-bold shrink-0">
            {athlete.avatar ? <img src={athlete.avatar} alt={athlete.name} className="h-full w-full rounded-full object-cover" /> : initials}
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">{athlete.name}</h1>
            <p className="text-gray-500">{athlete.email}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
              {athlete.goal && <span className="badge-blue flex items-center gap-1"><Target className="h-3 w-3"/> {athlete.goal}</span>}
              <span className="badge-gray flex items-center gap-1"><Calendar className="h-3 w-3"/> Miembro desde {new Date(athlete.createdAt).toLocaleDateString()}</span>
              {showMetrics && (
                <span className="badge-purple flex items-center gap-1"><Weight className="h-3 w-3"/> {athlete.weightKg}kg / {athlete.heightCm}cm</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <Dumbbell className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Entrenamientos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalWorkouts}</p>
            </div>
          </div>
          <div className="stat-card bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Series</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSets}</p>
            </div>
          </div>
          <div className="stat-card bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg text-green-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Peso Máximo</p>
              <p className="text-2xl font-bold text-gray-900">{stats.maxWeight} kg</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Weekly Frequency Chart */}
          <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              Frecuencia Semanal
            </h2>
            <div className="flex items-end h-40 gap-2">
              {Object.entries(weeklyFrequency).map(([week, count]) => (
                <div key={week} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div 
                    className="w-full bg-blue-500 rounded-t-md transition-all hover:bg-blue-600 relative"
                    style={{ height: `${(count / maxWeekly) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {count}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 truncate w-full text-center">{week}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weight Progress */}
          <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-500" />
              Progreso de Pesos (Top 5)
            </h2>
            <div className="space-y-6">
              {progressEntries.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No hay datos de progreso suficientes.</p>
              ) : (
                progressEntries.map(([exercise, records]) => {
                  const maxExerciseWeight = Math.max(...records.map(r => r.weight), 1);
                  return (
                    <div key={exercise} className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">{exercise}</p>
                      <div className="space-y-1">
                        {records.slice(-3).map((record, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-16 shrink-0">{new Date(record.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full" 
                                style={{ width: `${(record.weight / maxExerciseWeight) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-16 text-right">{record.weight}kg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Workout History */}
        <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            Historial de Entrenamientos
          </h2>
          <div className="space-y-4">
            {workouts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No hay entrenamientos recientes.</p>
            ) : (
              workouts.map(workout => (
                <div key={workout.id} className="p-4 border border-gray-100 rounded-lg hover:shadow-sm transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{new Date(workout.date).toLocaleDateString()} - {workout.dayName}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDuration(workout.durationSeconds)}</span>
                        <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> {workout.caloriesBurned} kcal</span>
                        <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> {workout.totalSets} series</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {workout.exercises.map((ex, i) => (
                      <span key={i} className="badge-gray text-xs">{ex}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
