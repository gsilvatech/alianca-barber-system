export const SERVICES = [
  { name: "Corte", price: 55, duration: 40 },
  { name: "Barba", price: 35, duration: 15 },
  { name: "Sobrancelha", price: 10, duration: 10 },
  { name: "Pezinho", price: 15, duration: 10 },
  { name: "Depilação nariz e orelha", price: 20, duration: 20 },
  { name: "Selagem", price: 80, duration: 120 },
  { name: "Pigmentação", price: 25, duration: 20 },
  { name: "Camuflagem", price: 50, duration: 20 },
  { name: "Nevou", price: 150, duration: 180 },
  { name: "Cabelo + Barba", price: 80, duration: 60 },
  { name: "Corte + Sobrancelha", price: 60, duration: 40 },
  { name: "Corte + Barba + Sobrancelha", price: 90, duration: 60 },
  { name: "Plano Cabelo", price: 150, duration: 40 },
  { name: "Plano Cabelo e Barba", price: 200, duration: 60 },
];

// Função que gera os horários de 10 em 10 minutos automaticamente
const generateHours = () => {
  const hours = [];
  // Vai das 09h às 18h
  for (let h = 9; h <= 18; h++) {
    for (let m = 0; m < 60; m += 10) {
      // Garante que não passe das 18:00 (não vai criar 18:10, 18:20, etc)
      if (h === 18 && m > 0) break;

      const hh = h.toString().padStart(2, "0");
      const mm = m.toString().padStart(2, "0");
      hours.push(`${hh}:${mm}`);
    }
  }
  return hours;
};

export const HOURS = generateHours();
