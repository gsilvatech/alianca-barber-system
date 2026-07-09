import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export const revalidate = 0;

const MASTER_VERSES = [
  {
    content:
      "Consagre ao Senhor tudo o que você faz, e os seus planos serão bem-sucedidos.",
    reference: "Provérbios 16:3",
  },
  {
    content: "Tudo posso naquele que me fortalece.",
    reference: "Filipenses 4:13",
  },
  {
    content:
      "Se o Senhor não edificar a casa, em vão trabalham os que a edificam...",
    reference: "Salmos 127:1",
  },
  {
    content: "O Senhor é o meu pastor; de nada terei falta.",
    reference: "Salmos 23:1",
  },
  {
    content:
      "Não fui eu que ordenei a você? Seja forte e corajoso! Não se apavore nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.",
    reference: "Josué 1:9",
  },
  {
    content: "Entregue o seu caminho ao Senhor; confie nele, e ele agirá.",
    reference: "Salmos 37:5",
  },
  {
    content:
      "Mas os que esperam no Senhor renovarão as suas forças; subirão com asas como águias; correrão e não se cansarão...",
    reference: "Isaías 40:31",
  },
  {
    content:
      "O próprio Senhor irá à sua frente e estará com você; ele nunca o deixará, nunca o abandonará. Não tenha medo! Não desanime!",
    reference: "Deuteronômio 31:8",
  },
  {
    content:
      "Reconheça o Senhor em todos os seus caminhos, e ele endireitará as suas veredas.",
    reference: "Provérbios 3:6",
  },
  {
    content:
      "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e te conceda graça.",
    reference: "Números 6:24-25",
  },
  {
    content:
      "Sejam fortes e corajosos. Não tenham medo nem fiquem apavorados, pois o Senhor, o seu Deus, vai com vocês.",
    reference: "Deuteronômio 31:6",
  },
  {
    content:
      "Mil poderão cair ao teu lado, e dez mil à tua direita, mas tu não serás atingido.",
    reference: "Salmos 91:7",
  },
  {
    content:
      "Abençoado é o homem que confia no Senhor, cuja confiança nele está depositada.",
    reference: "Jeremias 17:7",
  },
  {
    content:
      "O Senhor é a minha luz e a minha salvação; de quem terei medo? O Senhor é a fortaleza da minha vida; de quem terei receio?",
    reference: "Salmos 27:1",
  },
  {
    content:
      "Portanto, não vos inquieteis com o dia de amanhã, pois o amanhã trará os seus próprios cuidados.",
    reference: "Mateus 6:34",
  },
  {
    content:
      "A lei do Senhor é perfeita e revigora a alma. Os testemunhos do Senhor são dignos de confiança e tornam sábios os simples.",
    reference: "Salmos 19:7",
  },
  {
    content:
      "O coração do homem traça o seu caminho, mas o Senhor lhe firma os passos.",
    reference: "Provérbios 16:9",
  },
  {
    content:
      "Seja a vossa vida isenta de ganância, contentando-vos com o que tendes; porque ele mesmo disse: Não te deixarei, nem te abandonarei.",
    reference: "Hebreus 13:5",
  },
  {
    content:
      "Ora, a fé é a certeza de coisas que se esperam, a convicção de fatos que se não vêem.",
    reference: "Hebreus 11:1",
  },
  {
    content:
      "Deleita-te também no Senhor, e ele te concederá os desejos do teu coração.",
    reference: "Salmos 37:4",
  },
  {
    content:
      "O Senhor é bom, uma fortaleza no dia da angústia, e conhece os que confiam nele.",
    reference: "Naum 1:7",
  },
  {
    content:
      "Clama a mim, e responder-te-ei, e anunciar-te-ei coisas grandes e firmes que não sabes.",
    reference: "Jeremias 33:3",
  },
  {
    content: "Se Deus é por nós, quem será contra nós?",
    reference: "Romanos 8:31",
  },
  {
    content:
      "Lancem sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.",
    reference: "1 Pedro 5:7",
  },
  { content: "Operando Deus, quem impedirá?", reference: "Isaías 43:13" },
  {
    content:
      "Espera pelo Senhor, tem bom ânimo, e fortifique-se o teu coração; espera, pois, pelo Senhor.",
    reference: "Salmos 27:14",
  },
  {
    content:
      "Aquietai-vos, e sabei que eu sou Deus; serei exaltado entre as nações; serei exaltado na terra.",
    reference: "Salmos 46:10",
  },
  {
    content:
      "Os passos de um homem bom são confirmados pelo Senhor, e ele deleita-se no seu caminho.",
    reference: "Salmos 37:23",
  },
  {
    content:
      "Peçam, e lhes será dado; busquem, e encontrarão; batam, e a porta lhes será aberta.",
    reference: "Mateus 7:7",
  },
  {
    content:
      "O meu Deus, segundo as suas riquezas, suprirá todas as vossas necessidades em glória, por Cristo Jesus.",
    reference: "Filipenses 4:19",
  },
  {
    content:
      "E sabemos que todas as coisas cooperam para o bem daqueles que amam a Deus.",
    reference: "Romanos 8:28",
  },
];

function getScrambledIndex(dateStr: string, totalItems: number): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % totalItems;
}

export async function GET() {
  const today = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("/")
    .reverse()
    .join("-");

  try {
    const { data: cached } = await supabase
      .from("daily_words")
      .select("content, reference")
      .eq("date", today)
      .single();

    if (cached) return NextResponse.json(cached);

    const itemIndex = getScrambledIndex(today, MASTER_VERSES.length);
    const selectedVerse = MASTER_VERSES[itemIndex];

    const { content, reference } = selectedVerse;

    await supabase
      .from("daily_words")
      .upsert({ content, reference, date: today }, { onConflict: "date" });

    return NextResponse.json({ content, reference });
  } catch (error) {
    console.error("Erro interno controlado na DailyWord:", error);
    return NextResponse.json(MASTER_VERSES[0]);
  }
}
