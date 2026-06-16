/**
 * cookies.ts — CookieProvider : lecture des cookies Auchan Drive
 *
 * Trois implémentations :
 *   - EnvCookieProvider     : lit AUCHAN_COOKIE (headless / CI)
 *   - ChromeCookieProvider  : lit les cookies depuis le profil Chrome local
 *   - FirefoxCookieProvider : lit cookies.sqlite depuis le profil Firefox local
 *
 * Cookies requis (communs) : lark-session, datadome, lark-consentId
 * (Firefox peut ne pas avoir datadome si aucun challenge DataDome n'a été déclenché
 *   sur ce profil — les requêtes risquent alors d'être bloquées 403)
 *
 * Sélection du provider :
 *   AUCHAN_COOKIE défini          → EnvCookieProvider
 *   AUCHAN_BROWSER=firefox        → FirefoxCookieProvider
 *   (défaut)                      → ChromeCookieProvider
 */

import type { CookieProvider } from '../types.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

// Cookies toujours requis (quelle que soit l'implémentation)
const REQUIRED = ['lark-session', 'datadome', 'lark-consentId'] as const;
const AUCHAN_URL = 'https://www.auchan.fr';

// Pour Firefox : ces cookies sont obligatoires pour s'authentifier.
// Tous les autres cookies www.auchan.fr / .auchan.fr sont envoyés automatiquement
// (comme un navigateur), ce qui inclut connect.sid, lark-browser-uuid, etc.
const FF_REQUIRED = ['lark-session', 'lark-consentId'] as const;

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
 */
export class ChromeCookieProvider implements CookieProvider {
  private readonly profile: string;
  private cached: string | null = null;
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

    this.cached = REQUIRED.map((name) => name + '=' + all[name]).join('; ');
    return this.cached;
  }

  invalidate(): void {
    this.cached = null;
  }
}

// ─── FirefoxCookieProvider ────────────────────────────────────────────────────

type Sqlite3Row = { name: string; value: string };

type Sqlite3DbInstance = {
  all(sql: string, cb: (err: Error | null, rows: Sqlite3Row[]) => void): void;
  close(): void;
};

type Sqlite3Module = {
  Database: new (
    path: string,
    mode: number,
    cb: (err: Error | null) => void,
  ) => Sqlite3DbInstance;
  OPEN_READONLY: number;
};

function defaultSqlite3Loader(): Sqlite3Module {
  return _require('sqlite3') as Sqlite3Module;
}

/**
 * Lit les cookies Auchan Drive depuis le profil Firefox local (cookies.sqlite).
 * Copie le fichier SQLite en mémoire temporaire pour éviter le verrou Firefox.
 *
 * AUCHAN_FIREFOX_PROFILE peut pointer vers :
 *   - Un chemin complet vers cookies.sqlite
 *   - Un nom de profil relatif (ex: "47ob1shg.default-release")
 *   → Par défaut : détection automatique via profiles.ini
 */
export class FirefoxCookieProvider implements CookieProvider {
  private cached: string | null = null;
  private readonly loader: () => Sqlite3Module;

  constructor(
    private readonly dbPathOverride?: string,
    loader?: () => Sqlite3Module,
  ) {
    this.loader = loader ?? defaultSqlite3Loader;
  }

  // ── Détection du profil Firefox actif ──────────────────────────────────────

