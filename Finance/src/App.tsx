import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Edit2,
  CircleDollarSign,
  BarChart3,
  RefreshCw,
  Sun,
  Moon,
  Home,
  ArrowLeftRight,
  Target,
  UserCircle2,
  LogOut,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { AppSwitcher } from './components/AppSwitcher';
import { Transaction, Investment, TransactionType, DashboardSummary, SpendingGoal } from "../types";
import DashboardCard from "./components/DashboardCard";
import { supabase } from "./services/supabase";
import { getFinancialInsights } from "./services/insights";

const COLORS = ["#10b981","#6366f1", "#f59e0b", "#ef4444", "#a78bfa"];

const CRYPTOS = [
  { id: 'bitcoin',      name: 'Bitcoin',    symbol: 'BTC' },
  { id: 'ethereum',     name: 'Ethereum',   symbol: 'ETH' },
  { id: 'solana',       name: 'Solana',     symbol: 'SOL' },
  { id: 'binancecoin',  name: 'BNB',        symbol: 'BNB' },
  { id: 'ripple',       name: 'XRP',        symbol: 'XRP' },
  { id: 'cardano',      name: 'Cardano',    symbol: 'ADA' },
  { id: 'dogecoin',     name: 'Dogecoin',   symbol: 'DOGE' },
  { id: 'avalanche-2',  name: 'Avalanche',  symbol: 'AVAX' },
  { id: 'polkadot',     name: 'Polkadot',   symbol: 'DOT' },
  { id: 'chainlink',    name: 'Chainlink',  symbol: 'LINK' },
  { id: 'tron',         name: 'TRON',       symbol: 'TRX' },
  { id: 'toncoin',      name: 'Toncoin',    symbol: 'TON' },
];

