import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Lembre-se de ter essa chave no seu .env.local
  { auth: { persistSession: false } },
);

export async function POST(request: Request) {
  try {
    const { userId, actionType } = await request.json();

    // EXTRAI A ORIGEM (Pega http://localhost:3000 ou https://aliancabarberclub.com.br automaticamente)
    const origin = new URL(request.url).origin;

    const { data: userAuth, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userAuth?.user?.email) {
      return NextResponse.json(
        { error: "Usuário ou e-mail não encontrado no sistema." },
        { status: 404 },
      );
    }

    const userEmail = userAuth.user.email;

    if (actionType === "whatsapp_link") {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: userEmail,
        // MUDANÇA AQUI: Usa a variável origin que criamos ali em cima
        options: { redirectTo: `${origin}/atualizar-senha` },
      });

      if (error)
        return NextResponse.json({ error: error.message }, { status: 400 });

      return NextResponse.json({ link: data.properties.action_link });
    }

    // ... (restante do código continua igual)

    // 3. Forçar Senha Provisória
    if (actionType === "temporary_password") {
      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: "Mudar@123",
        });

      if (authError)
        return NextResponse.json({ error: authError.message }, { status: 400 });

      // Atualiza a tabela pública de perfis marcando que ele DEVE mudar a senha ao entrar
      await supabaseAdmin
        .from("profiles")
        .update({ require_password_change: true })
        .eq("id", userId);

      return NextResponse.json({
        success: true,
        temporaryPassword: "Mudar@123",
      });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
