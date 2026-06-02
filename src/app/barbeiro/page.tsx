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
  Target,
  CreditCard,
  UserPlus,
  BarChart3,
  Scissors,
  CheckCircle2,
} from "lucide-react";

// --- MOTOR DE TEMPO E AUTO-COMPLETE ---
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

const isPast = (dateStr: string, timeStr: string) => {
  if (!dateStr || !timeStr) return false;
  const now = new Date();
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const apptDate = new Date(year, month - 1, day, hours, minutes);
  return now > apptDate;
};

type Appointment = {
  id: string;
  client_id: string;
  client_plan_id?: string;
  service: string;
  date: string;
  time: string;
  status: string;
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

  // --- ATUALIZADO: MULTI-SELECT PARA BLOQUEIOS ---
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<
    "home" | "agenda" | "financeiro" | "gestao" | "novo"
  >("home");

  const todayStr = new Date().toISOString().split("T")[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];
  const monthEnd = new Date();
  monthEnd.setDate(monthEnd.getDate() + 30);
  const monthEndStr = monthEnd.toISOString().split("T")[0];

  const [manualClientId, setManualClientId] = useState("AVULSO");
  const [manualCustomer, setManualCustomer] = useState("");
  const [manualService, setManualService] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualDate, setManualDate] = useState(todayStr);
  const [manualTime, setManualTime] = useState("");
  const [usePlan, setUsePlan] = useState(false);
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
    mesAtual: 0,
    mesPassado: 0,
    total: 0,
    clientesMesAtual: 0,
    clientesMesPassado: 0,
    globalMesAtual: 0,
    globalClientesMesAtual: 0,
    servicosMesAtual: 0,
    produtosMesAtual: 0,
  });
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  // CRM
  const [crmTab, setCrmTab] = useState<"assinaturas" | "clientes">(
    "assinaturas",
  );
  const [clientPlans, setClientPlans] = useState<any[]>([]);
  const [crmClients, setCrmClients] = useState<any[]>([]);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planClientId, setPlanClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [isSavingGhost, setIsSavingGhost] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planCuts, setPlanCuts] = useState("4");
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isMigratedPlan, setIsMigratedPlan] = useState(false);
  const [migratedCutsUsed, setMigratedCutsUsed] = useState("0");
  const [absorbTodayCut, setAbsorbTodayCut] = useState(false);
  const [appointmentToAbsorb, setAppointmentToAbsorb] = useState("");

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
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDayThisMonth = new Date(year, month, 1)
      .toISOString()
      .split("T")[0];
    const firstDayLastMonth = new Date(year, month - 1, 1)
      .toISOString()
      .split("T")[0];
    const lastDayLastMonth = new Date(year, month, 0)
      .toISOString()
      .split("T")[0];
    const today = now.toISOString().split("T")[0];

    const { data: allPlans } = await supabase
      .from("client_plans")
      .select("price_paid, created_at, barber_id");
    const { data: allAppts } = await supabase
      .from("appointments")
      .select("price_applied, date, time, barber_id, status, service")
      .in("status", ["confirmed", "completed"]);
    const { data: allProductSales } = await supabase
      .from("product_sales")
      .select("total_price, created_at, barber_id");

    let mesAtual = 0,
      mesPassado = 0,
      total = 0,
      clientesMesAtual = 0,
      clientesMesPassado = 0,
      globalMesAtual = 0,
      globalClientesMesAtual = 0,
      produtosMesAtual = 0;

    if (allPlans) {
      allPlans.forEach((p) => {
        const val = Number(p.price_paid);
        const pDate = p.created_at.split("T")[0];
        if (p.barber_id === barberId) {
          total += val;
          if (pDate >= firstDayThisMonth) mesAtual += val;
          if (pDate >= firstDayLastMonth && pDate <= lastDayLastMonth)
            mesPassado += val;
        }
        if (pDate >= firstDayThisMonth) globalMesAtual += val;
      });
    }

    if (allAppts) {
      allAppts.forEach((a) => {
        const val = Number(a.price_applied || 0);
        const aDate = a.date;
        const isBlock = a.service.startsWith("BLOQUEIO");
        const timeHasPassed = isPast(a.date, a.time);
        const shouldCountRevenue =
          a.status === "completed" ||
          (a.status === "confirmed" && timeHasPassed);

        if (a.barber_id === barberId && shouldCountRevenue) {
          total += val;
          if (aDate >= firstDayThisMonth && aDate <= today) {
            mesAtual += val;
            if (!isBlock) clientesMesAtual++;
          }
          if (aDate >= firstDayLastMonth && aDate <= lastDayLastMonth) {
            mesPassado += val;
            if (!isBlock) clientesMesPassado++;
          }
        }
        if (
          aDate >= firstDayThisMonth &&
          aDate <= today &&
          shouldCountRevenue
        ) {
          globalMesAtual += val;
          if (!isBlock) globalClientesMesAtual++;
        }
      });
    }

    if (allProductSales) {
      allProductSales.forEach((s) => {
        const val = Number(s.total_price || 0);
        const sDate = s.created_at.split("T")[0];
        if (s.barber_id === barberId) {
          total += val;
          if (sDate >= firstDayThisMonth && sDate <= today) {
            mesAtual += val;
            produtosMesAtual += val;
          }
          if (sDate >= firstDayLastMonth && sDate <= lastDayLastMonth)
            mesPassado += val;
        }
        if (sDate >= firstDayThisMonth && sDate <= today) globalMesAtual += val;
      });
    }

    const servicosMesAtual = mesAtual - produtosMesAtual;
    setFinances({
      mesAtual,
      mesPassado,
      total,
      clientesMesAtual,
      clientesMesPassado,
      globalMesAtual,
      globalClientesMesAtual,
      servicosMesAtual,
      produtosMesAtual,
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

  const isEditDateBlocked = (d: string) => {
    const day = new Date(d + "T12:00:00").getDay();
    return day === 0 || blockedDates.some((b) => b.date === d);
  };
  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  // --- ATUALIZADO: SALVAMENTO EM LOTE DE MULTIPLOS HORÁRIOS BLOQUEADOS ---
  async function handleSmartBlock() {
    if (!newBlockDate || !barberId) return;
    setLoadingBlock(true);

    if (isFullDay) {
      await supabase
        .from("blocked_dates")
        .insert({
          barber_id: barberId,
          date: newBlockDate,
          reason: newBlockReason || "Folga",
        });
    } else {
      const motivoFinal = newBlockReason
        ? `BLOQUEIO: ${newBlockReason}`
        : "BLOQUEIO INDISPONÍVEL";

      const blocksToInsert = selectedTimes.map((time) => ({
        barber_id: barberId,
        client_id: profile?.id,
        date: newBlockDate,
        time: time,
        service: motivoFinal,
        status: "confirmed",
        price_applied: 0,
      }));

      await supabase.from("appointments").insert(blocksToInsert);
    }
    loadAppts();
    setNewBlockDate("");
    setNewBlockReason("");
    setSelectedTimes([]);
    setLoadingBlock(false);
  }

  async function deleteAppointment(id: string) {
    if (!confirm("Remover bloqueio?")) return;
    await supabase.from("appointments").delete().eq("id", id);
    loadAppts();
  }
  async function deleteFullDayBlock(id: string) {
    if (!confirm("Remover bloqueio do dia inteiro?")) return;
    await supabase.from("blocked_dates").delete().eq("id", id);
    loadAppts();
  }

  async function handleCancelByBarber(id: string) {
    if (!confirm("Cancelar?")) return;
    const apptToCancel = [...today, ...week].find((a) => a.id === id);

    await supabase
      .from("appointments")
      .update({ status: "canceled" })
      .eq("id", id);

    if (apptToCancel?.client_plan_id) {
      const { data: planData } = await supabase
        .from("client_plans")
        .select("cuts_used")
        .eq("id", apptToCancel.client_plan_id)
        .single();
      if (planData && planData.cuts_used > 0) {
        await supabase
          .from("client_plans")
          .update({ cuts_used: planData.cuts_used - 1 })
          .eq("id", apptToCancel.client_plan_id);
      }
    }
    loadAppts();
    loadFinancesAndGoals();
    loadCRMData();
  }

  async function handleNoShow(id: string) {
    if (!confirm("Registrar FURO? O plano NÃO devolve cota em caso de falta."))
      return;
    await supabase
      .from("appointments")
      .update({ status: "no-show" })
      .eq("id", id);
    loadAppts();
    loadFinancesAndGoals();
  }

  async function handleCreateGhostClient() {
    if (!newClientName || !newClientPhone)
      return alert("Preencha Nome e Telefone!");
    setIsSavingGhost(true);
    const { error } = await supabase
      .from("profiles")
      .insert({
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
    if (!planClientId || !planName || !planCuts)
      return alert("Preencha o cliente, nome do plano e cota!");
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
      loadCRMData();
      loadAppts();
      loadFinancesAndGoals();
    }
    setIsSavingPlan(false);
  }

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
    await supabase
      .from("barber_goals")
      .insert({
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
    await supabase
      .from("products")
      .insert({
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
    await supabase
      .from("product_sales")
      .insert({
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
    await supabase
      .from("services")
      .insert({
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
    if (!manualCustomer || !manualService || !manualDate || !manualTime) return;
    setIsSaving(true);

    const selectedServiceData = servicesList.find(
      (sv) => sv.name === manualService,
    );
    let appliedPrice = selectedServiceData ? selectedServiceData.price : 0;
    let finalServiceTag = `MANUAL: ${manualCustomer} - ${manualService}`;
    let planId = null;

    if (usePlan && activeClientPlan) {
      appliedPrice = 0;
      finalServiceTag = `PLANO: ${activeClientPlan.plan_name}`;
      planId = activeClientPlan.id;
    }

    const { error } = await supabase.from("appointments").insert({
      barber_id: barberId,
      client_id: manualClientId !== "AVULSO" ? manualClientId : profile?.id,
      client_plan_id: planId,
      date: manualDate,
      time: manualTime,
      service: finalServiceTag,
      status: "confirmed",
      price_applied: appliedPrice,
    });

    if (!error) {
      if (usePlan && activeClientPlan) {
        await supabase
          .from("client_plans")
          .update({ cuts_used: activeClientPlan.cuts_used + 1 })
          .eq("id", activeClientPlan.id);
      }
      setManualClientId("AVULSO");
      setManualCustomer("");
      setManualService("");
      setManualPrice("");
      setManualDate(todayStr);
      setManualTime("");
      setUsePlan(false);
      setActiveTab("agenda");
      loadAppts();
      loadFinancesAndGoals();
      loadCRMData();
    }
    setIsSaving(false);
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
                  today.map((a) => {
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
                            <div className="text-lg font-black leading-none">
                              {a.time}
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
                              onClick={() => deleteAppointment(a.id)}
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

        {/* --- ATUALIZADO: AGENDA COM MULTI-SELECT DE BLOQUEIO --- */}
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
                {week.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-10 text-center text-zinc-600 text-sm italic">
                    Nenhum compromisso agendado para o período.
                  </div>
                ) : (
                  week.map((a) => {
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
                            <div className="text-zinc-500 text-[10px] font-bold mt-1">
                              {a.time}
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
                              onClick={() => deleteAppointment(a.id)}
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
                            if (isSelected)
                              setSelectedTimes(
                                selectedTimes.filter((time) => time !== h),
                              );
                            else setSelectedTimes([...selectedTimes, h]);
                          }}
                          className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${isSelected ? "bg-amber-400 border-amber-400 text-zinc-950" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                )}
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

        {/* --- ATUALIZADO: NOVO AGENDAMENTO INTELIGENTE --- */}
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
                onChange={(e) => {
                  const val = e.target.value;
                  setManualClientId(val);
                  setUsePlan(false);
                  if (val !== "AVULSO") {
                    const c = crmClients.find((client) => client.id === val);
                    setManualCustomer(c ? c.name : "");
                  } else {
                    setManualCustomer("");
                  }
                }}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none appearance-none font-bold focus:border-amber-400 transition-colors"
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
                    const sD = servicesList.find((sv) => sv.name === s);
                    if (sD)
                      setManualPrice(
                        `R$ ${sD.price.toFixed(2).replace(".", ",")}`,
                      );
                  }}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none appearance-none focus:border-amber-400 transition-colors"
                >
                  <option value="">Serviço...</option>
                  {servicesList
                    .filter((s) => !s.name.toLowerCase().includes("plano"))
                    .map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  value={usePlan ? "R$ 0,00" : manualPrice}
                  readOnly
                  className={`bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 font-bold ${usePlan ? "text-amber-400" : "text-zinc-500"}`}
                />
              </div>

              {activeClientPlan && (
                <div className="bg-zinc-950/50 p-4 rounded-2xl border border-amber-500/30 flex flex-col gap-2 animate-in zoom-in-95 shadow-[0_0_15px_rgba(251,191,36,0.05)]">
                  <label className="flex items-center gap-3 text-sm font-bold text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usePlan}
                      onChange={(e) => setUsePlan(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-700 text-amber-400 focus:ring-amber-400 bg-zinc-800"
                    />
                    Descontar do Plano Ativo
                  </label>
                  <p className="text-[10px] text-amber-400 font-bold uppercase ml-8 tracking-wider">
                    {activeClientPlan.plan_name} • {activeClientPlan.cuts_used}/
                    {activeClientPlan.cuts_allowed} usados
                  </p>
                </div>
              )}

              <input
                type="date"
                value={manualDate}
                onChange={(e) => {
                  setManualDate(e.target.value);
                  setManualTime("");
                }}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white [color-scheme:dark] focus:border-amber-400 transition-colors"
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

        {/* FINANÇAS E GERAL (MANTIDO) */}
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
            <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <BarChart3 className="text-amber-400" size={18} />
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Visão Geral da Barbearia (Mês)
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">
                    Faturamento Geral
                  </p>
                  <p className="text-lg font-black text-white">
                    R$ {finances.globalMesAtual.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">
                    Total de Atendimentos
                  </p>
                  <p className="text-lg font-black text-white">
                    {finances.globalClientesMesAtual}
                  </p>
                </div>
              </div>
            </section>
            <section className="flex flex-col gap-4">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-2">
                Seus Números
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-zinc-500 mb-1">
                    <DollarSign size={16} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Receita
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">
                    R$ {finances.mesAtual.toFixed(2).replace(".", ",")}
                  </div>
                  <div className="flex flex-col gap-1 mt-2 border-t border-zinc-800/60 pt-2">
                    <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase">
                      <span>Serviços:</span>
                      <span className="text-zinc-200">
                        R${" "}
                        {finances.servicosMesAtual.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase">
                      <span>Produtos:</span>
                      <span className="text-zinc-200">
                        R${" "}
                        {finances.produtosMesAtual.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-zinc-500 mb-1">
                    <Scissors size={16} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Atendidos
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">
                    {finances.clientesMesAtual}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 w-fit px-2 py-1 rounded-md mt-1">
                    <TrendingUp size={12} />+{" "}
                    {(
                      ((finances.clientesMesAtual -
                        finances.clientesMesPassado) /
                        (finances.clientesMesPassado || 1)) *
                      100
                    ).toFixed(0)}
                    % vs último mês
                  </div>
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

        {/* GESTÃO & CRM AVANÇADO */}
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
                    {clientPlans.length === 0 ? (
                      <div className="text-center py-12 px-6 text-zinc-600 italic border border-zinc-800 rounded-3xl flex flex-col items-center gap-3 bg-zinc-900/30">
                        <CreditCard size={32} className="text-zinc-700" />{" "}
                        Nenhum plano ativo no momento. Venda sua primeira
                        assinatura!
                      </div>
                    ) : (
                      clientPlans.map((plan) => {
                        const startDate = new Date(plan.start_date);
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
                          plan.cuts_used >= plan.cuts_allowed ||
                          plan.status === "expired"
                        ) {
                          semCardClass = "border-red-500/30 bg-red-950/20";
                          semBadgeClass =
                            "bg-red-500/10 text-red-400 border-red-500/20";
                          semText = "🔴 Esgotado / Expirado";
                        } else if (
                          diffDays <= 7 ||
                          plan.cuts_used === plan.cuts_allowed - 1
                        ) {
                          semCardClass = "border-amber-500/30 bg-amber-950/20";
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
                                  {plan.cuts_used} de {plan.cuts_allowed} cortes
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
                                  {plan.price_paid.toFixed(2).replace(".", ",")}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
                {crmTab === "clientes" && (
                  <div className="flex flex-col gap-3 mt-2">
                    {crmClients.map((c) => (
                      <div
                        key={c.id}
                        className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center"
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
                        </div>
                        <div className="text-xs text-zinc-500 bg-zinc-950 px-2 py-1 rounded-lg">
                          Nasc:{" "}
                          {c.birth_date
                            ? c.birth_date.split("-").reverse().join("/")
                            : "--/--/----"}
                        </div>
                      </div>
                    ))}
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
                <input
                  type="text"
                  placeholder="Valor (R$)"
                  value={isMigratedPlan ? "0,00" : planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                  disabled={isMigratedPlan}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <input
                  type="number"
                  placeholder="Qtd Cortes"
                  value={planCuts}
                  onChange={(e) => setPlanCuts(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
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
                      />
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
