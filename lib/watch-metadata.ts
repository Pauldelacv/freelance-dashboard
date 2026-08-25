/**
 * Récupération du titre et du favicon d'une page, côté serveur.
 * Tout échec est silencieux : on retombe sur le domaine comme titre.
 */

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 512_000;

export interface SiteMetadata {
  title: string;
  faviconUrl: string | null;
}

function absolute(href: string, base: URL): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const text = match[1]
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
  return text || null;
}

function extractFavicon(html: string, base: URL): string | null {
  const links = html.matchAll(/<link\b[^>]*>/gi);
  for (const [tag] of links) {
    if (!/rel\s*=\s*["'][^"']*icon/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href) return absolute(href, base);
  }
  return absolute("/favicon.ico", base);
}

export async function fetchSiteMetadata(rawUrl: string): Promise<SiteMetadata> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { title: rawUrl, faviconUrl: null };
  }

  const fallback: SiteMetadata = {
    title: url.hostname.replace(/^www\./, ""),
    faviconUrl: absolute("/favicon.ico", url),
  };

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "freelance-dashboard/1.0 (annuaire de veille)" },
    });
    if (!response.ok || !response.body) return fallback;

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) return fallback;

    // On ne lit que le début de la page : le <head> suffit.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    await reader.cancel().catch(() => {});

    const finalUrl = new URL(response.url || url.toString());
    return {
      title: extractTitle(html) ?? fallback.title,
      faviconUrl: extractFavicon(html, finalUrl) ?? fallback.faviconUrl,
    };
  } catch {
    return fallback;
  }
}

/** Normalise une URL saisie à la volée : "exemple.fr" → "https://exemple.fr". */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Un schéma explicite autre que http(s) est refusé, jamais recollé derrière
  // "https://" (sinon "ftp://exemple.fr" deviendrait une URL valide et fausse).
  const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") return null;

  const candidate = scheme ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** "veille, seo , tech" → "veille,seo,tech" */
export function normalizeTags(input: string): string {
  return [
    ...new Set(
      input
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].join(",");
}

export function parseTags(csv: string): string[] {
  return csv
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
