import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Save, Loader2, Plus, Minus, User, Mail, Shield } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    goal?: string;
    weightKg?: number;
    heightCm?: number;
    emailVerified?: boolean;
  };
  onProfileUpdated: (updatedUser: any) => void;
}

const BASE = import.meta.env.VITE_API_URL ?? '';
const GOAL_OPTIONS = [
  'Acondicionamiento Físico',
  'Pérdida de peso',
  'Ganancia muscular',
  'Fuerza',
  'Resistencia',
  'Flexibilidad',
  'Rehabilitación',
];

export default function ProfileModal({ isOpen, onClose, user, onProfileUpdated }: ProfileModalProps) {
  const [name, setName] = useState(user.name || '');
  const [goal, setGoal] = useState(user.goal || '');
  const [weightKg, setWeightKg] = useState<number>(user.weightKg || 70);
  const [heightCm, setHeightCm] = useState<number>(user.heightCm || 170);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if user prop changes
  useEffect(() => {
    setName(user.name || '');
    setGoal(user.goal || '');
    setWeightKg(user.weightKg || 70);
    setHeightCm(user.heightCm || 170);
  }, [user]);

  if (!isOpen) return null;

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'badge-purple';
      case 'COACH': return 'badge-blue';
      case 'CLIENT': return 'badge-green';
      default: return 'badge-gray';
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch(`${BASE}/api/v1/user/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('gymaura_token')}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const updatedUser = { ...user, avatar: data.avatarUrl || data.avatar }; // Adjust depending on your API response
        localStorage.setItem('gymaura_user', JSON.stringify(updatedUser));
        onProfileUpdated(updatedUser);
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await fetch(`${BASE}/api/v1/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gymaura_token')}`,
        },
        body: JSON.stringify({ name, goal, weightKg, heightCm }),
      });

      if (res.ok) {
        const updatedProfile = await res.json();
        // Assuming updatedProfile contains the full updated user, or we merge it
        const updatedUser = { ...user, ...updatedProfile };
        localStorage.setItem('gymaura_user', JSON.stringify(updatedUser));
        onProfileUpdated(updatedUser);
        onClose();
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const adjustValue = (setter: React.Dispatch<React.SetStateAction<number>>, amount: number) => {
    setter((prev) => Math.max(0, prev + amount));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Edit Profile</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <div 
              className="relative w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden cursor-pointer group shadow-sm border-2 border-white ring-2 ring-gray-100"
              onClick={handleAvatarClick}
            >
              {isUploading ? (
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              ) : user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-medium text-gray-500">{getInitials(user.name)}</span>
              )}
              
              {!isUploading && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            <div className="mt-4 flex items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getRoleBadgeColor(user.role)}`}>
                <Shield size={12} />
                {user.role}
              </span>
            </div>
          </div>

          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="label flex items-center gap-1.5"><User size={16}/> Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Your full name"
              />
            </div>

            {/* Email (Read Only) */}
            <div>
              <label className="label flex items-center gap-1.5"><Mail size={16}/> Email</label>
              <input
                type="text"
                value={user.email}
                disabled
                className="input bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Weight */}
              <div>
                <label className="label">Weight (kg)</label>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-1.5 border border-gray-200">
                  <button 
                    onClick={() => adjustValue(setWeightKg, -1)}
                    className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <Minus size={20} />
                  </button>
                  <span className="text-lg font-medium text-gray-700 w-12 text-center">{weightKg}</span>
                  <button 
                    onClick={() => adjustValue(setWeightKg, 1)}
                    className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              {/* Height */}
              <div>
                <label className="label">Height (cm)</label>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-1.5 border border-gray-200">
                  <button 
                    onClick={() => adjustValue(setHeightCm, -1)}
                    className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <Minus size={20} />
                  </button>
                  <span className="text-lg font-medium text-gray-700 w-12 text-center">{heightCm}</span>
                  <button 
                    onClick={() => adjustValue(setHeightCm, 1)}
                    className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Goal */}
            <div>
              <label className="label">Primary Goal</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="input bg-white appearance-none"
              >
                <option value="" disabled>Select your goal</option>
                {GOAL_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl font-medium bg-[#007AFF] text-white hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
