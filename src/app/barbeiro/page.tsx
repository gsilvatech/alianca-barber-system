"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DailyWord from "@/components/DailyWord";
import { HOURS } from "@/lib/constant";
import {
  Home,
  Calendar,
  DollarSign,
  Users,
  PlusCircle,
  LogOut,
  Trash2,
  Edit2,
  XCircle,
  Briefcase,
  ChevronLeft,
  Package,
  MinusCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  CreditCard,
  UserPlus,
  BarChart3,
  Scissors,
  CheckCircle2,
} from "lucide-react";

// --- HELPER DE DATA LOCAL (CORRIGE O FUSO HORÁRIO DO BRASIL) ---
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

const getNextWeekDate = (dateStr: string, weeksToAdd: number) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 7 * weeksToAdd);
  return getLocalDateStr(date);
};

// Agrupa bloqueios consecutivos do mesmo motivo em um único item para facilitar a visualização
function groupAppointments(appts: any[]) {
  const grouped: any[] = [];
  let currentGroup: any = null;

  appts.forEach((appt) => {
    const isBlock = appt.service?.startsWith("BLOQUEIO");

    if (isBlock) {
      if (!currentGroup) {
        // Inicia um novo grupo
        currentGroup = {
          ...appt,
          isGroupedBlock: true,
          blockIds: [appt.id],
          endTime: appt.time,
        };
      } else if (
        currentGroup.date === appt.date &&
        currentGroup.service === appt.service
      ) {
        // É o mesmo dia e o mesmo motivo? Agrupa!
        currentGroup.blockIds.push(appt.id);
        currentGroup.endTime = appt.time; // Atualiza o fim para o último horário
      } else {
        // Mudou o dia ou o motivo, fecha o grupo atual e inicia outro
        grouped.push(currentGroup);
        currentGroup = {
          ...appt,
          isGroupedBlock: true,
          blockIds: [appt.id],
          endTime: appt.time,
        };
      }
    } else {
      // Se for cliente normal, fecha o grupo de bloqueio (se houver) e joga na lista normal
      if (currentGroup) {
        grouped.push(currentGroup);
        currentGroup = null;
      }
      grouped.push(appt);
    }
  });

  if (currentGroup) grouped.push(currentGroup);
  return grouped;
}

