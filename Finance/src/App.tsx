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

import { Transaction, Investment, TransactionType } from "../types";
import DashboardCard from "./components/DashboardCard";
import { supabase } from "./services/supabase";

const COLORS = ["#FFC400","#7C7FFF", "#00FF9C", "#FF3131", "#A855FF"];

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

  console.log("USER:", session?.user?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

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

  useEffect(() => {
    if (session) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

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

  // ---- Só aqui entram os returns condicionais ----
  if (authLoading) return <div className="p-8">Carregando...</div>;
  if (!session) {
  window.location.href = "/";
  return null;
}

  return (
    <div className="min-h-screen pb-20 px-5 md:px-8 bg-[#0A0A0A] flex flex-col gap-6">
      {/* Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b border-[#232323] bg-[#0A0A0A]/80">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h1 className="font-extrabold tracking-tight text-slate-900 text-white text-8px md:text-1xl lg:text-4xl">FinanceFlow</h1>
          </div>
          <div className="flex items-center gap-3">

          {/* BOTÃO GANHO */}
          <button
            onClick={() => {
              setDefaultType("income");
              setShowTransModal(true);
            }}
            className="bg-[#39FF14]/10 border border-[#39FF14]/30 shadow-[0_0_12px_rgba(57,255,20,0.25)] hover:bg-[#39FF14]/80 text-white px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1 md:gap-2 transition-all hover:scale-105 active:scale-95 shadow-md"
          >
            <Plus size={18} /> Ganho
          </button>

          {/* BOTÃO GASTO */}
          <button
            onClick={() => {
              setDefaultType("expense");
              setShowTransModal(true);
            }}
            className="bg-[#FF3131]/10 border border-[#FF3131]/30 shadow-[0_0_12px_rgba(255,49,49,0.25)] hover:bg-[#FF3131]/80 text-white px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1 md:gap-2 transition-all hover:scale-105 active:scale-95 shadow-md"
          >
            <Plus size={18} /> Gasto
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="bg-[#00000]/10 border border-[#FFFFFF]/30 shadow-[0_0_12px_rgba(255,255,255,0.18)] hover:bg-[#FFffff]/85 text-white hover:text-black px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1 md:gap-2 rounded-xl text-sm font-bold"
          >
            Sair
          </button>

        </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 ">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
          <DashboardCard 
            title="Ganho Mensal"
            value={`R$ ${summary.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<TrendingUp className="w-5 h-5 text-[#39FF14] " />}
            colorClass="bg-[#39FF14]/10 border-[#39FF14]/30 shadow-[0_0_12px_rgba(57,255,20,0.18)]"
            trend={{ value: '12%', isUp: true, }}
          />
          <DashboardCard 
            title="Gastos Mensais" 
            value={`R$ ${summary.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<TrendingDown className="w-5 h-5 text-[#FF3131]" />}
            colorClass="bg-[#FF3131]/10 border-[#FF3131]/30 shadow-[0_0_12px_rgba(255,49,49,0.18)]"
            trend={{ value: '5%', isUp: false }}
          />
          <DashboardCard 
            title="Saldo Total" 
            value={`R$ ${summary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<CircleDollarSign  className="w-5 h-5 text-indigo-600 text-[#00E5FF]" />}
            colorClass="bg-[#00E5FF]/10 border-[#00E5FF]/30 shadow-[0_0_12px_rgba(0,229,255,0.18)]" 
          />
          <DashboardCard 
            title="Total Investido" 
            value={formatCurrency(summary.totalInvested)}
            icon={<CircleDollarSign className="w-5 h-5 text-amber-600" />}
            colorClass="bg-[#F7931A]/10 border border-[#F7931A]/30 text-amber-600 shadow-[0_0_6px_rgba(247,147,26,0.7)]"
            subtitle="Custo de Aquisição"
          />
          <DashboardCard 
            title="Patrimônio Atual" 
            value={formatCurrency(summary.totalCurrentValue)}
            icon={<PieChartIcon className="w-5 h-5 text-[#39FF14]" />}
            colorClass="bg-[#39FF14]/10 border-[#39FF14]/30 shadow-[0_0_12px_rgba(57,255,20,0.18)]"
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
            <div className="p-8 rounded-[2rem] border border-[#262626] shadow-sm bg-[#111111]  ">
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
              <div className="p-8 border-b border-[#262626] flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#F5F5F5]">Atividade Recente</h3>
                  <p className="text-sm text-[#A3A3A3]">{transactions.length} registros no período</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#111111] border-b border-[#262626] text-[#A3A3A3] text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-8 py-4">Descrição</th>
                      <th className="px-8 py-4">Categoria</th>
                      <th className="px-8 py-4 text-right">Valor</th>
                      <th className="px-8 py-4 text-center">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#262626]">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-[#161616] transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div
                              className={`p-2.5 rounded-xl border ${
                                t.type === TransactionType.INCOME
                                  ? "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/30 shadow-[0_0_12px_rgba(57,255,20,0.18)]"
                                  : "bg-[#FF3131]/10 text-[#FF3131] border-[#FF3131]/30 shadow-[0_0_12px_rgba(255,49,49,0.18)]"
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

                        <td className="px-8 py-5">
                          <span className="px-3 py-1 rounded-full bg-[#1A1A1A] border border-[#2E2E2E] text-[#CFCFCF] text-[10px] font-extrabold uppercase tracking-tighter">
                            {t.category}
                          </span>
                        </td>

                        <td
                          className={`px-8 py-5 text-right font-black ${
                            t.type === TransactionType.INCOME
                              ? "text-[#39FF14]"
                              : "text-[#FF3131]"
                          }`}
                        >
                          {t.type === TransactionType.INCOME ? "+" : "-"} {formatCurrency(t.amount)}
                        </td>

                        <td className="px-8 py-5 text-center">
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
            <div className="bg-[#111111] p-8 rounded-[2rem] border border-[#262626] shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-[#F5F5F5]">Portfólio</h3>
                  <p className="text-sm text-[#A3A3A3]">Rentabilidade de ativos</p>
                </div>
                <button  
                  onClick={() => setShowInvModal(true)}
                  className=" bg-[#F7931A]/10 hover:bg-[#F7931A] border border-[#F7931A]/30 text-white p-2.5 rounded-xl transition-all shadow-[0_0_6px_rgba(247,147,26,0.7)] hover:scale-110"
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
                            className="p-1.5 text-[#00E5FF] hover:bg-[#00E5FF]/10 border border-transparent hover:border-[#00E5FF]/30 rounded-md transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Edit2
                              size={16}
                              className="drop-shadow-[0_0_6px_rgba(0,229,255,0.6)]"
                            />
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
                            className="p-1.5 text-[#FF3131] hover:bg-[#FF3131]/10 border border-transparent hover:border-[#FF3131]/30 rounded-md transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2
                              size={16}
                              className="drop-shadow-[0_0_6px_rgba(255,49,49,0.6)]"
                            />
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

                      <div className={`flex items-center justify-between p-3 rounded-xl ${isPositive ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]' : 'bg-[#FF3131]/10 border-[#FF3131]/30 text-[#FF3131]'}`}>
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
                  <div className="py-12 text-center text-slate-300 font-medium italic border-2 border-dashed border-slate-100 rounded-3xl">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-800">Nova Transação</h3>
                <p className="text-sm text-slate-400 font-medium">Registre sua movimentação</p>
              </div>
              <button onClick={() => setShowTransModal(false)} className="bg-white border border-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 shadow-sm transition-all hover:rotate-90">✕</button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Descrição</label>
                <input required name="description" type="text" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-slate-700 transition-all" placeholder="Ex: Aluguel, Mercado, Salário..." />
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Valor (R$)</label>
                  <input required name="amount" type="number" step="0.01" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-slate-700 transition-all" placeholder="0.00" />
                </div>
              
              </div>
              {defaultType === "expense" && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Categoria</label>
                  <select
                    name="category"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-slate-700 appearance-none"
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
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-[1.5rem] transition-all mt-4 shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95">
                Confirmar Lançamento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Investment Modal */}
      {showInvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-800">{editingInvestment ? 'Ajustar Ativo' : 'Novo Investimento'}</h3>
                <p className="text-sm text-slate-400 font-medium">Controle seu patrimônio</p>
              </div>
              <button onClick={handleCloseInvModal} className="bg-white border border-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 shadow-sm transition-all hover:rotate-90">✕</button>
            </div>
            <form onSubmit={handleInvestmentSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nome do Ativo</label>
                <input 
                  required 
                  name="name" 
                  type="text" 
                  defaultValue={editingInvestment?.name || ''}
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-amber-100 outline-none font-bold text-slate-700 transition-all" 
                  placeholder="Ex: PETR4, Tesouro Direto, BTC..." 
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Valor Investido</label>
                  <input 
                    required 
                    name="initialAmount" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingInvestment?.initialAmount || ''}
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-amber-100 outline-none font-bold text-slate-700 transition-all" 
                    placeholder="Quanto você pagou" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Valor Atual</label>
                  <input 
                    required 
                    name="currentValue" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingInvestment?.currentValue || ''}
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-amber-100 outline-none font-bold text-slate-700 transition-all" 
                    placeholder="Quanto vale hoje" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Tipo de Ativo</label>
                <select 
                  name="type" 
                  defaultValue={editingInvestment?.type || 'Renda Fixa'}
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-amber-100 outline-none font-bold text-slate-700 appearance-none"
                >
                  <option value="Cripto">Criptomoedas</option>
                  <option value="Renda Fixa">Renda Fixa</option>
                  <option value="Ações">Ações</option>
                  <option value="FIIs">FIIs (Imobiliário)</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <button type="submit" className={`w-full ${editingInvestment ? 'bg-indigo-600' : 'bg-amber-500 hover:bg-amber-600'} text-white font-black py-5 rounded-[1.5rem] transition-all mt-4 shadow-xl shadow-amber-100 hover:scale-[1.02] active:scale-95`}>
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