  private firefoxDir(): string {
    const home = os.homedir();
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Firefox');
    }
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA ?? home, 'Mozilla', 'Firefox');
    }
    return path.join(home, '.mozilla', 'firefox');
  }

  private async findCookiesDb(): Promise<string> {
    if (this.dbPathOverride) return this.dbPathOverride;

    const envProfile = process.env.AUCHAN_FIREFOX_PROFILE;
    const ffDir = this.firefoxDir();

    if (envProfile) {
      // Chemin absolu direct vers cookies.sqlite
      if (envProfile.endsWith('.sqlite')) return envProfile;
      // Nom de profil relatif
      return path.join(ffDir, 'Profiles', envProfile, 'cookies.sqlite');
    }

    // Lecture de profiles.ini pour trouver le profil actif
    const iniPath = path.join(ffDir, 'profiles.ini');
    const ini = await fs.readFile(iniPath, 'utf-8');

    // [Install…] Default= pointe toujours vers le profil utilisé au dernier lancement
    const installMatch = ini.match(/\[Install[^\]]+\][\s\S]*?Default=([^\r\n]+)/);
    if (installMatch) {
      const profileRelPath = installMatch[1].trim();
      return path.join(ffDir, profileRelPath, 'cookies.sqlite');
    }

    // Fallback : chercher Default=1 dans les sections [ProfileN]
    for (const section of ini.split(/(?=\[Profile\d+\])/)) {
      if (/^\s*Default\s*=\s*1\s*$/m.test(section)) {
        const pathMatch = section.match(/^\s*Path\s*=\s*(.+)$/m);
        const isRel = /^\s*IsRelative\s*=\s*1\s*$/m.test(section);
        if (pathMatch) {
          const profilePath = pathMatch[1].trim();
          return path.join(isRel ? ffDir : '', profilePath, 'cookies.sqlite');
        }
      }
    }

    throw new Error(
      'Profil Firefox introuvable. ' +
      'Définissez AUCHAN_FIREFOX_PROFILE avec le nom de profil ou le chemin vers cookies.sqlite.',
    );
  }

  // ── Lecture SQLite (copie temporaire pour éviter le verrou) ────────────────

  private async readCookiesFromDb(dbPath: string): Promise<Record<string, string>> {
    const tmpPath = path.join(os.tmpdir(), `auchan-ff-${Date.now()}.sqlite`);
    await fs.copyFile(dbPath, tmpPath);

    // Copier WAL/SHM si présents (nécessaire pour cohérence des données en cours d'écriture)
    for (const ext of ['-wal', '-shm']) {
      try { await fs.copyFile(dbPath + ext, tmpPath + ext); } catch { /* ignoré */ }
    }

    try {
      return await this.queryDb(tmpPath);
    } finally {
      for (const ext of ['', '-wal', '-shm']) {
        await fs.unlink(tmpPath + ext).catch(() => {});
      }
    }
  }

  private queryDb(dbPath: string): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      const sqlite3 = this.loader();
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) { reject(err); return; }
        db.all(
          // Inclut les cookies de .auchan.fr (wildcard) et www.auchan.fr (direct).
          // Exclut volontairement compte.auchan.fr (tokens Keycloak, autre sous-domaine).
          `SELECT name, value FROM moz_cookies
           WHERE host = 'www.auchan.fr' OR host = '.auchan.fr'
           ORDER BY host DESC, name`,
          (queryErr, rows) => {
            db.close();
            if (queryErr) { reject(queryErr); return; }
            const result: Record<string, string> = {};
            for (const row of rows) result[row.name] = row.value;
            resolve(result);
          },
        );
      });
    });
  }

  // ── API publique ───────────────────────────────────────────────────────────

  async getCookie(): Promise<string> {
    if (this.cached !== null) return this.cached;

    const dbPath = await this.findCookiesDb();
    const cookies = await this.readCookiesFromDb(dbPath);

    const missing = FF_REQUIRED.filter((name) => !cookies[name]);
    if (missing.length > 0) {
      throw new Error(
        `Cookies Firefox manquants pour Auchan Drive : ${missing.join(', ')}. ` +
        `Connectez-vous à Auchan Drive dans Firefox, puis relancez.`,
      );
    }

    if (!cookies['datadome']) {
      console.warn(
        '[auchan-drive] Cookie datadome absent du profil Firefox. ' +
        'Naviguez sur www.auchan.fr dans Firefox pour l\'obtenir, ' +
        'sinon les requêtes risquent d\'être bloquées (403).',
      );
    }

    // Inclure TOUS les cookies récupérés (comportement navigateur) :
    // lark-session, lark-consentId, connect.sid, lark-browser-uuid, etc.
    this.cached = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    return this.cached;
  }

  invalidate(): void {
    this.cached = null;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Retourne le CookieProvider adapté à l'environnement.
 *
 * Ordre de priorité :
 *   1. AUCHAN_COOKIE défini → EnvCookieProvider
 *   2. AUCHAN_BROWSER=firefox → FirefoxCookieProvider
 *   3. (défaut) → ChromeCookieProvider
 */
export function createCookieProvider(): CookieProvider {
  if (process.env.AUCHAN_COOKIE) {
    return new EnvCookieProvider();
  }
  if ((process.env.AUCHAN_BROWSER ?? '').toLowerCase() === 'firefox') {
    return new FirefoxCookieProvider();
  }
  return new ChromeCookieProvider();
}