const App: React.FC = () => {
  // ---- Tema ----
  const [isLight, setIsLight] = useState(() => localStorage.getItem('finance-theme') === 'light');
  const [hideBalance, setHideBalance] = useState(() => localStorage.getItem('finance-hide-balance') === 'true');
  const toggleHideBalance = () => setHideBalance(prev => {
    const next = !prev;
    localStorage.setItem('finance-hide-balance', next ? 'true' : 'false');
    return next;
  });
  const [activeTab, setActiveTab] = useState<'home' | 'transactions' | 'budget' | 'profile'>('home');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const toggleTheme = () => setIsLight(prev => {
    const next = !prev;
    localStorage.setItem('finance-theme', next ? 'light' : 'dark');
    return next;
  });

  // ---- Auth session (hooks SEMPRE rodam) ----
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ---- State do app (hooks SEMPRE rodam) ----
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [insights, setInsights] = useState<string>("");
  const [loadingInsights, setLoadingInsights] = useState<boolean>(false);
  const [showTransModal, setShowTransModal] = useState(false);
  const [showInvModal, setShowInvModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [defaultType, setDefaultType] = useState<"income" | "expense">("expense");
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, number>>({});
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [invModalType, setInvModalType] = useState('Renda Fixa');
  const [invModalCryptoId, setInvModalCryptoId] = useState('bitcoin');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [spendingGoals, setSpendingGoals] = useState<SpendingGoal[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SpendingGoal | null>(null);
  const [goalCategory, setGoalCategory] = useState('Alimentação');
  const [transactionCategory, setTransactionCategory] = useState('Alimentação');
  const [isInstallment, setIsInstallment] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const n = new Date();
    return { month: n.getMonth(), year: n.getFullYear() };
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);


  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  // ---- Carregar dados do Supabase quando estiver logado ----
  const fetchData = async () => {
    const { data: tData, error: tErr } = await supabase
      .from("transactions")
      .select("id, title, amount, type, category, created_at, notes, is_recurring, installment_total, installment_current")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (tErr) {
      console.error("Erro carregando transactions:", tErr.message);
    } else {
      const mapTx = (t: any): Transaction => ({
        id: t.id,
        description: t.title,
        amount: Number(t.amount),
        type: t.type === "income" ? TransactionType.INCOME : TransactionType.EXPENSE,
        category: t.category,
        date: t.created_at,
        notes: t.notes ?? undefined,
        isRecurring: t.is_recurring ?? false,
        installmentTotal: t.installment_total ?? undefined,
        installmentCurrent: t.installment_current ?? undefined,
      });

      const mapped = (tData || []).map(mapTx);

      // Auto-inserir recorrentes que ainda não existem neste mês
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      const recurring = mapped.filter(t => t.isRecurring);
      const thisMonthIds = new Set(
        mapped
          .filter(t => { const d = new Date(t.date); return d.getFullYear() === curYear && d.getMonth() === curMonth; })
          .filter(t => t.isRecurring)
          .map(t => t.description + '|' + t.category + '|' + t.type)
      );

      const toInsert = recurring
        .filter(t => {
          const d = new Date(t.date);
          return !(d.getFullYear() === curYear && d.getMonth() === curMonth);
        })
        .reduce<Transaction[]>((acc, t) => {
          const key = t.description + '|' + t.category + '|' + t.type;
          if (!thisMonthIds.has(key) && !acc.find(x => x.description + '|' + x.category + '|' + x.type === key)) {
            acc.push(t);
          }
          return acc;
        }, []);

      const inserted: Transaction[] = [];
      for (const t of toInsert) {
        const { data: ins } = await supabase
          .from("transactions")
          .insert({
            user_id: session.user.id,
            title: t.description,
            amount: t.amount,
            type: t.type === TransactionType.INCOME ? "income" : "expense",
            category: t.category,
            notes: t.notes,
            is_recurring: true,
            created_at: new Date(curYear, curMonth, 1).toISOString(),
          })
          .select("id, title, amount, type, category, created_at, notes, is_recurring")
          .single();
        if (ins) inserted.push(mapTx(ins));
      }

      setTransactions([...inserted, ...mapped]);
    }

    const { data: goalsData } = await supabase
      .from("spending_goals")
      .select("id, category, monthly_limit")
      .eq("user_id", session.user.id);
    if (goalsData) {
      setSpendingGoals(goalsData.map((g: any) => ({ id: g.id, category: g.category, monthlyLimit: Number(g.monthly_limit) })));
    }

    const { data: iData, error: iErr } = await supabase
      .from("investments")
      .select("id, name, initial_amount, current_value, type, date, crypto_id, quantity")
      .eq("user_id", session.user.id)
      .order("date", { ascending: false });

    if (iErr) {
      console.error("Erro carregando investments:", iErr.message);
    } else { // eslint-disable-line
      const mapped: Investment[] = (iData || []).map((inv: any) => ({
        id: inv.id,
        name: inv.name,
        initialAmount: Number(inv.initial_amount),
        currentValue: Number(inv.current_value),
        type: inv.type,
        date: inv.date,
        cryptoId: inv.crypto_id ?? undefined,
        quantity: inv.quantity != null ? Number(inv.quantity) : undefined,
      }));
      setInvestments(mapped);

      const cryptoIds = [...new Set(mapped.filter(i => i.cryptoId).map(i => i.cryptoId!))];
      if (cryptoIds.length > 0) fetchCryptoPrices(cryptoIds);
    }
  };

  const fetchCryptoPrices = async (ids: string[]) => {
    setCryptoLoading(true);
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=brl`);
      const data = await res.json();
      const prices: Record<string, number> = {};
      for (const [id, val] of Object.entries(data)) {
        prices[id] = (val as any).brl;
      }
      setCryptoPrices(prices);
    } catch (e) {
      console.error('Erro ao buscar preços cripto:', e);
    } finally {
      setCryptoLoading(false);
    }
  };


  // ---- Filtro por mês ----
  const filteredTransactions = useMemo(() => {
    const start = new Date(viewDate.year, viewDate.month, 1);
    const end   = new Date(viewDate.year, viewDate.month + 1, 0, 23, 59, 59);
    return transactions.filter(t => {
      const d = new Date(t.date);
      if (d < start || d > end) return false;
      if (selectedCategory && t.category !== selectedCategory) return false;
      return true;
    });
  }, [transactions, viewDate, selectedCategory]);

  const prevMonthTransactions = useMemo(() => {
    const pm = viewDate.month === 0 ? 11 : viewDate.month - 1;
    const py = viewDate.month === 0 ? viewDate.year - 1 : viewDate.year;
    const start = new Date(py, pm, 1);
    const end   = new Date(py, pm + 1, 0, 23, 59, 59);
    return transactions.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
  }, [transactions, viewDate]);

  const monthLabel = new Date(viewDate.year, viewDate.month, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const goToPrevMonth = () => setViewDate(p =>
    p.month === 0 ? { month: 11, year: p.year - 1 } : { month: p.month - 1, year: p.year }
  );
  const goToNextMonth = () => {
    const now = new Date();
    if (viewDate.year === now.getFullYear() && viewDate.month === now.getMonth()) return;
    setViewDate(p => p.month === 11 ? { month: 0, year: p.year + 1 } : { month: p.month + 1, year: p.year });
  };
  const isCurrentMonth = (() => { const n = new Date(); return viewDate.month === n.getMonth() && viewDate.year === n.getFullYear(); })();

  // ---- Financial Calculations ----
  const computedInvestments = useMemo(() => investments.map(inv => {
    if (inv.cryptoId && inv.quantity != null && cryptoPrices[inv.cryptoId]) {
      return { ...inv, currentValue: inv.quantity * cryptoPrices[inv.cryptoId] };
    }
    return inv;
  }), [investments, cryptoPrices]);

  const summary = useMemo<DashboardSummary>(() => {
    const totalIncome    = filteredTransactions.filter(t => t.type === TransactionType.INCOME).reduce((a, c) => a + c.amount, 0);
    const totalExpenses  = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((a, c) => a + c.amount, 0);
    const prevExpenses   = prevMonthTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((a, c) => a + c.amount, 0);
    const trendPct       = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;
    const totalInvested  = computedInvestments.reduce((a, c) => a + c.initialAmount, 0);
    const totalCurrentValue = computedInvestments.reduce((a, c) => a + c.currentValue, 0);
    const totalProfit    = totalCurrentValue - totalInvested;

    return {
      totalIncome, totalExpenses,
      totalInvested, totalCurrentValue, totalProfit,
      profitPercentage: totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0,
      balance: totalIncome - totalExpenses,
      monthlyExpenses: totalExpenses,
      monthlyTrend: { value: `${Math.abs(trendPct).toFixed(0)}%`, isUp: trendPct > 0 },
    };
  }, [filteredTransactions, prevMonthTransactions, computedInvestments]);

  const chartData = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      if (t.type === TransactionType.EXPENSE)
        groups[t.category] = (groups[t.category] || 0) + t.amount;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const investmentChartData = useMemo(() => {
    return computedInvestments.map((inv) => ({ name: inv.name, value: inv.currentValue }));
  }, [computedInvestments]);

  const allTimeBalance = useMemo(() => {
    const income   = transactions.filter(t => t.type === TransactionType.INCOME).reduce((a, c) => a + c.amount, 0);
    const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((a, c) => a + c.amount, 0);
    return income - expenses;
  }, [transactions]);

  const groupedTransactions = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateMap: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(t => {
      const key = new Date(t.date).toDateString();
      if (!dateMap[key]) dateMap[key] = [];
      dateMap[key].push(t);
    });
    return Object.entries(dateMap)
      .map(([key, txs]) => {
        const d = new Date(key);
        let label: string;
        if (d.toDateString() === today.toDateString()) label = 'Hoje';
        else if (d.toDateString() === yesterday.toDateString()) label = 'Ontem';
        else label = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
        return { label, txs };
      })
      .sort((a, b) => new Date(b.txs[0].date).getTime() - new Date(a.txs[0].date).getTime());
  }, [filteredTransactions]);

  // ---- Handlers ----
  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData   = new FormData(e.currentTarget);
    const desc       = formData.get("description") as string;
    const amount     = Math.abs(Number(formData.get("amount")));
    const category   = defaultType === "expense" ? transactionCategory : "Receitas";
    const notes      = (formData.get("notes") as string) || null;
    const isRecurring = formData.get("is_recurring") === "on";

    const installments = isInstallment ? Math.max(1, Number(formData.get("installments"))) : 1;

    const mapRow = (data: any): Transaction => ({
      id: data.id, description: data.title, amount: Number(data.amount),
      type: data.type === "income" ? TransactionType.INCOME : TransactionType.EXPENSE,
      category: data.category, date: data.created_at,
      notes: data.notes ?? undefined, isRecurring: data.is_recurring ?? false,
      installmentTotal: data.installment_total ?? undefined,
      installmentCurrent: data.installment_current ?? undefined,
    });

    if (editingTransaction) {
      const { data, error } = await supabase
        .from("transactions")
        .update({ title: desc, amount, type: defaultType, category, notes, is_recurring: isRecurring })
        .eq("id", editingTransaction.id)
        .select("id, title, amount, type, category, created_at, notes, is_recurring, installment_total, installment_current")
        .single();
      if (error) { alert("Erro ao editar transação."); return; }
      setTransactions(prev => prev.map(t => t.id === data.id ? mapRow(data) : t));
      setEditingTransaction(null);
    } else if (isInstallment && installments > 1) {
      const now = new Date();
      const inserted: Transaction[] = [];
      for (let i = 0; i < installments; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const { data, error } = await supabase
          .from("transactions")
          .insert({
            user_id: session.user.id, title: desc, amount, type: defaultType, category,
            notes, is_recurring: false,
            installment_total: installments, installment_current: i + 1,
            created_at: date.toISOString(),
          })
          .select("id, title, amount, type, category, created_at, notes, is_recurring, installment_total, installment_current")
          .single();
        if (!error && data) inserted.push(mapRow(data));
      }
      setTransactions(prev => [...inserted, ...prev]);
    } else {
      const { data, error } = await supabase
        .from("transactions")
        .insert({ user_id: session.user.id, title: desc, amount, type: defaultType, category, notes, is_recurring: isRecurring })
        .select("id, title, amount, type, category, created_at, notes, is_recurring, installment_total, installment_current")
        .single();
      if (error) { alert("Erro ao salvar transação."); return; }
      setTransactions(prev => [mapRow(data), ...prev]);
    }

    setShowTransModal(false);
    setIsInstallment(false);
    (e.currentTarget as HTMLFormElement).reset();
  };

  const handleCloseInvModal = () => {
    setShowInvModal(false);
    setEditingInvestment(null);
  };

  const saveGoal = async (category: string, limit: number) => {
    const { data, error } = await supabase
      .from("spending_goals")
      .upsert({ user_id: session.user.id, category, monthly_limit: limit }, { onConflict: 'user_id,category' })
      .select("id, category, monthly_limit")
      .single();
    if (error) { alert("Erro ao salvar meta."); return; }
    const goal: SpendingGoal = { id: data.id, category: data.category, monthlyLimit: Number(data.monthly_limit) };
    setSpendingGoals(prev => {
      const idx = prev.findIndex(g => g.category === category);
      return idx >= 0 ? prev.map((g, i) => i === idx ? goal : g) : [...prev, goal];
    });
    setShowGoalModal(false);
    setEditingGoal(null);
  };

  const deleteGoal = async (id: string) => {
    await supabase.from("spending_goals").delete().eq("id", id).eq("user_id", session.user.id);
    setSpendingGoals(prev => prev.filter(g => g.id !== id));
  };

  const handleInvestmentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const isCrypto = invModalType === 'Cripto';
    const cryptoMeta = CRYPTOS.find(c => c.id === invModalCryptoId);
    const payload = {
      user_id: session.user.id,
      name: isCrypto
        ? `${cryptoMeta?.name ?? invModalCryptoId} - ${cryptoMeta?.symbol ?? ''}`
        : (formData.get("name") as string),
      initial_amount: Number(formData.get("initialAmount")),
      current_value: isCrypto ? 0 : Number(formData.get("currentValue")),
      type: invModalType,
      date: new Date().toISOString(),
      crypto_id: isCrypto ? invModalCryptoId : null,
      quantity: isCrypto ? Number(formData.get("quantity")) : null,
    };

    if (editingInvestment) {
      const { data, error } = await supabase
        .from("investments")
        .update(payload)
        .eq("id", editingInvestment.id)
        .select("id, name, initial_amount, current_value, type, date, crypto_id, quantity")
        .single();

      if (error) {
        alert("Erro ao atualizar investimento.");
        return;
      }

      const mapped: Investment = {
        id: data.id,
        name: data.name,
        initialAmount: Number(data.initial_amount),
        currentValue: Number(data.current_value),
        type: data.type,
        date: data.date,
        cryptoId: data.crypto_id ?? undefined,
        quantity: data.quantity != null ? Number(data.quantity) : undefined,
      };
      if (mapped.cryptoId && !cryptoPrices[mapped.cryptoId]) {
        fetchCryptoPrices([mapped.cryptoId]);
      }

      setInvestments((prev) => prev.map((inv) => (inv.id === mapped.id ? mapped : inv)));
    } else {
      const { data, error } = await supabase
        .from("investments")
        .insert(payload)
        .select("id, name, initial_amount, current_value, type, date, crypto_id, quantity")
        .single();

      if (error) {
        alert("Erro ao salvar investimento.");
        return;
      }

      const mapped: Investment = {
        id: data.id,
        name: data.name,
        initialAmount: Number(data.initial_amount),
        currentValue: Number(data.current_value),
        type: data.type,
        date: data.date,
        cryptoId: data.crypto_id ?? undefined,
        quantity: data.quantity != null ? Number(data.quantity) : undefined,
      };
      if (mapped.cryptoId && !cryptoPrices[mapped.cryptoId]) {
        fetchCryptoPrices([mapped.cryptoId]);
      }

      setInvestments((prev) => [...prev, mapped]);
    }

    handleCloseInvModal();
    (e.currentTarget as HTMLFormElement).reset();
  };

  const fetchAIInsights = async () => {
    if (transactions.length === 0 && investments.length === 0) {
      setInsights("Adicione algumas transações ou ativos para que eu possa analisar sua jornada financeira.");
      return;
    }
    setLoadingInsights(true);
    const response = await getFinancialInsights(transactions, investments);
    setInsights(response || "Não foi possível gerar insights agora.");
    setLoadingInsights(false);
  };

  const formatCurrency = (val: number) =>
    hideBalance ? "R$ ••••" : val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (authLoading) return <div style={{ color: '#fff', padding: 40, background: '#0A0A0A', minHeight: '100vh' }}>Carregando...</div>;

  if (!session) {
    if (import.meta.env.PROD) {
      window.location.href = '/';
      return null;
    }
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0A0A' }}>
        <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ color: '#fff', marginBottom: 8 }}>Login (dev)</h2>
          <input id="fin-email" placeholder="email" style={{ padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }} />
          <input id="fin-pass" placeholder="senha" type="password" style={{ padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }} />
          <button onClick={() => supabase.auth.signInWithPassword({ email: (document.getElementById('fin-email') as HTMLInputElement).value, password: (document.getElementById('fin-pass') as HTMLInputElement).value })}
            style={{ padding: 12, background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 flex flex-col bg-[var(--bg-app)] ${isLight ? 'light-theme' : ''}`}>
      {/* Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-sm border-b border-[var(--bd)] bg-[var(--bg-app)]/95">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-semibold text-[var(--tx-1)] text-sm tracking-wide">Finance</h1>
          <div className="flex items-center gap-2">
            {/* Desktop: botões de ação */}
            <button onClick={() => { setDefaultType("income"); setTransactionCategory('Alimentação'); setShowTransModal(true); }}
              className="hidden md:flex bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold items-center gap-2 transition-all active:scale-95">
              <Plus size={16} /> Ganho
            </button>
            <button onClick={() => { setDefaultType("expense"); setTransactionCategory('Alimentação'); setShowTransModal(true); }}
              className="hidden md:flex bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold items-center gap-2 transition-all active:scale-95">
              <Plus size={16} /> Gasto
            </button>
            <button onClick={toggleHideBalance} title={hideBalance ? 'Mostrar saldo' : 'Esconder saldo'}
              className="p-1.5 rounded-lg text-[var(--tx-2)] hover:text-[var(--tx-1)] hover:bg-[var(--bg-inner)] transition-all">
              {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button onClick={toggleTheme} title={isLight ? 'Modo escuro' : 'Modo claro'}
              className="p-1.5 rounded-lg text-[var(--tx-2)] hover:text-[var(--tx-1)] hover:bg-[var(--bg-inner)] transition-all">
              {isLight ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <AppSwitcher currentApp="finance" userEmail={session?.user?.email} />
          </div>
        </div>
      </header>

      {/* ── MOBILE: tab content ── */}
      <div className="md:hidden flex-1 pb-24">
        {/* HOME */}
        {activeTab === 'home' && (
          <div className="px-4 py-5 space-y-4">
            {/* Saldo em destaque */}
            <div className={`rounded-2xl p-5 ${summary.balance >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-[var(--tx-2)] uppercase tracking-wider">Saldo do Mês</p>
                <button onClick={toggleHideBalance} title={hideBalance ? 'Mostrar saldo' : 'Esconder saldo'}
                  className={`p-1 -m-1 ${summary.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className={`text-3xl font-black mb-4 ${summary.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(summary.balance)}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[var(--bg-inner)] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-[var(--tx-2)] mb-0.5 flex items-center gap-1"><TrendingUp size={10} /> Entradas</p>
                  <p className="text-sm font-bold text-emerald-400">{formatCurrency(summary.totalIncome)}</p>
                </div>
                <div className="bg-[var(--bg-inner)] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-[var(--tx-2)] mb-0.5 flex items-center gap-1"><TrendingDown size={10} /> Gastos do Mês</p>
                  <p className="text-sm font-bold text-rose-400">{formatCurrency(summary.totalExpenses)}</p>
                </div>
              </div>
            </div>
            {/* Cards secundários */}
            <div className="grid grid-cols-2 gap-3">
              <DashboardCard
                title="Total Investido"
                value={formatCurrency(summary.totalInvested)}
                icon={<BarChart3 size={16} />}
                accentColor="#fbbf24"
                subtitle="Custo de aquisição"
              />
              <DashboardCard
                title="Patrimônio"
                value={formatCurrency(summary.totalCurrentValue)}
                icon={<PieChartIcon size={16} />}
                accentColor="#a78bfa"
                trend={{ value: `${summary.profitPercentage.toFixed(1)}%`, isUp: summary.totalProfit >= 0 }}
                subtitle="Valor de mercado"
              />
            </div>
            {/* Bar chart */}
            {chartData.length > 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--bd)] rounded-2xl p-4">
                <p className="text-sm font-semibold text-[var(--tx-1)] mb-3">Gastos por Categoria</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? '#E2E8F0' : '#1F1F1F'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isLight ? '#64748B' : '#616161', fontSize: 9}} dy={6} />
                    <Tooltip contentStyle={{ backgroundColor: isLight ? '#fff' : '#111', borderRadius: '12px', border: 'none', color: isLight ? '#0F172A' : '#fff' }}
                      itemStyle={{ color: isLight ? '#0F172A' : '#fff' }} formatter={(v: number) => [formatCurrency(v), 'Gastos']} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="value" radius={[6,6,6,6]} barSize={28} onClick={(d) => setSelectedCategory(p => p === d.name ? null : d.name)}>
                      {chartData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={selectedCategory && selectedCategory !== e.name ? 0.3 : 1} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Portfólio */}
            {computedInvestments.length > 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--bd)] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--bd)]">
                  <p className="text-sm font-semibold text-[var(--tx-1)]">Portfólio</p>
                  <div className="flex items-center gap-2">
                    {investments.some(i => i.cryptoId) && (
                      <button onClick={() => { const ids = investments.reduce<string[]>((acc, i) => { if (i.cryptoId && !acc.includes(i.cryptoId)) acc.push(i.cryptoId); return acc; }, []); fetchCryptoPrices(ids); }}
                        disabled={cryptoLoading} className="text-[var(--tx-2)] hover:text-emerald-400 transition-all disabled:opacity-40">
                        <RefreshCw size={14} className={cryptoLoading ? 'animate-spin' : ''} />
                      </button>
                    )}
                    <button onClick={() => { setInvModalType('Cripto'); setInvModalCryptoId('bitcoin'); if (!cryptoPrices['bitcoin']) fetchCryptoPrices(CRYPTOS.map(c => c.id)); setShowInvModal(true); }}
                      className="text-[var(--tx-2)] hover:text-[var(--tx-1)] transition-all">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                {computedInvestments.map((inv, i) => {
                  const profit = inv.currentValue - inv.initialAmount;
                  const profitPerc = inv.initialAmount > 0 ? (profit / inv.initialAmount) * 100 : 0;
                  const isPos = profit >= 0;
                  const livePrice = inv.cryptoId ? cryptoPrices[inv.cryptoId] : undefined;
                  return (
                    <div key={inv.id} className={`px-4 py-3.5 flex items-center gap-3 ${i < computedInvestments.length - 1 ? 'border-b border-[var(--bd)]' : ''}`}>
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <BarChart3 size={16} className="text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-[var(--tx-1)] truncate">{inv.name}</p>
                          {inv.cryptoId && <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded shrink-0">AO VIVO</span>}
                        </div>
                        <p className="text-[10px] text-[var(--tx-2)]">{inv.type} · Investido: {formatCurrency(inv.initialAmount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[var(--tx-1)]">{inv.cryptoId && !livePrice ? '—' : formatCurrency(inv.currentValue)}</p>
                        <p className={`text-[11px] font-semibold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {inv.cryptoId && !livePrice ? '' : `${isPos ? '+' : ''}${profitPerc.toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent transactions preview */}
            <div className="bg-[var(--bg-card)] border border-[var(--bd)] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--bd)]">
                <p className="text-sm font-semibold text-[var(--tx-1)]">Recentes</p>
                <button onClick={() => setActiveTab('transactions')} className="text-xs text-emerald-500 font-medium">Ver tudo</button>
              </div>
              {filteredTransactions.slice(0, 5).map(t => (
                <div key={t.id} className="px-4 py-3 flex items-center gap-3 border-b border-[var(--bd)] last:border-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm ${t.type === TransactionType.INCOME ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                    {t.type === TransactionType.INCOME ? '↑' : '↓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--tx-1)] truncate">{t.description}</p>
                    <p className="text-[10px] text-[var(--tx-2)]">{t.category}</p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
              {filteredTransactions.length === 0 && <p className="py-6 text-center text-sm text-[var(--tx-2)]">Nenhuma transação</p>}
            </div>
          </div>
        )}

        {/* TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div className="px-4 py-5 space-y-4">
            {/* Month nav */}
            <div className="flex items-center justify-between bg-[var(--bg-card)] border border-[var(--bd)] rounded-2xl px-4 py-3">
              <button onClick={goToPrevMonth} className="p-1.5 rounded-lg text-[var(--tx-2)] hover:text-[var(--tx-1)] transition-all">‹</button>
              <span className="text-sm font-semibold text-[var(--tx-1)] capitalize">{monthLabel}</span>
              <button onClick={goToNextMonth} disabled={isCurrentMonth} className="p-1.5 rounded-lg text-[var(--tx-2)] hover:text-[var(--tx-1)] transition-all disabled:opacity-30">›</button>
            </div>
            {selectedCategory && (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                <span className="text-xs text-emerald-400 font-medium">Filtrando: {selectedCategory}</span>
                <button onClick={() => setSelectedCategory(null)} className="text-emerald-400"><X size={14} /></button>
              </div>
            )}
            {/* Grouped list */}
            {groupedTransactions.length > 0 ? groupedTransactions.map(({ label, txs }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-[var(--tx-2)] uppercase tracking-wider mb-2 px-1">{label}</p>
                <div className="bg-[var(--bg-card)] border border-[var(--bd)] rounded-2xl overflow-hidden">
                  {txs.map((t, i) => (
                    <div key={t.id} className={`px-4 py-3.5 flex items-center gap-3 group ${i < txs.length - 1 ? 'border-b border-[var(--bd)]' : ''}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${t.type === TransactionType.INCOME ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
                        {t.type === TransactionType.INCOME ? '↑' : '↓'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-[var(--tx-1)] truncate">{t.description}</p>
                          {t.isRecurring && <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">↺</span>}
                          {t.installmentTotal && <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">{t.installmentCurrent}/{t.installmentTotal}x</span>}
                        </div>
                        <p className="text-[11px] text-[var(--tx-2)]">{t.category} · {new Date(t.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-sm font-bold tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1 rounded text-[var(--tx-3)] hover:text-blue-400 transition-all"
                            onClick={() => { setEditingTransaction(t); setDefaultType(t.type === TransactionType.INCOME ? 'income' : 'expense'); setTransactionCategory(t.category); setShowTransModal(true); }}>
                            <Edit2 size={12} />
                          </button>
                          <button className="p-1 rounded text-[var(--tx-3)] hover:text-rose-400 transition-all"
                            onClick={async () => { await supabase.from("transactions").delete().eq("id", t.id).eq("user_id", session.user.id); setTransactions(prev => prev.filter(x => x.id !== t.id)); }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <div className="py-16 text-center text-[var(--tx-2)] text-sm">Nenhuma transação neste mês.</div>
            )}
          </div>
        )}

        {/* BUDGET */}
        {activeTab === 'budget' && (() => {
          const expensesByCategory: Record<string, number> = {};
          filteredTransactions.filter(t => t.type === TransactionType.EXPENSE)
            .forEach(t => { expensesByCategory[t.category] = (expensesByCategory[t.category] ?? 0) + t.amount; });
          return (
            <div className="px-4 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[var(--tx-1)]">Limites de Gastos</h2>
                  <p className="text-xs text-[var(--tx-2)]">Controle de gastos por categoria</p>
                </div>
                <button onClick={() => { setEditingGoal(null); setGoalCategory('Alimentação'); setShowGoalModal(true); }}
                  className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg">
                  <Plus size={18} />
                </button>
              </div>
              {spendingGoals.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-[var(--bd)] rounded-2xl">
                  <p className="text-sm text-[var(--tx-2)]">Nenhum limite definido</p>
                  <p className="text-xs text-[var(--tx-3)] mt-1">Toque em + para definir um limite</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {spendingGoals.map(goal => {
                    const spent = expensesByCategory[goal.category] ?? 0;
                    const pct = Math.min(100, (spent / goal.monthlyLimit) * 100);
                    const over = spent > goal.monthlyLimit;
                    return (
                      <div key={goal.id} className="bg-[var(--bg-card)] border border-[var(--bd)] rounded-2xl p-4 group">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[var(--tx-1)]">{goal.category}</span>
                            {over && <span className="text-[9px] text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded font-semibold">EXCEDIDO</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-medium tabular-nums ${over ? 'text-rose-400' : 'text-[var(--tx-2)]'}`}>
                              {formatCurrency(spent)} / {formatCurrency(goal.monthlyLimit)}
                            </span>
                            <button onClick={() => { setEditingGoal(goal); setGoalCategory(goal.category); setShowGoalModal(true); }} className="p-1 text-[var(--tx-3)] hover:text-[var(--tx-1)] transition-all opacity-0 group-hover:opacity-100"><Edit2 size={12} /></button>
                            <button onClick={() => deleteGoal(goal.id)} className="p-1 text-[var(--tx-3)] hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        <div className="w-full bg-[var(--bg-inner)] h-2.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${over ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* PROFILE */}
        {activeTab === 'profile' && (
          <div className="px-4 py-5 space-y-4">
            <div className="bg-[var(--bg-card)] border border-[var(--bd)] rounded-2xl p-5 flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <UserCircle2 size={28} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-bold text-[var(--tx-1)]">Minha Conta</p>
                <p className="text-xs text-[var(--tx-2)] mt-0.5">{session?.user?.email}</p>
              </div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--bd)] rounded-2xl overflow-hidden">
              <button onClick={toggleHideBalance} className="w-full flex items-center justify-between px-5 py-4 border-b border-[var(--bd)] hover:bg-[var(--bg-inner)] transition-all">
                <div className="flex items-center gap-3">
                  {hideBalance ? <EyeOff size={18} className="text-[var(--tx-2)]" /> : <Eye size={18} className="text-[var(--tx-2)]" />}
                  <span className="text-sm font-medium text-[var(--tx-1)]">Esconder saldos</span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative ${hideBalance ? 'bg-emerald-500' : 'bg-[var(--bg-inner)]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hideBalance ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </button>
              <button onClick={toggleTheme} className="w-full flex items-center justify-between px-5 py-4 border-b border-[var(--bd)] hover:bg-[var(--bg-inner)] transition-all">
                <div className="flex items-center gap-3">
                  {isLight ? <Moon size={18} className="text-[var(--tx-2)]" /> : <Sun size={18} className="text-[var(--tx-2)]" />}
                  <span className="text-sm font-medium text-[var(--tx-1)]">{isLight ? 'Modo Escuro' : 'Modo Claro'}</span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative ${isLight ? 'bg-emerald-500' : 'bg-[var(--bg-inner)]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isLight ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </button>
              <button onClick={() => supabase.auth.signOut()}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-rose-500/5 transition-all text-rose-400">
                <LogOut size={18} />
                <span className="text-sm font-medium">Sair</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP: layout original ── */}
      <main className="hidden md:block max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-8">
          <DashboardCard
            title="Ganho Total"
            value={formatCurrency(summary.totalIncome)}
            icon={<TrendingUp size={16} />}
            accentColor="#4ade80"
            trend={{ value: `${((summary.totalIncome / (summary.totalIncome + summary.totalExpenses || 1)) * 100).toFixed(0)}%`, isUp: true }}
          />
          <DashboardCard
            title="Gastos Totais"
            value={formatCurrency(summary.totalExpenses)}
            icon={<TrendingDown size={16} />}
            accentColor="#f87171"
            trend={{ value: summary.monthlyTrend.value, isUp: summary.monthlyTrend.isUp }}
          />
          <DashboardCard
            title="Saldo"
            value={formatCurrency(summary.balance)}
            icon={<CircleDollarSign size={16} />}
            accentColor="#38bdf8"
          />
          <DashboardCard
            title="Total Investido"
            value={formatCurrency(summary.totalInvested)}
            icon={<BarChart3 size={16} />}
            accentColor="#fbbf24"
            subtitle="Custo de aquisição"
          />
          <DashboardCard
            title="Patrimônio"
            value={formatCurrency(summary.totalCurrentValue)}
            icon={<PieChartIcon size={16} />}
            accentColor="#a78bfa"
            trend={{ value: `${summary.profitPercentage.toFixed(1)}%`, isUp: summary.totalProfit >= 0 }}
            subtitle="Valor de mercado"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column Left: Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Expenses Analysis */}
            <div className="p-5 md:p-6 rounded-xl border border-[var(--bd)] bg-[var(--bg-card)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tx-1)]">Distribuição de Gastos</h3>
                  <p className="text-xs text-[var(--tx-2)] mt-0.5">
                    {selectedCategory ? `Filtrando: ${selectedCategory}` : 'Por categoria — clique para filtrar'}
                  </p>
                </div>
                {selectedCategory && (
                  <button onClick={() => setSelectedCategory(null)}
                    className="text-xs text-[var(--tx-2)] hover:text-[var(--tx-1)] bg-[var(--bg-inner)] px-3 py-1.5 rounded-lg transition-all">
                    Limpar filtro ✕
                  </button>
                )}
              </div>
              <div className="h-[260px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? '#E2E8F0' : '#1F1F1F'} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isLight ? '#64748B' : '#616161', fontSize: 11}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: isLight ? '#64748B' : '#616161', fontSize: 11}} />
                      <Tooltip
                        contentStyle={{
                        backgroundColor: isLight ? "#ffffff" : "#111111",
                        borderRadius: "16px",
                        border: isLight ? "1px solid #E2E8F0" : "none",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                        padding: "12px",
                        color: isLight ? "#0F172A" : "#ffffff",
                      }}
                      itemStyle={{ color: isLight ? "#0F172A" : "#fff", fontWeight: 700 }}
                      formatter={(value: number) => [formatCurrency(value), 'Gastos']}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      />
                      <Bar dataKey="value" name="Total" radius={[8, 8, 8, 8]} barSize={40} cursor="pointer"
                        onClick={(data) => setSelectedCategory(prev => prev === data.name ? null : data.name)}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                            opacity={selectedCategory && selectedCategory !== entry.name ? 0.3 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-2">
                    <PieChartIcon className="w-8 h-8 text-[#2a2a2a]" />
                    <p className="text-sm text-[var(--tx-2)]">Nenhum dado ainda</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transactions Table */}
            <div className="rounded-xl border border-[var(--bd)] overflow-hidden bg-[var(--bg-card)]">
              <div className="px-5 py-4 border-b border-[var(--bd)] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tx-1)]">Transações</h3>
                  <p className="text-xs text-[var(--tx-2)] mt-0.5">{filteredTransactions.length} registros</p>
                </div>
                {/* Month navigation */}
                <div className="flex items-center gap-2">
                  <button onClick={goToPrevMonth} className="p-1.5 rounded-lg text-[var(--tx-2)] hover:text-[var(--tx-1)] hover:bg-[var(--bg-inner)] transition-all">‹</button>
                  <span className="text-xs font-medium text-[var(--tx-1)] capitalize min-w-[110px] text-center">{monthLabel}</span>
                  <button onClick={goToNextMonth} disabled={isCurrentMonth} className="p-1.5 rounded-lg text-[var(--tx-2)] hover:text-[var(--tx-1)] hover:bg-[var(--bg-inner)] transition-all disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                </div>
              </div>

              {/* Mobile: card list */}
              <div className="md:hidden divide-y divide-[#1a1a1a]">
                {filteredTransactions.map((t) => (
                  <div key={t.id} className="px-4 py-3 flex items-center gap-3 group hover:bg-[var(--bg-hover)] transition-colors">
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${t.type === TransactionType.INCOME ? 'bg-green-400/60' : 'bg-rose-400/60'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-[var(--tx-1)] truncate">{t.description}</p>
                        {t.isRecurring && <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded shrink-0">↺</span>}
                        {t.installmentTotal && <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded shrink-0">{t.installmentCurrent}/{t.installmentTotal}x</span>}
                      </div>
                      <p className="text-[10px] text-[var(--tx-2)] mt-0.5">{t.category} · {new Date(t.date).toLocaleDateString('pt-BR')}</p>
                      {t.notes && <p className="text-[10px] text-[var(--tx-3)] mt-0.5 truncate">{t.notes}</p>}
                    </div>
                    <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${t.type === TransactionType.INCOME ? 'text-green-400' : 'text-rose-400'}`}>
                      {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button className="p-1.5 rounded-lg text-[var(--tx-3)] hover:text-blue-400 hover:bg-blue-400/10 transition-all"
                        onClick={() => { setEditingTransaction(t); setDefaultType(t.type === TransactionType.INCOME ? 'income' : 'expense'); setTransactionCategory(t.category); setShowTransModal(true); }}>
                        <Edit2 size={13} />
                      </button>
                      <button className="p-1.5 rounded-lg text-[var(--tx-3)] hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                        onClick={async () => {
                          const { error } = await supabase.from("transactions").delete().eq("id", t.id).eq("user_id", session.user.id);
                          if (error) { alert("Erro ao remover transação."); return; }
                          setTransactions(prev => prev.filter(item => item.id !== t.id));
                        }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredTransactions.length === 0 && (
                  <div className="py-12 text-center text-[var(--tx-2)] text-sm">Nenhuma transação neste mês.</div>
                )}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-[var(--bd)] text-[var(--tx-2)] text-[10px] font-medium uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Descrição</th>
                      <th className="px-5 py-3">Categoria</th>
                      <th className="px-5 py-3 text-right">Valor</th>
                      <th className="px-5 py-3 text-center">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#1a1a1a]">
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-[var(--bg-hover)] transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-1.5 h-7 rounded-full flex-shrink-0 ${t.type === TransactionType.INCOME ? 'bg-green-400/60' : 'bg-rose-400/60'}`} />
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-medium text-[var(--tx-1)]">{t.description}</p>
                                {t.isRecurring && <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">↺</span>}
                                {t.installmentTotal && <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">{t.installmentCurrent}/{t.installmentTotal}x</span>}
                              </div>
                              <p className="text-xs text-[var(--tx-2)] mt-0.5">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                              {t.notes && <p className="text-xs text-[var(--tx-3)] mt-0.5">{t.notes}</p>}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-[var(--bg-inner)] text-[var(--tx-2)] text-[10px] font-medium uppercase tracking-wide">
                            {t.category}
                          </span>
                        </td>

                        <td className={`px-5 py-4 text-right text-sm font-semibold tabular-nums ${
                          t.type === TransactionType.INCOME ? 'text-green-400' : 'text-rose-400'
                        }`}>
                          {t.type === TransactionType.INCOME ? '+' : '-'} {formatCurrency(t.amount)}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              className="p-1.5 rounded-lg text-transparent group-hover:text-[var(--tx-3)] hover:!text-blue-400 hover:bg-blue-400/10 transition-all"
                              onClick={() => { setEditingTransaction(t); setDefaultType(t.type === TransactionType.INCOME ? 'income' : 'expense'); setTransactionCategory(t.category); setShowTransModal(true); }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className="p-1.5 rounded-lg text-transparent group-hover:text-[var(--tx-3)] hover:!text-rose-400 hover:bg-rose-400/10 transition-all"
                              onClick={async () => {
                                const { error } = await supabase.from("transactions").delete().eq("id", t.id).eq("user_id", session.user.id);
                                if (error) { alert("Erro ao remover transação."); return; }
                                setTransactions((prev) => prev.filter((item) => item.id !== t.id));
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-16 text-center text-[var(--tx-2)] text-sm">
                          Nenhuma transação neste mês.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Column Right: Investments Portfolio */}
          <div className="space-y-6">
            <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--bd)]">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tx-1)]">Portfólio</h3>
                  <p className="text-xs text-[var(--tx-2)] mt-0.5">Rentabilidade de ativos</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {investments.some(i => i.cryptoId) && (
                    <button
                      onClick={() => {
                        const ids = investments.reduce<string[]>((acc, i) => {
                          if (i.cryptoId && !acc.includes(i.cryptoId)) acc.push(i.cryptoId);
                          return acc;
                        }, []);
                        fetchCryptoPrices(ids);
                      }}
                      disabled={cryptoLoading}
                      title="Atualizar preços"
                      className="bg-[var(--bg-inner)] hover:bg-[var(--bg-inner2)] text-[var(--tx-2)] hover:text-emerald-400 p-1.5 rounded-lg transition-all disabled:opacity-40"
                    >
                      <RefreshCw size={15} className={cryptoLoading ? 'animate-spin' : ''} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setInvModalType('Cripto');
                      setInvModalCryptoId('bitcoin');
                      if (!cryptoPrices['bitcoin']) fetchCryptoPrices(CRYPTOS.map(c => c.id));
                      setShowInvModal(true);
                    }}
                    className="bg-[var(--bg-inner)] hover:bg-[var(--bg-inner2)] text-[var(--tx-2)] hover:text-[var(--tx-1)] p-1.5 rounded-lg transition-all"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              {cryptoLoading && (
                <p className="text-[10px] text-[var(--tx-2)] text-center py-1">Buscando preços ao vivo...</p>
              )}

              <div className="space-y-3">
                {computedInvestments.map((inv) => {
                  const profit = inv.currentValue - inv.initialAmount;
                  const profitPerc = inv.initialAmount > 0 ? (profit / inv.initialAmount) * 100 : 0;
                  const isPositive = profit >= 0;
                  const livePrice = inv.cryptoId ? cryptoPrices[inv.cryptoId] : undefined;

                  return (
                    <div
                      key={inv.id}
                      className="group p-4 rounded-xl border border-[var(--bd)] hover:border-[var(--bd-sub)] bg-[var(--bg-deep)] transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[10px] font-medium text-[var(--tx-2)] uppercase tracking-widest">
                              {inv.type}
                            </p>
                            {inv.cryptoId && (
                              <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                                AO VIVO
                              </span>
                            )}
                          </div>
                          <h4 className="font-medium text-[var(--tx-1)] text-sm">{inv.name}</h4>
                          {livePrice && (
                            <p className="text-[10px] text-[var(--tx-2)] mt-0.5">
                              1 {CRYPTOS.find(c => c.id === inv.cryptoId)?.symbol} = {formatCurrency(livePrice)}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingInvestment(inv);
                              setInvModalType(inv.type);
                              setInvModalCryptoId(inv.cryptoId || 'bitcoin');
                              setShowInvModal(true);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-md transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={async () => {
                              const { error } = await supabase
                                .from("investments")
                                .delete()
                                .eq("id", inv.id)
                                .eq("user_id", session.user.id);
                              if (error) { alert("Erro ao remover investimento."); return; }
                              setInvestments(prev => prev.filter(i => i.id !== inv.id));
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-[10px] text-[var(--tx-2)] mb-0.5">Investido</p>
                          <p className="text-sm font-medium text-[var(--tx-1)]">{formatCurrency(inv.initialAmount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-[var(--tx-2)] mb-0.5">
                            {inv.cryptoId ? 'Valor Atual' : 'Atual'}
                          </p>
                          <p className="text-sm font-medium text-[var(--tx-1)]">
                            {inv.cryptoId && !livePrice ? '—' : formatCurrency(inv.currentValue)}
                          </p>
                          {inv.quantity && (
                            <p className="text-[10px] text-[var(--tx-2)]">
                              {inv.quantity} {CRYPTOS.find(c => c.id === inv.cryptoId)?.symbol}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${isPositive ? 'bg-green-400/10 text-green-400' : 'bg-rose-400/10 text-rose-400'}`}>
                        <div className="flex items-center gap-1.5">
                          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          <span className="text-sm font-black">
                            {inv.cryptoId && !livePrice ? '—' : `${isPositive ? '+' : ''}${profitPerc.toFixed(1)}%`}
                          </span>
                        </div>
                        <span className="text-xs font-bold">
                          {inv.cryptoId && !livePrice ? 'Carregando...' : `${isPositive ? 'Lucro: ' : 'Prejuízo: '}${formatCurrency(Math.abs(profit))}`}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {investments.length === 0 && (
                  <div className="py-12 text-center text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-2xl">
                    Nada investido ainda.
                  </div>
                )}
              </div>

              {investments.length > 0 && (
                <div className="mt-10 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={investmentChartData}
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {investmentChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: '16px', border: isLight ? '1px solid #E2E8F0' : 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: isLight ? '#fff' : '#111', color: isLight ? '#0F172A' : '#fff' }}
                        itemStyle={{ color: isLight ? '#0F172A' : '#fff' }}
                        labelStyle={{ color: isLight ? '#0F172A' : '#fff' }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Limites de Gastos */}
            {(() => {
              const expensesByCategory: Record<string, number> = {};
              filteredTransactions
                .filter(t => t.type === TransactionType.EXPENSE)
                .forEach(t => { expensesByCategory[t.category] = (expensesByCategory[t.category] ?? 0) + t.amount; });
              return (
                <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--bd)]">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--tx-1)]">Limites de Gastos</h3>
                      <p className="text-xs text-[var(--tx-2)] mt-0.5">Controle de gastos por categoria</p>
                    </div>
                    <button
                      onClick={() => { setEditingGoal(null); setGoalCategory('Alimentação'); setShowGoalModal(true); }}
                      className="bg-[var(--bg-inner)] hover:bg-[var(--bg-inner2)] text-[var(--tx-2)] hover:text-[var(--tx-1)] p-1.5 rounded-lg transition-all"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  {spendingGoals.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-[var(--bd)] rounded-xl">
                      <p className="text-sm text-[var(--tx-2)]">Nenhum limite definido</p>
                      <p className="text-xs text-[var(--tx-3)] mt-1">Clique em + para definir um limite</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {spendingGoals.map(goal => {
                        const spent = expensesByCategory[goal.category] ?? 0;
                        const pct = Math.min(100, (spent / goal.monthlyLimit) * 100);
                        const over = spent > goal.monthlyLimit;
                        return (
                          <div key={goal.id} className="group">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-[var(--tx-1)] font-medium">{goal.category}</span>
                                {over && <span className="text-[9px] text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded font-semibold">EXCEDIDO</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium tabular-nums ${over ? 'text-rose-400' : 'text-[var(--tx-2)]'}`}>
                                  {formatCurrency(spent)} / {formatCurrency(goal.monthlyLimit)}
                                </span>
                                <button onClick={() => { setEditingGoal(goal); setGoalCategory(goal.category); setShowGoalModal(true); }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-[var(--tx-3)] hover:text-[var(--tx-1)] transition-all">
                                  <Edit2 size={12} />
                                </button>
                                <button onClick={() => deleteGoal(goal.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-[var(--tx-3)] hover:text-rose-400 transition-all">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="w-full bg-[var(--bg-inner)] h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${over ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--bg-card)] border-t border-[var(--bd)]">
        <div className="flex items-center justify-around h-16 px-2 relative">
          {/* Home */}
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${activeTab === 'home' ? 'text-emerald-500' : 'text-[var(--tx-2)]'}`}>
            <Home size={22} />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          {/* Transações */}
          <button onClick={() => setActiveTab('transactions')} className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${activeTab === 'transactions' ? 'text-emerald-500' : 'text-[var(--tx-2)]'}`}>
            <ArrowLeftRight size={22} />
            <span className="text-[10px] font-medium">Transações</span>
          </button>
          {/* FAB + */}
          <div className="relative flex flex-col items-center -mt-6">
            <button
              onClick={() => setShowAddMenu(p => !p)}
              className={`w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-95 ${showAddMenu ? 'rotate-45' : ''}`}
            >
              <Plus size={26} className="text-white" />
            </button>
            <span className="text-[10px] font-medium text-[var(--tx-2)] mt-1">Novo</span>
          </div>
          {/* Metas */}
          <button onClick={() => setActiveTab('budget')} className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${activeTab === 'budget' ? 'text-emerald-500' : 'text-[var(--tx-2)]'}`}>
            <Target size={22} />
            <span className="text-[10px] font-medium">Limites</span>
          </button>
          {/* Perfil */}
          <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${activeTab === 'profile' ? 'text-emerald-500' : 'text-[var(--tx-2)]'}`}>
            <UserCircle2 size={22} />
            <span className="text-[10px] font-medium">Perfil</span>
          </button>
        </div>
      </nav>

      {/* Add Menu (mobile) */}
      {showAddMenu && (
        <div className="md:hidden fixed inset-0 z-20" onClick={() => setShowAddMenu(false)}>
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setDefaultType('income'); setTransactionCategory('Alimentação'); setShowTransModal(true); setShowAddMenu(false); }}
              className="flex flex-col items-center gap-2 bg-emerald-500 text-white px-5 py-3 rounded-2xl shadow-xl font-semibold text-sm active:scale-95 transition-transform">
              <TrendingUp size={20} />
              Ganho
            </button>
            <button onClick={() => { setDefaultType('expense'); setTransactionCategory('Alimentação'); setShowTransModal(true); setShowAddMenu(false); }}
              className="flex flex-col items-center gap-2 bg-rose-500 text-white px-5 py-3 rounded-2xl shadow-xl font-semibold text-sm active:scale-95 transition-transform">
              <TrendingDown size={20} />
              Gasto
            </button>
            <button onClick={() => { setInvModalType('Cripto'); setInvModalCryptoId('bitcoin'); if (!cryptoPrices['bitcoin']) fetchCryptoPrices(CRYPTOS.map(c => c.id)); setShowInvModal(true); setShowAddMenu(false); }}
              className="flex flex-col items-center gap-2 bg-amber-500 text-black px-5 py-3 rounded-2xl shadow-xl font-semibold text-sm active:scale-95 transition-transform">
              <BarChart3 size={20} />
              Ativo
            </button>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-md border border-[var(--bd-modal)] overflow-hidden">
            <div className="p-6 border-b border-[var(--bd-modal)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--tx-modal)]">{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</h3>
              <button onClick={() => { setShowTransModal(false); setEditingTransaction(null); setIsInstallment(false); }} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all">✕</button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Descrição</label>
                <input required name="description" type="text" defaultValue={editingTransaction?.description || ''} className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all placeholder:text-zinc-700" placeholder="Ex: Aluguel, Mercado, Salário..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Valor (R$)</label>
                <input required name="amount" type="number" step="0.01" defaultValue={editingTransaction?.amount || ''} className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all placeholder:text-zinc-700" placeholder="0.00" />
              </div>
              {defaultType === "expense" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Categoria</label>
                  <select name="category" value={transactionCategory} onChange={e => setTransactionCategory(e.target.value)}
                    className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all appearance-none">
                    <option value="Alimentação">Alimentação</option>
                    <option value="Lazer">Lazer</option>
                    <option value="Saúde/Academia">Saúde/Academia</option>
                    <option value="Educação">Educação</option>
                    <option value="Pais">Pais</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Notas (opcional)</label>
                <input name="notes" type="text" defaultValue={editingTransaction?.notes || ''}
                  className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all placeholder:text-zinc-700"
                  placeholder="Ex: parcelado em 3x, desconto aplicado..." />
              </div>
              {defaultType === "expense" && !editingTransaction && (
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer"
                      checked={isInstallment} onChange={e => setIsInstallment(e.target.checked)} />
                    <div className="w-10 h-5 bg-[#2a2a2a] rounded-full peer-checked:bg-amber-500 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-300 font-medium">Parcelado</p>
                    <p className="text-[11px] text-zinc-600">O valor é por parcela</p>
                  </div>
                </label>
              )}
              {isInstallment && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Número de parcelas</label>
                  <input name="installments" type="number" min="2" max="60" defaultValue={12}
                    className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
              )}
              {!isInstallment && (
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative">
                    <input type="checkbox" name="is_recurring" className="sr-only peer"
                      defaultChecked={editingTransaction?.isRecurring ?? false} />
                    <div className="w-10 h-5 bg-[#2a2a2a] rounded-full peer-checked:bg-emerald-500 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-300 font-medium">Recorrente</p>
                    <p className="text-[11px] text-zinc-600">Aparece automaticamente todo mês</p>
                  </div>
                </label>
              )}
              <button type="submit" className={`w-full ${defaultType === 'income' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'} text-white font-semibold py-3 rounded-xl transition-all mt-2`}>
                {editingTransaction ? 'Salvar' : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Investment Modal */}
      {showInvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-md border border-[var(--bd-modal)] overflow-hidden">
            <div className="p-6 border-b border-[var(--bd-modal)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--tx-modal)]">{editingInvestment ? 'Ajustar Ativo' : 'Novo Investimento'}</h3>
              <button onClick={handleCloseInvModal} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all">✕</button>
            </div>
            <form onSubmit={handleInvestmentSubmit} className="p-6 space-y-4">

              {/* Tipo — sempre primeiro para mudar os outros campos */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo de Ativo</label>
                <select
                  name="type"
                  value={invModalType}
                  onChange={e => setInvModalType(e.target.value)}
                  className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all appearance-none"
                >
                  <option value="Cripto">Criptomoedas</option>
                  <option value="Renda Fixa">Renda Fixa</option>
                  <option value="Ações">Ações</option>
                  <option value="FIIs">FIIs (Imobiliário)</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {/* Campos específicos de cripto */}
              {invModalType === 'Cripto' ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Moeda</label>
                    <select
                      value={invModalCryptoId}
                      onChange={e => setInvModalCryptoId(e.target.value)}
                      className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all appearance-none"
                    >
                      {CRYPTOS.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
                      ))}
                    </select>
                    {cryptoPrices[invModalCryptoId] && (
                      <p className="text-[11px] text-emerald-400 mt-1">
                        Preço atual: {formatCurrency(cryptoPrices[invModalCryptoId])}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Investido (R$)</label>
                      <input
                        required
                        name="initialAmount"
                        type="number"
                        step="0.01"
                        defaultValue={editingInvestment?.initialAmount || ''}
                        className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all placeholder:text-zinc-700"
                        placeholder="Ex: 850"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Quantidade</label>
                      <input
                        required
                        name="quantity"
                        type="number"
                        step="any"
                        defaultValue={editingInvestment?.quantity || ''}
                        className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all placeholder:text-zinc-700"
                        placeholder="Ex: 0.0012"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nome do Ativo</label>
                    <input
                      required
                      name="name"
                      type="text"
                      defaultValue={editingInvestment?.name || ''}
                      className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all placeholder:text-zinc-700"
                      placeholder="Ex: PETR4, Tesouro Direto..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Investido</label>
                      <input
                        required
                        name="initialAmount"
                        type="number"
                        step="0.01"
                        defaultValue={editingInvestment?.initialAmount || ''}
                        className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all placeholder:text-zinc-700"
                        placeholder="Valor pago"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Valor Atual</label>
                      <input
                        required
                        name="currentValue"
                        type="number"
                        step="0.01"
                        defaultValue={editingInvestment?.currentValue || ''}
                        className="w-full bg-[var(--bg-inner)] border border-[var(--bd-input)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-zinc-500 transition-all placeholder:text-zinc-700"
                        placeholder="Valor hoje"
                      />
                    </div>
                  </div>
                </>
              )}

              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl transition-all mt-2">
                {editingInvestment ? 'Atualizar Ativo' : 'Adicionar Ativo'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Goal Modal */}
      {showGoalModal && (() => {
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-sm border border-[var(--bd)] shadow-2xl">
              <div className="p-5 border-b border-[var(--bd)] flex justify-between items-center">
                <h3 className="text-base font-bold text-[var(--tx-modal)]">{editingGoal ? 'Editar Limite' : 'Novo Limite'}</h3>
                <button onClick={() => { setShowGoalModal(false); setEditingGoal(null); }}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all">✕</button>
              </div>
              <form onSubmit={async e => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                await saveGoal(goalCategory, Number(fd.get('limit')));
              }} className="p-5 space-y-4">

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Categoria</label>
                  <select value={goalCategory} onChange={e => setGoalCategory(e.target.value)}
                    className="w-full bg-[var(--bg-deep)] border border-[var(--bd)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-emerald-500/50 transition-all appearance-none text-sm">
                    <option value="Alimentação">Alimentação</option>
                    <option value="Lazer">Lazer</option>
                    <option value="Saúde/Academia">Saúde/Academia</option>
                    <option value="Educação">Educação</option>
                    <option value="Pais">Pais</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Limite por mês (R$)</label>
                  <input required name="limit" type="number" step="0.01" min="1"
                    defaultValue={editingGoal?.monthlyLimit || ''}
                    className="w-full bg-[var(--bg-deep)] border border-[var(--bd)] rounded-xl px-4 py-3 outline-none text-[var(--tx-modal)] focus:border-emerald-500/50 transition-all placeholder:text-zinc-700 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="Ex: 500" />
                </div>

                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                  {editingGoal ? 'Salvar' : 'Criar Limite'}
                </button>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default App;