function renderGrowth(current: number, past: number) {
  if (past === 0 && current === 0) return null;
  const pct = past === 0 ? 100 : ((current - past) / past) * 100;
  const isPositive = pct >= 0;
  return (
    <div
      className={`flex items-center gap-1 text-[9px] font-bold w-fit px-1.5 py-0.5 rounded-md ${isPositive ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}
    >
      {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {isPositive ? "+" : ""}
      {pct.toFixed(0)}%
    </div>
  );
}

type Appointment = {
  id: string;
  client_id: string;
  client_plan_id?: string;
  service: string;
  date: string;
  time: string;
  status: string;
  price_applied?: number;
  profiles: { name: string; phone: string };
};
type Product = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
};
type BarberService = {
  id: string;
  name: string;
  price: number;
  duration: number;
};
type BarberGoal = {
  id: string;
  title: string;
  target_value: number;
  is_completed: boolean;
  created_at: string;
};

export default function BarbeiroPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<{ name: string; id: string } | null>(
    null,
  );

  const [barberId, setBarberId] = useState<string | null>(null);
  const [today, setToday] = useState<Appointment[]>([]);
  const [week, setWeek] = useState<Appointment[]>([]);
  const [blockedDates, setBlockedDates] = useState<
    { id: string; date: string; reason: string }[]
  >([]);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [loadingBlock, setLoadingBlock] = useState(false);
  const [tab, setTab] = useState<"semana" | "mes">("semana");

  const [isFullDay, setIsFullDay] = useState(true);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    "home" | "agenda" | "financeiro" | "gestao" | "novo"
  >("home");

  const [chartView, setChartView] = useState<"diario" | "mensal" | "anual">(
    "diario",
  );
  const [chartViewGlobal, setChartViewGlobal] = useState<
    "diario" | "mensal" | "anual"
  >("diario");

  const todayStr = getLocalDateStr();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = getLocalDateStr(weekEnd);
  const monthEnd = new Date();
  monthEnd.setDate(monthEnd.getDate() + 30);
  const monthEndStr = getLocalDateStr(monthEnd);
  const [manualActivePlan, setManualActivePlan] = useState<any>(null);
  const [manualClientId, setManualClientId] = useState("AVULSO");
  const [manualCustomer, setManualCustomer] = useState("");
  const [manualService, setManualService] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualDate, setManualDate] = useState(todayStr);
  const [manualTime, setManualTime] = useState("");
  const [usePlan, setUsePlan] = useState(false);

  const [isVipDiscount, setIsVipDiscount] = useState(false);
  const [vipPrice, setVipPrice] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [manualTakenSlots, setManualTakenSlots] = useState<string[]>([]);

  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editTakenSlots, setEditTakenSlots] = useState<string[]>([]);

  const [gestaoView, setGestaoView] = useState<
    "menu" | "estoque" | "crm" | "servicos"
  >("menu");
  const [products, setProducts] = useState<Product[]>([]);
  const [estoqueTab, setEstoqueTab] = useState<"barbearia" | "geladeira">(
    "barbearia",
  );
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [productCategory, setProductCategory] = useState<
    "barbearia" | "geladeira"
  >("barbearia");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
  const [editProductId, setEditProductId] = useState("");
  const [editProductName, setEditProductName] = useState("");
  const [editProductPrice, setEditProductPrice] = useState("");
  const [editProductQuantity, setEditProductQuantity] = useState("");
  const [editProductCategory, setEditProductCategory] = useState<
    "barbearia" | "geladeira"
  >("barbearia");
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [sellProductId, setSellProductId] = useState("");
  const [sellQuantity, setSellQuantity] = useState(1);
  const [isSelling, setIsSelling] = useState(false);
  const [servicesList, setServicesList] = useState<BarberService[]>([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isEditServiceModalOpen, setIsEditServiceModalOpen] = useState(false);
  const [svcName, setSvcName] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcDuration, setSvcDuration] = useState("");
  const [svcId, setSvcId] = useState("");
  const [isSavingSvc, setIsSavingSvc] = useState(false);

  const [goals, setGoals] = useState<BarberGoal[]>([]);

  const [finances, setFinances] = useState({
    hoje: 0,
    ontem: 0,
    mesAtual: 0,
    mesPassado: 0,
    total: 0,
    clientesHoje: 0,
    clientesMesAtual: 0,
    clientesMesPassado: 0,
    globalHoje: 0,
    globalOntem: 0,
    globalMesAtual: 0,
    globalMesPassado: 0,
    globalClientesHoje: 0,
    globalClientesMesAtual: 0,
    globalClientesMesPassado: 0,
    globalServicosMesAtual: 0,
    globalProdutosMesAtual: 0,
    chartDiario: [] as any[],
    chartMensal: [] as any[],
    chartAnual: [] as any[],
    maxGenDiario: 1,
    maxGenMensal: 1,
    maxGenAnual: 1,
    maxIndDiario: 1,
    maxIndMensal: 1,
    maxIndAnual: 1,
  });

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  // --- CRM ESTADOS ---
  const [crmTab, setCrmTab] = useState<"assinaturas" | "clientes">(
    "assinaturas",
  );
  const [clientPlans, setClientPlans] = useState<any[]>([]);
  const [crmClients, setCrmClients] = useState<any[]>([]);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  // NOVA LINHA: Estado para a busca de clientes
  const [clientSearch, setClientSearch] = useState("");

  // NOVA FUNÇÃO: Excluir Cliente (Forçado via RPC)
  async function handleDeleteClient(clientId: string, clientName: string) {
    if (
      !confirm(
        `Tem certeza que deseja excluir o cliente "${clientName}"? Essa ação apagará também os agendamentos amarrados a este perfil e não pode ser desfeita.`,
      )
    )
      return;

    // Dispara a função no banco de dados que quebra a trava de segurança e limpa tudo
    const { error } = await supabase.rpc("force_delete_client", {
      target_client_id: clientId,
    });

    if (error) {
      alert("Erro ao tentar excluir a conta. Tente novamente.");
      console.error(error);
    } else {
      alert("Conta excluída e CRM limpo com sucesso! 🧹");
      loadCRMData(); // Recarrega a lista instantaneamente
    }
  }

  // --- ESTADOS DE RECORRÊNCIA (MÓDULO VIP E BLOQUEIOS) ---
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState("4"); // Padrão: 1 mês (4 semanas)

  // Vender Plano
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planClientId, setPlanClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planCuts, setPlanCuts] = useState("4");
  const [planStartDate, setPlanStartDate] = useState(todayStr);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isMigratedPlan, setIsMigratedPlan] = useState(false);
  const [migratedCutsUsed, setMigratedCutsUsed] = useState("0");
  const [absorbTodayCut, setAbsorbTodayCut] = useState(false);
  const [appointmentToAbsorb, setAppointmentToAbsorb] = useState("");
  const [isSavingGhost, setIsSavingGhost] = useState(false);

  // Editar Plano
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [editPlanId, setEditPlanId] = useState("");
  const [editPlanCutsUsed, setEditPlanCutsUsed] = useState("");
  const [editPlanCutsAllowed, setEditPlanCutsAllowed] = useState("");
  const [editPlanPrice, setEditPlanPrice] = useState("");
  const [editPlanStartDate, setEditPlanStartDate] = useState(todayStr);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

  // Renovar Plano
  const [isRenewPlanModalOpen, setIsRenewPlanModalOpen] = useState(false);
  const [renewPlanData, setRenewPlanData] = useState<any>(null);
  const [renewPlanPrice, setRenewPlanPrice] = useState("");
  const [renewPlanCuts, setRenewPlanCuts] = useState("");
  const [renewStartDate, setRenewStartDate] = useState(todayStr);
  const [isRenewingPlan, setIsRenewingPlan] = useState(false);
  const [renewPlanName, setRenewPlanName] = useState("");

  async function loadAppts() {
    if (!barberId) return;
    let endDate = tab === "semana" ? weekEndStr : monthEndStr;
    const [{ data: todayAppts }, { data: weekAppts }, { data: blocked }] =
      await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, client_id, client_plan_id, service, date, time, status, profiles(name, phone)",
          )
          .eq("barber_id", barberId)
          .eq("date", todayStr)
          .in("status", ["confirmed", "canceled", "no-show"])
          .order("time"),
        supabase
          .from("appointments")
          .select(
            "id, client_id, client_plan_id, service, date, time, status, profiles(name, phone)",
          )
          .eq("barber_id", barberId)
          .gte("date", todayStr)
          .lte("date", endDate)
          .in("status", ["confirmed"])
          .order("date")
          .order("time"),
        supabase
          .from("blocked_dates")
          .select("id, date, reason")
          .eq("barber_id", barberId)
          .gte("date", todayStr)
          .order("date"),
      ]);
    setToday((todayAppts as any) || []);
    setWeek((weekAppts as any) || []);
    setBlockedDates(blocked || []);
  }

  async function loadFinancesAndGoals() {
    if (!barberId) return;
    const { data: gData } = await supabase
      .from("barber_goals")
      .select("*")
      .eq("barber_id", barberId)
      .order("created_at", { ascending: false });
    setGoals(gData || []);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();

    const firstDayThisMonth = getLocalDateStr(
      new Date(currentYear, currentMonthIdx, 1),
    );
    const firstDayLastMonth = getLocalDateStr(
      new Date(currentYear, currentMonthIdx - 1, 1),
    );
    const lastDayLastMonth = getLocalDateStr(
      new Date(currentYear, currentMonthIdx, 0),
    );
    const today = getLocalDateStr(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yesterdayDate);

    const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return getLocalDateStr(d);
    });
    const last5Years = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

    let chartDiario = last7DaysDates.map((d) => ({
      name: d.split("-").reverse().slice(0, 2).join("/"),
      date: d,
      ind: 0,
      gen: 0,
      indClients: 0,
      genClients: 0,
    }));
    let chartMensal = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ].map((m) => ({ name: m, ind: 0, gen: 0, indClients: 0, genClients: 0 }));
    let chartAnual = last5Years.map((y) => ({
      name: String(y),
      year: y,
      ind: 0,
      gen: 0,
      indClients: 0,
      genClients: 0,
    }));

    // Buscando todos os planos (incluindo expired) para garantir a integridade do caixa histórico
    const { data: allPlans } = await supabase
      .from("client_plans")
      .select("price_paid, created_at, start_date, barber_id");
    const { data: allAppts } = await supabase
      .from("appointments")
      .select("price_applied, date, time, barber_id, status, service")
      .in("status", ["confirmed", "completed"]);
    const { data: allProductSales } = await supabase
      .from("product_sales")
      .select("total_price, created_at, barber_id");
    const { data: allServices } = await supabase
      .from("services")
      .select("name, price");

    let hoje = 0,
      ontem = 0,
      mesAtual = 0,
      mesPassado = 0,
      total = 0,
      clientesHoje = 0,
      clientesMesAtual = 0,
      clientesMesPassado = 0;
    let globalHoje = 0,
      globalOntem = 0,
      globalMesAtual = 0,
      globalMesPassado = 0,
      globalClientesHoje = 0,
      globalClientesMesAtual = 0,
      globalClientesMesPassado = 0;
    let globalServicosMesAtual = 0,
      globalProdutosMesAtual = 0;

    const processItem = (
      val: number,
      dateStr: string,
      isBlock: boolean,
      isProduct: boolean,
      itemBarberId: string,
    ) => {
      const [ay, am, ad] = dateStr.split("-");
      const aYear = parseInt(ay);
      const aMonthIdx = parseInt(am) - 1;

      const dayMatch = chartDiario.find((d) => d.date === dateStr);
      if (dayMatch) {
        dayMatch.gen += val;
        if (!isBlock && !isProduct) dayMatch.genClients += 1;
        if (itemBarberId === barberId) {
          dayMatch.ind += val;
          if (!isBlock && !isProduct) dayMatch.indClients += 1;
        }
      }

      if (aYear === currentYear) {
        chartMensal[aMonthIdx].gen += val;
        if (!isBlock && !isProduct) chartMensal[aMonthIdx].genClients += 1;
        if (itemBarberId === barberId) {
          chartMensal[aMonthIdx].ind += val;
          if (!isBlock && !isProduct) chartMensal[aMonthIdx].indClients += 1;
        }
      }

      const yearMatch = chartAnual.find((y) => y.year === aYear);
      if (yearMatch) {
        yearMatch.gen += val;
        if (!isBlock && !isProduct) yearMatch.genClients += 1;
        if (itemBarberId === barberId) {
          yearMatch.ind += val;
          if (!isBlock && !isProduct) yearMatch.indClients += 1;
        }
      }

      if (itemBarberId === barberId) {
        total += val;
        if (dateStr === today) {
          hoje += val;
          if (!isBlock && !isProduct) clientesHoje++;
        }
        if (dateStr === yesterdayStr) {
          ontem += val;
        }
        if (dateStr >= firstDayThisMonth && dateStr <= today) {
          mesAtual += val;
          if (!isBlock && !isProduct) clientesMesAtual++;
        }
        if (dateStr >= firstDayLastMonth && dateStr <= lastDayLastMonth) {
          mesPassado += val;
          if (!isBlock && !isProduct) clientesMesPassado++;
        }
      }

      if (dateStr === today) {
        globalHoje += val;
        if (!isBlock && !isProduct) globalClientesHoje++;
      }
      if (dateStr === yesterdayStr) {
        globalOntem += val;
      }
      if (dateStr >= firstDayThisMonth && dateStr <= today) {
        globalMesAtual += val;
        if (!isBlock && !isProduct) globalClientesMesAtual++;
        if (isProduct) globalProdutosMesAtual += val;
      }
      if (dateStr >= firstDayLastMonth && dateStr <= lastDayLastMonth) {
        globalMesPassado += val;
        if (!isBlock && !isProduct) globalClientesMesPassado++;
      }
    };

    if (allPlans) {
      allPlans.forEach((p) => {
        const planDate = p.start_date
          ? p.start_date.split("T")[0]
          : p.created_at.split("T")[0];
        processItem(Number(p.price_paid), planDate, false, false, p.barber_id);
      });
    }

    if (allProductSales) {
      allProductSales.forEach((s) => {
        processItem(
          Number(s.total_price || 0),
          s.created_at.split("T")[0],
          false,
          true,
          s.barber_id,
        );
      });
    }

    if (allAppts) {
      allAppts.forEach((a) => {
        const isBlock = a.service.startsWith("BLOQUEIO");
        const isPlano = a.service.startsWith("PLANO:");
        const isAdmin = a.service.startsWith("ADMIN:");
        const timeHasPassed = isPast(a.date, a.time);
        const shouldCountRevenue =
          a.status === "completed" ||
          (a.status === "confirmed" && timeHasPassed);

        let val = 0;
        if (!isBlock && !isPlano && !isAdmin) {
          if (a.price_applied !== null && a.price_applied > 0) {
            val = Number(a.price_applied);
          } else {
            let svcName = a.service;
            if (svcName.startsWith("MANUAL:"))
              svcName = svcName.split(" - ")[1] || svcName;
            const svc = (allServices || []).find((s) => s.name === svcName);
            val = svc ? svc.price : 0;
          }
        }
        if (shouldCountRevenue) {
          processItem(val, a.date, isBlock, false, a.barber_id);
        }
      });
    }

    globalServicosMesAtual = globalMesAtual - globalProdutosMesAtual;
    setFinances({
      hoje,
      ontem,
      mesAtual,
      mesPassado,
      total,
      clientesHoje,
      clientesMesAtual,
      clientesMesPassado,
      globalHoje,
      globalOntem,
      globalMesAtual,
      globalMesPassado,
      globalClientesHoje,
      globalClientesMesAtual,
      globalClientesMesPassado,
      globalServicosMesAtual,
      globalProdutosMesAtual,
      chartDiario,
      chartMensal,
      chartAnual,
      maxGenDiario: Math.max(...chartDiario.map((d) => d.gen), 1),
      maxGenMensal: Math.max(...chartMensal.map((d) => d.gen), 1),
      maxGenAnual: Math.max(...chartAnual.map((d) => d.gen), 1),
      maxIndDiario: Math.max(...chartDiario.map((d) => d.ind), 1),
      maxIndMensal: Math.max(...chartMensal.map((d) => d.ind), 1),
      maxIndAnual: Math.max(...chartAnual.map((d) => d.ind), 1),
    });
  }

  async function loadCRMData() {
    if (!barberId) return;
    const { data: plans } = await supabase
      .from("client_plans")
      .select("*, profiles(name, phone)")
      .eq("barber_id", barberId)
      .order("created_at", { ascending: false });
    setClientPlans(plans || []);
    const { data: clientsData } = await supabase
      .from("profiles")
      .select("id, name, phone, birth_date, is_ghost")
      .in("role", ["client", "cliente"])
      .order("name");
    setCrmClients(clientsData || []);
  }

  async function loadProducts() {
    if (!barberId) return;
    const { data } = await supabase.from("products").select("*").order("name");
    setProducts(data || []);
  }
  async function loadServicesFromDB() {
    if (!barberId) return;
    const { data } = await supabase.from("services").select("*").order("name");
    setServicesList(data || []);
  }

  useEffect(() => {
    async function loadInitial() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", user.id)
        .single();
      if (
        prof?.role !== "barbers" &&
        prof?.role !== "barber" &&
        prof?.role !== "admin"
      )
        return router.push("/cliente");
      setProfile({ ...prof, id: user.id });
      const { data: barber } = await supabase
        .from("barbers")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (barber) setBarberId(barber.id);
    }
    loadInitial();
  }, []);

  useEffect(() => {
    if (barberId) {
      loadAppts();
      loadProducts();
      loadServicesFromDB();
      loadFinancesAndGoals();
      loadCRMData();
      const interval = setInterval(() => {
        loadAppts();
        loadFinancesAndGoals();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [barberId, tab]);

  useEffect(() => {
    if (
      !barberId ||
      !editDate ||
      !editingAppointment ||
      servicesList.length === 0
    )
      return;
    async function loadEditSlots() {
      const { data } = await supabase
        .from("appointments")
        .select("time, service")
        .eq("barber_id", barberId)
        .eq("date", editDate)
        .eq("status", "confirmed");
      const existingAppts = data || [];
      const blocked: string[] = [];
      let actualServiceName = editingAppointment!.service;
      if (actualServiceName.startsWith("MANUAL:"))
        actualServiceName = actualServiceName.split(" - ")[1] || "Corte";
      const selectedSvc = servicesList.find(
        (s) => s.name === actualServiceName,
      );
      const duration = selectedSvc?.duration || 30;
      HOURS.forEach((slot) => {
        const slotStart = timeToMinutes(slot);
        const slotEnd = slotStart + duration;
        if (
          editDate === editingAppointment!.date &&
          slot === editingAppointment!.time
        )
          return;
        const hasConflict = existingAppts.some((appt: any) => {
          if (
            appt.time === editingAppointment!.time &&
            editDate === editingAppointment!.date
          )
            return false;
          const apptStart = timeToMinutes(appt.time);
          let apptSvcName = appt.service;
          if (apptSvcName.startsWith("MANUAL:"))
            apptSvcName = apptSvcName.split(" - ")[1] || "Corte";
          const apptSvc = servicesList.find((s) => s.name === apptSvcName);
          const apptDuration = apptSvc?.duration || 30;
          const apptEnd = apptStart + apptDuration;
          return slotStart < apptEnd && slotEnd > apptStart;
        });
        if (hasConflict) blocked.push(slot);
      });
      setEditTakenSlots(blocked);
    }
    loadEditSlots();
  }, [barberId, editDate, editingAppointment, servicesList]);

  useEffect(() => {
    if (
      !barberId ||
      !manualDate ||
      !manualService ||
      servicesList.length === 0
    ) {
      setManualTakenSlots([]);
      return;
    }
    async function loadManualSlots() {
      const { data } = await supabase
        .from("appointments")
        .select("time, service")
        .eq("barber_id", barberId)
        .eq("date", manualDate)
        .eq("status", "confirmed");
      const existingAppts = data || [];
      const blocked: string[] = [];
      const selectedSvc = servicesList.find((s) => s.name === manualService);
      const duration = selectedSvc?.duration || 30;
      HOURS.forEach((slot) => {
        const slotStart = timeToMinutes(slot);
        const slotEnd = slotStart + duration;
        const hasConflict = existingAppts.some((appt: any) => {
          const apptStart = timeToMinutes(appt.time);
          let apptSvcName = appt.service;
          if (apptSvcName.startsWith("MANUAL:"))
            apptSvcName = apptSvcName.split(" - ")[1] || "Corte";
          const apptSvc = servicesList.find((s) => s.name === apptSvcName);
          const apptDuration = apptSvc?.duration || 30;
          const apptEnd = apptStart + apptDuration;
          return slotStart < apptEnd && slotEnd > apptStart;
        });
        if (hasConflict) blocked.push(slot);
      });
      setManualTakenSlots(blocked);
    }
    loadManualSlots();
  }, [barberId, manualDate, manualService, servicesList]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  async function handleSmartBlock() {
    if (!newBlockDate || !barberId) return;
    setLoadingBlock(true);

    // 1. Verifica se vai repetir. Se o checkbox estiver marcado, usa o número de semanas. Senão, faz só 1 vez (o padrão atual).
    const loops = isRecurring ? parseInt(recurringWeeks) : 1;

    if (isFullDay) {
      // 2. Array para armazenar todos os dias inteiros gerados
      const fullDayBlocks: any[] = [];

      for (let i = 0; i < loops; i++) {
        fullDayBlocks.push({
          barber_id: barberId,
          date: getNextWeekDate(newBlockDate, i), // Função que avança as semanas
          reason: newBlockReason || "Folga",
        });
      }
      // Dispara todos os dias de uma vez para o banco
      await supabase.from("blocked_dates").insert(fullDayBlocks);
    } else {
      // 3. Array para armazenar os horários específicos picados
      const motivoFinal = newBlockReason
        ? `BLOQUEIO: ${newBlockReason}`
        : "BLOQUEIO INDISPONÍVEL";

      const timeBlocks: any[] = [];

      for (let i = 0; i < loops; i++) {
        const nextDate = getNextWeekDate(newBlockDate, i); // Avança a semana

        // Pega todos os horários que o barbeiro clicou e injeta nessa data específica
        selectedTimes.forEach((time) => {
          timeBlocks.push({
            barber_id: barberId,
            client_id: profile?.id,
            date: nextDate,
            time: time,
            service: motivoFinal,
            status: "confirmed",
            price_applied: 0,
          });
        });
      }
      // Dispara todos os horários picados de uma vez para o banco
      await supabase.from("appointments").insert(timeBlocks);
    }

    // 4. Limpeza final e recarga
    setIsRecurring(false);
    setRecurringWeeks("4");
    loadAppts();
    setNewBlockDate("");
    setNewBlockReason("");
    setSelectedTimes([]);
    setIsRecurring(false); // Desmarca o checkbox de repetição
    setRecurringWeeks("4"); // Reseta para o padrão de 1 mês
    setLoadingBlock(false);
  }

  async function deleteAppointment(ids: string | string[]) {
    if (!confirm("Remover este bloqueio?")) return;

    // Transforma em array se for um ID único
    const idsToDelete = Array.isArray(ids) ? ids : [ids];

    // Apaga todos os IDs que estiverem dentro dessa lista
    await supabase.from("appointments").delete().in("id", idsToDelete);
    loadAppts();
  }

  async function deleteFullDayBlock(id: string) {
    if (!confirm("Remover bloqueio do dia inteiro?")) return;
    await supabase.from("blocked_dates").delete().eq("id", id);
    loadAppts();
  }

  async function handleCancelByBarber(id: string) {
    if (
      !confirm(
        "Cancelar agendamento? (Se for plano, o corte é devolvido ao cliente)",
      )
    )
      return;
    const apptToCancel = [...today, ...week].find((a) => a.id === id);
    await supabase
      .from("appointments")
      .update({ status: "canceled" })
      .eq("id", id);
    if (apptToCancel?.client_plan_id) {
      // 1. Buscamos a lista (array)
      const { data: planData } = await supabase
        .from("client_plans")
        .select("id, cuts_used")
        .eq("id", apptToCancel.client_plan_id) // Usamos o ID do plano diretamente
        .limit(1);
      // 2. Pegamos o primeiro item da lista: planData[0]
      const plan = planData ? planData[0] : null;

      if (plan && plan.cuts_used > 0) {
        await supabase
          .from("client_plans")
          .update({ cuts_used: plan.cuts_used - 1 })
          .eq("id", plan.id);
      }
    }
    loadAppts();
    loadFinancesAndGoals();
    loadCRMData();
  }

  async function handleNoShow(id: string) {
    if (
      !confirm(
        "Registrar FURO? O plano NÃO devolve cota em caso de falta do cliente.",
      )
    )
      return;
    await supabase
      .from("appointments")
      .update({ status: "no-show" })
      .eq("id", id);
    loadAppts();
    loadFinancesAndGoals();
  }

  // --- CRM: FUNÇÕES DE PLANO ---
  async function handleCreateGhostClient() {
    if (!newClientName || !newClientPhone)
      return alert("Preencha Nome e Telefone!");
    setIsSavingGhost(true);
    const { error } = await supabase.from("profiles").insert({
      name: newClientName,
      phone: newClientPhone,
      role: "client",
      is_ghost: true,
    });
    if (!error) {
      setNewClientName("");
      setNewClientPhone("");
      setIsNewClientModalOpen(false);
      loadCRMData();
    } else {
      alert("Erro ao criar perfil.");
    }
    setIsSavingGhost(false);
  }

  async function handleCreatePlan() {
    if (!planClientId || !planName || !planCuts || !planStartDate)
      return alert("Preencha todos os campos do plano!");
    if (planClientId === "NEW" && (!newClientName || !newClientPhone))
      return alert("Preencha o Nome e WhatsApp!");
    if (!isMigratedPlan && !planPrice)
      return alert("Planos novos precisam de valor de venda!");
    setIsSavingPlan(true);
    let finalClientId = planClientId;

    if (planClientId === "NEW") {
      const { data: newProfile, error: ghostErr } = await supabase
        .from("profiles")
        .insert({
          name: newClientName,
          phone: newClientPhone,
          role: "client",
          is_ghost: true,
        })
        .select()
        .single();
      if (ghostErr) {
        alert("Erro ao cadastrar cliente.");
        setIsSavingPlan(false);
        return;
      }
      finalClientId = newProfile.id;
    }

    let finalPrice = isMigratedPlan
      ? 0
      : parseFloat(planPrice.replace(",", "."));
    let initialCutsUsed = isMigratedPlan
      ? parseInt(migratedCutsUsed)
      : absorbTodayCut && appointmentToAbsorb !== "NO_APPT"
        ? 1
        : 0;
    if (absorbTodayCut && appointmentToAbsorb === "NO_APPT")
      initialCutsUsed = 1;

    const { data: newPlan, error } = await supabase
      .from("client_plans")
      .insert({
        client_id: finalClientId,
        barber_id: barberId,
        plan_name: planName,
        price_paid: finalPrice,
        cuts_allowed: parseInt(planCuts),
        cuts_used: initialCutsUsed,
        status: "active",
        start_date: planStartDate,
      })
      .select()
      .single();

    if (!error) {
      if (
        absorbTodayCut &&
        appointmentToAbsorb &&
        appointmentToAbsorb !== "NO_APPT"
      ) {
        await supabase
          .from("appointments")
          .update({
            client_plan_id: newPlan.id,
            service: `PLANO: ${planName}`,
            price_applied: 0,
          })
          .eq("id", appointmentToAbsorb);
      }
      setIsPlanModalOpen(false);
      setPlanClientId("");
      setPlanName("");
      setPlanPrice("");
      setPlanCuts("4");
      setNewClientName("");
      setNewClientPhone("");
      setIsMigratedPlan(false);
      setMigratedCutsUsed("0");
      setAbsorbTodayCut(false);
      setAppointmentToAbsorb("");
      setPlanStartDate(todayStr);
      loadCRMData();
      loadAppts();
      loadFinancesAndGoals();
    }
    setIsSavingPlan(false);
  }

  function openEditPlanModal(plan: any) {
    setEditPlanId(plan.id);
    setEditPlanCutsUsed(plan.cuts_used.toString());
    setEditPlanCutsAllowed(plan.cuts_allowed.toString());
    setEditPlanPrice(plan.price_paid.toFixed(2).replace(".", ","));
    setEditPlanStartDate(
      plan.start_date
        ? plan.start_date.split("T")[0]
        : plan.created_at.split("T")[0],
    );
    setIsEditPlanModalOpen(true);
  }

  async function handleUpdatePlan() {
    setIsUpdatingPlan(true);
    await supabase
      .from("client_plans")
      .update({
        cuts_used: parseInt(editPlanCutsUsed),
        cuts_allowed: parseInt(editPlanCutsAllowed),
        price_paid: parseFloat(editPlanPrice.replace(",", ".")),
        start_date: editPlanStartDate,
      })
      .eq("id", editPlanId);
    setIsEditPlanModalOpen(false);
    loadCRMData();
    loadFinancesAndGoals();
    setIsUpdatingPlan(false);
  }

  async function handleDeletePlan(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta assinatura?")) return;
    await supabase.from("client_plans").delete().eq("id", id);
    loadCRMData();
    loadFinancesAndGoals();
  }

  // Abertura do modal de renovação pré-preenchido com os dados do plano selecionado
  function openRenewModal(plan: any) {
    setRenewPlanData(plan);
    setRenewPlanName(plan.plan_name);

    // Busca o valor atualizado e oficial do plano na tabela de serviços
    const svc = servicesList.find((s) => s.name === plan.plan_name);

    if (svc) {
      setRenewPlanPrice(svc.price.toFixed(2).replace(".", ","));
    } else {
      setRenewPlanPrice(
        plan.price_paid > 0 ? plan.price_paid.toFixed(2).replace(".", ",") : "",
      );
    }

    setRenewPlanCuts(plan.cuts_allowed.toString());
    setRenewStartDate(todayStr);
    setIsRenewPlanModalOpen(true);
  }

  async function handleRenewPlan() {
    if (!renewPlanName || !renewPlanPrice || !renewPlanCuts) {
      return alert(
        "Por favor, selecione um plano válido e preencha a quantidade de cortes.",
      );
    }

    setIsRenewingPlan(true);
    await supabase
      .from("client_plans")
      .update({ status: "expired" })
      .eq("id", renewPlanData.id);

    await supabase.from("client_plans").insert({
      client_id: renewPlanData.client_id,
      barber_id: renewPlanData.barber_id,
      plan_name: renewPlanName,
      price_paid: parseFloat(renewPlanPrice.replace(",", ".")),
      cuts_allowed: parseInt(renewPlanCuts),
      cuts_used: 0,
      status: "active",
      start_date: renewStartDate,
    });

    setIsRenewPlanModalOpen(false);
    loadCRMData();
    loadFinancesAndGoals();
    setIsRenewingPlan(false);
  }
  // -------------------------

  const clientTodayAppts = today.filter((a) => {
    if (a.status !== "confirmed" || a.service.startsWith("BLOQUEIO"))
      return false;
    if (a.client_id === planClientId) return true;
    if (planClientId === "NEW" && a.service.startsWith("MANUAL:")) return true;
    return false;
  });

  async function handleAddGoal() {
    if (!goalTitle || !goalTarget) return;
    setIsSavingGoal(true);
    await supabase.from("barber_goals").insert({
      barber_id: barberId,
      title: goalTitle,
      target_value: parseFloat(goalTarget.replace(",", ".")),
    });
    setGoalTitle("");
    setGoalTarget("");
    setIsGoalModalOpen(false);
    loadFinancesAndGoals();
    setIsSavingGoal(false);
  }
  async function handleDeleteGoal(id: string) {
    if (!confirm("Remover?")) return;
    await supabase.from("barber_goals").delete().eq("id", id);
    loadFinancesAndGoals();
  }
  function openEditModal(appt: Appointment) {
    setEditingAppointment(appt);
    setEditDate(appt.date);
    setEditTime(appt.time);
  }
  async function handleReschedule() {
    if (!editingAppointment || !editDate || !editTime) return;
    setIsUpdating(true);
    await supabase
      .from("appointments")
      .update({ date: editDate, time: editTime })
      .eq("id", editingAppointment.id);
    setEditingAppointment(null);
    loadAppts();
    setIsUpdating(false);
  }
  async function handleAddProduct() {
    if (!productName || !productPrice || !productQuantity) return;
    setIsSavingProduct(true);
    await supabase.from("products").insert({
      barber_id: barberId,
      name: productName,
      price: parseFloat(productPrice.replace(",", ".")),
      quantity: parseInt(productQuantity),
      category: productCategory,
    });
    setProductName("");
    setProductPrice("");
    setProductQuantity("");
    setIsProductModalOpen(false);
    loadProducts();
    setIsSavingProduct(false);
  }
  function openEditProductModal(product: Product) {
    setEditProductId(product.id);
    setEditProductName(product.name);
    setEditProductPrice(product.price.toFixed(2).replace(".", ","));
    setEditProductQuantity(product.quantity.toString());
    setEditProductCategory(product.category as any);
    setIsEditProductModalOpen(true);
  }
  async function handleUpdateProduct() {
    setIsUpdatingProduct(true);
    await supabase
      .from("products")
      .update({
        name: editProductName,
        price: parseFloat(editProductPrice.replace(",", ".")),
        quantity: parseInt(editProductQuantity),
        category: editProductCategory,
      })
      .eq("id", editProductId);
    setIsEditProductModalOpen(false);
    loadProducts();
    setIsUpdatingProduct(false);
  }
  async function handleDeleteProduct(id: string) {
    if (!confirm("Remover?")) return;
    await supabase.from("products").delete().eq("id", id);
    loadProducts();
  }
  async function handleSellProduct() {
    const product = products.find((p) => p.id === sellProductId);
    if (!product || product.quantity < sellQuantity) return;
    setIsSelling(true);
    const totalPrice = product.price * sellQuantity;
    await supabase
      .from("products")
      .update({ quantity: product.quantity - sellQuantity })
      .eq("id", sellProductId);
    await supabase.from("product_sales").insert({
      barber_id: barberId,
      product_name: product.name,
      quantity: sellQuantity,
      unit_price: product.price,
      total_price: totalPrice,
    });
    setIsSellModalOpen(false);
    setSellProductId("");
    setSellQuantity(1);
    loadProducts();
    loadFinancesAndGoals();
    setIsSelling(false);
  }
  async function handleAddService() {
    if (!svcName || !svcPrice || !svcDuration) return;
    setIsSavingSvc(true);
    await supabase.from("services").insert({
      barber_id: barberId,
      name: svcName,
      price: parseFloat(svcPrice.replace(",", ".")),
      duration: parseInt(svcDuration),
    });
    setSvcName("");
    setSvcPrice("");
    setSvcDuration("");
    setIsServiceModalOpen(false);
    loadServicesFromDB();
    setIsSavingSvc(false);
  }
  function openEditServiceModal(s: BarberService) {
    setSvcId(s.id);
    setSvcName(s.name);
    setSvcPrice(s.price.toFixed(2).replace(".", ","));
    setSvcDuration(s.duration.toString());
    setIsEditServiceModalOpen(true);
  }
  async function handleUpdateService() {
    setIsSavingSvc(true);
    await supabase
      .from("services")
      .update({
        name: svcName,
        price: parseFloat(svcPrice.replace(",", ".")),
        duration: parseInt(svcDuration),
      })
      .eq("id", svcId);
    setIsEditServiceModalOpen(false);
    loadServicesFromDB();
    setIsSavingSvc(false);
  }
  async function handleDeleteService(id: string) {
    if (!confirm("Deseja excluir?")) return;
    await supabase.from("services").delete().eq("id", id);
    loadServicesFromDB();
  }

  function renderCustomerName(a: Appointment) {
    if (a.service?.startsWith("MANUAL:"))
      return a.service.split(" - ")[0].replace("MANUAL: ", "");
    return a.profiles?.name || "Cliente sem nome";
  }
  function renderServiceDescription(a: Appointment) {
    if (a.service?.startsWith("MANUAL:"))
      return a.service.split(" - ")[1] || "Serviço Manual";
    return a.service;
  }

  const activeClientPlan =
    manualClientId !== "AVULSO"
      ? clientPlans.find(
          (p) => p.client_id === manualClientId && p.status === "active",
        )
      : null;

  async function handleManualSchedule() {
    // Se for cliente do CRM, usamos o nome do cliente. Se for avulso, exigimos o manualCustomer.
    const isAvulso = manualClientId === "AVULSO";
    const nomeCliente = isAvulso
      ? manualCustomer
      : crmClients.find((c) => c.id === manualClientId)?.name;

    if (!nomeCliente || !manualService || !manualDate || !manualTime) {
      alert("Preencha todos os campos! (Nome, Serviço, Data e Hora)");
      return;
    }

    setIsSaving(true);
    console.log("Iniciando salvamento...");

    let finalPrice = 0;

    // CORREÇÃO: Padrão é só o nome do serviço.
    let finalServiceTag = manualService;
    let planId = null;

    // Lógica de definição de plano
    if (usePlan && manualActivePlan) {
      finalPrice = 0;
      finalServiceTag = `PLANO: ${manualActivePlan.plan_name}`;
      planId = manualActivePlan.id;
    } else if (isVipDiscount) {
      finalPrice = parseFloat(vipPrice.replace(",", ".")) || 0;
      // Só bota a tag MANUAL se for realmente um cliente avulso
      if (isAvulso)
        finalServiceTag = `MANUAL: ${manualCustomer} - ${manualService}`;
    } else {
      const svc = servicesList.find((s) => s.name === manualService);
      finalPrice = svc ? svc.price : 0;
      // Só bota a tag MANUAL se for realmente um cliente avulso
      if (isAvulso)
        finalServiceTag = `MANUAL: ${manualCustomer} - ${manualService}`;
    }

    // --- O CORAÇÃO DO PROBLEMA ESTAVA AQUI ---
    // LÓGICA DE RECORRÊNCIA: Se estiver ativo, repete X semanas. Senão, faz só 1.
    const loops = isRecurring ? parseInt(recurringWeeks) : 1;
    const appointmentsToInsert = [];

    for (let i = 0; i < loops; i++) {
      const nextDate = getNextWeekDate(manualDate, i);
      appointmentsToInsert.push({
        barber_id: barberId,
        client_id: manualClientId !== "AVULSO" ? manualClientId : null,
        client_plan_id: planId,
        date: nextDate,
        time: manualTime,
        service: finalServiceTag,
        status: "confirmed",
        price_applied: finalPrice,
      });
    }

    // Manda a lista inteira de uma vez para o banco!
    const { error } = await supabase
      .from("appointments")
      .insert(appointmentsToInsert);

    // Lógica para debitar os cortes do plano (agora debita a quantidade de loops)
    if (usePlan && planId && manualActivePlan) {
      await supabase
        .from("client_plans")
        .update({
          cuts_used: (manualActivePlan.cuts_used || 0) + loops,
        })
        .eq("id", planId);
    }

    if (error) {
      console.error("Erro ao debitar corte:", error);
      alert("Agendamento criado, mas erro ao atualizar o plano!");
    } else {
      console.log("Corte debitado com sucesso!");
    }

    // Limpeza e recarga dos dados
    setManualClientId("AVULSO");
    setManualCustomer("");
    setManualService("");
    setActiveTab("agenda");
    setIsRecurring(false);
    setRecurringWeeks("4");
    loadAppts();
    loadFinancesAndGoals();
    alert("Agendamento confirmado e corte debitado!");
  }

  const NavButton = ({ icon: Icon, label, tabId }: any) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === tabId ? "text-amber-400 scale-110" : "text-zinc-500 hover:text-zinc-300"}`}
    >
      <Icon size={20} strokeWidth={activeTab === tabId ? 2.5 : 2} />
      <span className="text-[10px] font-bold uppercase tracking-tighter">
        {label}
      </span>
    </button>
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-28">
      <header className="bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <img src="/logo.png" alt="Logo" className="h-12 w-auto" />
          <button
            onClick={handleLogout}
            className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* HOME */}
        {activeTab === "home" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div>
              <h2 className="text-2xl font-bold italic tracking-tight">
                Olá, {profile?.name?.split(" ")[0]}! ✂️
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                Sua jornada de hoje começa aqui.
              </p>
            </div>
            <DailyWord />
            <section>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">
                Agenda de Hoje
              </h3>
              <div className="flex flex-col gap-3">
                {today.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-10 text-center text-zinc-600 text-sm italic">
                    Nenhum compromisso agendado.
                  </div>
                ) : (
                  groupAppointments(today).map((a) => {
                    const isBlock = a.service.startsWith("BLOQUEIO");
                    const isCanceled = a.status === "canceled";
                    const isNoShow = a.status === "no-show";
                    const timeHasPassed = isPast(a.date, a.time);
                    const autoCompleted =
                      !isBlock &&
                      !isCanceled &&
                      !isNoShow &&
                      (a.status === "completed" || timeHasPassed);

                    return (
                      <div
                        key={a.id}
                        className={`bg-zinc-900 border rounded-2xl px-4 py-4 flex flex-col gap-2 transition-all ${isCanceled || isNoShow ? "opacity-40 border-zinc-800 grayscale" : autoCompleted ? "border-emerald-500/30 bg-emerald-950/10" : isBlock ? "border-red-900/30" : "border-zinc-800"}`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`rounded-xl px-3 py-2 text-center min-w-[60px] ${isBlock ? "bg-red-500 text-white" : autoCompleted ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-400 text-zinc-950"}`}
                          >
                            <div
                              className={`text-lg font-black leading-none ${a.isGroupedBlock && a.time !== a.endTime ? "text-[11px]" : "text-lg"}`}
                            >
                              {a.isGroupedBlock && a.time !== a.endTime
                                ? `${a.time} às ${a.endTime}`
                                : a.time}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div
                              className={`font-bold italic flex items-center gap-2 ${isBlock ? "text-red-400" : autoCompleted ? "text-emerald-400" : "text-zinc-100"}`}
                            >
                              {isBlock
                                ? "HORÁRIO BLOQUEADO"
                                : renderCustomerName(a)}
                              {autoCompleted && (
                                <CheckCircle2
                                  size={14}
                                  className="text-emerald-500"
                                />
                              )}
                            </div>
                            <div className="text-zinc-500 text-xs font-medium mt-0.5 flex items-center gap-2">
                              {isBlock
                                ? a.service.replace("BLOQUEIO: ", "")
                                : renderServiceDescription(a)}
                              {isNoShow && (
                                <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                                  Furo
                                </span>
                              )}
                              {autoCompleted && (
                                <span className="text-emerald-500/70 text-[10px] uppercase tracking-wider">
                                  Concluído
                                </span>
                              )}
                            </div>
                          </div>
                          {!isBlock &&
                            !isCanceled &&
                            !isNoShow &&
                            !autoCompleted && (
                              <div className="flex items-center gap-2 border-l border-zinc-800 pl-3">
                                <button
                                  onClick={() => openEditModal(a)}
                                  className="text-zinc-500 hover:text-amber-400 p-1.5 transition-colors"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleCancelByBarber(a.id)}
                                  className="text-zinc-500 hover:text-red-400 p-1.5 transition-colors"
                                >
                                  <XCircle size={16} />
                                </button>
                                <button
                                  onClick={() => handleNoShow(a.id)}
                                  title="Registrar Furo"
                                  className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-orange-500 hover:text-zinc-950 transition-all whitespace-nowrap"
                                >
                                  Faltou
                                </button>
                              </div>
                            )}
                          {autoCompleted && !isNoShow && (
                            <button
                              onClick={() => handleNoShow(a.id)}
                              title="Foi erro? Registrar Furo"
                              className="text-zinc-600 hover:text-orange-500 p-2"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                          {isBlock && !isCanceled && !isNoShow && (
                            <button
                              onClick={() =>
                                deleteAppointment(
                                  a.isGroupedBlock ? a.blockIds : a.id,
                                )
                              }
                              className="text-zinc-600 hover:text-red-400 p-2"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}

        {/* AGENDA */}
        {activeTab === "agenda" && (
          <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500">
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold italic">Sua Agenda</h3>
              </div>
              <div className="flex gap-2 bg-zinc-900 p-1 rounded-xl mb-6 border border-zinc-800">
                <button
                  onClick={() => setTab("semana")}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase rounded-lg transition-all ${tab === "semana" ? "bg-zinc-800 text-amber-400" : "text-zinc-500 hover:text-white"}`}
                >
                  Próximos 7 Dias
                </button>
                <button
                  onClick={() => setTab("mes")}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase rounded-lg transition-all ${tab === "mes" ? "bg-zinc-800 text-amber-400" : "text-zinc-500 hover:text-white"}`}
                >
                  Próximos 30 Dias
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {(() => {
                  const upcomingAppointments = week.filter(
                    (a) => !isPast(a.date, a.time),
                  );
                  if (upcomingAppointments.length === 0) {
                    return (
                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-10 text-center text-zinc-600 text-sm italic">
                        Nenhum compromisso futuro agendado para o período.
                      </div>
                    );
                  }
                  return groupAppointments(upcomingAppointments).map((a) => {
                    const isBlock = a.service.startsWith("BLOQUEIO");
                    return (
                      <div
                        key={a.id}
                        className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`rounded-xl px-3 py-2 text-center min-w-[64px] ${isBlock ? "bg-red-900/20 border border-red-900/50" : "bg-zinc-800 border border-zinc-700"}`}
                          >
                            <div
                              className={`font-black text-sm ${isBlock ? "text-red-400" : "text-zinc-100"}`}
                            >
                              {a.date
                                .split("-")
                                .reverse()
                                .slice(0, 2)
                                .join("/")}
                            </div>
                            <div
                              className={`text-sm font-black leading-none ${a.isGroupedBlock && a.time !== a.endTime ? "text-[11px]" : "text-lg"}`}
                            >
                              {a.isGroupedBlock && a.time !== a.endTime
                                ? `${a.time} às ${a.endTime}`
                                : a.time}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div
                              className={`font-bold text-sm italic ${isBlock ? "text-red-400" : "text-zinc-100"}`}
                            >
                              {isBlock
                                ? "HORÁRIO BLOQUEADO"
                                : renderCustomerName(a)}
                            </div>
                            <div className="text-zinc-500 text-xs mt-0.5">
                              {isBlock
                                ? a.service.replace("BLOQUEIO: ", "")
                                : renderServiceDescription(a)}
                            </div>
                          </div>
                          {!isBlock && (
                            <div className="flex items-center gap-2 border-l border-zinc-800 pl-3">
                              <button
                                onClick={() => openEditModal(a)}
                                className="text-zinc-500 hover:text-amber-400 p-1.5 transition-colors"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleCancelByBarber(a.id)}
                                className="text-zinc-500 hover:text-red-400 p-1.5 transition-colors"
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          )}
                          {isBlock && (
                            <button
                              onClick={() =>
                                deleteAppointment(
                                  a.isGroupedBlock ? a.blockIds : a.id,
                                )
                              }
                              className="text-zinc-600 hover:text-red-400 p-2"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </section>

            <section className="mt-2">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">
                Gerenciar Bloqueios
              </h3>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col gap-4 shadow-lg">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    min={todayStr}
                    value={newBlockDate}
                    onChange={(e) => setNewBlockDate(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:border-amber-400 outline-none [color-scheme:dark]"
                  />
                  <input
                    type="text"
                    placeholder="Motivo (Ex: Reunião)"
                    value={newBlockReason}
                    onChange={(e) => setNewBlockReason(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="flex bg-zinc-800 p-1 rounded-xl border border-zinc-700">
                  <button
                    onClick={() => {
                      setIsFullDay(true);
                      setSelectedTimes([]);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${isFullDay ? "bg-zinc-700 text-amber-400" : "text-zinc-500 hover:text-white"}`}
                  >
                    DIA INTEIRO
                  </button>
                  <button
                    onClick={() => setIsFullDay(false)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!isFullDay ? "bg-zinc-700 text-amber-400" : "text-zinc-500 hover:text-white"}`}
                  >
                    ESCOLHER HORÁRIOS
                  </button>
                </div>
                {!isFullDay && (
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {HOURS.map((h) => {
                      const isSelected = selectedTimes.includes(h);
                      return (
                        <button
                          key={h}
                          onClick={() => {
                            if (
                              selectedTimes.length === 0 ||
                              selectedTimes.length > 1
                            ) {
                              // Primeiro clique: Inicia a seleção do zero
                              setSelectedTimes([h]);
                            } else if (selectedTimes.length === 1) {
                              // Segundo clique: Pega o início e o fim, e preenche tudo no meio
                              const startIdx = HOURS.indexOf(selectedTimes[0]);
                              const endIdx = HOURS.indexOf(h);
                              const minIdx = Math.min(startIdx, endIdx);
                              const maxIdx = Math.max(startIdx, endIdx);

                              // Fatiamos o array original do menor até o maior + 1
                              const newSelection = HOURS.slice(
                                minIdx,
                                maxIdx + 1,
                              );
                              setSelectedTimes(newSelection);
                            }
                          }}
                          className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${isSelected ? "bg-amber-400 border-amber-400 text-zinc-950" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-col gap-3 mt-2 border-t border-zinc-800/60 pt-3 mb-2">
                  <label className="flex items-center gap-3 text-sm font-bold text-amber-400 cursor-pointer pl-1">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-5 h-5 rounded border-amber-500/50 text-amber-400 focus:ring-amber-400 bg-zinc-950"
                    />
                    Repetir Bloqueio Semanalmente
                  </label>
                  {isRecurring && (
                    <div className="flex items-center gap-3 bg-amber-400/10 border border-amber-400/20 p-3 rounded-xl animate-in zoom-in-95">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider w-full">
                        Por quantas semanas?
                      </span>
                      <input
                        type="number"
                        min="2"
                        max="52"
                        value={recurringWeeks}
                        onChange={(e) => setRecurringWeeks(e.target.value)}
                        className="w-20 bg-zinc-950 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-400 font-black text-center outline-none"
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSmartBlock}
                  disabled={
                    !newBlockDate ||
                    (!isFullDay && selectedTimes.length === 0) ||
                    loadingBlock
                  }
                  className="bg-amber-400 text-zinc-950 font-black py-4 rounded-xl uppercase text-xs tracking-widest disabled:opacity-30 hover:bg-amber-300 transition-colors"
                >
                  Confirmar Bloqueio
                </button>
              </div>

              {blockedDates.length > 0 && (
                <div className="mt-6 flex flex-col gap-3">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">
                    Dias Inteiros Bloqueados
                  </h4>
                  {blockedDates.map((b) => (
                    <div
                      key={b.id}
                      className="bg-zinc-900 border border-red-900/30 p-4 rounded-2xl flex justify-between items-center shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-xl">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <div className="font-black text-white text-sm">
                            {b.date.split("-").reverse().join("/")}
                          </div>
                          <div className="text-zinc-500 text-xs mt-0.5">
                            {b.reason || "Sem descrição"}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteFullDayBlock(b.id)}
                        className="text-zinc-500 hover:text-red-400 p-2 bg-zinc-950 rounded-xl transition-colors border border-zinc-800 hover:border-red-900/50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* --- NOVO AGENDAMENTO E DESCONTO VIP --- */}
        {activeTab === "novo" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <header>
              <h1 className="text-2xl font-black italic uppercase">
                Novo Agendamento
              </h1>
            </header>
            <div className="flex flex-col gap-4 bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl shadow-lg">
              <select
                value={manualClientId}
                onChange={async (e) => {
                  const cId = e.target.value;
                  setManualClientId(cId);

                  // Busca se o cliente tem um plano ativo
                  if (cId) {
                    const { data: planData } = await supabase
                      .from("client_plans")
                      .select("*")
                      .eq("client_id", cId)
                      .eq("status", "active")
                      .single();
                    setManualActivePlan(planData || null);
                  } else {
                    setManualActivePlan(null);
                  }
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none"
              >
                <option value="AVULSO">
                  👤 Cliente Avulso (Digitar nome...)
                </option>
                <optgroup
                  label="Clientes CRM"
                  className="text-zinc-400 font-normal"
                >
                  {crmClients.map((c) => (
                    <option key={c.id} value={c.id} className="text-white">
                      {c.name} {c.is_ghost ? "(Balcão)" : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
              {manualClientId === "AVULSO" && (
                <input
                  type="text"
                  placeholder="Nome do Cliente (Avulso)"
                  value={manualCustomer}
                  onChange={(e) => setManualCustomer(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none animate-in fade-in focus:border-amber-400 transition-colors"
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <select
                  value={manualService}
                  onChange={(e) => {
                    const s = e.target.value;
                    setManualService(s);

                    // Lógica para definir o preço automaticamente
                    if (s.startsWith("PLANO:")) {
                      setManualPrice("R$ 0,00");
                      setUsePlan(true); // Ativa o checkbox automaticamente
                    } else {
                      setUsePlan(false);
                      const sD = servicesList.find((sv) => sv.name === s);
                      if (sD) {
                        setManualPrice(
                          `R$ ${sD.price.toFixed(2).replace(".", ",")}`,
                        );
                      }
                    }
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none appearance-none focus:border-amber-400 transition-colors"
                >
                  <option value="">Serviço...</option>

                  {/* Opção do Plano */}
                  {manualActivePlan &&
                    manualActivePlan.cuts_used <
                      manualActivePlan.cuts_allowed && (
                      <option value={`PLANO: ${manualActivePlan.plan_name}`}>
                        💳 USAR PLANO: {manualActivePlan.plan_name} (
                        {manualActivePlan.cuts_allowed -
                          manualActivePlan.cuts_used}{" "}
                        restantes)
                      </option>
                    )}

                  {/* Serviços normais */}
                  {servicesList
                    .filter((s) => !s.name.toLowerCase().includes("plano"))
                    .map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} - R$ {s.price.toFixed(2).replace(".", ",")}
                      </option>
                    ))}
                </select>
                {isVipDiscount ? (
                  <input
                    type="number"
                    placeholder="Valor (Ex: 25,00)"
                    value={vipPrice}
                    onChange={(e) => setVipPrice(e.target.value)}
                    className="bg-zinc-950 border border-amber-500/50 rounded-2xl px-4 py-3 font-black text-amber-400 outline-none animate-in fade-in"
                  />
                ) : (
                  <input
                    type="text"
                    value={usePlan ? "R$ 0,00" : manualPrice}
                    readOnly
                    className={`bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 font-bold outline-none ${usePlan ? "text-amber-400" : "text-zinc-500"}`}
                  />
                )}
              </div>

              <div className="flex flex-col gap-3 mt-1 border-t border-zinc-800/60 pt-4">
                {activeClientPlan && (
                  <div className="bg-zinc-950/50 p-4 rounded-2xl border border-amber-500/30 flex flex-col gap-2 shadow-[0_0_15px_rgba(251,191,36,0.05)] transition-all">
                    <label className="flex items-center gap-3 text-sm font-bold text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usePlan}
                        onChange={(e) => {
                          setUsePlan(e.target.checked);
                          setIsVipDiscount(false);
                        }}
                        className="w-5 h-5 rounded border-zinc-700 text-amber-400 focus:ring-amber-400 bg-zinc-800"
                      />
                      Descontar do Plano Ativo
                    </label>
                    <p className="text-[10px] text-amber-400 font-bold uppercase ml-8 tracking-wider">
                      {activeClientPlan.plan_name} •{" "}
                      {activeClientPlan.cuts_used}/
                      {activeClientPlan.cuts_allowed} usados
                    </p>
                  </div>
                )}
                <label className="flex items-center gap-3 text-sm font-bold text-zinc-300 cursor-pointer pl-1">
                  <input
                    type="checkbox"
                    checked={isVipDiscount}
                    onChange={(e) => {
                      setIsVipDiscount(e.target.checked);
                      setUsePlan(false);
                      setVipPrice("");
                    }}
                    className="w-5 h-5 rounded border-zinc-700 text-amber-400 focus:ring-amber-400 bg-zinc-800"
                  />
                  Aplicar Desconto VIP (Preço Flexível)
                </label>
              </div>

              <input
                type="date"
                value={manualDate}
                onChange={(e) => {
                  setManualDate(e.target.value);
                  setManualTime("");
                }}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 mt-2 text-white [color-scheme:dark] focus:border-amber-400 transition-colors"
              />
              <select
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none appearance-none focus:border-amber-400 transition-colors"
              >
                <option value="">Horário...</option>
                {HOURS.filter((h) => !manualTakenSlots.includes(h)).map(
                  (h, i) => (
                    <option key={i} value={h}>
                      {h}
                    </option>
                  ),
                )}
              </select>
              {/* CHECKBOX DA RECORRÊNCIA */}
              <div className="flex flex-col gap-3 mt-2 border-t border-zinc-800/60 pt-3">
                <label className="flex items-center gap-3 text-sm font-bold text-amber-400 cursor-pointer pl-1">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-5 h-5 rounded border-amber-500/50 text-amber-400 focus:ring-amber-400 bg-zinc-950"
                  />
                  Repetir Semanalmente (Recorrente)
                </label>
                {isRecurring && (
                  <div className="flex items-center gap-3 bg-amber-400/10 border border-amber-400/20 p-3 rounded-xl animate-in zoom-in-95">
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider w-full">
                      Por quantas semanas?
                    </span>
                    <input
                      type="number"
                      min="2"
                      max="52"
                      value={recurringWeeks}
                      onChange={(e) => setRecurringWeeks(e.target.value)}
                      className="w-20 bg-zinc-950 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-400 font-black text-center outline-none"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={handleManualSchedule}
                disabled={isSaving || !manualTime}
                className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black py-4 rounded-2xl uppercase tracking-widest disabled:opacity-30 transition-colors"
              >
                {isSaving ? "Salvando..." : "Confirmar Agenda"}
              </button>
            </div>
          </div>
        )}

        {/* --- FINANÇAS (BI TURBINADO - NÍVEL TRINKS) --- */}
        {activeTab === "financeiro" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <header className="mb-2">
              <h1 className="text-2xl font-black italic uppercase">
                Desempenho
              </h1>
              <p className="text-zinc-500 text-sm mt-1">
                Visão geral do negócio e suas metas.
              </p>
            </header>

            {/* VISÃO GERAL (BARBEARIA) */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-amber-400" size={18} />
                  <h3 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                    Visão da Barbearia
                  </h3>
                </div>
                <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setChartViewGlobal("diario")}
                    className={`px-2 py-1 text-[9px] font-bold rounded-md uppercase transition-all ${chartViewGlobal === "diario" ? "bg-zinc-800 text-amber-400" : "text-zinc-500"}`}
                  >
                    Diário
                  </button>
                  <button
                    onClick={() => setChartViewGlobal("mensal")}
                    className={`px-2 py-1 text-[9px] font-bold rounded-md uppercase transition-all ${chartViewGlobal === "mensal" ? "bg-zinc-800 text-amber-400" : "text-zinc-500"}`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setChartViewGlobal("anual")}
                    className={`px-2 py-1 text-[9px] font-bold rounded-md uppercase transition-all ${chartViewGlobal === "anual" ? "bg-zinc-800 text-amber-400" : "text-zinc-500"}`}
                  >
                    Anual
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">
                    Faturamento Geral
                  </p>
                  <p className="text-xl font-black text-white">
                    R$ {finances.globalMesAtual.toFixed(2).replace(".", ",")}{" "}
                    <span className="text-[10px] font-normal text-zinc-500 lowercase">
                      /mês
                    </span>
                  </p>
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
                      Hoje:{" "}
                      <strong className="text-emerald-400">
                        R$ {finances.globalHoje.toFixed(2).replace(".", ",")}
                      </strong>
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">
                    Total Atendimentos
                  </p>
                  <p className="text-xl font-black text-white">
                    {finances.globalClientesMesAtual}{" "}
                    <span className="text-[10px] font-normal text-zinc-500 lowercase">
                      /mês
                    </span>
                  </p>
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
                      Hoje:{" "}
                      <strong className="text-emerald-400">
                        {finances.globalClientesHoje}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Gráfico Dinâmico */}
              <div className="flex justify-between gap-1 h-32 mt-4 pt-4 border-t border-zinc-800/60">
                {(() => {
                  const activeChart =
                    chartViewGlobal === "diario"
                      ? finances.chartDiario
                      : chartViewGlobal === "mensal"
                        ? finances.chartMensal
                        : finances.chartAnual;
                  const activeMax =
                    chartViewGlobal === "diario"
                      ? finances.maxGenDiario
                      : chartViewGlobal === "mensal"
                        ? finances.maxGenMensal
                        : finances.maxGenAnual;

                  return activeChart.map((data, idx) => {
                    const isCurrent =
                      chartViewGlobal === "diario"
                        ? idx === 6
                        : chartViewGlobal === "mensal"
                          ? idx === new Date().getMonth()
                          : data.year === new Date().getFullYear();
                    const height = `${(data.gen / activeMax) * 100}%`;
                    const barColor = isCurrent
                      ? "bg-amber-400"
                      : data.gen > 0
                        ? "bg-zinc-600 group-hover:bg-amber-400/50"
                        : "bg-zinc-800";

                    return (
                      <div
                        key={data.name}
                        className="flex flex-col items-center justify-end gap-1 flex-1 group h-full"
                      >
                        <div className="w-full relative h-full flex flex-col justify-end">
                          <div
                            className={`w-full rounded-t-sm transition-all duration-500 ${barColor}`}
                            style={{ height: data.gen > 0 ? height : "2px" }}
                          >
                            <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white text-[9px] font-bold px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 flex flex-col items-center gap-0.5 shadow-xl">
                              <span className="whitespace-nowrap text-amber-400">
                                R$ {data.gen.toFixed(0)}
                              </span>
                              <span className="whitespace-nowrap text-zinc-300 text-[8px]">
                                {data.genClients} cortes
                              </span>
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[8px] font-bold uppercase ${isCurrent ? "text-amber-400" : "text-zinc-600"}`}
                        >
                          {data.name}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </section>

            {/* SEUS NÚMEROS (INDIVIDUAL) */}
            <section className="flex flex-col gap-4">
              <div className="flex justify-between items-center ml-2">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                  Seus Números
                </h3>
                <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 shadow-lg">
                  <button
                    onClick={() => setChartView("diario")}
                    className={`px-2 py-1 text-[9px] font-bold rounded-md uppercase transition-all ${chartView === "diario" ? "bg-zinc-800 text-amber-400" : "text-zinc-500"}`}
                  >
                    Diário
                  </button>
                  <button
                    onClick={() => setChartView("mensal")}
                    className={`px-2 py-1 text-[9px] font-bold rounded-md uppercase transition-all ${chartView === "mensal" ? "bg-zinc-800 text-amber-400" : "text-zinc-500"}`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setChartView("anual")}
                    className={`px-2 py-1 text-[9px] font-bold rounded-md uppercase transition-all ${chartView === "anual" ? "bg-zinc-800 text-amber-400" : "text-zinc-500"}`}
                  >
                    Anual
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-zinc-500 mb-1">
                    <DollarSign size={16} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Receita
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">
                    R$ {finances.mesAtual.toFixed(2).replace(".", ",")}{" "}
                    <span className="text-[10px] font-normal text-zinc-500 lowercase">
                      /mês
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-1 border-t border-zinc-800/60 pt-2">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase">
                      Hoje:{" "}
                      <strong className="text-emerald-400">
                        R$ {finances.hoje.toFixed(2).replace(".", ",")}
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-zinc-500 mb-1">
                    <Scissors size={16} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Atendidos
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">
                    {finances.clientesMesAtual}{" "}
                    <span className="text-[10px] font-normal text-zinc-500 lowercase">
                      /mês
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-1 border-t border-zinc-800/60 pt-2">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase">
                      Hoje:{" "}
                      <strong className="text-emerald-400">
                        {finances.clientesHoje}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Gráfico Individual Dinâmico */}
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex flex-col mt-2">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">
                  Sua Evolução ({chartView})
                </h3>
                <div className="flex justify-between gap-1 h-32">
                  {(() => {
                    const activeChart =
                      chartView === "diario"
                        ? finances.chartDiario
                        : chartView === "mensal"
                          ? finances.chartMensal
                          : finances.chartAnual;
                    const activeMax =
                      chartView === "diario"
                        ? finances.maxIndDiario
                        : chartView === "mensal"
                          ? finances.maxIndMensal
                          : finances.maxIndAnual;

                    return activeChart.map((data, idx) => {
                      const isCurrent =
                        chartView === "diario"
                          ? idx === 6
                          : chartView === "mensal"
                            ? idx === new Date().getMonth()
                            : data.year === new Date().getFullYear();
                      const height = `${(data.ind / activeMax) * 100}%`;
                      const barColor = isCurrent
                        ? "bg-amber-400"
                        : data.ind > 0
                          ? "bg-zinc-600 group-hover:bg-amber-400/50"
                          : "bg-zinc-800";

                      return (
                        <div
                          key={data.name}
                          className="flex flex-col items-center justify-end gap-1 flex-1 group h-full"
                        >
                          <div className="w-full relative h-full flex flex-col justify-end">
                            <div
                              className={`w-full rounded-t-sm transition-all duration-500 ${barColor}`}
                              style={{ height: data.ind > 0 ? height : "2px" }}
                            >
                              <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white text-[9px] font-bold px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 flex flex-col items-center gap-0.5 shadow-xl">
                                <span className="whitespace-nowrap text-amber-400">
                                  R$ {data.ind.toFixed(0)}
                                </span>
                                <span className="whitespace-nowrap text-zinc-300 text-[8px]">
                                  {data.indClients} cortes
                                </span>
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[8px] font-bold uppercase ${isCurrent ? "text-amber-400" : "text-zinc-600"}`}
                          >
                            {data.name}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </section>

            <section className="mt-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                  Seus Objetivos
                </h3>
                <button
                  onClick={() => setIsGoalModalOpen(true)}
                  className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
                >
                  <PlusCircle size={16} />
                  <span className="text-xs font-bold">Nova Meta</span>
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {goals.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl px-4 py-8 text-center text-zinc-600 text-sm italic">
                    Nenhuma meta definida. Crie um objetivo!
                  </div>
                ) : (
                  goals.map((goal) => {
                    const percentage = Math.min(
                      (finances.mesAtual / goal.target_value) * 100,
                      100,
                    );
                    return (
                      <div
                        key={goal.id}
                        className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex flex-col gap-4 relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="bg-zinc-800 p-2.5 rounded-xl text-amber-400">
                              <Target size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-sm">
                                {goal.title}
                              </h4>
                              <p className="text-zinc-500 text-xs mt-0.5">
                                Faltam R${" "}
                                {(goal.target_value - finances.mesAtual > 0
                                  ? goal.target_value - finances.mesAtual
                                  : 0
                                )
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="font-black text-amber-400 text-sm">
                              R${" "}
                              {goal.target_value.toFixed(2).replace(".", ",")}
                            </span>
                            <button
                              onClick={() => handleDeleteGoal(goal.id)}
                              className="text-zinc-600 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-3 mb-1 relative z-10 overflow-hidden">
                          <div
                            className="bg-amber-400 h-3 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase z-10">
                          <span>Progresso</span>
                          <span
                            className={
                              percentage >= 100 ? "text-emerald-400" : ""
                            }
                          >
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}

        {/* GESTÃO & CRM */}
        {activeTab === "gestao" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {gestaoView === "menu" && (
              <div className="flex flex-col gap-4">
                <header className="mb-4">
                  <h1 className="text-2xl font-black italic uppercase">
                    Gestão
                  </h1>
                </header>
                <button
                  onClick={() => setGestaoView("crm")}
                  className="bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 p-6 rounded-3xl flex items-center gap-4 transition-all group"
                >
                  <div className="bg-amber-400/10 p-4 rounded-2xl text-amber-400 group-hover:scale-110 transition-transform">
                    <Users size={28} />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-lg font-bold text-white">
                      CRM & Clientes
                    </h3>
                    <p className="text-zinc-500 text-xs">
                      Assinaturas e Perfis Fantasmas
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setGestaoView("estoque")}
                  className="bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 p-6 rounded-3xl flex items-center gap-4 transition-all"
                >
                  <div className="bg-amber-400/10 p-4 rounded-2xl text-amber-400">
                    <Package size={28} />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-lg font-bold text-white">Estoque</h3>
                    <p className="text-zinc-500 text-xs">
                      Produtos e geladeira
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setGestaoView("servicos")}
                  className="bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 p-6 rounded-3xl flex items-center gap-4 transition-all"
                >
                  <div className="bg-amber-400/10 p-4 rounded-2xl text-amber-400">
                    <Briefcase size={28} />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-lg font-bold text-white">Serviços</h3>
                    <p className="text-zinc-500 text-xs">Preços e duração</p>
                  </div>
                </button>
              </div>
            )}

            {gestaoView === "crm" && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setGestaoView("menu")}
                      className="text-zinc-500 p-2 hover:text-white transition-colors"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold italic">CRM</h2>
                  </div>
                  {crmTab === "assinaturas" ? (
                    <button
                      onClick={() => setIsPlanModalOpen(true)}
                      className="bg-amber-400 text-zinc-950 p-2.5 rounded-xl hover:scale-105 transition-transform"
                    >
                      <PlusCircle size={20} strokeWidth={2.5} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsNewClientModalOpen(true)}
                      className="bg-amber-400 text-zinc-950 p-2.5 rounded-xl hover:scale-105 transition-transform"
                    >
                      <UserPlus size={20} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                <div className="flex gap-2 bg-zinc-900 p-1 rounded-xl">
                  <button
                    onClick={() => setCrmTab("assinaturas")}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg ${crmTab === "assinaturas" ? "bg-zinc-800 text-amber-400" : "text-zinc-500"}`}
                  >
                    Assinaturas
                  </button>
                  <button
                    onClick={() => setCrmTab("clientes")}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg ${crmTab === "clientes" ? "bg-zinc-800 text-amber-400" : "text-zinc-500"}`}
                  >
                    Todos os Clientes
                  </button>
                </div>

                {crmTab === "assinaturas" && (
                  <div className="flex flex-col gap-3 mt-2">
                    {/* AQUI ESTÁ A MÁGICA: FILTRAMOS APENAS OS PLANOS ATIVOS PARA NÃO POLUIR A TELA */}
                    {clientPlans.filter((p) => p.status === "active").length ===
                    0 ? (
                      <div className="text-center py-12 px-6 text-zinc-600 italic border border-zinc-800 rounded-3xl flex flex-col items-center gap-3 bg-zinc-900/30">
                        <CreditCard size={32} className="text-zinc-700" />{" "}
                        Nenhuma assinatura ativa na sua carteira.
                      </div>
                    ) : (
                      clientPlans
                        .filter((p) => p.status === "active")
                        .map((plan) => {
                          const startDateString = plan.start_date
                            ? plan.start_date.split("T")[0]
                            : plan.created_at.split("T")[0];
                          const [sy, sm, sd] = startDateString
                            .split("-")
                            .map(Number);
                          const startDate = new Date(sy, sm - 1, sd);
                          const expDate = new Date(startDate);
                          expDate.setDate(startDate.getDate() + 30);
                          const diffTime =
                            expDate.getTime() - new Date().getTime();
                          const diffDays = Math.ceil(
                            diffTime / (1000 * 60 * 60 * 24),
                          );

                          let semCardClass = "border-zinc-800 bg-zinc-900";
                          let semBadgeClass =
                            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          let semText = "🟢 Saudável";

                          if (
                            diffDays <= 0 ||
                            plan.cuts_used >= plan.cuts_allowed
                          ) {
                            semCardClass = "border-red-500/30 bg-red-950/20";
                            semBadgeClass =
                              "bg-red-500/10 text-red-400 border-red-500/20";
                            semText = "🔴 Esgotado / Expirado";
                          } else if (
                            diffDays <= 7 ||
                            plan.cuts_used === plan.cuts_allowed - 1
                          ) {
                            semCardClass =
                              "border-amber-500/30 bg-amber-950/20";
                            semBadgeClass =
                              "bg-amber-500/10 text-amber-400 border-amber-500/20";
                            semText = `🟡 Atenção (${diffDays} dias ou 1 corte restante)`;
                          }

                          return (
                            <div
                              key={plan.id}
                              className={`border p-5 rounded-3xl flex flex-col gap-4 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.2)] ${semCardClass}`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold text-white text-base">
                                    {plan.profiles?.name || "Cliente Fantasma"}
                                  </h4>
                                  <p className="text-amber-400 text-xs mt-0.5 font-bold italic">
                                    {plan.plan_name}
                                  </p>
                                </div>
                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-wider border ${semBadgeClass}`}
                                >
                                  {semText}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-amber-400 h-2 rounded-full transition-all"
                                    style={{
                                      width: `${(plan.cuts_used / plan.cuts_allowed) * 100}%`,
                                    }}
                                  ></div>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
                                  <span>Consumo</span>
                                  <span className="text-zinc-300">
                                    {plan.cuts_used} de {plan.cuts_allowed}{" "}
                                    cortes
                                  </span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center border-t border-zinc-800/60 pt-3">
                                <div className="text-[10px] text-zinc-500">
                                  Vence em:{" "}
                                  {expDate
                                    .toISOString()
                                    .split("T")[0]
                                    .split("-")
                                    .reverse()
                                    .join("/")}
                                </div>
                                <div className="text-xs text-zinc-400">
                                  Receita:{" "}
                                  <span className="text-emerald-400 font-bold">
                                    R${" "}
                                    {plan.price_paid
                                      .toFixed(2)
                                      .replace(".", ",")}
                                  </span>
                                </div>
                              </div>
                              {/* AÇÕES CRM */}
                              <div className="flex gap-2 justify-end items-center border-t border-zinc-800/60 pt-3 mt-1">
                                <button
                                  onClick={() => openRenewModal(plan)}
                                  className="flex-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                                >
                                  Renovar
                                </button>
                                <button
                                  onClick={() => openEditPlanModal(plan)}
                                  className="flex-1 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDeletePlan(plan.id)}
                                  className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                                >
                                  Excluir
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                )}
                {crmTab === "clientes" && (
                  <div className="flex flex-col gap-3 mt-2 animate-in fade-in duration-300">
                    {/* BARRA DE PESQUISA */}
                    <input
                      type="text"
                      placeholder="Pesquisar cliente por nome..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber-400 transition-colors w-full"
                    />

                    {/* LISTA DE CLIENTES FILTRADA */}
                    <div className="flex flex-col gap-3 mt-1 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      {crmClients
                        .filter(
                          (c) =>
                            c.name
                              .toLowerCase()
                              .includes(clientSearch.toLowerCase()) ||
                            (c.phone && c.phone.includes(clientSearch)),
                        )
                        .map((c) => (
                          <div
                            key={c.id}
                            className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center group hover:border-zinc-700 transition-colors"
                          >
                            <div className="flex flex-col gap-0.5">
                              <h4 className="font-bold text-zinc-100 flex items-center gap-2">
                                {c.name}
                                {c.is_ghost && (
                                  <span className="text-[9px] bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-400 uppercase tracking-wider">
                                    Balcão
                                  </span>
                                )}
                              </h4>
                              <span className="text-xs text-zinc-500">
                                {c.phone || "Sem contato"}
                              </span>
                              <span className="text-[10px] text-zinc-600 mt-0.5">
                                Nasc:{" "}
                                {c.birth_date
                                  ? c.birth_date.split("-").reverse().join("/")
                                  : "--/--/----"}
                              </span>
                            </div>

                            <button
                              onClick={() => handleDeleteClient(c.id, c.name)}
                              className="text-zinc-600 hover:text-red-400 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 hover:border-red-900/50 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                              title="Excluir Cliente"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}

                      {crmClients.filter((c) =>
                        c.name
                          .toLowerCase()
                          .includes(clientSearch.toLowerCase()),
                      ).length === 0 && (
                        <div className="text-center py-10 text-zinc-600 italic text-sm">
                          Nenhum cliente encontrado com esse nome.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {gestaoView === "estoque" && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setGestaoView("menu")}
                      className="text-zinc-500 p-2"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold italic">Estoque</h2>
                  </div>
                  <button
                    onClick={() => setIsProductModalOpen(true)}
                    className="bg-amber-400 text-zinc-950 p-2.5 rounded-xl"
                  >
                    <PlusCircle size={20} />
                  </button>
                </div>
                <div className="flex gap-2 bg-zinc-900 p-1 rounded-xl">
                  <button
                    onClick={() => setEstoqueTab("barbearia")}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg ${estoqueTab === "barbearia" ? "bg-zinc-800 text-amber-400" : "text-zinc-500"}`}
                  >
                    Barbearia
                  </button>
                  <button
                    onClick={() => setEstoqueTab("geladeira")}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg ${estoqueTab === "geladeira" ? "bg-zinc-800 text-amber-400" : "text-zinc-500"}`}
                  >
                    Geladeira
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {products
                    .filter((p) => p.category === estoqueTab)
                    .map((product) => {
                      const isZerado = product.quantity === 0;
                      const isLowStock =
                        product.quantity > 0 && product.quantity <= 5;
                      let cardStyle = "bg-zinc-900 border-zinc-800";
                      if (isZerado)
                        cardStyle =
                          "bg-red-950/10 border-red-900/50 opacity-60";
                      else if (isLowStock)
                        cardStyle = "bg-amber-500/10 border-amber-500/40";
                      return (
                        <div
                          key={product.id}
                          className={`p-4 rounded-2xl flex justify-between items-center border transition-all ${cardStyle}`}
                        >
                          <div className="flex flex-col">
                            <h4
                              className={`font-bold flex items-center gap-2 ${isZerado ? "text-red-400 line-through" : "text-white"}`}
                            >
                              {product.name}
                              {isZerado && (
                                <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider not-italic no-underline">
                                  Esgotado
                                </span>
                              )}
                            </h4>
                            <span
                              className={`text-xs ${isZerado ? "text-red-500/70" : "text-zinc-500"}`}
                            >
                              Qtd: {product.quantity}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-black mr-2 ${isZerado ? "text-red-400/50" : "text-amber-400"}`}
                            >
                              R$ {product.price.toFixed(2).replace(".", ",")}
                            </span>
                            <button
                              onClick={() => openEditProductModal(product)}
                              className="text-zinc-500 p-1.5 hover:text-amber-400 transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="text-zinc-500 p-1.5 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
                <button
                  onClick={() => {
                    setSellQuantity(1);
                    setSellProductId("");
                    setIsSellModalOpen(true);
                  }}
                  className="bg-amber-400 text-zinc-950 font-black py-4 rounded-2xl uppercase tracking-widest flex justify-center gap-2 mt-2"
                >
                  <MinusCircle size={18} /> Registrar Venda
                </button>
              </div>
            )}
            {gestaoView === "servicos" && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setGestaoView("menu")}
                      className="text-zinc-500 p-2"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold italic">Serviços</h2>
                  </div>
                  <button
                    onClick={() => setIsServiceModalOpen(true)}
                    className="bg-amber-400 text-zinc-950 p-2.5 rounded-xl"
                  >
                    <PlusCircle size={20} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {servicesList.length === 0 ? (
                    <div className="text-center py-10 text-zinc-600 italic border border-zinc-800 rounded-3xl">
                      Nenhum serviço cadastrado.
                    </div>
                  ) : (
                    servicesList.map((s) => (
                      <div
                        key={s.id}
                        className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center"
                      >
                        <div className="flex flex-col">
                          <h4 className="font-bold text-zinc-100">{s.name}</h4>
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <Clock size={12} /> {s.duration} min
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-amber-400 mr-2">
                            R$ {s.price.toFixed(2).replace(".", ",")}
                          </span>
                          <button
                            onClick={() => openEditServiceModal(s)}
                            className="text-zinc-500 p-1.5 hover:text-amber-400"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteService(s.id)}
                            className="text-zinc-500 p-1.5 hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL NOVO CLIENTE FANTASMA */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic flex items-center gap-2">
                <UserPlus className="text-amber-400" size={20} /> Novo Cliente
              </h3>
              <p className="text-zinc-500 text-xs mt-1">
                Cadastre rapidamente quem chegou no balcão.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Nome Completo"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
              />
              <input
                type="text"
                placeholder="Telefone / WhatsApp"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
              />
            </div>
            <div className="flex gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setIsNewClientModalOpen(false)}
                className="flex-1 py-3 text-zinc-400 font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateGhostClient}
                disabled={isSavingGhost}
                className="flex-1 py-3 bg-amber-400 text-zinc-950 rounded-xl font-black uppercase text-xs disabled:opacity-50"
              >
                {isSavingGhost ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VENDER PLANO */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div>
              <h3 className="font-bold text-lg italic flex items-center gap-2">
                <CreditCard className="text-amber-400" size={20} /> Vender
                Assinatura
              </h3>
              <p className="text-zinc-500 text-xs mt-1">
                Vincule o plano e absorva o corte atual.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <select
                value={planClientId}
                onChange={(e) => {
                  setPlanClientId(e.target.value);
                  if (e.target.value !== "NEW") {
                    setNewClientName("");
                    setNewClientPhone("");
                  }
                }}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none appearance-none font-bold"
              >
                <option value="">Selecione o Cliente...</option>
                <option value="NEW" className="text-amber-400">
                  ➕ Cadastrar Novo Cliente
                </option>
                {crmClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.is_ghost ? "(Balcão)" : ""}
                  </option>
                ))}
              </select>
              {planClientId === "NEW" && (
                <div className="flex flex-col gap-3 p-4 bg-zinc-950/50 border border-amber-500/20 rounded-2xl animate-in zoom-in-95">
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">
                    Novo Perfil Rápido
                  </p>
                  <input
                    type="text"
                    placeholder="Nome Completo"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                  />
                  <input
                    type="text"
                    placeholder="WhatsApp"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                  />
                </div>
              )}
              <select
                value={planName}
                onChange={(e) => {
                  const val = e.target.value;
                  setPlanName(val);
                  const svc = servicesList.find((s) => s.name === val);
                  if (svc && !isMigratedPlan)
                    setPlanPrice(svc.price.toFixed(2).replace(".", ","));
                }}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none appearance-none"
              >
                <option value="">Qual Plano?</option>
                {servicesList
                  .filter((s) => s.name.toLowerCase().includes("plano"))
                  .map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} - R$ {s.price.toFixed(2).replace(".", ",")}
                    </option>
                  ))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    value={isMigratedPlan ? "0,00" : planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    disabled={isMigratedPlan}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                    Qtd Cortes
                  </label>
                  <input
                    type="number"
                    value={planCuts}
                    onChange={(e) => setPlanCuts(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={planStartDate}
                  onChange={(e) => setPlanStartDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none [color-scheme:dark]"
                />
              </div>

              <div className="flex flex-col gap-3 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/60 mt-2">
                <label className="flex items-center gap-3 text-sm font-bold text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMigratedPlan}
                    onChange={(e) => {
                      setIsMigratedPlan(e.target.checked);
                      setAbsorbTodayCut(false);
                    }}
                    className="w-5 h-5 rounded border-zinc-700 text-amber-400 focus:ring-amber-400 bg-zinc-800"
                  />
                  Plano Migrado Antigo
                </label>
                {isMigratedPlan && (
                  <input
                    type="number"
                    placeholder="Quantos cortes ele já usou?"
                    value={migratedCutsUsed}
                    onChange={(e) => setMigratedCutsUsed(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                  />
                )}
                {!isMigratedPlan && (
                  <>
                    <label className="flex items-center gap-3 text-sm font-bold text-zinc-300 cursor-pointer border-t border-zinc-800/60 pt-3">
                      <input
                        type="checkbox"
                        checked={absorbTodayCut}
                        onChange={(e) => setAbsorbTodayCut(e.target.checked)}
                        className="w-5 h-5 rounded border-zinc-700 text-amber-400 focus:ring-amber-400 bg-zinc-800"
                      />{" "}
                      Absorver Corte de Hoje (Upsell)
                    </label>
                    {absorbTodayCut && (
                      <select
                        value={appointmentToAbsorb}
                        onChange={(e) => setAppointmentToAbsorb(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none appearance-none mt-1"
                      >
                        <option value="">
                          Selecione o horário na agenda...
                        </option>
                        <option value="NO_APPT">
                          ✂️ Não lancei na agenda (Apenas debitar 1 corte)
                        </option>
                        {clientTodayAppts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.time} - {a.service}
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="flex-1 py-3 text-zinc-400 font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreatePlan}
                disabled={isSavingPlan || !planClientId || !planName}
                className="flex-1 py-3 bg-amber-400 text-zinc-950 rounded-xl font-black uppercase text-xs disabled:opacity-50"
              >
                {isSavingPlan ? "Processando..." : "Confirmar Venda"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PLANO (NOVO) */}
      {isEditPlanModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic text-amber-400">
                Editar Assinatura
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                  Cortes Usados
                </label>
                <input
                  type="number"
                  value={editPlanCutsUsed}
                  onChange={(e) => setEditPlanCutsUsed(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                  Cortes Totais
                </label>
                <input
                  type="number"
                  value={editPlanCutsAllowed}
                  onChange={(e) => setEditPlanCutsAllowed(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-1">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  value={editPlanPrice}
                  onChange={(e) => setEditPlanPrice(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={editPlanStartDate}
                  onChange={(e) => setEditPlanStartDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="flex gap-3 border-t border-zinc-800 pt-4 mt-2">
              <button
                onClick={() => setIsEditPlanModalOpen(false)}
                className="flex-1 py-3 text-zinc-400 font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePlan}
                disabled={isUpdatingPlan}
                className="flex-1 bg-amber-400 text-zinc-950 py-3 rounded-xl font-black uppercase text-xs disabled:opacity-50"
              >
                {isUpdatingPlan ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RENOVAR PLANO (NOVO) */}
      {/* MODAL RENOVAR PLANO (BLINDADO) */}
      {isRenewPlanModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic text-emerald-400">
                Renovar Assinatura
              </h3>
              <p className="text-zinc-500 text-xs mt-1">
                O plano antigo será encerrado e um novo ciclo se iniciará no
                caixa.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              {/* SELECT DE PLANOS (A MÁGICA ACONTECE AQUI) */}
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                  Qual Plano? (Upgrade / Downgrade)
                </label>
                <select
                  value={renewPlanName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRenewPlanName(val);
                    const svc = servicesList.find((s) => s.name === val);
                    if (svc) {
                      setRenewPlanPrice(svc.price.toFixed(2).replace(".", ","));
                    }
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none appearance-none font-bold focus:border-emerald-400 transition-colors"
                >
                  <option value="">Selecione o Plano...</option>
                  {servicesList
                    .filter((s) => s.name.toLowerCase().includes("plano"))
                    .map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} - R$ {s.price.toFixed(2).replace(".", ",")}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                  Início do Novo Ciclo
                </label>
                <input
                  type="date"
                  value={renewStartDate}
                  onChange={(e) => setRenewStartDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none [color-scheme:dark]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    value={renewPlanPrice}
                    readOnly
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 text-emerald-400 font-black rounded-xl px-4 py-3 outline-none cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block pl-1">
                    Qtd Cortes
                  </label>
                  <input
                    type="number"
                    value={renewPlanCuts}
                    onChange={(e) => setRenewPlanCuts(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 border-t border-zinc-800 pt-4 mt-2">
              <button
                onClick={() => setIsRenewPlanModalOpen(false)}
                className="flex-1 py-3 text-zinc-400 font-bold text-sm hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenewPlan}
                disabled={isRenewingPlan || !renewPlanName}
                className="flex-1 bg-emerald-500 text-zinc-950 py-3 rounded-xl font-black uppercase text-[10px] disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"
              >
                {isRenewingPlan ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OUTROS MODAIS */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic flex items-center gap-2">
                <Target className="text-amber-400" size={20} /> Definir Novo
                Objetivo
              </h3>
            </div>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Ex: Trocar pneu do carro"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
              />
              <input
                type="number"
                placeholder="Valor (Ex: 1500,00)"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
              />
            </div>
            <div className="flex gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="flex-1 py-3 text-zinc-400 font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddGoal}
                disabled={isSavingGoal}
                className="flex-1 py-3 bg-amber-400 text-zinc-950 rounded-xl font-black uppercase text-xs"
              >
                Criar Meta
              </button>
            </div>
          </div>
        </div>
      )}
      {(isServiceModalOpen || isEditServiceModalOpen) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic">
                {isEditServiceModalOpen ? "Editar Serviço" : "Novo Serviço"}
              </h3>
            </div>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Nome (Ex: Barba e Toalha)"
                value={svcName}
                onChange={(e) => setSvcName(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Preço (Ex: 35,00)"
                  value={svcPrice}
                  onChange={(e) => setSvcPrice(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
                />
                <input
                  type="number"
                  placeholder="Minutos (Ex: 30)"
                  value={svcDuration}
                  onChange={(e) => setSvcDuration(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-2 border-t border-zinc-800 pt-4">
              <button
                onClick={() => {
                  setIsServiceModalOpen(false);
                  setIsEditServiceModalOpen(false);
                }}
                className="flex-1 py-3 text-zinc-400 font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={
                  isEditServiceModalOpen
                    ? handleUpdateService
                    : handleAddService
                }
                disabled={isSavingSvc}
                className="flex-1 py-3 bg-amber-400 text-zinc-950 rounded-xl font-black uppercase text-xs"
              >
                {isSavingSvc ? "..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic">Novo Produto</h3>
            </div>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Nome"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="R$ 0,00"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
                />
                <input
                  type="number"
                  placeholder="Qtd"
                  value={productQuantity}
                  onChange={(e) => setProductQuantity(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
                />
              </div>
              <div className="flex bg-zinc-800 p-1 rounded-xl">
                <button
                  onClick={() => setProductCategory("barbearia")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold ${productCategory === "barbearia" ? "bg-amber-400 text-zinc-950" : "text-zinc-500"}`}
                >
                  Barbearia
                </button>
                <button
                  onClick={() => setProductCategory("geladeira")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold ${productCategory === "geladeira" ? "bg-amber-400 text-zinc-950" : "text-zinc-500"}`}
                >
                  Geladeira
                </button>
              </div>
            </div>
            <div className="flex gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="flex-1 py-3"
              >
                Sair
              </button>
              <button
                onClick={handleAddProduct}
                disabled={isSavingProduct}
                className="flex-1 py-3 bg-amber-400 text-zinc-950 rounded-xl font-black uppercase text-xs"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {isEditProductModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic">Editar Produto</h3>
            </div>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={editProductName}
                onChange={(e) => setEditProductName(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={editProductPrice}
                  onChange={(e) => setEditProductPrice(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
                />
                <input
                  type="number"
                  value={editProductQuantity}
                  onChange={(e) => setEditProductQuantity(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setIsEditProductModalOpen(false)}
                className="flex-1 py-3"
              >
                Sair
              </button>
              <button
                onClick={handleUpdateProduct}
                disabled={isUpdatingProduct}
                className="flex-1 py-3 bg-amber-400 text-zinc-950 rounded-xl font-black uppercase text-xs"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>
      )}
      {isSellModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic">Registrar Venda</h3>
            </div>
            <select
              value={sellProductId}
              onChange={(e) => setSellProductId(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none appearance-none"
            >
              <option value="">Item...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                  {p.name} ({p.quantity === 0 ? "ZERADO" : p.quantity})
                </option>
              ))}
            </select>
            <div className="flex items-center gap-4 mx-auto">
              <button
                onClick={() => setSellQuantity((q) => Math.max(1, q - 1))}
                className="bg-zinc-800 p-4 rounded-xl"
              >
                -
              </button>
              <span className="text-2xl font-black text-amber-400">
                {sellQuantity}
              </span>
              <button
                onClick={() => setSellQuantity((q) => q + 1)}
                className="bg-zinc-800 p-4 rounded-xl"
              >
                +
              </button>
            </div>
            <div className="flex gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setIsSellModalOpen(false)}
                className="flex-1 py-3"
              >
                Sair
              </button>
              <button
                onClick={handleSellProduct}
                disabled={isSelling || !sellProductId}
                className="flex-1 py-3 bg-amber-400 text-zinc-950 rounded-xl font-black uppercase text-xs"
              >
                Vender
              </button>
            </div>
          </div>
        </div>
      )}
      {editingAppointment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic text-amber-400">
                Remarcar
              </h3>
            </div>
            <input
              type="date"
              min={todayStr}
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white [color-scheme:dark]"
            />
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {HOURS.filter((h) => !editTakenSlots.includes(h)).map((h) => (
                <button
                  key={h}
                  onClick={() => setEditTime(h)}
                  className={`py-2 rounded-xl text-xs font-bold border ${editTime === h ? "bg-amber-400 text-zinc-950" : "bg-zinc-800 text-white"}`}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="flex gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setEditingAppointment(null)}
                className="flex-1 py-3"
              >
                Sair
              </button>
              <button
                onClick={handleReschedule}
                disabled={isUpdating || !editTime}
                className="flex-1 py-3 bg-amber-400 text-zinc-950 rounded-xl font-black uppercase text-xs"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800/50 px-6 pt-3 pb-8 flex justify-between items-center z-50">
        <NavButton icon={Home} label="Início" tabId="home" />
        <NavButton icon={Calendar} label="Agenda" tabId="agenda" />
        <button
          onClick={() => setActiveTab("novo")}
          className="bg-amber-400 p-4 rounded-2xl -mt-14 shadow-[0_10px_25px_rgba(251,191,36,0.4)] text-zinc-950 transition-transform active:scale-90"
        >
          <PlusCircle size={32} strokeWidth={2.5} />
        </button>
        <NavButton icon={DollarSign} label="Finanças" tabId="financeiro" />
        <NavButton icon={Briefcase} label="Gestão" tabId="gestao" />
      </nav>
    </main>
  );
}
