import { useState } from 'react';
import { supabase } from '../services/supabase';
import { Dumbbell } from 'lucide-react';

interface OnboardingProps {
  userId: string;
  onComplete: () => void;
}

function gerarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function Onboarding({ userId, onComplete }: OnboardingProps) {
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
    .from('squads')
    .insert({ name: nome, created_by: userId, invite_code: inviteCode })
    .select('id')
    .single();

  if (squadErr) { setErro('Erro squad: ' + squadErr.message); setLoading(false); return; }

  const { error: memberErr } = await supabase
    .from('squad_members')
    .insert({ squad_id: squad.id, user_id: userId, role: 'admin' });

  if (memberErr) { setErro('Erro membro: ' + memberErr.message); setLoading(false); return; }

  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const { error: daysErr } = await supabase
    .from('workout_days')
    .insert(dias.map((name, i) => ({ squad_id: squad.id, name, day_order: i })));

  if (daysErr) { setErro('Erro dias: ' + daysErr.message); setLoading(false); return; }

  setLoading(false);
  onComplete();
};

  const entrarSquad = async () => {
    if (!codigo.trim()) { setErro('Digite o código do squad'); return; }
    setLoading(true); setErro('');

    const { data: squad, error: squadErr } = await supabase
      .from('squads')
      .select('id')
      .eq('invite_code', codigo.toUpperCase())
      .single();

    if (squadErr || !squad) { setErro('Código inválido. Verifique e tente novamente.'); setLoading(false); return; }

    const { error: memberErr } = await supabase
      .from('squad_members')
      .insert({ squad_id: squad.id, user_id: userId, role: 'member' });

    if (memberErr) { setErro('Você já está nesse squad ou ocorreu um erro.'); setLoading(false); return; }

    setLoading(false);
    onComplete();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#09090b' }}>
      <div style={{ width: 400, padding: 32 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: '#10b981', borderRadius: 16, marginBottom: 16 }}>
            <Dumbbell color="white" size={28} />
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Bem-vindo ao SquadFit!</h1>
          <p style={{ color: '#666', fontSize: 14 }}>Para começar, crie ou entre em um squad</p>
        </div>

        {/* Tela de escolha */}
        {modo === 'escolha' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => setModo('criar')}
              style={{ padding: '20px 24px', background: '#111', border: '1px solid #222', borderRadius: 12, color: '#fff', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>💪 Criar um novo squad</div>
              <div style={{ fontSize: 13, color: '#666' }}>Você será o admin e poderá convidar membros</div>
            </button>
            <button onClick={() => setModo('entrar')}
              style={{ padding: '20px 24px', background: '#111', border: '1px solid #222', borderRadius: 12, color: '#fff', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🔑 Entrar em um squad</div>
              <div style={{ fontSize: 13, color: '#666' }}>Use o código de convite que recebeu</div>
            </button>
          </div>
        )}

        {/* Criar squad */}
        {modo === 'criar' && (
          <div>
            <button onClick={() => setModo('escolha')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: 20, fontSize: 13 }}>
              ← Voltar
            </button>
            <label style={{ display: 'block', color: '#fff', fontSize: 14, marginBottom: 6 }}>Nome do squad</label>
            <input value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Os Brutos do CT"
              style={{ width: '100%', padding: 12, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }} />
            {erro && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{erro}</p>}
            <button onClick={criarSquad} disabled={loading}
              style={{ width: '100%', padding: 14, background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 15, opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Criando...' : 'Criar Squad'}
            </button>
          </div>
        )}

        {/* Entrar no squad */}
        {modo === 'entrar' && (
          <div>
            <button onClick={() => setModo('escolha')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: 20, fontSize: 13 }}>
              ← Voltar
            </button>
            <label style={{ display: 'block', color: '#fff', fontSize: 14, marginBottom: 6 }}>Código de convite</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value)}
              placeholder="Ex: ABC123"
              style={{ width: '100%', padding: 12, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff', fontSize: 14, marginBottom: 16, boxSizing: 'border-box', textTransform: 'uppercase', letterSpacing: 4 }} />
            {erro && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{erro}</p>}
            <button onClick={entrarSquad} disabled={loading}
              style={{ width: '100%', padding: 14, background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 15, opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Entrando...' : 'Entrar no Squad'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}