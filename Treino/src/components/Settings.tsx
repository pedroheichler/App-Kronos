import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Squad } from '../types';

interface SettingsProps {
  session: any;
  squad: Squad;
  onSquadUpdate: (name: string, icon: string) => void;
  onProfileUpdate: (name: string, avatarUrl: string) => void;
  onLeaveSquad: () => void;
  onSquadJoined?: () => void;
}

function gerarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function SquadSetup({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const [modo, setModo] = useState<'escolha' | 'criar' | 'entrar'>('escolha');
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const criarSquad = async () => {
    if (!nome.trim()) { setErro('Digite um nome para o squad'); return; }
    setLoading(true); setErro('');
    const inviteCode = gerarCodigo();
    const { data: squad, error: squadErr } = await supabase
      .from('squads').insert({ name: nome, created_by: userId, invite_code: inviteCode }).select('id').single();
    if (squadErr) { setErro('Erro: ' + squadErr.message); setLoading(false); return; }
    const { error: memberErr } = await supabase
      .from('squad_members').insert({ squad_id: squad.id, user_id: userId, role: 'admin' });
    if (memberErr) { setErro('Erro: ' + memberErr.message); setLoading(false); return; }
    const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    await supabase.from('workout_days').insert(dias.map((name, i) => ({ squad_id: squad.id, name, day_order: i })));
    setLoading(false);
    onComplete();
  };

  const entrarSquad = async () => {
    if (!codigo.trim()) { setErro('Digite o código do squad'); return; }
    setLoading(true); setErro('');
    const { data: squad, error: squadErr } = await supabase
      .from('squads').select('id').eq('invite_code', codigo.toUpperCase()).single();
    if (squadErr || !squad) { setErro('Código inválido. Verifique e tente novamente.'); setLoading(false); return; }
    const { error: memberErr } = await supabase
      .from('squad_members').insert({ squad_id: squad.id, user_id: userId, role: 'member' });
    if (memberErr) { setErro('Você já está nesse squad ou ocorreu um erro.'); setLoading(false); return; }
    setLoading(false);
    onComplete();
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 max-w-md">
      <h2 className="text-xl font-bold text-zinc-100 mb-2">Entrar em um Squad</h2>
      <p className="text-sm text-zinc-500 mb-6">Crie um squad novo ou entre num existente com código de convite.</p>

      {modo === 'escolha' && (
        <div className="flex flex-col gap-3">
          <button onClick={() => setModo('criar')}
            className="p-5 bg-[#111] border border-[#222] hover:border-emerald-500 rounded-xl text-left transition-colors"
          >
            <div className="text-sm font-semibold text-white mb-1">💪 Criar um novo squad</div>
            <div className="text-xs text-zinc-500">Você será o admin e poderá convidar membros</div>
          </button>
          <button onClick={() => setModo('entrar')}
            className="p-5 bg-[#111] border border-[#222] hover:border-emerald-500 rounded-xl text-left transition-colors"
          >
            <div className="text-sm font-semibold text-white mb-1">🔑 Entrar em um squad</div>
            <div className="text-xs text-zinc-500">Use o código de convite que recebeu</div>
          </button>
        </div>
      )}

      {modo === 'criar' && (
        <div>
          <button onClick={() => { setModo('escolha'); setErro(''); }} className="text-xs text-zinc-500 hover:text-zinc-300 mb-4 block">← Voltar</button>
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Nome do squad</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Os Brutos do CT"
            className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 mb-4" />
          {erro && <p className="text-red-400 text-xs mb-3">{erro}</p>}
          <button onClick={criarSquad} disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold transition-all">
            {loading ? 'Criando...' : 'Criar Squad'}
          </button>
        </div>
      )}

      {modo === 'entrar' && (
        <div>
          <button onClick={() => { setModo('escolha'); setErro(''); }} className="text-xs text-zinc-500 hover:text-zinc-300 mb-4 block">← Voltar</button>
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Código de convite</label>
          <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ex: ABC123"
            className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 mb-4 uppercase tracking-widest" />
          {erro && <p className="text-red-400 text-xs mb-3">{erro}</p>}
          <button onClick={entrarSquad} disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold transition-all">
            {loading ? 'Entrando...' : 'Entrar no Squad'}
          </button>
        </div>
      )}
    </div>
  );
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

export function Settings({ session, squad, onSquadUpdate, onProfileUpdate, onLeaveSquad, onSquadJoined }: SettingsProps) {
  const isAdmin = squad.members.find(m => m.id === session?.user?.id)?.role === 'admin';
  const hasSquad = !!squad.id;

  // Perfil
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Squad
  const [squadName, setSquadName] = useState(squad.name);
  const [squadIcon, setSquadIcon] = useState(squad.icon || '');
  const [squadIconUploading, setSquadIconUploading] = useState(false);
  const [squadStatus, setSquadStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const squadIconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.name) setDisplayName(data.name);
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [session.user.id]);

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    const path = `${session.user.id}/avatar`;
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (error) { console.error('Erro no upload:', error); setAvatarUploading(false); return; }
    const url = publicUrl('avatars', path);
    await supabase.from('profiles').upsert({ id: session.user.id, avatar_url: url }, { onConflict: 'id' });
    const urlWithCache = url + '?t=' + Date.now();
    setAvatarUrl(urlWithCache);
    onProfileUpdate(displayName, urlWithCache);
    setAvatarUploading(false);
  };

  const uploadSquadIcon = async (file: File) => {
    setSquadIconUploading(true);
    const path = `${squad.id}/icon`;
    const { error } = await supabase.storage
      .from('squad-icons')
      .upload(path, file, { upsert: true });
    if (error) { console.error('Erro no upload:', error); setSquadIconUploading(false); return; }
    const url = publicUrl('squad-icons', path);
    await supabase.from('squads').update({ icon: url }).eq('id', squad.id);
    setSquadIcon(url + '?t=' + Date.now());
    onSquadUpdate(squadName, url);
    setSquadIconUploading(false);
  };

  const saveProfile = async () => {
    setProfileStatus('saving');
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, name: displayName }, { onConflict: 'id' });
    if (error) {
      alert('Erro ao salvar configurações.');
      setProfileStatus('error');
      setTimeout(() => setProfileStatus('idle'), 3000);
      return;
    }
    onProfileUpdate(displayName, avatarUrl);
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

      {/* Squad Setup — quando ainda não tem squad */}
      {!hasSquad && onSquadJoined && (
        <SquadSetup userId={session.user.id} onComplete={onSquadJoined} />
      )}

      {/* Meu Perfil */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
        <h2 className="text-xl font-bold text-zinc-100 mb-6">Meu Perfil</h2>

        <div className="space-y-5">

          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className={`w-20 h-20 rounded-full object-cover bg-zinc-800 ${avatarUploading ? 'opacity-60' : ''}`}
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-2xl">
                  {displayName?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {avatarUploading ? 'Enviando...' : 'Trocar foto de perfil'}
              </button>
              <p className="text-xs text-zinc-600 mt-1">JPG, PNG ou GIF</p>
            </div>
          </div>

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
              {profileStatus === 'saving' ? 'Salvando...' : profileStatus === 'saved' ? 'Salvo!' : profileStatus === 'error' ? 'Erro!' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      {/* Squad — só para admin e quando tem squad */}
      {hasSquad && isAdmin && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
          <h2 className="text-xl font-bold text-zinc-100 mb-6">Configurações do Squad</h2>

          <div className="space-y-5">

            {/* Foto do squad */}
            <div className="flex items-center gap-5">
              <div className="relative">
                {squadIcon ? (
                  <img
                    src={squadIcon}
                    alt="squad"
                    className={`w-20 h-20 rounded-2xl object-cover bg-zinc-800 ${squadIconUploading ? 'opacity-60' : ''}`}
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 text-2xl">
                    {squadName?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div>
                <input
                  ref={squadIconInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && uploadSquadIcon(e.target.files[0])}
                />
                <button
                  onClick={() => squadIconInputRef.current?.click()}
                  disabled={squadIconUploading}
                  className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {squadIconUploading ? 'Enviando...' : 'Trocar foto do squad'}
                </button>
                <p className="text-xs text-zinc-600 mt-1">JPG, PNG ou GIF</p>
              </div>
            </div>

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

      {/* Zona de Perigo — só quando tem squad */}
      {hasSquad && <div className="bg-zinc-900/50 border border-red-900/40 rounded-3xl p-8">
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Zona de Perigo</h2>
        <p className="text-zinc-500 text-sm mb-6">Ações irreversíveis relacionadas ao seu squad.</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-200">Sair do squad</p>
            <p className="text-xs text-zinc-500 mt-0.5">Você perderá acesso aos treinos e precisará entrar novamente com um código.</p>
          </div>
          <button
            onClick={async () => {
              if (!confirm('Tem certeza que quer sair do squad?')) return;
              const { error } = await supabase
                .from('squad_members')
                .delete()
                .eq('user_id', session.user.id)
                .eq('squad_id', squad.id);
              if (error) { alert('Erro ao sair do squad.'); return; }
              onLeaveSquad();
            }}
            className="ml-6 shrink-0 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            Sair do squad
          </button>
        </div>
      </div>}
    </div>
  );
}
