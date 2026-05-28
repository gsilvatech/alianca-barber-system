"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DailyWord from "@/components/DailyWord";
import { HOURS } from "@/lib/constant"; // AGORA IMPORTAMOS APENAS AS HORAS DAQUI
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
} from "lucide-react";

// --- MOTOR DE TEMPO SGO ---
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

type Appointment = {
  id: string;
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
  const [selectedTime, setSelectedTime] = useState("");

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

  const [manualCustomer, setManualCustomer] = useState("");
  const [manualService, setManualService] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualDate, setManualDate] = useState(todayStr);
  const [manualTime, setManualTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [manualTakenSlots, setManualTakenSlots] = useState<string[]>([]);

  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editTakenSlots, setEditTakenSlots] = useState<string[]>([]);

  // --- ESTADOS GESTÃO ---
  const [gestaoView, setGestaoView] = useState<
    "menu" | "estoque" | "crm" | "servicos"
  >("menu");

  // Estados Estoque
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

  // Estados Venda
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [sellProductId, setSellProductId] = useState("");
  const [sellQuantity, setSellQuantity] = useState(1);
  const [isSelling, setIsSelling] = useState(false);

  // Estados de Serviços
  const [servicesList, setServicesList] = useState<BarberService[]>([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isEditServiceModalOpen, setIsEditServiceModalOpen] = useState(false);
  const [svcName, setSvcName] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcDuration, setSvcDuration] = useState("");
  const [svcId, setSvcId] = useState("");
  const [isSavingSvc, setIsSavingSvc] = useState(false);

  async function loadAppts() {
    if (!barberId) return;
    let endDate = tab === "semana" ? weekEndStr : monthEndStr;

    const [{ data: todayAppts }, { data: weekAppts }, { data: blocked }] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("id, service, date, time, status, profiles(name, phone)")
          .eq("barber_id", barberId)
          .eq("date", todayStr)
          .in("status", ["confirmed", "canceled"])
          .order("time"),
        supabase
          .from("appointments")
          .select("id, service, date, time, status, profiles(name, phone)")
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

  async function loadProducts() {
    if (!barberId) return;
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");
    if (!error) setProducts(data || []);
  }

  async function loadServicesFromDB() {
    if (!barberId) return;
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .order("name");
    if (!error) setServicesList(data || []);
  }

  useEffect(() => {
    async function loadInitial() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", user.id)
        .single();
      if (
        prof?.role !== "barbers" &&
        prof?.role !== "barber" &&
        prof?.role !== "admin"
      ) {
        router.push("/cliente");
        return;
      }
      setProfile({ ...prof, id: user.id });

      const { data: barber } = await supabase
        .from("barbers")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!barber) return;
      setBarberId(barber.id);
    }
    loadInitial();
  }, []);

  useEffect(() => {
    if (barberId) {
      loadAppts();
      loadProducts();
      loadServicesFromDB();
    }
  }, [barberId, tab]);

  // --- LOGICA DE AGENDAMENTO COM BANCO DE DADOS ---
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

      if (actualServiceName.startsWith("MANUAL:")) {
        actualServiceName = actualServiceName.split(" - ")[1] || "Corte";
      }
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
    if (!d) return false;
    const day = new Date(d + "T12:00:00").getDay();
    return day === 0 || blockedDates.some((b) => b.date === d);
  };

  async function handleUnblockDate(id: string) {
    await supabase.from("blocked_dates").delete().eq("id", id);
    setBlockedDates((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  async function handleSmartBlock() {
    if (!newBlockDate || !barberId) return;
    loadingBlock || setLoadingBlock(true);
    if (isFullDay) {
      const { data, error } = await supabase
        .from("blocked_dates")
        .insert({
          barber_id: barberId,
          date: newBlockDate,
          reason: newBlockReason || "Folga",
        })
        .select()
        .single();
      if (!error) setBlockedDates((prev) => [...prev, data]);
    } else {
      const motivoFinal = newBlockReason
        ? `BLOQUEIO: ${newBlockReason}`
        : "BLOQUEIO INDISPONÍVEL";
      const { error } = await supabase.from("appointments").insert({
        barber_id: barberId,
        client_id: profile?.id,
        date: newBlockDate,
        time: selectedTime,
        service: motivoFinal,
        status: "confirmed",
      });
      if (!error) loadAppts();
    }
    setNewBlockDate("");
    setNewBlockReason("");
    setSelectedTime("");
    setLoadingBlock(false);
  }

  async function deleteAppointment(id: string) {
    if (!confirm("Deseja remover este bloqueio?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (!error) loadAppts();
  }

  async function handleCancelByBarber(id: string) {
    if (!confirm("Tem certeza que deseja cancelar?")) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "canceled" })
      .eq("id", id);
    if (!error) {
      loadAppts();
      alert("Cancelado!");
    }
  }

  function openEditModal(appt: Appointment) {
    setEditingAppointment(appt);
    setEditDate(appt.date);
    setEditTime(appt.time);
  }

  async function handleReschedule() {
    if (!editingAppointment || !editDate || !editTime) return;
    setIsUpdating(true);
    const { error } = await supabase
      .from("appointments")
      .update({ date: editDate, time: editTime })
      .eq("id", editingAppointment.id);
    if (!error) {
      setEditingAppointment(null);
      loadAppts();
      alert("Remarcado!");
    }
    setIsUpdating(false);
  }

  // --- CRUD ESTOQUE ---
  async function handleAddProduct() {
    if (!productName || !productPrice || !productQuantity)
      return alert("Preencha tudo!");
    setIsSavingProduct(true);
    const { error } = await supabase.from("products").insert({
      barber_id: barberId,
      name: productName,
      price: parseFloat(productPrice.replace(",", ".")),
      quantity: parseInt(productQuantity),
      category: productCategory,
    });
    if (!error) {
      setProductName("");
      setProductPrice("");
      setProductQuantity("");
      setIsProductModalOpen(false);
      loadProducts();
    }
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
    const { error } = await supabase
      .from("products")
      .update({
        name: editProductName,
        price: parseFloat(editProductPrice.replace(",", ".")),
        quantity: parseInt(editProductQuantity),
        category: editProductCategory,
      })
      .eq("id", editProductId);
    if (!error) {
      setIsEditProductModalOpen(false);
      loadProducts();
    }
    setIsUpdatingProduct(false);
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm("Remover?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) loadProducts();
  }

  async function handleSellProduct() {
    const product = products.find((p) => p.id === sellProductId);
    if (!product || product.quantity < sellQuantity)
      return alert("Estoque insuficiente!");
    setIsSelling(true);
    const { error } = await supabase
      .from("products")
      .update({ quantity: product.quantity - sellQuantity })
      .eq("id", sellProductId);
    if (!error) {
      setIsSellModalOpen(false);
      setSellProductId("");
      setSellQuantity(1);
      loadProducts();
    }
    setIsSelling(false);
  }

  // --- CRUD SERVIÇOS ---
  async function handleAddService() {
    if (!svcName || !svcPrice || !svcDuration) return alert("Preencha tudo!");
    setIsSavingSvc(true);
    const { error } = await supabase.from("services").insert({
      barber_id: barberId,
      name: svcName,
      price: parseFloat(svcPrice.replace(",", ".")),
      duration: parseInt(svcDuration),
    });
    if (!error) {
      setSvcName("");
      setSvcPrice("");
      setSvcDuration("");
      setIsServiceModalOpen(false);
      loadServicesFromDB();
    }
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
    const { error } = await supabase
      .from("services")
      .update({
        name: svcName,
        price: parseFloat(svcPrice.replace(",", ".")),
        duration: parseInt(svcDuration),
      })
      .eq("id", svcId);
    if (!error) {
      setIsEditServiceModalOpen(false);
      loadServicesFromDB();
    }
    setIsSavingSvc(false);
  }

  async function handleDeleteService(id: string) {
    if (!confirm("Deseja excluir este serviço?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (!error) loadServicesFromDB();
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

  async function handleManualSchedule() {
    if (!manualCustomer || !manualService || !manualDate || !manualTime)
      return alert("Preencha tudo!");
    setIsSaving(true);
    const { error } = await supabase.from("appointments").insert({
      barber_id: barberId,
      client_id: profile?.id,
      date: manualDate,
      time: manualTime,
      service: `MANUAL: ${manualCustomer} - ${manualService}`,
      status: "confirmed",
    });
    if (!error) {
      setManualCustomer("");
      setManualService("");
      setManualPrice("");
      setManualDate(todayStr);
      setManualTime("");
      setActiveTab("agenda");
      loadAppts();
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
                  today.map((a) => {
                    const isBlock = a.service.startsWith("BLOQUEIO");
                    const isCanceled = a.status === "canceled";
                    return (
                      <div
                        key={a.id}
                        className={`bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 flex flex-col gap-2 ${isCanceled ? "opacity-40 grayscale" : ""} ${isBlock ? "border-red-900/30" : ""}`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`rounded-xl px-3 py-2 text-center min-w-[60px] ${isBlock ? "bg-red-500 text-white" : "bg-amber-400 text-zinc-950"}`}
                          >
                            <div className="text-lg font-black leading-none">
                              {a.time}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div
                              className={`font-bold italic ${isBlock ? "text-red-400" : "text-zinc-100"}`}
                            >
                              {isBlock
                                ? "HORÁRIO BLOQUEADO"
                                : renderCustomerName(a)}
                            </div>
                            <div className="text-zinc-500 text-xs font-medium mt-0.5">
                              {isBlock
                                ? a.service.replace("BLOQUEIO: ", "")
                                : renderServiceDescription(a)}
                            </div>
                          </div>
                          {!isBlock && !isCanceled && (
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
                          {isBlock && !isCanceled && (
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

        {/* AGENDA */}
        {activeTab === "agenda" && (
          <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500">
            <section>
              <h3 className="text-xl font-bold italic mb-6">
                Próximos Clientes
              </h3>
              <div className="flex flex-col gap-3">
                {week.map((a) => {
                  const isBlock = a.service.startsWith("BLOQUEIO");
                  return (
                    <div
                      key={a.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`rounded-xl px-3 py-2 text-center min-w-[64px] ${isBlock ? "bg-red-900/20" : "bg-zinc-800"}`}
                        >
                          <div
                            className={`font-black text-sm ${isBlock ? "text-red-400" : "text-zinc-100"}`}
                          >
                            {a.date.split("-").reverse().slice(0, 2).join("/")}
                          </div>
                          <div className="text-zinc-500 text-[10px] font-bold mt-1">
                            {a.time}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div
                            className={`font-bold text-sm italic ${isBlock ? "text-red-400" : "text-zinc-100"}`}
                          >
                            {isBlock ? "BLOQUEIO" : renderCustomerName(a)}
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
                })}
              </div>
            </section>
            <section className="mt-4">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">
                Bloqueios
              </h3>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col gap-4">
                <input
                  type="date"
                  min={todayStr}
                  value={newBlockDate}
                  onChange={(e) => setNewBlockDate(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:border-amber-400 outline-none [color-scheme:dark]"
                />
                <div className="flex bg-zinc-800 p-1 rounded-xl">
                  <button
                    onClick={() => setIsFullDay(true)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${isFullDay ? "bg-zinc-700 text-white" : "text-zinc-500"}`}
                  >
                    DIA INTEIRO
                  </button>
                  <button
                    onClick={() => setIsFullDay(false)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!isFullDay ? "bg-zinc-700 text-white" : "text-zinc-500"}`}
                  >
                    HORÁRIO
                  </button>
                </div>
                {!isFullDay && (
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        onClick={() => setSelectedTime(h)}
                        className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${selectedTime === h ? "bg-amber-400 border-amber-400 text-zinc-950" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleSmartBlock}
                  disabled={
                    !newBlockDate ||
                    (!isFullDay && !selectedTime) ||
                    loadingBlock
                  }
                  className="bg-amber-400 text-zinc-950 font-black py-4 rounded-xl uppercase text-xs tracking-widest disabled:opacity-30"
                >
                  Confirmar
                </button>
              </div>
            </section>
          </div>
        )}

        {/* GESTÃO */}
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
                <button className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex items-center gap-4 transition-all opacity-60">
                  <div className="bg-zinc-800 p-4 rounded-2xl text-zinc-400">
                    <Users size={28} />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-lg font-bold text-white">
                      CRM Clientes
                    </h3>
                    <p className="text-zinc-500 text-xs">Em breve...</p>
                  </div>
                </button>
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
                    .map((product) => (
                      <div
                        key={product.id}
                        className={`p-4 rounded-2xl flex justify-between items-center border ${product.quantity <= 5 ? "bg-amber-500/10 border-amber-500/40" : "bg-zinc-900 border-zinc-800"}`}
                      >
                        <div className="flex flex-col">
                          <h4 className="font-bold">
                            {product.name}{" "}
                            {product.quantity === 0 && (
                              <span className="text-[9px] bg-red-500 px-1 rounded ml-1">
                                Zerado
                              </span>
                            )}
                          </h4>
                          <span className="text-xs text-zinc-500">
                            Qtd: {product.quantity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-amber-400 mr-2">
                            R$ {product.price.toFixed(2).replace(".", ",")}
                          </span>
                          <button
                            onClick={() => openEditProductModal(product)}
                            className="text-zinc-500 p-1.5"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-zinc-500 p-1.5"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
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

        {/* NOVO AGENDAMENTO */}
        {activeTab === "novo" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <header>
              <h1 className="text-2xl font-black italic uppercase">
                Novo Agendamento
              </h1>
            </header>
            <div className="flex flex-col gap-4 bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
              <input
                type="text"
                placeholder="Nome do Cliente"
                value={manualCustomer}
                onChange={(e) => setManualCustomer(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none"
              />
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
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none appearance-none"
                >
                  <option value="">Serviço...</option>
                  {servicesList.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={manualPrice}
                  readOnly
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-zinc-500"
                />
              </div>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => {
                  setManualDate(e.target.value);
                  setManualTime("");
                }}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white [color-scheme:dark]"
              />
              <select
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white outline-none appearance-none"
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
                className="bg-amber-500 text-black font-black py-4 rounded-2xl uppercase disabled:opacity-30"
              >
                {isSaving ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAIS DE SERVIÇO --- */}
      {(isServiceModalOpen || isEditServiceModalOpen) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic">
                {isEditServiceModalOpen ? "Editar Serviço" : "Novo Serviço"}
              </h3>
              <p className="text-zinc-500 text-xs mt-1">
                Defina nome, preço e duração.
              </p>
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

      {/* --- OUTROS MODAIS MANTIDOS --- */}
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

      {/* NAV INFERIOR */}
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
