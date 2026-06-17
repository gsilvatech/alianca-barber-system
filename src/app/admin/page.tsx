"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HOURS } from "@/lib/constant";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Activity,
  LogOut,
  Search,
  Menu,
  X,
  Plus,
  TrendingUp,
  CreditCard,
  Scissors,
  ArrowLeft,
  ChevronRight,
  LineChart,
} from "lucide-react";

const getLocalDateStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

const isPast = (dateStr: string, timeStr: string) => {
  if (!dateStr || !timeStr) return false;
  const now = new Date();
  const cleanDate = dateStr.split("T")[0];
  const [year, month, day] = cleanDate.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const apptDate = new Date(year, month - 1, day, hours, minutes + 20);
  return now > apptDate;
};

const getServiceDuration = (
  serviceString: string,
  servicesList: any[],
): number => {
  if (!serviceString) return 30;
  let cleanName = serviceString;
  if (cleanName.startsWith("MANUAL:")) {
    cleanName = cleanName.split(" - ")[1] || cleanName;
  }
  if (cleanName.startsWith("PLANO: ") || cleanName.startsWith("ADMIN: ")) {
    cleanName = cleanName.replace("PLANO: ", "").replace("ADMIN: ", "");
  }
  const svc = servicesList.find((s) => s.name.trim() === cleanName.trim());
  return svc?.duration || 30;
};

