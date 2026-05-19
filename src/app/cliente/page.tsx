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
} from "lucide-react";

type Barber = { id: string; display_name: string; whatsapp: string };
type Appointment = {
  id: string;
  service: string;
  date: string;
  time: string;
  barbers: { display_name: string };
};

export default function ClientePage() {
  const router = useRouter();
  const supabase = createClient();

  // Abas do Menu Inferior
  const [activeTab, setActiveTab] = useState<
    "home" | "historico" | "agendar" | "fidelidade" | "perfil"
  >("home");

  // Dados do Banco
  const [profile, setProfile] = useState<{
    name: string;
    birth_date?: string;
    phone?: string;
  } | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [takenSlots, setTakenSlots] = useState<string[]>([]);

  // Form state (Mantendo as suas variáveis)
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

  // Função Universal para abrir Maps/Waze
  function handleOpenMaps() {
    const endereco = "Aliança Barber Club, Volta Redonda, RJ";
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
      .update({ status: "cancelled" })
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
        window.open(`https://wa.me/55${barber.whatsapp}?text=${msg}`, "_blank");
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
          .select("name, birth_date, phone")
          .eq("id", user.id)
          .single(),
        supabase.from("barbers").select("id, display_name, whatsapp"),
        supabase
          .from("appointments")
          .select("id, service, date, time, status, barbers(display_name)")
          .eq("client_id", user.id)
          .eq("status", "confirmed")
          .gte("date", todayStr)
          .order("date")
          .order("time")
          .limit(5),
        supabase
          .from("appointments")
          .select("id, service, date, time, status, barbers(display_name)")
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
    }
    load();
  }, []);

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

  useEffect(() => {
    if (!barberId || !date) return;
    async function loadSlots() {
      const { data } = await supabase
        .from("appointments")
        .select("time")
        .eq("barber_id", barberId)
        .eq("date", date)
        .eq("status", "confirmed");
      const times = (data || []).map((d: any) => d.time);
      const blocked: string[] = [];
      times.forEach((t: string) => {
        blocked.push(t);
        const idx = HOURS.indexOf(t);
        if (idx >= 0 && idx + 1 < HOURS.length) blocked.push(HOURS[idx + 1]);
      });
      setTakenSlots(blocked);
    }
    loadSlots();
  }, [barberId, date]);

  async function handleAgendar() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const svcDetails = SERVICES.find((s) => s.name === service);

      if (!svcDetails) {
        alert("Erro ao identificar o serviço selecionado.");
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

        const msg = encodeURIComponent(
          `Olá ${barber.display_name}! Acabei de agendar um *${service}* para o dia *${d}/${m}/${y}* às *${time}*. Valor: R$ ${svcDetails.price}. Nome: ${profile?.name}`,
        );

        window.open(`https://wa.me/55${barber.whatsapp}?text=${msg}`, "_blank");

        setSuccess(true);
        setStep(1);
        setBarberId("");
        setService("");
        setDate("");
        setTime("");

        // Atualiza a lista local de confirmados
        const { data: updatedAppts } = await supabase
          .from("appointments")
          .select("id, service, date, time, barbers(display_name)")
          .eq("client_id", user!.id)
          .eq("status", "confirmed")
          .gte("date", new Date().toISOString().split("T")[0])
          .order("date")
          .limit(5);
        setAppointments((updatedAppts as any) || []);

        setActiveTab("home");
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

            {/* Toast sucesso se houver */}
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
              <div className="flex flex-col gap-2">
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
                        className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                      >
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
                          className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium border border-zinc-800 px-2.5 py-1.5 rounded-lg hover:border-red-900/40"
                        >
                          Cancelar
                        </button>
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
                    {/* NOVO: Endereço impresso na tela */}
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
            {/* Header com Botão Voltar Inteligente */}
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

            {/* Linhas de progresso */}
            <div className="flex gap-2 mb-2">
              {["Barbeiro", "Serviço", "Data e hora"].map((label, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full transition-colors ${step > i ? "bg-amber-400" : "bg-zinc-800"}`}
                />
              ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
              {/* Step 1: Barbeiro */}
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

              {/* Step 2: Serviço */}
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

              {/* Step 3: Data e Hora */}
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
                        {HOURS.map((h) => {
                          const blocked = takenSlots.includes(h);
                          return (
                            <button
                              key={h}
                              disabled={blocked}
                              onClick={() => setTime(h)}
                              className={`py-3 rounded-xl text-xs font-bold border transition-all ${time === h ? "bg-amber-400 text-zinc-950 border-amber-400" : blocked ? "bg-zinc-900 border-zinc-800 text-zinc-700 cursor-not-allowed" : "bg-zinc-800 border-zinc-700 text-white hover:border-amber-400"}`}
                            >
                              {h}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bloco de Confirmação Final dentro do formulário estruturado */}
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

        {/* ================= TAB 5: PERFIL ================= */}
        {activeTab === "perfil" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div>
              <h2 className="text-xl font-bold italic">Seu Perfil</h2>
              <p className="text-zinc-500 text-xs">
                Suas informações cadastradas no clube.
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                  Nome completo
                </span>
                <span className="text-sm font-bold text-zinc-200">
                  {profile?.name || "Não informado"}
                </span>
              </div>
              <div className="flex flex-col gap-1 border-t border-zinc-800/60 pt-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                  WhatsApp
                </span>
                <span className="text-sm font-bold text-zinc-200">
                  {profile?.phone || "Não informado"}
                </span>
              </div>
              <div className="flex flex-col gap-1 border-t border-zinc-800/60 pt-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                  Data de Nascimento (CRM)
                </span>
                <span className="text-sm font-bold text-amber-400">
                  {profile?.birth_date
                    ? profile.birth_date.split("-").reverse().join("/")
                    : "Não informada"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

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

        {/* Central Plus Button */}
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
