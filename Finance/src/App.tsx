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
import { Transaction, Investment, TransactionType, DashboardSummary } from "../types";
import DashboardCard from "./components/DashboardCard";
import { supabase } from "./services/supabase";
import { getFinancialInsights } from "./services/insights";

const COLORS = ["#10b981","#6366f1", "#f59e0b", "#ef4444", "#a78bfa"];

const App: React.FC = () => {
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
    .select("id, title, amount, type, category, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

    if (tErr) {
  console.error("Erro carregando transactions:", tErr.message);
} else {
  const mapped = (tData || []).map((t: any) => ({
    id: t.id,
    description: t.title, // banco tem title
    amount: Number(t.amount),
    type:
      t.type === "income"
        ? TransactionType.INCOME
        : TransactionType.EXPENSE,
    category: t.category,
    date: t.created_at, // banco tem created_at
  }));

  setTransactions(mapped);
}

    const { data: iData, error: iErr } = await supabase
      .from("investments")
      .select("id, name, initial_amount, current_value, type, date")
      .eq("user_id", session.user.id)
      .order("date", { ascending: false });

    if (iErr) {
      console.error("Erro carregando investments:", iErr.message);
    } else {
      const mapped: Investment[] = (iData || []).map((inv: any) => ({
        id: inv.id,
        name: inv.name,
        initialAmount: Number(inv.initial_amount),
        currentValue: Number(inv.current_value),
        type: inv.type,
        date: inv.date,
      }));
      setInvestments(mapped);
    }
  };


  // ---- Filtro por mês ----
  const filteredTransactions = useMemo(() => {
    const start = new Date(viewDate.year, viewDate.month, 1);
    const end   = new Date(viewDate.year, viewDate.month + 1, 0, 23, 59, 59);
    return transactions.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
  }, [transactions, viewDate]);

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
  const summary = useMemo<DashboardSummary>(() => {
    const totalIncome    = filteredTransactions.filter(t => t.type === TransactionType.INCOME).reduce((a, c) => a + c.amount, 0);
    const totalExpenses  = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((a, c) => a + c.amount, 0);
    const prevExpenses   = prevMonthTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((a, c) => a + c.amount, 0);
    const trendPct       = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;
    const totalInvested  = investments.reduce((a, c) => a + c.initialAmount, 0);
    const totalCurrentValue = investments.reduce((a, c) => a + c.currentValue, 0);
    const totalProfit    = totalCurrentValue - totalInvested;

    return {
      totalIncome, totalExpenses,
      totalInvested, totalCurrentValue, totalProfit,
      profitPercentage: totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0,
      balance: totalIncome - totalExpenses,
      monthlyExpenses: totalExpenses,
      monthlyTrend: { value: `${Math.abs(trendPct).toFixed(0)}%`, isUp: trendPct > 0 },
    };
  }, [filteredTransactions, prevMonthTransactions, investments]);

  const chartData = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      if (t.type === TransactionType.EXPENSE)
        groups[t.category] = (groups[t.category] || 0) + t.amount;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const investmentChartData = useMemo(() => {
    return investments.map((inv) => ({ name: inv.name, value: inv.currentValue }));
  }, [investments]);

  // ---- Handlers ----
  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const desc     = formData.get("description") as string;
    const amount   = Math.abs(Number(formData.get("amount")));
    const category = defaultType === "expense" ? (formData.get("category") as string) : "Receitas";

    if (editingTransaction) {
      // ---- Editar existente ----
      const { data, error } = await supabase
        .from("transactions")
        .update({ title: desc, amount, type: defaultType, category })
        .eq("id", editingTransaction.id)
        .select("id, title, amount, type, category, created_at")
        .single();
      if (error) { alert("Erro ao editar transação."); return; }
      setTransactions(prev => prev.map(t => t.id === data.id ? {
        id: data.id, description: data.title, amount: Number(data.amount),
        type: data.type === "income" ? TransactionType.INCOME : TransactionType.EXPENSE,
        category: data.category, date: data.created_at,
      } : t));
      setEditingTransaction(null);
    } else {
      // ---- Nova transação ----
      const { data, error } = await supabase
        .from("transactions")
        .insert({ user_id: session.user.id, title: desc, amount, type: defaultType, category })
        .select("id, title, amount, type, category, created_at")
        .single();
      if (error) { alert("Erro ao salvar transação."); return; }
      setTransactions(prev => [{
        id: data.id, description: data.title, amount: Number(data.amount),
        type: data.type === "income" ? TransactionType.INCOME : TransactionType.EXPENSE,
        category: data.category, date: data.created_at,
      }, ...prev]);
    }

    setShowTransModal(false);
    (e.currentTarget as HTMLFormElement).reset();
  };

  const handleCloseInvModal = () => {
    setShowInvModal(false);
    setEditingInvestment(null);
  };

  const handleInvestmentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const payload = {
      name: formData.get("name") as string,
      initial_amount: Number(formData.get("initialAmount")),
      current_value: Number(formData.get("currentValue")),
      type: formData.get("type") as string,
      date: new Date().toISOString(),
    };

    if (editingInvestment) {
      const { data, error } = await supabase
        .from("investments")
        .update(payload)
        .eq("id", editingInvestment.id)
        .select("id, name, initial_amount, current_value, type, date")
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
      };

      setInvestments((prev) => prev.map((inv) => (inv.id === mapped.id ? mapped : inv)));
    } else {
      const { data, error } = await supabase
        .from("investments")
        .insert(payload)
        .select("id, name, initial_amount, current_value, type, date")
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
      };

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
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
    <div className="min-h-screen pb-20 bg-[#0A0A0A] flex flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-sm border-b border-[#1F1F1F] bg-[#0A0A0A]/90">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h1 className="font-semibold text-[#E8E8E8] text-sm tracking-wide">Finance</h1>
          </div>
          <div className="flex items-center gap-3">

          {/* BOTÃO GANHO */}
          <button
            onClick={() => {
              setDefaultType("income");
              setShowTransModal(true);
            }}
            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1 md:gap-2 transition-all active:scale-95"
          >
            <Plus size={16} /> Ganho
          </button>

          {/* BOTÃO GASTO */}
          <button
            onClick={() => {
              setDefaultType("expense");
              setShowTransModal(true);
            }}
            className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1 md:gap-2 transition-all active:scale-95"
          >
            <Plus size={16} /> Gasto
          </button>
          <AppSwitcher currentApp="finance" userEmail={session?.user?.email} />
        </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-8">
          <DashboardCard
            title="Ganho Total"
            value={`R$ ${summary.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<TrendingUp size={16} />}
            accentColor="#4ade80"
            trend={{ value: `${((summary.totalIncome / (summary.totalIncome + summary.totalExpenses || 1)) * 100).toFixed(0)}%`, isUp: true }}
          />
          <DashboardCard
            title="Gastos Totais"
            value={`R$ ${summary.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<TrendingDown size={16} />}
            accentColor="#f87171"
            trend={{ value: summary.monthlyTrend.value, isUp: summary.monthlyTrend.isUp }}
          />
          <DashboardCard
            title="Saldo"
            value={`R$ ${summary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
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
            <div className="p-5 md:p-6 rounded-xl border border-[#1F1F1F] bg-[#111111]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-[#E8E8E8]">Distribuição de Gastos</h3>
                  <p className="text-xs text-[#616161] mt-0.5">Por categoria</p>
                </div>
              </div>
              <div className="h-[260px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F1F1F" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#616161', fontSize: 11}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#616161', fontSize: 11}} />
                      <Tooltip 
                        contentStyle={{
                        backgroundColor: "#111111",
                        borderRadius: "16px",
                        border: "1px solid #262626",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                        padding: "12px",
                        color: "#ffffff",
                      }}
                      itemStyle={{
                        color: "#fffffff",
                        fontWeight: 700
                      }}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      />
                      <Bar dataKey="value"  radius={[8, 8, 8, 8]} barSize={40}>
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}  />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-2">
                    <PieChartIcon className="w-8 h-8 text-[#2a2a2a]" />
                    <p className="text-sm text-[#616161]">Nenhum dado ainda</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transactions Table */}
            <div className="rounded-xl border border-[#1F1F1F] overflow-hidden bg-[#111111]">
              <div className="px-5 py-4 border-b border-[#1F1F1F] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#E8E8E8]">Transações</h3>
                  <p className="text-xs text-[#616161] mt-0.5">{filteredTransactions.length} registros</p>
                </div>
                {/* Month navigation */}
                <div className="flex items-center gap-2">
                  <button onClick={goToPrevMonth} className="p-1.5 rounded-lg text-[#616161] hover:text-[#E8E8E8] hover:bg-[#1a1a1a] transition-all">‹</button>
                  <span className="text-xs font-medium text-[#E8E8E8] capitalize min-w-[110px] text-center">{monthLabel}</span>
                  <button onClick={goToNextMonth} disabled={isCurrentMonth} className="p-1.5 rounded-lg text-[#616161] hover:text-[#E8E8E8] hover:bg-[#1a1a1a] transition-all disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                </div>
              </div>

              {/* Mobile: card list */}
              <div className="md:hidden divide-y divide-[#1a1a1a]">
                {filteredTransactions.map((t) => (
                  <div key={t.id} className="px-4 py-3 flex items-center gap-3 group hover:bg-[#161616] transition-colors">
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${t.type === TransactionType.INCOME ? 'bg-green-400/60' : 'bg-rose-400/60'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#E8E8E8] truncate">{t.description}</p>
                      <p className="text-[10px] text-[#616161] mt-0.5">{t.category} · {new Date(t.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${t.type === TransactionType.INCOME ? 'text-green-400' : 'text-rose-400'}`}>
                      {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button className="p-1.5 rounded-lg text-[#3a3a3a] hover:text-blue-400 hover:bg-blue-400/10 transition-all"
                        onClick={() => { setEditingTransaction(t); setDefaultType(t.type === TransactionType.INCOME ? 'income' : 'expense'); setShowTransModal(true); }}>
                        <Edit2 size={13} />
                      </button>
                      <button className="p-1.5 rounded-lg text-[#3a3a3a] hover:text-rose-400 hover:bg-rose-400/10 transition-all"
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
                  <div className="py-12 text-center text-[#616161] text-sm">Nenhuma transação neste mês.</div>
                )}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-[#1F1F1F] text-[#616161] text-[10px] font-medium uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Descrição</th>
                      <th className="px-5 py-3">Categoria</th>
                      <th className="px-5 py-3 text-right">Valor</th>
                      <th className="px-5 py-3 text-center">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#1a1a1a]">
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-[#161616] transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-1.5 h-7 rounded-full flex-shrink-0 ${t.type === TransactionType.INCOME ? 'bg-green-400/60' : 'bg-rose-400/60'}`} />
                            <div>
                              <p className="text-sm font-medium text-[#E8E8E8]">{t.description}</p>
                              <p className="text-xs text-[#616161] mt-0.5">
                                {new Date(t.date).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-[#1a1a1a] text-[#616161] text-[10px] font-medium uppercase tracking-wide">
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
                              className="p-1.5 rounded-lg text-transparent group-hover:text-[#3a3a3a] hover:!text-blue-400 hover:bg-blue-400/10 transition-all"
                              onClick={() => { setEditingTransaction(t); setDefaultType(t.type === TransactionType.INCOME ? 'income' : 'expense'); setShowTransModal(true); }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className="p-1.5 rounded-lg text-transparent group-hover:text-[#3a3a3a] hover:!text-rose-400 hover:bg-rose-400/10 transition-all"
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
                        <td colSpan={4} className="py-16 text-center text-[#616161] text-sm">
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
            <div className="bg-[#111111] p-5 rounded-xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-[#E8E8E8]">Portfólio</h3>
                  <p className="text-xs text-[#616161] mt-0.5">Rentabilidade de ativos</p>
                </div>
                <button
                  onClick={() => setShowInvModal(true)}
                  className="bg-[#1a1a1a] hover:bg-[#222] text-[#616161] hover:text-[#E8E8E8] p-1.5 rounded-lg transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {investments.map((inv) => {
                  const profit = inv.currentValue - inv.initialAmount;
                  const profitPerc = (profit / inv.initialAmount) * 100;
                  const isPositive = profit >= 0;

                  return (
                    <div
                      key={inv.id}
                      className="group p-4 rounded-xl border border-[#1F1F1F] hover:border-[#2a2a2a] bg-[#0e0e0e] transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-[10px] font-medium text-[#616161] uppercase tracking-widest mb-0.5">
                            {inv.type}
                          </p>
                          <h4 className="font-medium text-[#E8E8E8] text-sm">
                            {inv.name}
                          </h4>
                        </div>

                        <div className="flex gap-1">

                          {/* EDIT */}
                          <button
                            onClick={() => {
                              setEditingInvestment(inv);
                              setShowInvModal(true);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-md transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Edit2 size={15} />
                          </button>

                          {/* DELETE */}
                          <button
                            onClick={async () => {
                              const { error } = await supabase
                                .from("investments")
                                .delete()
                                .eq("id", inv.id)
                                .eq("user_id", session.user.id);

                              if (error) {
                                alert("Erro ao remover investimento.");
                                return;
                              }

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
                          <p className="text-[10px] text-[#616161] mb-0.5">Investido</p>
                          <p className="text-sm font-medium text-[#E8E8E8]">{formatCurrency(inv.initialAmount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-[#616161] mb-0.5">Atual</p>
                          <p className="text-sm font-medium text-[#E8E8E8]">{formatCurrency(inv.currentValue)}</p>
                        </div>
                      </div>

                      <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${isPositive ? 'bg-green-400/10 text-green-400' : 'bg-rose-400/10 text-rose-400'}`}>
                        <div className="flex items-center gap-1.5">
                          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14}  />}
                          <span className="text-sm font-black">{isPositive ? '+' : ''}{profitPerc.toFixed(1)}%</span>
                        </div>
                        <span className="text-xs font-bold">{isPositive ? 'Lucro: ' : 'Prejuízo: '}{formatCurrency(Math.abs(profit))}</span>
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
                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color:"white",}}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Transaction Modal */}
      {showTransModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111111] rounded-2xl w-full max-w-md border border-[#262626] overflow-hidden">
            <div className="p-6 border-b border-[#262626] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#F5F5F5]">{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</h3>
              <button onClick={() => { setShowTransModal(false); setEditingTransaction(null); }} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all">✕</button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Descrição</label>
                <input required name="description" type="text" defaultValue={editingTransaction?.description || ''} className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 outline-none text-[#F5F5F5] focus:border-zinc-500 transition-all placeholder:text-zinc-700" placeholder="Ex: Aluguel, Mercado, Salário..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Valor (R$)</label>
                <input required name="amount" type="number" step="0.01" defaultValue={editingTransaction?.amount || ''} className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 outline-none text-[#F5F5F5] focus:border-zinc-500 transition-all placeholder:text-zinc-700" placeholder="0.00" />
              </div>
              {defaultType === "expense" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Categoria</label>
                  <select
                    name="category"
                    defaultValue={editingTransaction?.category || 'Alimentação'}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 outline-none text-[#F5F5F5] focus:border-zinc-500 transition-all appearance-none"
                  >
                    <option value="Alimentação">Alimentação</option>
                    <option value="Lazer">Lazer</option>
                    <option value="Saúde/Academia">Saúde/Academia</option>
                    <option value="Educação">Educação</option>
                    <option value="Pais">Pais</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
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
          <div className="bg-[#111111] rounded-2xl w-full max-w-md border border-[#262626] overflow-hidden">
            <div className="p-6 border-b border-[#262626] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#F5F5F5]">{editingInvestment ? 'Ajustar Ativo' : 'Novo Investimento'}</h3>
              <button onClick={handleCloseInvModal} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all">✕</button>
            </div>
            <form onSubmit={handleInvestmentSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nome do Ativo</label>
                <input
                  required
                  name="name"
                  type="text"
                  defaultValue={editingInvestment?.name || ''}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 outline-none text-[#F5F5F5] focus:border-zinc-500 transition-all placeholder:text-zinc-700"
                  placeholder="Ex: PETR4, Tesouro Direto, BTC..."
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
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 outline-none text-[#F5F5F5] focus:border-zinc-500 transition-all placeholder:text-zinc-700"
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
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 outline-none text-[#F5F5F5] focus:border-zinc-500 transition-all placeholder:text-zinc-700"
                    placeholder="Valor hoje"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo de Ativo</label>
                <select
                  name="type"
                  defaultValue={editingInvestment?.type || 'Renda Fixa'}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 outline-none text-[#F5F5F5] focus:border-zinc-500 transition-all appearance-none"
                >
                  <option value="Cripto">Criptomoedas</option>
                  <option value="Renda Fixa">Renda Fixa</option>
                  <option value="Ações">Ações</option>
                  <option value="FIIs">FIIs (Imobiliário)</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl transition-all mt-2">
                {editingInvestment ? 'Atualizar Ativo' : 'Adicionar Ativo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
