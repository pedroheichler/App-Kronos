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
  const [defaultType, setDefaultType] = useState<"income" | "expense">("expense");

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


  // ---- Financial Calculations ----
  const summary = useMemo<DashboardSummary>(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfLastMonth = new Date(currentYear, currentMonth, 0);

    const totalIncome = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((acc, curr) => acc + curr.amount, 0);

    const monthlyExpenses = transactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === TransactionType.EXPENSE && d >= startOfCurrentMonth;
      })
      .reduce((acc, curr) => acc + curr.amount, 0);

    const lastMonthExpenses = transactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === TransactionType.EXPENSE && d >= startOfLastMonth && d <= endOfLastMonth;
      })
      .reduce((acc, curr) => acc + curr.amount, 0);

    const trendPercentage =
      lastMonthExpenses > 0 ? ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 : 0;

    const totalInvested = investments.reduce((acc, curr) => acc + curr.initialAmount, 0);
    const totalCurrentValue = investments.reduce((acc, curr) => acc + curr.currentValue, 0);
    const totalProfit = totalCurrentValue - totalInvested;
    const profitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    return {
      totalIncome,
      totalExpenses,
      totalInvested,
      totalCurrentValue,
      totalProfit,
      profitPercentage,
      balance: totalIncome - totalExpenses,
      monthlyExpenses,
      monthlyTrend: {
        value: `${Math.abs(trendPercentage).toFixed(0)}%`,
        isUp: trendPercentage > 0,
      },
    };
  }, [transactions, investments]);

  const chartData = useMemo(() => {
    const groups: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.type === TransactionType.EXPENSE) {
        groups[t.category] = (groups[t.category] || 0) + t.amount;
      }
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const investmentChartData = useMemo(() => {
    return investments.map((inv) => ({ name: inv.name, value: inv.currentValue }));
  }, [investments]);

  // ---- Handlers ----
  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);

  const payload = {
    user_id: session.user.id,
    title: formData.get("description") as string,
    amount: Math.abs(Number(formData.get("amount"))),
    type: defaultType,
    category: defaultType === "expense"
      ? (formData.get("category") as string)
      : "Receitas",
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select("id, title, amount, type, category, created_at")
    .single();

  if (error) {
    console.error(error.message);
    alert("Erro ao salvar transação: " + error.message);
    return;
  }

  // 👇 MAPEAMENTO CORRETO PARA O FRONTEND
  const mapped: Transaction = {
    id: data.id,
    description: data.title,
    amount: Number(data.amount),
    type:
      data.type === "income"
        ? TransactionType.INCOME
        : TransactionType.EXPENSE,
    category: data.category,
    date: data.created_at,
  };

  setTransactions((prev) => [mapped, ...prev]);
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
        alert("Erro ao atualizar: " + error.message);
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
        alert("Erro ao salvar investimento: " + error.message);
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
    <div className="min-h-screen pb-20 bg-[#0A0A0A] flex flex-col gap-6">
      {/* Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b border-[#232323] bg-[#0A0A0A]/80">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold tracking-tight text-white text-base md:text-xl">Finance</h1>
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

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-6 mb-6 md:mb-8">
          <DashboardCard
            title="Ganho Total"
            value={`R$ ${summary.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            colorClass="bg-emerald-500/10 border-emerald-500/20"
            trend={{ value: '12%', isUp: true, }}
          />
          <DashboardCard
            title="Gastos Totais"
            value={`R$ ${summary.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<TrendingDown className="w-5 h-5 text-red-400" />}
            colorClass="bg-red-500/10 border-red-500/20"
            trend={{ value: '5%', isUp: false }}
          />
          <DashboardCard
            title="Saldo Total"
            value={`R$ ${summary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<CircleDollarSign className="w-5 h-5 text-indigo-400" />}
            colorClass="bg-indigo-500/10 border-indigo-500/20"
          />
          <DashboardCard
            title="Total Investido"
            value={formatCurrency(summary.totalInvested)}
            icon={<CircleDollarSign className="w-5 h-5 text-amber-400" />}
            colorClass="bg-amber-500/10 border-amber-500/20"
            subtitle="Custo de Aquisição"
          />
          <DashboardCard
            title="Patrimônio Atual"
            value={formatCurrency(summary.totalCurrentValue)}
            icon={<PieChartIcon className="w-5 h-5 text-violet-400" />}
            colorClass="bg-violet-500/10 border-violet-500/20"
            trend={{
              value: `${summary.profitPercentage.toFixed(1)}%`,
              isUp: summary.totalProfit >= 0
            }}
            subtitle="Valor de mercado"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 ">
          {/* Column Left: Main Content */}
          <div className="lg:col-span-2 space-y-8 ">

            {/* Expenses Analysis */}
            <div className="p-4 md:p-8 rounded-[2rem] border border-[#262626] shadow-sm bg-[#111111]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 text-[#F5F5F5]">Distribuição de Gastos</h3>
                  <p className="text-sm text-slate-400 text-[#A3A3A3]">Visão por categorias de despesas</p>
                </div>
              </div>
              <div className="h-[300px] ">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} />
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
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <PieChartIcon className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-semibold text-[#A3A3A3]">Nenhum dado para exibir</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transactions Table */}
            <div className="rounded-[2rem] border border-[#262626] shadow-sm overflow-hidden bg-[#111111]">
              <div className="p-4 md:p-8 border-b border-[#262626] flex items-center justify-between">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-[#F5F5F5]">Atividade Recente</h3>
                  <p className="text-sm text-[#A3A3A3]">{transactions.length} registros no período</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#111111] border-b border-[#262626] text-[#A3A3A3] text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 md:px-8 py-3 md:py-4">Descrição</th>
                      <th className="px-3 md:px-8 py-3 md:py-4 hidden md:table-cell">Categoria</th>
                      <th className="px-3 md:px-8 py-3 md:py-4 text-right">Valor</th>
                      <th className="px-3 md:px-8 py-3 md:py-4 text-center">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#262626]">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-[#161616] transition-colors group">
                        <td className="px-3 md:px-8 py-3 md:py-5">
                          <div className="flex items-center gap-2 md:gap-4">
                            <div
                              className={`p-2 rounded-lg ${
                                t.type === TransactionType.INCOME
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              {t.type === TransactionType.INCOME ? (
                                <ArrowUpRight size={18} className="text-current" />
                              ) : (
                                <ArrowDownLeft size={18} className="text-current" />
                              )}
                            </div>

                            <div>
                              <p className="font-bold text-[#F5F5F5]">{t.description}</p>
                              <p className="text-[10px] text-[#A3A3A3] font-medium">
                                {new Date(t.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 md:px-8 py-3 md:py-5 hidden md:table-cell">
                          <span className="px-3 py-1 rounded-full bg-[#1A1A1A] border border-[#2E2E2E] text-[#CFCFCF] text-[10px] font-extrabold uppercase tracking-tighter">
                            {t.category}
                          </span>
                        </td>

                        <td
                          className={`px-3 md:px-8 py-3 md:py-5 text-right font-semibold text-sm md:text-base ${
                            t.type === TransactionType.INCOME
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {t.type === TransactionType.INCOME ? "+" : "-"} {formatCurrency(t.amount)}
                        </td>

                        <td className="px-3 md:px-8 py-3 md:py-5 text-center">
                          <button
                            className="p-2 rounded-lg text-[#A3A3A3] hover:text-[#FF3131] hover:bg-[#FF3131]/10 transition-all"
                            onClick={async () => {
                              const { error } = await supabase
                                .from("transactions")
                                .delete()
                                .eq("id", t.id);

                              if (error) {
                                alert("Erro ao deletar: " + error.message);
                                return;
                              }

                              setTransactions((prev) =>
                                prev.filter((item) => item.id !== t.id)
                              );
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-[#666666] font-medium">
                          Nenhuma transação registrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Column Right: Investments Portfolio */}
          <div className="space-y-8 ">
            <div className="bg-[#111111] p-4 md:p-8 rounded-[2rem] border border-[#262626] shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-[#F5F5F5]">Portfólio</h3>
                  <p className="text-sm text-[#A3A3A3]">Rentabilidade de ativos</p>
                </div>
                <button
                  onClick={() => setShowInvModal(true)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2 rounded-lg transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-5 ">
                {investments.map((inv) => {
                  const profit = inv.currentValue - inv.initialAmount;
                  const profitPerc = (profit / inv.initialAmount) * 100;
                  const isPositive = profit >= 0;

                  return (
                    <div
                      key={inv.id}
                      className="group bg-[#111111] p-5 rounded-2xl border border-[#262626] transition-all shadow-sm hover:border-[#3a3a3a]"
                    >
                      <div className="flex justify-between items-start mb-4">
                        
                        <div>
                          <p className="text-xs font-black text-[#F5F5F5] uppercase tracking-widest mb-1">
                            {inv.type}
                          </p>

                          <h4 className="font-bold text-[#A3A3A3] text-lg">
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
                                .eq("id", inv.id);

                              if (error) {
                                alert("Erro ao deletar: " + error.message);
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
                      
                      <div className="grid grid-cols-2 gap-4 mb-4 " >
                        <div>
                          <p className="text-[10px] font-bold text-[#F5F5F5] uppercase">Investido</p>
                          <p className="font-bold text-[#A3A3A3]">{formatCurrency(inv.initialAmount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-[#F5F5F5] uppercase">Valor Atual</p>
                          <p className="font-black text-[#A3A3A3]">{formatCurrency(inv.currentValue)}</p>
                        </div>
                      </div>

                      <div className={`flex items-center justify-between p-3 rounded-xl ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
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
              <h3 className="text-lg font-bold text-[#F5F5F5]">Nova Transação</h3>
              <button onClick={() => setShowTransModal(false)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all">✕</button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Descrição</label>
                <input required name="description" type="text" className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 outline-none text-[#F5F5F5] focus:border-zinc-500 transition-all placeholder:text-zinc-700" placeholder="Ex: Aluguel, Mercado, Salário..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Valor (R$)</label>
                <input required name="amount" type="number" step="0.01" className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 outline-none text-[#F5F5F5] focus:border-zinc-500 transition-all placeholder:text-zinc-700" placeholder="0.00" />
              </div>
              {defaultType === "expense" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Categoria</label>
                  <select
                    name="category"
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
                Confirmar
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
