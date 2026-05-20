"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DailyWord from "@/components/DailyWord";
import { SERVICES } from "@/lib/constant";
import {
  Home,
  Calendar,
  DollarSign,
  Users,
  PlusCircle,
  LogOut,
  Trash2,
  Edit2, // NOVO: Ícone para edição
  XCircle, // NOVO: Ícone para cancelamento
} from "lucide-react";

type Appointment = {
  id: string;
  service: string;
  date: string;
  time: string;
  status: string;
  profiles: { name: string; phone: string };
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
  const HOURS = [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
  ];

  const [activeTab, setActiveTab] = useState<
    "home" | "agenda" | "financeiro" | "crm" | "novo"
  >("home");

  const todayStr = new Date().toISOString().split("T")[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];
  const monthEnd = new Date();
  monthEnd.setDate(monthEnd.getDate() + 30);
  const monthEndStr = monthEnd.toISOString().split("T")[0];

  // Inicia o formulário manual com a data de hoje por padrão
  const [manualCustomer, setManualCustomer] = useState("");
  const [manualService, setManualService] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualDate, setManualDate] = useState(todayStr);
  const [manualTime, setManualTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // NOVO: Estados para Remarcação
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // NOVO: Estados para Bloqueios Dinâmicos durante Edição
  const [editBlockedDates, setEditBlockedDates] = useState<string[]>([]);
  const [editTakenSlots, setEditTakenSlots] = useState<string[]>([]);

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

      // Ajustado para admin poder acessar também
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
    if (barberId) loadAppts();
  }, [barberId, tab]);

  // NOVO: Carregar bloqueios para a data de edição (igual ao do cliente)
  useEffect(() => {
    if (!barberId || !editDate) return;
    async function loadEditSlots() {
      const { data } = await supabase
        .from("appointments")
        .select("time")
        .eq("barber_id", barberId)
        .eq("date", editDate)
        .eq("status", "confirmed");

      const times = (data || []).map((d: any) => d.time);
      const blocked: string[] = [];
      times.forEach((t: string) => {
        // Não bloqueia o slot que o cliente JÁ ocupa se a data for a mesma
        if (
          editingAppointment &&
          editDate === editingAppointment.date &&
          t === editingAppointment.time
        ) {
          return;
        }
        blocked.push(t);
        const idx = HOURS.indexOf(t);
        if (idx >= 0 && idx + 1 < HOURS.length) blocked.push(HOURS[idx + 1]);
      });
      setEditTakenSlots(blocked);
    }
    loadEditSlots();
  }, [barberId, editDate, editingAppointment]);

  const isEditDateBlocked = (d: string) => {
    if (!d) return false;
    const day = new Date(d + "T12:00:00").getDay();
    // Bloqueia domingos e datas bloqueadas do barbeiro
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

      if (error) {
        console.error("Erro ao bloquear:", error.message);
        alert("Erro ao salvar bloqueio no banco.");
      } else {
        loadAppts();
      }
    }

    setNewBlockDate("");
    setNewBlockReason("");
    setSelectedTime("");
    setLoadingBlock(false);
  }

  async function deleteAppointment(id: string) {
    if (!confirm("Deseja remover este bloqueio?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) {
      console.error("Erro ao deletar:", error.message);
      alert("Não foi possível remover o bloqueio.");
    } else {
      loadAppts();
    }
  }

  // NOVO: Função para o Barbeiro Cancelar
  async function handleCancelByBarber(id: string) {
    if (
      !confirm(
        "Tem certeza que deseja cancelar este agendamento? O cliente não será notificado automaticamente.",
      )
    )
      return;

    const { error } = await supabase
      .from("appointments")
      .update({ status: "canceled" })
      .eq("id", id);

    if (error) {
      console.error("Erro ao cancelar:", error);
      alert("Erro ao cancelar o agendamento.");
    } else {
      loadAppts();
      alert("Agendamento cancelado com sucesso.");
    }
  }

  // NOVO: Função para iniciar a edição
  function openEditModal(appt: Appointment) {
    setEditingAppointment(appt);
    setEditDate(appt.date);
    setEditTime(appt.time);
  }

  // NOVO: Função para salvar a remarcação
  async function handleReschedule() {
    if (!editingAppointment || !editDate || !editTime) return;
    setIsUpdating(true);

    const { error } = await supabase
      .from("appointments")
      .update({
        date: editDate,
        time: editTime,
      })
      .eq("id", editingAppointment.id);

    if (error) {
      console.error("Erro ao remarcar:", error);
      alert("Erro ao remarcar o horário.");
    } else {
      setEditingAppointment(null);
      loadAppts();
      alert("Agendamento remarcado com sucesso!");
    }
    setIsUpdating(false);
  }

  // FUNÇÕES AUXILIARES: Tratam o texto da string 'MANUAL: Cliente - Serviço'
  function renderCustomerName(a: Appointment) {
    if (a.service?.startsWith("MANUAL:")) {
      return a.service.split(" - ")[0].replace("MANUAL: ", "");
    }
    return a.profiles?.name || "Cliente sem nome";
  }

  function renderServiceDescription(a: Appointment) {
    if (a.service?.startsWith("MANUAL:")) {
      return a.service.split(" - ")[1] || "Serviço Manual";
    }
    return a.service;
  }

  async function handleManualSchedule() {
    if (!manualCustomer || !manualService || !manualDate || !manualTime) {
      alert("Preencha todos os campos, mestre!");
      return;
    }

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
      setManualDate(todayStr); // Reseta voltando para hoje
      setManualTime("");
      setActiveTab("agenda");
      loadAppts();
    } else {
      console.error(error);
      alert("Erro ao agendar. Verifique a conexão.");
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
                    const isCanceled = a.status === "canceled"; // Ou "canceled" se mudou no banco

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

                          {/* NOVO: Botões de ação apenas se não for bloqueio e não estiver cancelado */}
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

                        {/* NOVO: Botões de ação na visão Semanal */}
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
                Gerenciar Bloqueios
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
                  <div className="grid grid-cols-4 gap-2 animate-in zoom-in-95 duration-200">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        onClick={() => setSelectedTime(h)}
                        className={`py-2 rounded-lg text-[10px] font-bold border ${selectedTime === h ? "bg-amber-400 border-amber-400 text-zinc-950" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Motivo (opcional)"
                  value={newBlockReason}
                  onChange={(e) => setNewBlockReason(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:border-amber-400 outline-none"
                />
                <button
                  onClick={handleSmartBlock}
                  disabled={
                    !newBlockDate ||
                    (!isFullDay && !selectedTime) ||
                    loadingBlock
                  }
                  className="bg-amber-400 text-zinc-950 font-black py-4 rounded-xl hover:bg-amber-300 transition-all disabled:opacity-30 uppercase text-xs tracking-widest shadow-[0_10px_20px_rgba(251,191,36,0.2)]"
                >
                  {loadingBlock ? "Processando..." : "Confirmar Bloqueio"}
                </button>
              </div>

              {blockedDates.length > 0 && (
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase mb-2">
                    Folgas Confirmadas (Dia Todo)
                  </p>
                  {blockedDates.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-3"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-red-400 italic">
                          {b.date.split("-").reverse().join("/")}
                        </span>
                        <span className="text-zinc-500 text-[10px] font-bold uppercase">
                          {b.reason}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnblockDate(b.id)}
                        className="text-zinc-600 hover:text-white text-[10px] font-black uppercase border border-zinc-800 px-3 py-1 rounded-lg"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {week.filter((a) => a.service.startsWith("BLOQUEIO")).length >
                0 && (
                <div className="mt-6 flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase mb-2">
                    Horários Bloqueados
                  </p>
                  {week
                    .filter((a) => a.service.startsWith("BLOQUEIO"))
                    .map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-3"
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-amber-400 italic">
                              {a.date
                                .split("-")
                                .reverse()
                                .slice(0, 2)
                                .join("/")}
                            </span>
                            <span className="text-sm font-black text-white">
                              {a.time}
                            </span>
                          </div>
                          <span className="text-zinc-500 text-[10px] font-bold uppercase">
                            {a.service
                              .replace("BLOQUEIO: ", "")
                              .replace("BLOQUEIO INDISPONÍVEL", "Indisponível")}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteAppointment(a.id)}
                          className="text-zinc-600 hover:text-red-400 text-[10px] font-black uppercase border border-zinc-800 px-3 py-1 rounded-lg"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "financeiro" && (
          <div className="py-20 text-center text-zinc-500 italic animate-pulse">
            Finanças em construção...
          </div>
        )}
        {activeTab === "crm" && (
          <div className="py-20 text-center text-zinc-500 italic animate-pulse">
            CRM em construção...
          </div>
        )}

        {activeTab === "novo" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <header>
              <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                Novo Agendamento
              </h1>
              <p className="text-zinc-500 text-xs font-bold uppercase">
                Cadastre um cliente manualmente
              </p>
            </header>

            <div className="flex flex-col gap-4 bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  placeholder="Ex: João Silva"
                  value={manualCustomer}
                  onChange={(e) => setManualCustomer(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">
                    Serviço
                  </label>
                  <select
                    value={manualService}
                    onChange={(e) => {
                      const selectedTitle = e.target.value;
                      setManualService(selectedTitle);

                      const serviceData = SERVICES.find(
                        (s) => s.name === selectedTitle,
                      );
                      if (serviceData) {
                        setManualPrice(
                          `R$ ${serviceData.price.toFixed(2).replace(".", ",")}`,
                        );
                      }
                    }}
                    className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white focus:outline-none appearance-none"
                  >
                    <option value="">Selecionar...</option>
                    {SERVICES.map((service, index) => (
                      <option key={index} value={service.name}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">
                    Preço Est.
                  </label>
                  <input
                    type="text"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">
                  Horário
                </label>
                <select
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white focus:outline-none appearance-none w-full"
                >
                  <option value="">Selecionar...</option>
                  {HOURS.map((hour, index) => (
                    <option key={index} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">
                  Data
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white focus:outline-none w-full [color-scheme:dark]"
                />
              </div>

              <button
                onClick={handleManualSchedule}
                disabled={isSaving}
                className="mt-4 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-700 text-black font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95"
              >
                {isSaving ? "Agendando..." : "Confirmar Agendamento"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NOVO: Modal de Edição (Remarcação) */}
      {editingAppointment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic text-amber-400">
                Remarcar Horário
              </h3>
              <p className="text-zinc-500 text-xs mt-1">
                Cliente:{" "}
                <span className="text-white font-medium">
                  {renderCustomerName(editingAppointment)}
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  Nova Data
                </label>
                <input
                  type="date"
                  min={todayStr}
                  value={editDate}
                  onChange={(e) => {
                    const d = e.target.value;
                    if (!isEditDateBlocked(d)) {
                      setEditDate(d);
                      setEditTime(""); // Reseta a hora ao mudar o dia
                    } else {
                      alert("Esta data está bloqueada ou é domingo.");
                    }
                  }}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors [color-scheme:dark]"
                />
              </div>

              {editDate && !isEditDateBlocked(editDate) && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    Novo Horário
                  </label>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {HOURS.map((h) => {
                      const blocked = editTakenSlots.includes(h);
                      return (
                        <button
                          key={h}
                          disabled={blocked}
                          onClick={() => setEditTime(h)}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${editTime === h ? "bg-amber-400 text-zinc-950 border-amber-400" : blocked ? "bg-zinc-900 border-zinc-800 text-zinc-700 cursor-not-allowed" : "bg-zinc-800 border-zinc-700 text-white hover:border-amber-400"}`}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-2 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setEditingAppointment(null)}
                className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white transition-colors font-bold text-xs uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={handleReschedule}
                disabled={!editDate || !editTime || isUpdating}
                className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 transition-colors text-zinc-950 font-black text-xs uppercase tracking-wider disabled:opacity-50 shadow-[0_4px_15px_rgba(251,191,36,0.15)]"
              >
                {isUpdating ? "Salvando..." : "Confirmar"}
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
        <NavButton icon={Users} label="CRM" tabId="crm" />
      </nav>
    </main>
  );
}