type Appointment = {
  id: string;
  service: string;
  date: string;
  time: string;
  status: string;
  price_applied: number;
  profiles: { name: string };
  barbers: { display_name: string };
  created_at: string;
  barber_id: string;
};
type Barber = { id: string; display_name: string; user_id: string };
type UserProfile = {
  id: string;
  name: string;
  role: string;
  created_at: string;
  phone: string;
  is_ghost: boolean;
};
type BarberService = {
  id: string;
  name: string;
  price: number;
  duration: number;
};
type ClientPlan = {
  id: string;
  plan_name: string;
  price_paid: number;
  status: string;
  barber_id: string;
  created_at: string;
  start_date?: string;
};
type ProductSale = {
  total_price: number;
  created_at: string;
  barber_id: string;
};

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<{
    name: string;
    id: string;
    role: string;
  } | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [servicesList, setServicesList] = useState<BarberService[]>([]);
  const [clientPlans, setClientPlans] = useState<ClientPlan[]>([]);
  const [productSales, setProductSales] = useState<ProductSale[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<
    "overview" | "team" | "users" | "audit"
  >("overview");
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [loading, setLoading] = useState(true);

  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] =
    useState<UserProfile | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResultLink, setResetResultLink] = useState("");
  const [showPassMessage, setShowPassMessage] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    barberId: "",
    service: "",
    date: "",
    time: "",
  });
  const [saving, setSaving] = useState(false);
  const [admTakenSlots, setAdmTakenSlots] = useState<string[]>([]);

  const todayStr = getLocalDateStr(new Date());

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const firstDayThisMonth = getLocalDateStr(
    new Date(currentYear, currentMonthIdx, 1),
  );
  const lastDayThisMonth = getLocalDateStr(
    new Date(currentYear, currentMonthIdx + 1, 0),
  );

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", user.id)
        .single();
      if (prof?.role !== "admin") return router.push("/cliente");
      setProfile(prof);

      const [
        { data: barb },
        { data: usr },
        { data: svcs },
        { data: plans },
        { data: appts },
        { data: blocks },
        { data: sales },
      ] = await Promise.all([
        supabase.from("barbers").select("id, display_name, user_id"),
        supabase
          .from("profiles")
          .select("id, name, phone, role, created_at, is_ghost")
          .order("created_at", { ascending: false }),
        supabase.from("services").select("*").order("name"),
        supabase
          .from("client_plans")
          .select(
            "id, plan_name, price_paid, status, barber_id, created_at, start_date",
          ),
        supabase
          .from("appointments")
          .select(
            "id, service, date, time, status, price_applied, barber_id, created_at, profiles(name), barbers(display_name)",
          )
          .gte("date", firstDayThisMonth)
          .lte("date", lastDayThisMonth)
          .order("date", { ascending: false })
          .order("time", { ascending: false }),
        supabase.from("blocked_dates").select("*"),
        supabase
          .from("product_sales")
          .select("total_price, created_at, barber_id"),
      ]);

      setBarbers(barb || []);
      setUsers(usr || []);
      setServicesList(svcs || []);
      setClientPlans(plans || []);
      setAppointments((appts as any) || []);
      setBlockedDates(blocks || []);
      setProductSales(sales || []);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (
      !form.barberId ||
      !form.date ||
      !form.service ||
      servicesList.length === 0
    ) {
      setAdmTakenSlots([]);
      return;
    }

    const isDayBlocked = blockedDates.some(
      (b) => b.barber_id === form.barberId && b.date === form.date,
    );

    if (isDayBlocked) {
      setAdmTakenSlots(HOURS);
      return;
    }

    const existingAppts = appointments.filter(
      (a) =>
        a.barber_id === form.barberId &&
        a.date === form.date &&
        a.status === "confirmed",
    );

    const duration = getServiceDuration(form.service, servicesList);
    const blocked: string[] = [];

    HOURS.forEach((slot) => {
      const slotStart = timeToMinutes(slot);
      const slotEnd = slotStart + duration;

      const hasConflict = existingAppts.some((appt: any) => {
        const apptStart = timeToMinutes(appt.time);
        const apptDuration = getServiceDuration(appt.service, servicesList);
        const apptEnd = apptStart + apptDuration;
        return slotStart < apptEnd && slotEnd > apptStart;
      });

      if (hasConflict) blocked.push(slot);
    });

    setAdmTakenSlots(blocked);
  }, [
    form.barberId,
    form.date,
    form.service,
    appointments,
    blockedDates,
    servicesList,
  ]);

  async function handleCreateAppointment() {
    if (!form.barberId || !form.service || !form.date || !form.time)
      return alert("Preencha todos os campos!");
    setSaving(true);

    const isencaoTag = `ADMIN: ${form.service}`;

    const { error } = await supabase.from("appointments").insert({
      client_id: profile?.id,
      barber_id: form.barberId,
      service: isencaoTag,
      date: form.date,
      time: form.time,
      status: "confirmed",
      price_applied: 0,
    });

    if (error) {
      alert("Erro ao agendar: " + error.message);
    } else {
      alert("Agendamento VIP realizado com sucesso!");
      setShowModal(false);
      setForm({ barberId: "", service: "", date: "", time: "" });
      const { data: newAppts } = await supabase
        .from("appointments")
        .select(
          "id, service, date, time, status, price_applied, barber_id, created_at, profiles(name), barbers(display_name)",
        )
        .gte("date", firstDayThisMonth)
        .lte("date", lastDayThisMonth)
        .order("date", { ascending: false })
        .order("time", { ascending: false });
      setAppointments((newAppts as any) || []);
    }
    setSaving(false);
  }

  function getActualPrice(appt: Appointment) {
    if (
      appt.service.startsWith("PLANO:") ||
      appt.service.startsWith("ADMIN:") ||
      appt.service.startsWith("BLOQUEIO")
    )
      return 0;

    if (appt.price_applied !== null && appt.price_applied !== undefined)
      return Number(appt.price_applied);

    let svcName = appt.service;
    if (svcName.startsWith("MANUAL:"))
      svcName = svcName.split(" - ")[1] || svcName;
    const svc = servicesList.find((s) => s.name === svcName);
    return svc ? svc.price : 0;
  }

  const activePlans = clientPlans.filter((p) => p.status === "active");
  const mrr = activePlans.reduce((sum, p) => sum + Number(p.price_paid), 0);

  const plansThisMonth = clientPlans.filter((p) => {
    const planDate = p.start_date
      ? p.start_date.split("T")[0]
      : p.created_at?.split("T")[0];
    return (
      planDate && planDate >= firstDayThisMonth && planDate <= lastDayThisMonth
    );
  });

  const revenuePlanosMes = plansThisMonth.reduce(
    (sum, p) => sum + Number(p.price_paid),
    0,
  );

  const salesThisMonth = productSales.filter((s) => {
    const saleDate = s.created_at.split("T")[0];
    return saleDate >= firstDayThisMonth && saleDate <= lastDayThisMonth;
  });
  const revenueProdutosMes = salesThisMonth.reduce(
    (sum, s) => sum + Number(s.total_price),
    0,
  );

  const projectedAppts = appointments.filter(
    (a) => a.status === "confirmed" || a.status === "completed",
  );
  const realizedAppts = projectedAppts.filter(
    (a) =>
      a.status === "completed" ||
      (a.status === "confirmed" && isPast(a.date, a.time)),
  );

  const validProjectedAppts = projectedAppts.filter(
    (a) => !a.service.startsWith("BLOQUEIO"),
  );
  const validRealizedAppts = realizedAppts.filter(
    (a) => !a.service.startsWith("BLOQUEIO"),
  );

  const revenueCadeirasRealizado = realizedAppts.reduce(
    (sum, a) => sum + getActualPrice(a),
    0,
  );
  const revenueCadeirasProjetado = projectedAppts.reduce(
    (sum, a) => sum + getActualPrice(a),
    0,
  );

  const totalRealizado =
    revenuePlanosMes + revenueProdutosMes + revenueCadeirasRealizado;
  const totalProjetado =
    revenuePlanosMes + revenueProdutosMes + revenueCadeirasProjetado;

  const barberStats = barbers.map((b) => {
    const bProjectedAppts = projectedAppts.filter((a) => a.barber_id === b.id);
    const bRealizedAppts = realizedAppts.filter((a) => a.barber_id === b.id);

    const bPlansThisMonth = plansThisMonth.filter((p) => p.barber_id === b.id);
    const bRevenuePlanosMes = bPlansThisMonth.reduce(
      (sum, p) => sum + Number(p.price_paid),
      0,
    );

    const bSalesThisMonth = salesThisMonth.filter((s) => s.barber_id === b.id);
    const bRevenueProdutosMes = bSalesThisMonth.reduce(
      (sum, s) => sum + Number(s.total_price),
      0,
    );

    const bRevProjetado = bProjectedAppts.reduce(
      (sum, a) => sum + getActualPrice(a),
      0,
    );
    const bRevRealizado = bRealizedAppts.reduce(
      (sum, a) => sum + getActualPrice(a),
      0,
    );

    const validBRealizedAppts = bRealizedAppts.filter(
      (a) => !a.service.startsWith("BLOQUEIO"),
    );
    const validBProjectedAppts = bProjectedAppts.filter(
      (a) => !a.service.startsWith("BLOQUEIO"),
    );

    return {
      ...b,
      countRealized: validBRealizedAppts.length,
      countProjected: validBProjectedAppts.length,
      revenueRealizado: bRevRealizado + bRevenuePlanosMes + bRevenueProdutosMes,
      revenueProjetado: bRevProjetado + bRevenuePlanosMes + bRevenueProdutosMes,
      appts: bProjectedAppts,
    };
  });

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.phone?.includes(searchUser),
  );

  function roleLabel(role: string) {
    if (role === "admin")
      return {
        label: "Admin",
        cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      };
    if (role === "barbers" || role === "barber")
      return {
        label: "Barbeiro",
        cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      };
    return {
      label: "Cliente",
      cls: "bg-zinc-800 text-zinc-400 border-zinc-700",
    };
  }

  async function changeRole(userId: string, newRole: string) {
    if (!confirm(`Deseja promover este usuário a ${newRole.toUpperCase()}?`))
      return;
    setLoading(true);
    try {
      const res = await fetch(`${window.location.origin}/api/update-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newRole }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
        );
        alert(`Sucesso! Agora o perfil é: ${newRole}`);
      } else {
        const result = await res.json();
        alert(`Erro no servidor: ${result.error || "Falha desconhecida"}`);
      }
    } catch (e) {
      alert("Erro ao conectar com a API.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetAction(
    type: "whatsapp_link" | "temporary_password",
  ) {
    if (!selectedUserForReset) return;
    setResetLoading(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserForReset.id,
          actionType: type,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (type === "whatsapp_link") {
        setResetResultLink(data.link);
      } else {
        setShowPassMessage(true);
      }
    } catch (error: any) {
      alert("Erro ao processar: " + error.message);
    } finally {
      setResetLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const SidebarItem = ({
    icon: Icon,
    label,
    id,
  }: {
    icon: any;
    label: string;
    id: any;
  }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setSelectedBarber(null);
        setIsMobileMenuOpen(false);
      }}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === id && !selectedBarber ? "bg-amber-400 text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white hover:bg-zinc-900"}`}
    >
      <Icon
        size={18}
        strokeWidth={activeTab === id && !selectedBarber ? 2.5 : 2}
      />{" "}
      {label}
    </button>
  );

  if (loading)
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
      </main>
    );

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row font-sans">
      <header className="md:hidden bg-zinc-900 border-b border-zinc-800 p-3 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-amber-400" size={20} />
          <span className="font-black italic text-base tracking-tight">
            Command Center
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="bg-amber-400 text-zinc-950 p-1.5 rounded-lg flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Plus size={18} strokeWidth={3} />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-zinc-400 hover:text-white transition-colors p-1"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <aside
        className={`${isMobileMenuOpen ? "flex" : "hidden"} md:flex flex-col w-full md:w-64 bg-zinc-950 border-r border-zinc-800 fixed md:sticky top-[61px] md:top-0 h-[calc(100vh-61px)] md:h-screen z-30 p-4`}
      >
        <div className="hidden md:flex items-center gap-2 px-2 py-4 mb-4 border-b border-zinc-800">
          <div className="bg-amber-400 p-2 rounded-xl text-zinc-950">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-black italic leading-none tracking-tight">
              Command Center
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
              Admin Level
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="hidden md:flex items-center justify-center gap-2 w-full px-4 py-3 mb-6 bg-amber-400 text-zinc-950 hover:bg-amber-300 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-[0_4px_15px_rgba(251,191,36,0.15)]"
        >
          <Plus size={16} strokeWidth={3} /> Agendamento VIP
        </button>

        <nav className="flex flex-col gap-1 flex-1">
          <SidebarItem
            icon={LayoutDashboard}
            label="Visão Geral"
            id="overview"
          />
          <SidebarItem icon={Users} label="A Sociedade" id="team" />
          <SidebarItem icon={Search} label="Usuários" id="users" />
          <SidebarItem icon={Activity} label="Auditoria" id="audit" />
        </nav>

        <div className="border-t border-zinc-800 pt-4 mt-auto flex flex-col gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold text-sm text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-all"
          >
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      <section className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto pb-12">
        {activeTab === "overview" && (
          <div className="flex flex-col gap-4 md:gap-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                Métricas Globais (Mês Atual)
              </h2>
              <p className="text-xs md:text-sm text-zinc-500 mt-1">
                A saúde financeira e operacional da barbearia (Realizado).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="bg-zinc-900 border border-zinc-800 p-4 md:p-6 rounded-2xl md:rounded-[1.5rem] relative overflow-hidden group shadow-lg">
                <TrendingUp className="absolute top-2 right-2 md:top-4 md:right-4 w-12 h-12 md:w-20 md:h-20 opacity-10 group-hover:opacity-20 transition-opacity" />
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 md:mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>{" "}
                  Faturamento Realizado
                </h3>
                <div className="text-2xl md:text-4xl font-black text-white">
                  R$ {totalRealizado.toFixed(2).replace(".", ",")}
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-zinc-800/60 flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Cadeiras Executadas:</span>{" "}
                    <span className="font-semibold text-white">
                      R$ {revenueCadeirasRealizado.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">
                      Planos e Produtos no Mês:
                    </span>{" "}
                    <span className="font-semibold text-emerald-400">
                      R${" "}
                      {(revenuePlanosMes + revenueProdutosMes)
                        .toFixed(2)
                        .replace(".", ",")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-4 md:p-6 rounded-2xl md:rounded-[1.5rem] relative overflow-hidden group shadow-lg">
                <LineChart className="absolute top-2 right-2 md:top-4 md:right-4 w-12 h-12 md:w-20 md:h-20 opacity-10 group-hover:opacity-20 transition-opacity" />
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 md:mb-2">
                  Previsão do Mês (Projetado)
                </h3>
                <div className="text-2xl md:text-4xl font-black text-amber-400">
                  R$ {totalProjetado.toFixed(2).replace(".", ",")}
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-zinc-800/60 flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">
                      Cadeiras Agendadas + Realizadas:
                    </span>{" "}
                    <span className="font-semibold text-amber-400">
                      R$ {revenueCadeirasProjetado.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">
                      Planos e Produtos no Mês:
                    </span>{" "}
                    <span className="font-semibold text-emerald-400">
                      R${" "}
                      {(revenuePlanosMes + revenueProdutosMes)
                        .toFixed(2)
                        .replace(".", ",")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-4 md:p-6 rounded-2xl md:rounded-[1.5rem] relative overflow-hidden group shadow-lg">
                <CreditCard className="absolute top-2 right-2 md:top-4 md:right-4 w-12 h-12 md:w-16 md:h-16 opacity-10 group-hover:opacity-20 transition-opacity" />
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 md:mb-2">
                  Receita Recorrente (MRR)
                </h3>
                <div className="text-2xl md:text-3xl font-black text-emerald-400">
                  R$ {mrr.toFixed(2).replace(".", ",")}
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-zinc-800/60 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    Planos Ativos e Saudáveis
                  </span>
                  <span className="text-xs font-bold text-white bg-zinc-800 px-2 py-0.5 md:py-1 rounded-md">
                    {activePlans.length}
                  </span>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-4 md:p-6 rounded-2xl md:rounded-[1.5rem] relative overflow-hidden group shadow-lg">
                <Scissors className="absolute top-2 right-2 md:top-4 md:right-4 w-12 h-12 md:w-16 md:h-16 opacity-10 group-hover:opacity-20 transition-opacity" />
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 md:mb-2">
                  Tráfego de Cadeiras
                </h3>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl md:text-3xl font-black text-white">
                    {validRealizedAppts.length}
                  </div>
                  <div className="text-[10px] md:text-sm text-zinc-500 font-bold uppercase">
                    / {validProjectedAppts.length} agendados
                  </div>
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-zinc-800/60 flex items-center justify-between text-[10px] md:text-xs text-zinc-500">
                  <span>Atendimentos Concluídos vs Previsão Mensal</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "team" && (
          <div className="flex flex-col gap-4 md:gap-6 animate-in slide-in-from-right-4 duration-300">
            {!selectedBarber ? (
              <>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                    A Sociedade
                  </h2>
                  <p className="text-xs md:text-sm text-zinc-500 mt-1">
                    Clique no card do barbeiro para ver o Raio-X exclusivo.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {barberStats.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBarber(b)}
                      className="bg-zinc-900 border border-zinc-800 p-4 md:p-5 rounded-2xl md:rounded-[1.5rem] flex flex-col gap-3 md:gap-4 hover:border-amber-400/50 hover:bg-zinc-800/50 transition-all text-left group shadow-lg"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-zinc-800 border border-amber-400/30 flex items-center justify-center text-amber-400 font-black text-base md:text-lg group-hover:scale-110 transition-transform">
                          {b.display_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-sm md:text-base text-white leading-tight">
                            {b.display_name}
                          </h4>
                          <span className="text-[9px] md:text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                            Sócio Oficial
                          </span>
                        </div>
                        <ChevronRight
                          size={18}
                          className="text-zinc-600 group-hover:text-amber-400 transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-2.5 md:p-3 rounded-xl md:rounded-2xl border border-zinc-800/50 w-full">
                        <div>
                          <span className="text-[8px] md:text-[9px] text-zinc-500 font-bold uppercase block mb-0.5 md:mb-1">
                            Realizado
                          </span>
                          <span className="text-xs md:text-sm font-black text-emerald-400">
                            R$ {b.revenueRealizado.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] md:text-[9px] text-zinc-500 font-bold uppercase block mb-0.5 md:mb-1">
                            Projetado
                          </span>
                          <span className="text-xs md:text-sm font-black text-amber-400">
                            R$ {b.revenueProjetado.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4 md:gap-6 animate-in slide-in-from-right-4 duration-300">
                <button
                  onClick={() => setSelectedBarber(null)}
                  className="flex items-center gap-2 text-zinc-400 hover:text-amber-400 transition-colors w-fit font-bold text-xs md:text-sm bg-zinc-900 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-zinc-800"
                >
                  <ArrowLeft size={16} /> Voltar
                </button>

                <div className="flex items-center gap-3 md:gap-4 border-b border-zinc-800 pb-3 md:pb-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-zinc-800 border border-amber-400/50 flex items-center justify-center text-amber-400 font-black text-xl md:text-2xl shadow-lg">
                    {selectedBarber.display_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black italic leading-tight">
                      {selectedBarber.display_name}
                    </h2>
                    <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mt-0.5 md:mt-1">
                      Raio-X de Desempenho (Mês)
                    </p>
                  </div>
                </div>

                {(() => {
                  const stats = barberStats.find(
                    (b) => b.id === selectedBarber.id,
                  );
                  const myPlans = activePlans.filter(
                    (p) => p.barber_id === selectedBarber.id,
                  );
                  const myMrr = myPlans.reduce(
                    (sum, p) => sum + Number(p.price_paid),
                    0,
                  );

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                        <div className="bg-zinc-900 border border-zinc-800 p-4 md:p-5 rounded-2xl md:rounded-[1.5rem] shadow-lg flex flex-col justify-between gap-3 md:gap-4">
                          <div>
                            <span className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                              Receita do Barbeiro
                            </span>
                            <div className="text-xl md:text-2xl font-black text-emerald-400">
                              R${" "}
                              {stats?.revenueRealizado
                                .toFixed(2)
                                .replace(".", ",")}
                            </div>
                          </div>
                          <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/50 flex justify-between items-center text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            <span>Previsão do mês:</span>
                            <span className="text-amber-400">
                              R${" "}
                              {stats?.revenueProjetado
                                .toFixed(2)
                                .replace(".", ",")}
                            </span>
                          </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 p-4 md:p-5 rounded-2xl md:rounded-[1.5rem] shadow-lg flex flex-col justify-between gap-3 md:gap-4">
                          <div>
                            <span className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                              MRR (Assinaturas Dele)
                            </span>
                            <div className="text-xl md:text-2xl font-black text-emerald-400">
                              R$ {myMrr.toFixed(2).replace(".", ",")}
                            </div>
                          </div>
                          <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/50 flex justify-between items-center text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            <span>Planos Ativos:</span>
                            <span className="text-white">{myPlans.length}</span>
                          </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 p-4 md:p-5 rounded-2xl md:rounded-[1.5rem] shadow-lg flex flex-col justify-between gap-3 md:gap-4">
                          <div>
                            <span className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                              Tráfego de Clientes
                            </span>
                            <div className="text-xl md:text-2xl font-black text-white">
                              {stats?.countRealized}
                            </div>
                          </div>
                          <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/50 flex justify-between items-center text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            <span>Previsão de Atendimentos:</span>
                            <span className="text-white">
                              {stats?.countProjected}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 md:mt-4">
                        <h3 className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 md:mb-3">
                          Agenda Completa (Realizado e Projetado)
                        </h3>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl md:rounded-3xl p-4 md:p-6 max-h-[400px] md:max-h-[500px] overflow-y-auto custom-scrollbar">
                          <div className="relative border-l border-zinc-800 ml-2 md:ml-4 pl-4 md:pl-6 flex flex-col gap-4 md:gap-6">
                            {stats?.appts.map((a) => {
                              const passed = isPast(a.date, a.time);
                              const isRealized =
                                a.status === "completed" || passed;
                              return (
                                <div
                                  key={a.id}
                                  className={`relative ${!isRealized ? "opacity-50" : ""}`}
                                >
                                  <div
                                    className={`absolute -left-[21px] md:-left-[31px] border-4 border-zinc-900 w-3 h-3 md:w-4 md:h-4 rounded-full mt-1 ${isRealized ? "bg-emerald-500" : "bg-amber-400"}`}
                                  ></div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center justify-between gap-2 md:gap-4">
                                      <div className="flex items-center gap-1.5 md:gap-2">
                                        <span
                                          className={`text-[10px] md:text-xs font-bold ${isRealized ? "text-zinc-300" : "text-amber-400"}`}
                                        >
                                          {a.date
                                            .split("-")
                                            .reverse()
                                            .slice(0, 2)
                                            .join("/")}{" "}
                                          às {a.time}
                                        </span>
                                        <span className="text-[8px] md:text-[10px] font-bold text-white uppercase px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                                          {a.service}
                                        </span>
                                        {!isRealized && (
                                          <span className="text-[8px] md:text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400">
                                            A fazer
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className={`text-[10px] md:text-xs font-black ${isRealized ? "text-emerald-400" : "text-zinc-500"}`}
                                      >
                                        R${" "}
                                        {getActualPrice(a)
                                          .toFixed(2)
                                          .replace(".", ",")}
                                      </span>
                                    </div>
                                    <span className="text-xs md:text-sm font-semibold text-zinc-300 mt-1">
                                      {(a.profiles as any)?.name ||
                                        "Cliente Fantasma"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            {stats?.appts.length === 0 && (
                              <div className="text-zinc-500 italic text-xs md:text-sm py-2 md:py-4">
                                Nenhum atendimento no período.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div className="flex flex-col gap-4 md:gap-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                  Controle de Acessos
                </h2>
                <p className="text-xs md:text-sm text-zinc-500 mt-1">
                  Pesquise, edite e promova perfis.
                </p>
              </div>
              <div className="relative w-full md:w-72">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Buscar nome ou telefone..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto shadow-lg">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider text-[9px] md:text-[10px]">
                  <tr>
                    <th className="px-4 md:px-6 py-3 md:py-4">Usuário</th>
                    <th className="px-4 md:px-6 py-3 md:py-4">Contato</th>
                    <th className="px-4 md:px-6 py-3 md:py-4">Status / Role</th>
                    <th className="px-4 md:px-6 py-3 md:py-4 text-right">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredUsers.map((u) => {
                    const { label, cls } = roleLabel(u.role);
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="font-bold text-white text-xs md:text-sm flex items-center gap-2">
                            {u.name}
                            {u.is_ghost && (
                              <span className="bg-zinc-800 border border-zinc-700 text-[8px] md:text-[9px] px-1.5 py-0.5 rounded text-zinc-400 uppercase">
                                Balcão
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] md:text-[10px] text-zinc-500 mt-0.5">
                            Criado em{" "}
                            {u.created_at
                              .split("T")[0]
                              .split("-")
                              .reverse()
                              .join("/")}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-zinc-400 font-mono text-[10px] md:text-xs">
                          {u.phone || "---"}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <span
                            className={`text-[9px] md:text-[10px] px-1.5 md:px-2 py-0.5 md:py-1 rounded-md font-bold uppercase tracking-wider border ${cls}`}
                          >
                            {label}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-right flex items-center justify-end gap-2">
                          {u.role !== "admin" && (
                            <select
                              value={u.role}
                              onChange={(e) => changeRole(u.id, e.target.value)}
                              className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 md:py-1.5 text-[10px] md:text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                            >
                              <option value="client">Manter Cliente</option>
                              <option value="barbers">
                                Promover a Barbeiro
                              </option>
                              <option value="admin">Promover a Admin</option>
                            </select>
                          )}
                          <button
                            onClick={() => {
                              setSelectedUserForReset(u);
                              setResetResultLink("");
                              setShowPassMessage(false);
                              setShowResetModal(true);
                            }}
                            className="bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20 px-2 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-colors"
                          >
                            Reset Senha
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 md:px-6 py-6 md:py-8 text-center text-zinc-500 italic text-xs md:text-sm"
                      >
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="flex flex-col gap-4 md:gap-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                Log de Auditoria
              </h2>
              <p className="text-xs md:text-sm text-zinc-500 mt-1">
                Timeline de movimentação da agenda (Mês Atual).
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-lg">
              <div className="relative border-l border-zinc-800 ml-2 md:ml-4 pl-4 md:pl-6 flex flex-col gap-6 md:gap-8">
                {appointments.slice(0, 50).map((a, i) => (
                  <div key={a.id} className="relative">
                    <div className="absolute -left-[21px] md:-left-[31px] bg-zinc-800 border-4 border-zinc-900 w-3 h-3 md:w-4 md:h-4 rounded-full mt-1.5"></div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] md:text-xs font-bold text-amber-400">
                          {a.date.split("-").reverse().slice(0, 2).join("/")} às{" "}
                          {a.time}
                        </span>
                        <span className="text-[8px] md:text-[10px] text-zinc-500 font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                          Ref: {a.id.split("-")[0]}
                        </span>
                      </div>
                      <div className="text-xs md:text-sm text-zinc-300">
                        <span className="font-bold text-white">
                          {(a.profiles as any)?.name || "Balcão (Fantasma)"}
                        </span>{" "}
                        agendado com{" "}
                        <span className="font-bold text-white">
                          {(a.barbers as any)?.display_name}
                        </span>
                        .
                      </div>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-[8px] md:text-[10px] font-bold text-white bg-zinc-800 border border-zinc-700 px-1.5 md:px-2 py-0.5 rounded">
                          {a.service}
                        </span>
                        <span
                          className={`text-[8px] md:text-[10px] font-bold uppercase px-1.5 md:px-2 py-0.5 rounded ${a.status === "confirmed" || a.status === "completed" ? "text-emerald-400 bg-emerald-400/10" : a.status === "canceled" ? "text-red-400 bg-red-400/10" : "text-orange-400 bg-orange-400/10"}`}
                        >
                          {a.status}
                        </span>
                        <span className="text-[8px] md:text-[10px] font-bold text-zinc-400 border border-zinc-700 bg-zinc-950 px-1.5 md:px-2 py-0.5 rounded">
                          R$ {getActualPrice(a).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 p-5 md:p-6 rounded-2xl md:rounded-3xl w-full max-w-md flex flex-col gap-4 md:gap-5 shadow-2xl">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-amber-400" size={22} /> Agendamento
                VIP
              </h2>
              <p className="text-[10px] md:text-xs text-amber-400/80 font-bold mt-1 uppercase tracking-wider">
                Isento de cobrança no caixa
              </p>
            </div>

            <div className="flex flex-col gap-3 md:gap-4">
              <select
                className="bg-zinc-800 border border-zinc-700 p-3 md:p-3.5 rounded-xl outline-none text-xs md:text-sm font-bold text-white focus:border-amber-400"
                value={form.barberId}
                onChange={(e) => setForm({ ...form, barberId: e.target.value })}
              >
                <option value="">Selecionar Barbeiro</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.display_name}
                  </option>
                ))}
              </select>

              <select
                className="bg-zinc-800 border border-zinc-700 p-3 md:p-3.5 rounded-xl outline-none text-xs md:text-sm text-white focus:border-amber-400"
                value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value })}
              >
                <option value="">Selecionar Serviço</option>
                {servicesList
                  .filter((s) => !s.name.toLowerCase().includes("plano"))
                  .map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} (Tabela: R${s.price})
                    </option>
                  ))}
              </select>

              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <input
                  type="date"
                  className="bg-zinc-800 border border-zinc-700 p-3 md:p-3.5 rounded-xl outline-none text-xs md:text-sm text-white [color-scheme:dark] focus:border-amber-400"
                  value={form.date}
                  min={todayStr}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />

                <select
                  className="bg-zinc-800 border border-zinc-700 p-3 md:p-3.5 rounded-xl outline-none text-xs md:text-sm text-white focus:border-amber-400"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                >
                  <option value="">Horário</option>
                  {HOURS.filter((h) => !admTakenSlots.includes(h)).map(
                    (h: string) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className="flex gap-2 md:gap-3 mt-1 md:mt-2 border-t border-zinc-800 pt-3 md:pt-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 md:py-3.5 text-zinc-400 font-bold text-xs md:text-sm hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateAppointment}
                disabled={saving}
                className="flex-1 bg-amber-400 text-zinc-950 py-3 md:py-3.5 rounded-xl font-black uppercase text-[10px] md:text-xs tracking-wider hover:bg-amber-300 transition-colors disabled:opacity-50 shadow-lg shadow-amber-400/20"
              >
                {saving ? "Injetando..." : "Confirmar Agenda"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetModal && selectedUserForReset && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5 shadow-2xl">
            <div>
              <h3 className="font-bold text-lg md:text-xl text-white flex items-center gap-2">
                <ShieldCheck className="text-amber-400" size={22} /> Suporte de
                Acesso
              </h3>
              <p className="text-[10px] md:text-xs text-zinc-400 mt-1">
                Ação para o cliente:{" "}
                <span className="text-white font-bold">
                  {selectedUserForReset.name}
                </span>
              </p>
            </div>

            {!resetResultLink && !showPassMessage ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleResetAction("whatsapp_link")}
                  disabled={resetLoading}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white font-bold py-3 md:py-3.5 rounded-xl text-xs md:text-sm hover:border-amber-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {resetLoading ? "Gerando..." : "💬 Gerar Link para WhatsApp"}
                </button>
                <button
                  onClick={() => handleResetAction("temporary_password")}
                  disabled={resetLoading}
                  className="w-full bg-zinc-800 border border-zinc-700 text-amber-400 font-bold py-3 md:py-3.5 rounded-xl text-xs md:text-sm hover:border-amber-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {resetLoading
                    ? "Processando..."
                    : "🔑 Forçar Senha (Mudar@123)"}
                </button>
              </div>
            ) : resetResultLink ? (
              <div className="flex flex-col gap-3 text-center">
                <p className="text-emerald-400 font-bold text-xs">
                  Link gerado com sucesso!
                </p>
                <a
                  href={`https://wa.me/${selectedUserForReset.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${selectedUserForReset.name.split(" ")[0]}! Segue o seu link de acesso rápido para atualizar a sua senha: ${resetResultLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-500 text-zinc-950 font-black py-3 rounded-xl text-center text-xs uppercase tracking-wider hover:bg-emerald-400 transition-colors"
                >
                  Enviar via WhatsApp
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-center">
                <p className="text-emerald-400 font-bold text-xs">
                  Senha alterada no banco!
                </p>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 font-mono font-black text-amber-400 text-lg tracking-widest">
                  Mudar@123
                </div>
                <p className="text-[10px] text-zinc-500">
                  Avise o cliente. Ele será obrigado a trocar a senha ao fazer o
                  login.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setShowResetModal(false);
                setSelectedUserForReset(null);
              }}
              className="text-zinc-500 hover:text-white text-xs font-bold pt-3 border-t border-zinc-800/60 mt-1"
            >
              Fechar Janela
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
