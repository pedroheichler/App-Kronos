import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Squad } from '../types';

interface SettingsProps {
  session: any;
  squad: Squad;
  onSquadUpdate: (name: string, icon: string) => void;
}

export function Settings({ session, squad, onSquadUpdate }: SettingsProps) {
  const isAdmin = squad.members.find(m => m.id === session?.user?.id)?.role === 'admin';

  // Perfil
  const [displayName, setDisplayName] = useState('');
  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Squad
  const [squadName, setSquadName] = useState(squad.name);
  const [squadIcon, setSquadIcon] = useState(squad.icon || '');
  const [squadStatus, setSquadStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    supabase
      .from('profiles')
      .select('name')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.name) setDisplayName(data.name);
      });
  }, [session.user.id]);

  const saveProfile = async () => {
    setProfileStatus('saving');
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, name: displayName }, { onConflict: 'id' });
    if (error) console.error('Erro ao salvar perfil:', error);
    setProfileStatus('saved');
    setTimeout(() => setProfileStatus('idle'), 2000);
  };

  const saveSquad = async () => {
    setSquadStatus('saving');
    await supabase
      .from('squads')
      .update({ name: squadName, icon: squadIcon })
      .eq('id', squad.id);
    onSquadUpdate(squadName, squadIcon);
    setSquadStatus('saved');
    setTimeout(() => setSquadStatus('idle'), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Meu Perfil */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
        <h2 className="text-xl font-bold text-zinc-100 mb-6">Meu Perfil</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
              E-mail
            </label>
            <div className="bg-zinc-800/50 rounded-xl px-4 py-3 text-sm text-zinc-400">
              {session.user.email}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
              Nome de exibição
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Seu nome"
              className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveProfile}
              disabled={profileStatus === 'saving'}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-all"
            >
              {profileStatus === 'saving' ? 'Salvando...' : profileStatus === 'saved' ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      {/* Squad — só para admin */}
      {isAdmin && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
          <h2 className="text-xl font-bold text-zinc-100 mb-6">Configurações do Squad</h2>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Nome do Squad
              </label>
              <input
                type="text"
                value={squadName}
                onChange={e => setSquadName(e.target.value)}
                placeholder="Nome do squad"
                className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
                URL da foto do Squad
              </label>
              <input
                type="text"
                value={squadIcon}
                onChange={e => setSquadIcon(e.target.value)}
                placeholder="https://..."
                className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {squadIcon && (
                <img
                  src={squadIcon}
                  alt="preview"
                  className="mt-3 w-16 h-16 rounded-2xl object-cover bg-zinc-800"
                  onError={e => (e.currentTarget.style.display = 'none')}
                />
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveSquad}
                disabled={squadStatus === 'saving'}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-all"
              >
                {squadStatus === 'saving' ? 'Salvando...' : squadStatus === 'saved' ? 'Salvo!' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
