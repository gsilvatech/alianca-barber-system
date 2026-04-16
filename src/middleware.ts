import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const publicRoutes = ["/login", "/cadastro"];

  // 1. Se NÃO está logado e tenta entrar em qualquer página que não seja login/cadastro
  if (!user && !publicRoutes.includes(path)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 2. Lógica para usuários LOGADOS
  if (user) {
    // Buscamos a role do banco de dados
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    // Se ele está no /login ou /cadastro mas já está logado, manda para a home correta
    if (publicRoutes.includes(path)) {
      if (role === "barbers") {
        return NextResponse.redirect(new URL("/barbeiro", request.url));
      }
      return NextResponse.redirect(new URL("/cliente", request.url));
    }

    // Proteção: Se o Barbeiro tentar entrar no /cliente, manda ele de volta pro /barbeiro
    if (path === "/cliente" && role === "barbers") {
      return NextResponse.redirect(new URL("/barbeiro", request.url));
    }

    // Proteção: Se o Cliente tentar entrar na área do barbeiro, manda pro /cliente
    if (path.startsWith("/barbeiro") && role !== "barbers") {
      return NextResponse.redirect(new URL("/cliente", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
