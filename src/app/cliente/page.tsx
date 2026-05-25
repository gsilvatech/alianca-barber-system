"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DailyWord from "@/components/DailyWord";
import { SERVICES, HOURS } from "@/lib/constant";
import {
  Home as HomeIcon,
  Clock,
  PlusCircle,
  Award,
  User,
  MapPin,
  ChevronLeft,
  LogOut,
  AlertTriangle,
  Edit2, // NOVO: Ícone para editar
} from "lucide-react";

type Barber = { id: string; display_name: string; whatsapp: string };
type Appointment = {
  id: string;
  service: string;
  date: string;
  time: string;
  barber_id: string; // NOVO: Precisamos saber o ID do barbeiro para remarcar
  barbers: { display_name: string };
};

// --- INÍCIO DO BLOCO 1 ---
// Função auxiliar para converter "14:30" em 870 minutos
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};
// --- FIM DO BLOCO 1 ---

export default function ClientePage() {
  const router = useRouter();
  const supabase = createClient();

  // Abas do Menu Inferior
  const [activeTab, setActiveTab] = useState<
    "home" | "historico" | "agendar" | "fidelidade" | "perfil"
  >("home");

  // Dados do Banco
  const [profile, setProfile] = useState<{
    id?: string;
    name: string;
    birth_date?: string;
    phone?: string;
  } | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [takenSlots, setTakenSlots] = useState<string[]>([]);

  // Form state do Novo Agendamento
  const [barberId, setBarberId] = useState("");
  const [service, setService] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState<{
    id: string;
    barber: string;
    service: string;
    date: string;
    time: string;
  } | null>(null);

  // Estados de controle para a Edição de Perfil
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);

  // NOVO: Estados para Remarcação de Agendamento do Cliente
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editBlockedDates, setEditBlockedDates] = useState<string[]>([]);
  const [editTakenSlots, setEditTakenSlots] = useState<string[]>([]);

  // Função Universal para abrir Maps/Waze
  function handleOpenMaps() {
    const endereco =
      "Aliança Barber Club, Rua 50, 65 - Vila Santa Cecília, Volta Redonda - RJ, 27261-040";
    const urlUniversal = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
    window.open(urlUniversal, "_blank");
  }

  async function cancelAppointment(
    id: string,
    barber: string,
    service: string,
    date: string,
    time: string,
  ) {
    setCancelConfirm({ id, barber, service, date, time });
  }

  async function confirmCancel() {
    if (!cancelConfirm) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "canceled" })
      .eq("id", cancelConfirm.id);

    if (!error) {
      setAppointments((prev) => prev.filter((a) => a.id !== cancelConfirm.id));
      const barber = barbers.find(
        (b) => b.display_name === cancelConfirm.barber,
      );
      if (barber) {
        const msg = encodeURIComponent(
          `Olá ${cancelConfirm.barber}! Precisei cancelar meu agendamento de *${cancelConfirm.service}* do dia *${cancelConfirm.date}* às *${cancelConfirm.time}*. Nome: ${profile?.name}`,
        );
        const urlCancel = `https://api.whatsapp.com/send?phone=55${barber.whatsapp}&text=${msg}`;
        window.location.href = urlCancel;
      }
    }
    setCancelConfirm(null);
  }

  // Carregamento Inicial Isolado
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const todayStr = new Date().toISOString().split("T")[0];

      const [
        { data: prof },
        { data: barb },
        { data: upcomingAppts },
        { data: pastAppts },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, name, birth_date, phone") // adicionado id
          .eq("id", user.id)
          .single(),
        supabase.from("barbers").select("id, display_name, whatsapp"),
        supabase
          .from("appointments")
          .select(
            "id, service, date, time, status, barber_id, barbers(display_name)",
          ) // adicionado barber_id
          .eq("client_id", user.id)
          .eq("status", "confirmed")
          .gte("date", todayStr)
          .order("date")
          .order("time")
          .limit(5),
        supabase
          .from("appointments")
          .select(
            "id, service, date, time, status, barber_id, barbers(display_name)",
          )
          .eq("client_id", user.id)
          .eq("status", "confirmed")
          .lt("date", todayStr)
          .order("date", { ascending: false })
          .limit(10),
      ]);

      setProfile(prof);
      setBarbers(barb || []);
      setAppointments((upcomingAppts as any) || []);
      setPastAppointments((pastAppts as any) || []);

      if (prof) {
        setEditPhone(prof.phone || "");
        setEditBirthDate(prof.birth_date || "");
      }
    }
    load();
  }, []);

  // Busca bloqueios do Barbeiro do Novo Agendamento
  useEffect(() => {
    if (!barberId) return;
    async function loadBlocked() {
      const { data } = await supabase
        .from("blocked_dates")
        .select("date")
        .eq("barber_id", barberId);
      setBlockedDates((data || []).map((d: any) => d.date));
    }
    loadBlocked();
  }, [barberId]);

  // Busca Slots do Novo Agendamento
  // --- INÍCIO DO BLOCO 2 (Substitui o useEffect de Busca de Slots do Novo Agendamento) ---
  useEffect(() => {
    // Adicionamos !service para só calcular se ele já souber o serviço que o cliente quer
    if (!barberId || !date || !service) return;

    async function loadSlots() {
      const { data } = await supabase
        .from("appointments")
        .select("time, service") // Agora puxamos o nome do serviço que está no banco também!
        .eq("barber_id", barberId)
        .eq("date", date)
        .eq("status", "confirmed");

      const existingAppts = data || [];
      const blocked: string[] = [];
      const closingTime = timeToMinutes("19:00");
      const maxStartTime = timeToMinutes("18:00"); // Mas o último clique permitido na tela é 18h
      const lunchStart = timeToMinutes("12:00"); // O almoço começa às 12h
      const lunchEnd = timeToMinutes("13:00"); // O almoço termina às 13h
      const limitNevouClient = timeToMinutes("15:00");

      // Descobrindo a duração do serviço que o cliente está tentando marcar
      const selectedSvc = SERVICES.find((s) => s.name === service);
      const duration = selectedSvc?.duration || 60; // Se não achar, assume 60 min por segurança

      HOURS.forEach((slot) => {
        const slotStart = timeToMinutes(slot);
        const slotEnd = slotStart + duration;

        // Regra 1: O serviço não pode terminar depois que a barbearia fecha
        if (slotStart > maxStartTime || slotEnd > closingTime) {
          blocked.push(slot);
          return;
        }

        // --- NOVA REGRA 1.5: Bloqueio Automático do Almoço ---
        // Condição A: O horário clicado está dentro do almoço (ex: tentar clicar em 12:10)
        // Condição B: O serviço começa antes das 12h, mas o fim dele invade o almoço (ex: começar 11:30 e terminar 12:10)
        const invadiuAlmoco =
          (slotStart >= lunchStart && slotStart < lunchEnd) ||
          (slotStart < lunchStart && slotEnd > lunchStart);

        if (invadiuAlmoco) {
          blocked.push(slot);
          return;
        }

        // Regra 2: A Trava do Nevou e Selagem para o Cliente
        // --- REGRA 2: Travas Específicas (Nevou e Selagem) ---
        const nomeServicoTratado = service.toLowerCase(); // ou editingAppointment!.service.toLowerCase() na edição

        if (
          nomeServicoTratado.includes("nevou") &&
          slotStart > timeToMinutes("15:00")
        ) {
          blocked.push(slot);
          return;
        }

        if (
          nomeServicoTratado.includes("selagem") &&
          slotStart > timeToMinutes("16:00")
        ) {
          blocked.push(slot);
          return;
        }

        // Regra 3: A Colisão de Horários com a agenda existente
        const hasConflict = existingAppts.some((appt: any) => {
          const apptStart = timeToMinutes(appt.time);
          const apptSvc = SERVICES.find((s) => s.name === appt.service);
          const apptDuration = apptSvc?.duration || 60;
          const apptEnd = apptStart + apptDuration;

          // Matemática da sobreposição
          return slotStart < apptEnd && slotEnd > apptStart;
        });

        if (hasConflict) {
          blocked.push(slot);
        }
      });
      setTakenSlots(blocked);
    }
    loadSlots();
  }, [barberId, date, service]); // Dependência do service adicionada
  // --- FIM DO BLOCO 2 ---

  // NOVO: Busca bloqueios e Slots para o Modal de Remarcação
  // --- INÍCIO DO BLOCO 3 (Substitui o useEffect de Busca de Slots da Remarcação) ---
  useEffect(() => {
    if (!editingAppointment || !editDate) return;

    async function loadEditSlots() {
      const { data } = await supabase
        .from("appointments")
        .select("time, service")
        .eq("barber_id", editingAppointment!.barber_id)
        .eq("date", editDate)
        .eq("status", "confirmed");

      const existingAppts = data || [];
      const blocked: string[] = [];
      const closingTime = timeToMinutes("19:00");
      const limitNevouClient = timeToMinutes("15:00");

      const selectedSvc = SERVICES.find(
        (s) => s.name === editingAppointment!.service,
      );
      const duration = selectedSvc?.duration || 60;

      HOURS.forEach((slot) => {
        const slotStart = timeToMinutes(slot);
        const slotEnd = slotStart + duration;

        // Ignora a hora original deste agendamento para não bloquear a si mesmo
        if (
          editDate === editingAppointment!.date &&
          slot === editingAppointment!.time
        ) {
          return;
        }

        // Regra 1: Passou das 18h
        if (slotEnd > closingTime) {
          blocked.push(slot);
          return;
        }

        // Regra 2: Trava do Nevou na edição
        if (
          editingAppointment!.service.toLowerCase() === "nevou" &&
          slotStart > limitNevouClient
        ) {
          blocked.push(slot);
          return;
        }

        // Regra 3: Colisão de Horários
        const hasConflict = existingAppts.some((appt: any) => {
          // Também ignora o próprio agendamento na hora de cruzar os dados com o banco
          if (
            appt.time === editingAppointment!.time &&
            editDate === editingAppointment!.date
          )
            return false;

          const apptStart = timeToMinutes(appt.time);
          const apptSvc = SERVICES.find((s) => s.name === appt.service);
          const apptDuration = apptSvc?.duration || 60;
          const apptEnd = apptStart + apptDuration;

          return slotStart < apptEnd && slotEnd > apptStart;
        });

        if (hasConflict) {
          blocked.push(slot);
        }
      });
      setEditTakenSlots(blocked);
    }
    loadEditSlots();
  }, [editDate, editingAppointment]);
  // --- FIM DO BLOCO 3 ---

  async function handleUpdateProfile() {
    if (!profile) return;
    setLoadingProfile(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        phone: editPhone,
        birth_date: editBirthDate || null,
      })
      .eq("id", user.id);

    if (!error) {
      setProfile((prev: any) => ({
        ...prev,
        phone: editPhone,
        birth_date: editBirthDate,
      }));
      setIsEditingProfile(false);
      alert("Perfil atualizado com sucesso! 💎");
    } else {
      alert("Erro ao atualizar o perfil.");
    }
    setLoadingProfile(false);
  }

  // NOVO: Função para o cliente confirmar a Remarcação
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

    if (!error) {
      const barber = barbers.find((b) => b.id === editingAppointment.barber_id);
      if (barber) {
        const [y, m, d] = editDate.split("-");
        const msg = encodeURIComponent(
          `Olá ${barber.display_name}! Remarquei meu agendamento de *${editingAppointment.service}* para o dia *${d}/${m}/${y}* às *${editTime}*. Nome: ${profile?.name}`,
        );
        const urlWhatsapp = `https://api.whatsapp.com/send?phone=55${barber.whatsapp}&text=${msg}`;

        // Timeout para garantir que a interface seja limpa antes do redirect
        setTimeout(() => {
          window.location.href = urlWhatsapp;
        }, 100);
      }

      // Atualiza a lista na tela
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: updatedAppts } = await supabase
        .from("appointments")
        .select(
          "id, service, date, time, status, barber_id, barbers(display_name)",
        )
        .eq("client_id", profile!.id)
        .eq("status", "confirmed")
        .gte("date", todayStr)
        .order("date")
        .order("time")
        .limit(5);

      setAppointments((updatedAppts as any) || []);
      setEditingAppointment(null);
    } else {
      alert("Erro ao remarcar. Tente novamente.");
    }
    setIsUpdating(false);
  }

  async function handleAgendar() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const svcDetails = SERVICES.find((s) => s.name === service);

      if (!svcDetails) {
        alert("Erro ao identificar o serviço.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("appointments").insert({
        client_id: user!.id,
        barber_id: barberId,
        service: service,
        date,
        time,
        status: "confirmed",
      });

      if (!error) {
        const barber = barbers.find((b) => b.id === barberId)!;
        const [y, m, d] = date.split("-");

        const textoMensagem = `Olá ${barber.display_name}! Acabei de agendar um *${service}* para o dia *${d}/${m}/${y}* às *${time}*. Valor: R$ ${svcDetails.price.toFixed(2).replace(".", ",")}. Nome: ${profile?.name}`;
        const urlWhatsapp = `https://api.whatsapp.com/send?phone=55${barber.whatsapp}&text=${encodeURIComponent(textoMensagem)}`;

        setSuccess(true);
        setStep(1);
        setBarberId("");
        setService("");
        setDate("");
        setTime("");

        const { data: updatedAppts } = await supabase
          .from("appointments")
          .select(
            "id, service, date, time, status, barber_id, barbers(display_name)",
          )
          .eq("client_id", user!.id)
          .eq("status", "confirmed")
          .gte("date", new Date().toISOString().split("T")[0])
          .order("date")
          .limit(5);
        setAppointments((updatedAppts as any) || []);
        setActiveTab("home");

        setTimeout(() => {
          window.location.href = urlWhatsapp;
        }, 100);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const minDate = new Date().toISOString().split("T")[0];

  const isDateBlocked = (d: string) => {
    if (!d) return false;
    const day = new Date(d + "T12:00:00").getDay();
    return day === 0 || blockedDates.includes(d);
  };

  const isEditDateBlocked = (d: string) => {
    if (!d) return false;
    const day = new Date(d + "T12:00:00").getDay();
    return day === 0 || editBlockedDates.includes(d);
  };

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const NavButton = ({ icon: Icon, label, tabId }: any) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === tabId ? "text-amber-400 scale-110" : "text-zinc-500 hover:text-zinc-300"}`}
    >
      <Icon size={20} />
      <span className="text-[10px] font-bold uppercase tracking-tighter">
        {label}
      </span>
    </button>
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-28">
      {/* Header Estilo App */}
      <header className="bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="w-16" />
          <img
            src="/logo.png"
            alt="Aliança Barber Club"
            className="h-12 w-auto mx-auto mix-blend-lighten"
          />
          <button
            onClick={handleLogout}
            className="text-zinc-500 text-xs font-bold hover:text-red-400 transition-colors w-16 text-right"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* ================= TAB 1: HOME ================= */}
        {activeTab === "home" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div>
              <h2 className="text-2xl font-bold italic tracking-tight">
                Olá, {profile?.name?.split(" ")[0]}! 👋
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                Bem-vindo de volta à Aliança.
              </p>
            </div>

            <DailyWord />

            {success && (
              <div className="bg-emerald-900/40 border border-emerald-600 rounded-xl px-4 py-3 text-emerald-400 text-sm font-medium flex items-center gap-2">
                ✓ Agendamento confirmado! O WhatsApp do barbeiro foi aberto.
                <button
                  onClick={() => setSuccess(false)}
                  className="ml-auto text-emerald-600"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Listagem de Próximos Cortes */}
            <section>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">
                Seus Próximos Agendamentos
              </h3>
              <div className="flex flex-col gap-3">
                {appointments.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-6 text-center text-zinc-500 text-sm italic">
                    Nenhum agendamento marcado. Clique no "+" abaixo para
                    agendar!
                  </div>
                ) : (
                  appointments.map((a) => {
                    const [y, m, d] = a.date.split("-");
                    return (
                      <div
                        key={a.id}
                        className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 flex flex-col gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-amber-400 text-zinc-950 rounded-xl px-3 py-2 text-center min-w-[56px]">
                            <div className="text-xs font-bold leading-none">
                              {d}/{m}
                            </div>
                            <div className="text-base font-black mt-1 leading-none">
                              {a.time}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-zinc-100 text-sm">
                              {a.service}
                            </div>
                            <div className="text-zinc-500 text-xs mt-0.5">
                              {(a.barbers as any)?.display_name}
                            </div>
                          </div>
                        </div>

                        {/* NOVO: Botões agrupados horizontalmente de Remarcar e Cancelar */}
                        <div className="flex gap-2 border-t border-zinc-800/60 pt-3">
                          <button
                            onClick={() => {
                              setEditingAppointment(a);
                              setEditDate(a.date);
                              setEditTime(a.time);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-zinc-950/30 hover:bg-zinc-800 transition-colors font-bold border border-zinc-800 px-2 py-2 rounded-lg"
                          >
                            <Edit2 size={14} />
                            Remarcar
                          </button>
                          <button
                            onClick={() =>
                              cancelAppointment(
                                a.id,
                                (a.barbers as any)?.display_name,
                                a.service,
                                `${d}/${m}`,
                                a.time,
                              )
                            }
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-zinc-950/30 hover:bg-zinc-800 transition-colors font-bold border border-zinc-800 px-2 py-2 rounded-lg"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* SEÇÃO ONDE ESTAMOS */}
            <section>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">
                Onde Estamos?
              </h3>
              <div
                onClick={handleOpenMaps}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-zinc-700 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.1)] animate-in fade-in duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-zinc-800 p-3 rounded-xl text-amber-400">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-zinc-100">
                      Aliança Barber Club
                    </h4>
                    <p className="text-zinc-400 text-xs mt-0.5">
                      Rua 50, Nº 65 - Vila Santa Cecília
                    </p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">
                      Clique para abrir rotas no GPS (Maps, Waze)
                    </p>
                  </div>
                </div>
                <span className="text-xs text-amber-400 font-bold ml-2">
                  Como Chegar →
                </span>
              </div>
            </section>
          </div>
        )}

        {/* ================= TAB 2: HISTÓRICO ================= */}
        {activeTab === "historico" && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-500">
            <div>
              <h2 className="text-xl font-bold italic">Seu Histórico</h2>
              <p className="text-zinc-500 text-xs">
                Acompanhe suas últimas visitas à Aliança.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {pastAppointments.length === 0 ? (
                <p className="text-zinc-600 text-sm italic text-center py-8">
                  Nenhum corte passado registrado.
                </p>
              ) : (
                pastAppointments.map((a) => {
                  const [y, m, d] = a.date.split("-");
                  return (
                    <div
                      key={a.id}
                      className="bg-zinc-900/50 border border-zinc-900 px-4 py-3 rounded-xl flex justify-between items-center opacity-70"
                    >
                      <div>
                        <h4 className="font-semibold text-sm text-zinc-300">
                          {a.service}
                        </h4>
                        <p className="text-zinc-500 text-xs">
                          {(a.barbers as any)?.display_name}
                        </p>
                      </div>
                      <span className="text-zinc-400 font-bold text-xs">
                        {d}/{m}/{y} - {a.time}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: AGENDAMENTO STEPPER ================= */}
        {activeTab === "agendar" && (
          <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  onClick={() => setStep((prev) => prev - 1)}
                  className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <div>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                  Novo Agendamento
                </h3>
                <p className="text-zinc-500 text-xs">Passo {step} de 3</p>
              </div>
            </div>

            <div className="flex gap-2 mb-2">
              {["Barbeiro", "Serviço", "Data e hora"].map((label, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full transition-colors ${step > i ? "bg-amber-400" : "bg-zinc-800"}`}
                />
              ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
              {step === 1 && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                  <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    Escolha o Barbeiro
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {barbers.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setBarberId(b.id);
                          setStep(2);
                        }}
                        className={`py-4 px-4 rounded-xl text-sm font-bold border transition-all text-left ${barberId === b.id ? "bg-amber-400 text-zinc-950 border-amber-400" : "bg-zinc-800 border-zinc-700 text-white hover:border-amber-400"}`}
                      >
                        {b.display_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                  <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    Selecione o Serviço
                  </label>
                  <div className="flex flex-col gap-2">
                    {SERVICES.map((s) => (
                      <button
                        key={s.name}
                        onClick={() => {
                          setService(s.name);
                          setStep(3);
                        }}
                        className={`py-4 px-4 rounded-xl text-sm border font-bold transition-all flex justify-between items-center text-left ${service === s.name ? "bg-amber-400 text-zinc-950 border-amber-400" : "bg-zinc-800 border-zinc-700 text-white hover:border-amber-400"}`}
                      >
                        <span>{s.name}</span>
                        <span
                          className={
                            service === s.name
                              ? "text-zinc-950 font-black"
                              : "text-amber-400 font-black"
                          }
                        >
                          R$ {s.price.toFixed(2).replace(".", ",")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                  <div className="flex flex-col gap-2">
                    <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                      Selecione o Dia
                    </label>
                    <input
                      type="date"
                      min={minDate}
                      value={date}
                      onChange={(e) => {
                        const d = e.target.value;
                        if (!isDateBlocked(d)) {
                          setDate(d);
                          setTime("");
                        } else {
                          alert("Esta data está bloqueada ou é domingo.");
                        }
                      }}
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors [color-scheme:dark]"
                    />
                  </div>

                  {date && !isDateBlocked(date) && (
                    <div className="flex flex-col gap-2 animate-in zoom-in-95 duration-200">
                      <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                        Horários Disponíveis
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {/* Filtramos para remover os horários bloqueados ANTES de desenhar os botões */}
                        {HOURS.filter((h) => !takenSlots.includes(h)).map(
                          (h) => {
                            return (
                              <button
                                key={h}
                                onClick={() => setTime(h)}
                                className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                                  time === h
                                    ? "bg-amber-400 text-zinc-950 border-amber-400"
                                    : "bg-zinc-800 border-zinc-700 text-white hover:border-amber-400"
                                }`}
                              >
                                {h}
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {barberId &&
                service &&
                date &&
                time &&
                !isDateBlocked(date) &&
                step === 3 && (
                  <div className="border-t border-zinc-800 pt-4 flex flex-col gap-3 animate-in zoom-in-95 duration-300">
                    <div className="text-xs text-zinc-400 flex flex-col gap-1.5 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/60">
                      <div>
                        Barbeiro:{" "}
                        <span className="text-white font-bold">
                          {barbers.find((b) => b.id === barberId)?.display_name}
                        </span>
                      </div>
                      <div>
                        Serviço:{" "}
                        <span className="text-white font-bold">{service}</span>
                      </div>
                      <div>
                        Data e Hora:{" "}
                        <span className="text-amber-400 font-bold">
                          {date.split("-").reverse().join("/")} às {time}
                        </span>
                      </div>
                      <div>
                        Total:{" "}
                        <span className="text-white font-black">
                          R${" "}
                          {SERVICES.find((s) => s.name === service)
                            ?.price.toFixed(2)
                            .replace(".", ",")}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleAgendar}
                      disabled={loading}
                      className="bg-amber-400 text-zinc-950 font-black py-4 rounded-xl hover:bg-amber-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider text-xs shadow-[0_10px_25px_rgba(251,191,36,0.15)]"
                    >
                      {loading
                        ? "Agendando..."
                        : "✓ Confirmar e notificar barbeiro"}
                    </button>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: FIDELIDADE EM CONSTRUÇÃO ================= */}
        {activeTab === "fidelidade" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center animate-in fade-in duration-500">
            <div className="bg-amber-500/10 p-4 rounded-full text-amber-400 animate-bounce">
              <AlertTriangle size={36} />
            </div>
            <div>
              <h2 className="text-lg font-bold italic text-zinc-100">
                Clube de Vantagens Aliança
              </h2>
              <p className="text-zinc-500 text-sm mt-1 max-w-xs mx-auto">
                Estamos alinhando com os barbeiros os melhores prêmios para
                você.
              </p>
            </div>
            <span className="text-xs font-black tracking-widest text-amber-400 bg-zinc-900 border border-amber-500/20 px-4 py-2 rounded-full uppercase animate-pulse">
              ⚠️ Módulo em Construção
            </span>
          </div>
        )}

        {/* ================= TAB 5: PERFIL DINÂMICO ================= */}
        {activeTab === "perfil" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold italic">Seu Perfil</h2>
                <p className="text-zinc-500 text-xs">
                  Suas informações cadastradas no clube.
                </p>
              </div>
              {!isEditingProfile && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="text-xs font-bold text-amber-400 border border-zinc-800 hover:border-amber-400/40 px-4 py-2 rounded-xl transition-all"
                >
                  Editar Perfil
                </button>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                  Nome completo
                </span>
                <span className="text-sm font-bold text-zinc-300 bg-zinc-950/20 px-1 py-1 rounded">
                  {profile?.name || "Não informado"}
                </span>
              </div>

              <div className="flex flex-col gap-1 border-t border-zinc-800/60 pt-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                  WhatsApp
                </span>
                {isEditingProfile ? (
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="(24) 99999-0000"
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 mt-1 transition-colors"
                  />
                ) : (
                  <span className="text-sm font-bold text-zinc-200">
                    {profile?.phone || "Não informado"}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1 border-t border-zinc-800/60 pt-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                  Data de Nascimento (CRM)
                </span>
                {isEditingProfile ? (
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-amber-400 focus:outline-none focus:border-amber-400 mt-1 transition-colors [color-scheme:dark]"
                  />
                ) : (
                  <span className="text-sm font-bold text-amber-400">
                    {profile?.birth_date
                      ? profile.birth_date.split("-").reverse().join("/")
                      : "Não informada"}
                  </span>
                )}
              </div>

              {isEditingProfile && (
                <div className="flex gap-3 mt-2 border-t border-zinc-800/60 pt-4 animate-in zoom-in-95 duration-200">
                  <button
                    onClick={() => {
                      setEditPhone(profile?.phone || "");
                      setEditBirthDate(profile?.birth_date || "");
                      setIsEditingProfile(false);
                    }}
                    disabled={loadingProfile}
                    className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateProfile}
                    disabled={loadingProfile}
                    className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors shadow-[0_4px_15px_rgba(251,191,36,0.1)]"
                  >
                    {loadingProfile ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* NOVO: Modal de Edição (Remarcação do Cliente) */}
      {editingAppointment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-lg italic text-amber-400">
                Remarcar Horário
              </h3>
              <p className="text-zinc-500 text-xs mt-1">
                Serviço:{" "}
                <span className="text-white font-medium">
                  {editingAppointment.service}
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
                  min={minDate}
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
                <div className="flex flex-col gap-1.5 animate-in zoom-in-95 duration-200">
                  <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    Novo Horário
                  </label>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Filtramos para remover os horários bloqueados ANTES de desenhar os botões */}
                    {HOURS.filter((h) => !takenSlots.includes(h)).map((h) => {
                      return (
                        <button
                          key={h}
                          onClick={() => setTime(h)}
                          className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                            time === h
                              ? "bg-amber-400 text-zinc-950 border-amber-400"
                              : "bg-zinc-800 border-zinc-700 text-white hover:border-amber-400"
                          }`}
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
                Voltar
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

      {/* Modal de Cancelamento (Global da tela) */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="font-bold text-lg text-red-400 italic">
              Cancelar agendamento?
            </h3>
            <div className="bg-zinc-950 rounded-xl p-4 flex flex-col gap-1.5 text-xs border border-zinc-800">
              <span className="text-zinc-500">
                Barbeiro:{" "}
                <span className="text-white font-medium">
                  {cancelConfirm.barber}
                </span>
              </span>
              <span className="text-zinc-500">
                Serviço:{" "}
                <span className="text-white font-medium">
                  {cancelConfirm.service}
                </span>
              </span>
              <span className="text-zinc-500">
                Data e Hora:{" "}
                <span className="text-white font-medium">
                  {cancelConfirm.date} às {cancelConfirm.time}
                </span>
              </span>
            </div>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setCancelConfirm(null)}
                className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-colors font-bold text-xs uppercase tracking-wider"
              >
                Voltar
              </button>
              <button
                onClick={confirmCancel}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 transition-colors text-white font-bold text-xs uppercase tracking-wider shadow-[0_4px_15px_rgba(239,68,68,0.2)]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENU INFERIOR DE 5 ITENS COM BOTÃO CENTRAL */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800/50 px-4 pt-3 pb-8 flex justify-between items-center z-50">
        <NavButton icon={HomeIcon} label="Início" tabId="home" />
        <NavButton icon={Clock} label="Histórico" tabId="historico" />
        <button
          onClick={() => {
            setActiveTab("agendar");
            setStep(1);
          }}
          className={`p-4 rounded-2xl -mt-14 shadow-[0_10px_25px_rgba(251,191,36,0.3)] transition-all active:scale-90 ${activeTab === "agendar" ? "bg-amber-400 text-zinc-950 scale-105" : "bg-zinc-800 text-amber-400 hover:bg-zinc-700"}`}
        >
          <PlusCircle size={28} strokeWidth={2.5} />
        </button>
        <NavButton icon={Award} label="Fidelidade" tabId="fidelidade" />
        <NavButton icon={User} label="Perfil" tabId="perfil" />
      </nav>
    </main>
  );
}
