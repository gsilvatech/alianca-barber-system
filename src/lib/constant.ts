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
