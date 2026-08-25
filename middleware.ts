import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let authenticated = false;
  try {
    authenticated = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    // SESSION_SECRET absent ou invalide : on renvoie vers /login, qui affiche
    // précisément ce qu'il manque dans la configuration.
    authenticated = false;
  }

  if (pathname === "/login") {
    if (authenticated) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Tout est protégé sauf :
     * - /api/health (healthcheck Coolify, doit répondre sans session)
     * - les assets Next et les fichiers statiques (icônes, manifest PWA…)
     */
    "/((?!api/health|_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|robots.txt).*)",
  ],
};
