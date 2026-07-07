import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Droplets,
  GlassWater,
  Plus,
  Trash2,
  Flame,
  Beef,
  Pencil,
  Check,
  RotateCcw,
  UtensilsCrossed,
  Trophy,
  Camera,
  Loader2,
  Wheat,
  Sparkles,
} from 'lucide-react';
import { compressImage, analyzeFoodPhoto } from '../services/foodAI';

// "YYYY-MM-DD" no fuso local
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMl(ml: number): string {
  return ml >= 1000 ? `${(ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L` : `${ml} ml`;
}

type WaterEntry = { id: string; ml: number; date: string };
type Meal = { id: string; name: string; calories: number | null; protein: number | null; carbs: number | null };

interface DietaProps {
  session: any;
}

export function Dieta({ session }: DietaProps) {
  // ── Hidratação ──
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([]);
  const [waterGoal, setWaterGoal] = useState(2000);
  const [editingWaterGoal, setEditingWaterGoal] = useState(false);
  const [waterGoalInput, setWaterGoalInput] = useState('2000');
  const [customMl, setCustomMl] = useState('');
  const [celebrate, setCelebrate] = useState(false);

  // ── Refeições ──
  const [meals, setMeals] = useState<Meal[]>([]);
  const [calorieGoal, setCalorieGoal] = useState<number>(2500);
  const [proteinGoal, setProteinGoal] = useState<number>(150);
  const [editingMacros, setEditingMacros] = useState(false);
  const [showMealForm, setShowMealForm] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealCal, setMealCal] = useState('');
  const [mealProt, setMealProt] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');

  // ── IA: análise de foto ──
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const today = localDateStr();

  // ── Carregar dados ──
  useEffect(() => {
    if (!session) return;
    const load = async () => {
      setLoading(true);
      const weekAgo = localDateStr(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

      const [{ data: water }, { data: mealsData }, { data: settings }] = await Promise.all([
        supabase
          .from('water_intake')
          .select('id, ml, date')
          .eq('user_id', session.user.id)
          .gte('date', weekAgo)
          .order('created_at', { ascending: true }),
        supabase
          .from('meals')
          .select('id, name, calories, protein, carbs')
          .eq('user_id', session.user.id)
          .eq('date', today)
          .order('created_at', { ascending: true }),
        supabase
          .from('diet_settings')
          .select('water_goal_ml, calorie_goal, protein_goal')
          .eq('user_id', session.user.id)
          .maybeSingle(),
      ]);

      if (water) setWaterEntries(water as WaterEntry[]);
      if (mealsData) setMeals(mealsData as Meal[]);
      if (settings) {
        setWaterGoal(settings.water_goal_ml ?? 2000);
        setWaterGoalInput(String(settings.water_goal_ml ?? 2000));
        if (settings.calorie_goal) setCalorieGoal(settings.calorie_goal);
        if (settings.protein_goal) setProteinGoal(settings.protein_goal);
      }
      setLoading(false);
    };
    load();
  }, [session?.user?.id]);

  // ── Derivados ──
  const waterToday = useMemo(
    () => waterEntries.filter(e => e.date === today).reduce((a, e) => a + e.ml, 0),
    [waterEntries, today]
  );
  const waterPct = Math.min(100, (waterToday / waterGoal) * 100);
  const goalHit = waterToday >= waterGoal;

  const weekData = useMemo(() => {
    const days: { label: string; date: string; ml: number; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const ds = localDateStr(d);
      days.push({
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3).replace('.', ''),
        date: ds,
        ml: waterEntries.filter(e => e.date === ds).reduce((a, e) => a + e.ml, 0),
        isToday: ds === today,
      });
    }
    return days;
  }, [waterEntries, today]);

  const totalCal = meals.reduce((a, m) => a + (m.calories ?? 0), 0);
  const totalProt = meals.reduce((a, m) => a + (m.protein ?? 0), 0);
  const totalCarbs = meals.reduce((a, m) => a + (m.carbs ?? 0), 0);

  // ── Ações: água ──
  const addWater = async (ml: number) => {
    if (ml <= 0) return;
    const wasBelow = waterToday < waterGoal;
    const tempId = `temp-${Date.now()}`;
    setWaterEntries(prev => [...prev, { id: tempId, ml, date: today }]);

    if (wasBelow && waterToday + ml >= waterGoal) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2500);
    }

    const { data } = await supabase
      .from('water_intake')
      .insert({ user_id: session.user.id, ml, date: today })
      .select('id, ml, date')
      .single();
    if (data) {
      setWaterEntries(prev => prev.map(e => (e.id === tempId ? (data as WaterEntry) : e)));
    } else {
      setWaterEntries(prev => prev.filter(e => e.id !== tempId));
    }
  };

  const undoWater = async () => {
    const todayEntries = waterEntries.filter(e => e.date === today);
    const last = todayEntries[todayEntries.length - 1];
    if (!last) return;
    setWaterEntries(prev => prev.filter(e => e.id !== last.id));
    if (!last.id.startsWith('temp-')) {
      await supabase.from('water_intake').delete().eq('id', last.id).eq('user_id', session.user.id);
    }
  };

  const saveWaterGoal = async () => {
    const goal = Math.max(500, Number(waterGoalInput) || 2000);
    setWaterGoal(goal);
    setEditingWaterGoal(false);
    await supabase
      .from('diet_settings')
      .upsert({ user_id: session.user.id, water_goal_ml: goal, calorie_goal: calorieGoal, protein_goal: proteinGoal });
  };

  // ── Ações: refeições ──
  const addMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealName.trim()) return;
    const cal = mealCal ? Number(mealCal) : null;
    const prot = mealProt ? Number(mealProt) : null;
    const carbs = mealCarbs ? Number(mealCarbs) : null;
    const { data } = await supabase
      .from('meals')
      .insert({ user_id: session.user.id, date: today, name: mealName.trim(), calories: cal, protein: prot, carbs })
      .select('id, name, calories, protein, carbs')
      .single();
    if (data) setMeals(prev => [...prev, data as Meal]);
    setMealName('');
    setMealCal('');
    setMealProt('');
    setMealCarbs('');
    setAiNote(null);
    setAiError(null);
    setShowMealForm(false);
  };

  // ── IA: analisar foto da refeição ──
  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher a mesma foto de novo
    if (!file) return;

    setAiLoading(true);
    setAiError(null);
    setAiNote(null);
    try {
      const { base64, mediaType } = await compressImage(file);
      const result = await analyzeFoodPhoto(base64, mediaType);
      setMealName(result.name);
      setMealCal(String(result.calories));
      setMealProt(String(result.protein));
      setMealCarbs(String(result.carbs));
      setAiNote(
        `Confiança ${result.confidence}${result.notes ? ` — ${result.notes}` : ''}. Ajuste os valores se precisar.`
      );
    } catch (err: any) {
      setAiError(err?.message ?? 'Erro ao analisar a foto. Tente novamente.');
    } finally {
      setAiLoading(false);
    }
  };

  const deleteMeal = async (id: string) => {
    setMeals(prev => prev.filter(m => m.id !== id));
    await supabase.from('meals').delete().eq('id', id).eq('user_id', session.user.id);
  };

  const saveMacros = async () => {
    setEditingMacros(false);
    await supabase
      .from('diet_settings')
      .upsert({ user_id: session.user.id, water_goal_ml: waterGoal, calorie_goal: calorieGoal, protein_goal: proteinGoal });
  };

  // ── Anel SVG ──
  const R = 80;
  const C = 2 * Math.PI * R;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        <div className="lg:col-span-2 bg-[#111111] border border-[#1F1F1F] rounded-xl h-80" />
        <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Celebração */}
      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-sky-500 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 font-bold text-sm"
          >
            <Trophy size={18} /> Meta de água batida! 💧
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Card Hidratação ── */}
        <div className="lg:col-span-2 bg-[#111111] border border-[#1F1F1F] rounded-xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-[#E8E8E8] flex items-center gap-2">
                <Droplets size={16} className="text-sky-400" /> Hidratação
              </h3>
              <p className="text-xs text-[#616161] mt-0.5">Meta diária de água</p>
            </div>
            {editingWaterGoal ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={waterGoalInput}
                  onChange={e => setWaterGoalInput(e.target.value)}
                  className="w-20 bg-[#1a1a1a] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-[#E8E8E8] outline-none focus:border-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] text-[#616161]">ml</span>
                <button onClick={saveWaterGoal} className="p-1.5 bg-sky-500 rounded-lg text-white">
                  <Check size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingWaterGoal(true)}
                className="flex items-center gap-1.5 text-xs text-[#616161] hover:text-[#E8E8E8] bg-[#1a1a1a] px-3 py-1.5 rounded-lg transition-all"
              >
                Meta: {formatMl(waterGoal)} <Pencil size={11} />
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
            {/* Anel de progresso */}
            <div className="relative w-48 h-48 shrink-0">
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                <circle cx="100" cy="100" r={R} stroke="#1F1F1F" strokeWidth="14" fill="none" />
                <motion.circle
                  cx="100" cy="100" r={R}
                  stroke={goalHit ? '#10b981' : '#38bdf8'}
                  strokeWidth="14"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  initial={{ strokeDashoffset: C }}
                  animate={{ strokeDashoffset: C * (1 - waterPct / 100) }}
                  transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  key={waterToday}
                  initial={{ scale: 1.15, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`text-3xl font-black tabular-nums ${goalHit ? 'text-emerald-400' : 'text-sky-400'}`}
                >
                  {formatMl(waterToday)}
                </motion.span>
                <span className="text-xs text-[#616161] mt-1">de {formatMl(waterGoal)}</span>
                <span className={`text-[10px] font-bold mt-1 ${goalHit ? 'text-emerald-400' : 'text-[#616161]'}`}>
                  {goalHit ? '✓ Meta batida!' : `${waterPct.toFixed(0)}%`}
                </span>
              </div>
            </div>

            {/* Botões rápidos */}
            <div className="flex-1 w-full space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { ml: 200, label: 'Copo', icon: '🥛' },
                  { ml: 500, label: 'Garrafa', icon: '🍶' },
                  { ml: 1000, label: '1 Litro', icon: '💧' },
                ].map(b => (
                  <motion.button
                    key={b.ml}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => addWater(b.ml)}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-xl border border-[#1F1F1F] bg-[#0e0e0e] hover:border-sky-500/40 hover:bg-sky-500/5 transition-all"
                  >
                    <span className="text-2xl">{b.icon}</span>
                    <span className="text-xs font-semibold text-[#E8E8E8]">+{b.ml} ml</span>
                    <span className="text-[10px] text-[#616161]">{b.label}</span>
                  </motion.button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  value={customMl}
                  onChange={e => setCustomMl(e.target.value)}
                  placeholder="Quantidade personalizada (ml)"
                  className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-[#E8E8E8] outline-none focus:border-sky-500 transition-all placeholder:text-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => { addWater(Number(customMl)); setCustomMl(''); }}
                  disabled={!customMl || Number(customMl) <= 0}
                  className="px-4 bg-sky-500 hover:bg-sky-400 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>

              <button
                onClick={undoWater}
                disabled={waterEntries.filter(e => e.date === today).length === 0}
                className="flex items-center gap-1.5 text-xs text-[#616161] hover:text-[#E8E8E8] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <RotateCcw size={12} /> Desfazer último registro
              </button>
            </div>
          </div>

          {/* Copos do dia */}
          <div className="mt-6 pt-5 border-t border-[#1F1F1F]">
            <p className="text-[10px] text-[#616161] uppercase tracking-widest mb-3">Copos de 250 ml</p>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: Math.ceil(waterGoal / 250) }).map((_, i) => {
                const filled = waterToday >= (i + 1) * 250;
                const partial = !filled && waterToday > i * 250;
                return (
                  <motion.div
                    key={i}
                    initial={false}
                    animate={{ scale: filled ? 1 : 0.95, opacity: filled || partial ? 1 : 0.35 }}
                    className={`w-8 h-10 rounded-b-lg rounded-t-sm border-2 flex items-end justify-center overflow-hidden ${
                      filled ? 'border-sky-400 bg-sky-400/20' : 'border-[#2a2a2a] bg-[#0e0e0e]'
                    }`}
                  >
                    {filled && <GlassWater size={14} className="text-sky-400 mb-1" />}
                    {partial && (
                      <div
                        className="w-full bg-sky-400/30"
                        style={{ height: `${((waterToday - i * 250) / 250) * 100}%` }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Card Histórico semanal ── */}
        <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl p-5 md:p-6">
          <h3 className="text-sm font-semibold text-[#E8E8E8] mb-1">Últimos 7 dias</h3>
          <p className="text-xs text-[#616161] mb-6">Consumo de água</p>
          <div className="flex items-end justify-between gap-2 h-40">
            {weekData.map(d => {
              const pct = Math.min(100, (d.ml / waterGoal) * 100);
              const hit = d.ml >= waterGoal;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[9px] text-[#616161] tabular-nums">
                    {d.ml > 0 ? formatMl(d.ml) : ''}
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, pct * 0.8)}%` }}
                    transition={{ type: 'spring', stiffness: 80, damping: 16 }}
                    className={`w-full max-w-[28px] rounded-lg ${
                      hit ? 'bg-emerald-500' : d.isToday ? 'bg-sky-400' : 'bg-sky-400/30'
                    }`}
                  />
                  <span className={`text-[10px] capitalize ${d.isToday ? 'text-sky-400 font-bold' : 'text-[#616161]'}`}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-[#1F1F1F] flex items-center justify-between text-xs">
            <span className="text-[#616161]">Dias com meta batida</span>
            <span className="font-bold text-emerald-400">
              {weekData.filter(d => d.ml >= waterGoal).length}/7
            </span>
          </div>
        </div>
      </div>

      {/* ── Card Refeições ── */}
      <div className="bg-[#111111] border border-[#1F1F1F] rounded-xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-[#E8E8E8] flex items-center gap-2">
              <UtensilsCrossed size={16} className="text-amber-400" /> Refeições de Hoje
            </h3>
            <p className="text-xs text-[#616161] mt-0.5">{meals.length} registradas</p>
          </div>
          <div className="flex items-center gap-2">
            {editingMacros ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Flame size={12} className="text-orange-400" />
                  <input
                    type="number"
                    value={calorieGoal}
                    onChange={e => setCalorieGoal(Number(e.target.value))}
                    className="w-16 bg-[#1a1a1a] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-[#E8E8E8] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Beef size={12} className="text-rose-400" />
                  <input
                    type="number"
                    value={proteinGoal}
                    onChange={e => setProteinGoal(Number(e.target.value))}
                    className="w-14 bg-[#1a1a1a] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-[#E8E8E8] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <button onClick={saveMacros} className="p-1.5 bg-emerald-500 rounded-lg text-white">
                  <Check size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingMacros(true)}
                className="flex items-center gap-1.5 text-xs text-[#616161] hover:text-[#E8E8E8] bg-[#1a1a1a] px-3 py-1.5 rounded-lg transition-all"
              >
                Metas <Pencil size={11} />
              </button>
            )}
            <button
              onClick={() => setShowMealForm(p => !p)}
              className="bg-[#1a1a1a] hover:bg-[#222] text-[#616161] hover:text-[#E8E8E8] p-1.5 rounded-lg transition-all"
            >
              <Plus size={18} className={showMealForm ? 'rotate-45 transition-transform' : 'transition-transform'} />
            </button>
          </div>
        </div>

        {/* Barras de macros */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#616161] flex items-center gap-1">
                <Flame size={12} className="text-orange-400" /> Calorias
              </span>
              <span className={`text-xs font-bold tabular-nums ${totalCal > calorieGoal ? 'text-rose-400' : 'text-[#E8E8E8]'}`}>
                {totalCal} / {calorieGoal} kcal
              </span>
            </div>
            <div className="w-full bg-[#1a1a1a] h-2 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${Math.min(100, (totalCal / calorieGoal) * 100)}%` }}
                className={`h-full rounded-full ${totalCal > calorieGoal ? 'bg-rose-500' : 'bg-orange-400'}`}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#616161] flex items-center gap-1">
                <Beef size={12} className="text-rose-400" /> Proteína
              </span>
              <span className={`text-xs font-bold tabular-nums ${totalProt >= proteinGoal ? 'text-emerald-400' : 'text-[#E8E8E8]'}`}>
                {totalProt} / {proteinGoal} g
              </span>
            </div>
            <div className="w-full bg-[#1a1a1a] h-2 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${Math.min(100, (totalProt / proteinGoal) * 100)}%` }}
                className={`h-full rounded-full ${totalProt >= proteinGoal ? 'bg-emerald-500' : 'bg-rose-400'}`}
              />
            </div>
          </div>
        </div>

        {/* Total de carboidratos */}
        <div className="flex items-center justify-between px-4 py-2.5 mb-5 bg-[#0e0e0e] border border-[#1F1F1F] rounded-xl">
          <span className="text-xs text-[#616161] flex items-center gap-1.5">
            <Wheat size={13} className="text-amber-400" /> Carboidratos hoje
          </span>
          <span className="text-xs font-bold tabular-nums text-amber-400">{totalCarbs} g</span>
        </div>

        {/* Form de nova refeição */}
        <AnimatePresence>
          {showMealForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={addMeal}
              className="overflow-hidden mb-4"
            >
              <div className="p-4 bg-[#0e0e0e] border border-[#1F1F1F] rounded-xl space-y-3">
                {/* Botão de análise por foto */}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={aiLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/10 text-sky-400 text-sm font-semibold transition-all disabled:opacity-60"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Analisando foto...
                    </>
                  ) : (
                    <>
                      <Camera size={16} /> Tirar foto do prato — IA preenche os macros
                    </>
                  )}
                </button>

                {aiError && (
                  <p className="text-xs text-rose-400 bg-rose-400/10 rounded-lg px-3 py-2">{aiError}</p>
                )}
                {aiNote && (
                  <p className="text-xs text-sky-400 bg-sky-400/10 rounded-lg px-3 py-2 flex items-start gap-1.5">
                    <Sparkles size={13} className="shrink-0 mt-0.5" /> {aiNote}
                  </p>
                )}

                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    required
                    value={mealName}
                    onChange={e => setMealName(e.target.value)}
                    placeholder="Ex: Frango com arroz"
                    className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-[#E8E8E8] outline-none focus:border-emerald-500 transition-all placeholder:text-zinc-700"
                  />
                  <input
                    type="number"
                    value={mealCal}
                    onChange={e => setMealCal(e.target.value)}
                    placeholder="kcal"
                    className="w-full md:w-24 bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-[#E8E8E8] outline-none focus:border-emerald-500 transition-all placeholder:text-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="number"
                    value={mealCarbs}
                    onChange={e => setMealCarbs(e.target.value)}
                    placeholder="carbo (g)"
                    className="w-full md:w-24 bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-[#E8E8E8] outline-none focus:border-emerald-500 transition-all placeholder:text-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="number"
                    value={mealProt}
                    onChange={e => setMealProt(e.target.value)}
                    placeholder="prot (g)"
                    className="w-full md:w-24 bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-[#E8E8E8] outline-none focus:border-emerald-500 transition-all placeholder:text-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Lista de refeições */}
        {meals.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-[#1F1F1F] rounded-xl">
            <p className="text-sm text-[#616161]">Nenhuma refeição registrada hoje</p>
            <p className="text-xs text-[#3a3a3a] mt-1">Toque em + para adicionar</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {meals.map(m => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="group flex items-center gap-3 px-4 py-3 bg-[#0e0e0e] border border-[#1F1F1F] rounded-xl hover:border-[#2a2a2a] transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <UtensilsCrossed size={15} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E8E8E8] truncate">{m.name}</p>
                    <p className="text-[11px] text-[#616161]">
                      {m.calories != null && <span className="text-orange-400">{m.calories} kcal</span>}
                      {m.calories != null && m.carbs != null && ' · '}
                      {m.carbs != null && <span className="text-amber-400">{m.carbs}g carbo</span>}
                      {(m.calories != null || m.carbs != null) && m.protein != null && ' · '}
                      {m.protein != null && <span className="text-rose-400">{m.protein}g prot</span>}
                      {m.calories == null && m.protein == null && m.carbs == null && 'Sem macros'}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMeal(m.id)}
                    className="p-1.5 rounded-lg text-transparent group-hover:text-[#3a3a3a] hover:!text-rose-400 hover:bg-rose-400/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
