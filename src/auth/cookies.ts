/**
 * cookies.ts — CookieProvider : lecture des cookies Auchan Drive
 *
 * Deux implémentations :
 *   - EnvCookieProvider     : lit AUCHAN_COOKIE (headless / CI)
 *   - ChromeCookieProvider  : lit les cookies depuis le profil Chrome local
 *
 * chrome-cookies-secure est importé dynamiquement (lazy) pour éviter
 * de charger sqlite3 dans les environnements sans Chrome (tests, CI).
 *
 * Cookies requis : lark-session, datadome, lark-consentId
 */

import type { CookieProvider } from '../types.js';

const REQUIRED = ['lark-session', 'datadome', 'lark-consentId'] as const;
const AUCHAN_URL = 'https://www.auchan.fr';

// ─── EnvCookieProvider ────────────────────────────────────────────────────────

/**
 * Utilise la variable d'environnement AUCHAN_COOKIE comme header Cookie brut.
 * Pratique pour les déploiements headless / CI.
 */
export class EnvCookieProvider implements CookieProvider {
  getCookie(): Promise<string> {
    const cookie = process.env.AUCHAN_COOKIE;
    if (!cookie) return Promise.reject(new Error('AUCHAN_COOKIE env var is not set'));
    return Promise.resolve(cookie);
  }

  invalidate(): void {
    // no-op : pas de cache a invalider
  }
}

// ─── ChromeCookieProvider ─────────────────────────────────────────────────────

type ChromeCookiesModule = {
  getCookiesPromised(url: string, format: string, profile: string): Promise<Record<string, string>>;
};

/**
 * Lit les cookies depuis le profil Chrome local via chrome-cookies-secure.
 * Cache la chaine Cookie en memoire — invalidate() force une relecture.
 * Import dynamique pour eviter de charger sqlite3 au demarrage.
 */
export class ChromeCookieProvider implements CookieProvider {
  private readonly profile: string;
  private cached: string | null = null;

  // Injecteur permettant de mocker en tests
  private readonly loader: () => Promise<ChromeCookiesModule>;

  constructor(
    profile = process.env.AUCHAN_CHROME_PROFILE ?? 'Default',
    loader?: () => Promise<ChromeCookiesModule>,
  ) {
    this.profile = profile;
    this.loader = loader ?? (() => import('chrome-cookies-secure') as Promise<ChromeCookiesModule>);
  }

  async getCookie(): Promise<string> {
    if (this.cached !== null) return this.cached;

    const chromeCookies = await this.loader();
    const all = await chromeCookies.getCookiesPromised(AUCHAN_URL, 'object', this.profile);

    const missing = REQUIRED.filter((name) => !all[name]);
    if (missing.length > 0) {
      throw new Error('Missing required cookies: ' + missing.join(', '));
    }

    // Ordre fixe (important pour DataDome)
    this.cached = REQUIRED.map((name) => name + '=' + all[name]).join('; ');
    return this.cached;
  }

  invalidate(): void {
    this.cached = null;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Retourne le CookieProvider adapte a l'environnement.
 */
export function createCookieProvider(): CookieProvider {
  if (process.env.AUCHAN_COOKIE) {
    return new EnvCookieProvider();
  }
  return new ChromeCookieProvider();
}
