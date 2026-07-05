import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Shield, 
  ShieldOff, 
  UserPlus,
  Mail,
  Phone,
  MapPin,
  Calendar,
  MoreVertical,
  Loader2,
  Check
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import { ErrorState } from '../../components/ui/ErrorState';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(false);
    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (fetchErr) {
      console.error('Error fetching users:', fetchErr);
      setError(true);
    } else if (data) {
      setUsers(data);
    }
    setLoading(false);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <ErrorState onRetry={fetchUsers} />
      </div>
    );
  }

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    setIsUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: !currentStatus })
      .eq('id', userId);
    
    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, is_admin: !currentStatus } : u));
    }
    setIsUpdating(null);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = 
      roleFilter === 'all' || 
      (roleFilter === 'admin' && u.is_admin) || 
      (roleFilter === 'citizen' && !u.is_admin);
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-5xl font-black uppercase tracking-tighter mb-2">Citizen <span className="text-brand-red">Registry</span></h1>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Manage all citizens registered within the Posterealm.</p>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search registry (Name, Email)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white comic-border font-bold focus:outline-none focus:ring-2 focus:ring-brand-red/20 transition-all"
          />
        </div>
        <select 
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-6 py-4 bg-white comic-border font-black uppercase text-xs tracking-widest hover:bg-gray-100 transition-colors focus:outline-none"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admins</option>
          <option value="citizen">Citizens</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white comic-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b-2 border-brand-black">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Citizen</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Contact</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Joined</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Role</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-brand-red w-10 h-10 mx-auto" />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                    No citizens found in the registry.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand-red/10 rounded-full flex items-center justify-center text-brand-red comic-border border-brand-red/20 font-black">
                          {u.full_name?.[0] || u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-sm uppercase group-hover:text-brand-red transition-colors">{u.full_name || 'Anonymous citizen'}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">ID: {u.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="flex items-center gap-2 text-xs font-bold"><Mail size={12} className="text-gray-400" /> {u.email}</p>
                        {u.phone && <p className="flex items-center gap-2 text-xs font-bold"><Phone size={12} className="text-gray-400" /> {u.phone}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-brand-red" />
                        {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 comic-border text-[10px] font-black uppercase tracking-widest ${u.is_admin ? 'bg-brand-red text-white border-brand-red shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {u.is_admin ? <Shield size={12} /> : <Users size={12} />}
                        {u.is_admin ? 'Admin' : 'Citizen'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => toggleAdmin(u.id, u.is_admin)}
                        disabled={isUpdating === u.id}
                        className={`w-11 h-11 flex items-center justify-center transition-all comic-border border-transparent hover:bg-gray-100 hover:border-gray-200 active:scale-95 ${u.is_admin ? 'text-brand-red' : 'text-gray-400 hover:text-brand-black'}`}
                        title={u.is_admin ? 'Remove Admin Privileges' : 'Grant Admin Privileges'}
                      >
                        {isUpdating === u.id ? <Loader2 size={18} className="animate-spin" /> : u.is_admin ? <ShieldOff size={18} /> : <Shield size={18} />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
