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

  // Une Server Action ne sait pas lire une redirection HTTP : le client reçoit
  // du HTML à la place de sa réponse et lève « An unexpected response was
  // received from the server. » On laisse donc passer, et c'est `requireSession()`
  // en tête de chaque action qui redirige — proprement, via le protocole de Next.
  if (isServerAction(request)) return NextResponse.next();

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/** Appel de Server Action : POST portant l'identifiant de l'action. */
function isServerAction(request: NextRequest): boolean {
  return request.method === "POST" && request.headers.has("next-action");
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
