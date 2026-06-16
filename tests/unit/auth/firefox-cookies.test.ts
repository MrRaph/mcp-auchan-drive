import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FirefoxCookieProvider, EnvCookieProvider, createCookieProvider } from '../../../src/auth/cookies.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const sqlite3 = req('sqlite3') as {
  Database: new (p: string, mode: number, cb: (e: Error | null) => void) => {
    run(sql: string, cb?: (e: Error | null) => void): void;
    all(sql: string, cb: (e: Error | null, rows: unknown[]) => void): void;
    close(): void;
  };
  OPEN_READWRITE: number;
  OPEN_CREATE: number;
  OPEN_READONLY: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createTestDb(cookies: Array<{ name: string; value: string; host: string }>): Promise<string> {
  const dbPath = path.join(os.tmpdir(), `ff-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);

  await new Promise<void>((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) { reject(err); return; }
      db.run(`CREATE TABLE moz_cookies (
        id INTEGER PRIMARY KEY, originAttributes TEXT DEFAULT '',
        name TEXT, value TEXT, host TEXT, path TEXT,
        expiry INTEGER, lastAccessed INTEGER, creationTime INTEGER,
        isSecure INTEGER, isHttpOnly INTEGER, inBrowserElement INTEGER DEFAULT 0,
        sameSite INTEGER DEFAULT 0, schemeMap INTEGER DEFAULT 0,
        isPartitionedAttributeSet INTEGER DEFAULT 0, updateTime INTEGER DEFAULT 0
      )`, (createErr) => {
        if (createErr) { db.close(); reject(createErr); return; }

        if (cookies.length === 0) { db.close(); resolve(); return; }

        const placeholders = cookies.map(() => '(?,?,?,?,0,0)').join(',');
        const values = cookies.flatMap((c) => [c.name, c.value, c.host, '/']);
        db.run(
          `INSERT INTO moz_cookies (name, value, host, path, isSecure, isHttpOnly) VALUES ${placeholders}`,
          values,
          (insertErr) => { db.close(); insertErr ? reject(insertErr) : resolve(); },
        );
      });
    });
  });

  return dbPath;
}

// Loader sqlite3 à injecter dans FirefoxCookieProvider
function makeSqlite3Loader() {
  return () => sqlite3 as ReturnType<typeof makeSqlite3Loader extends () => infer R ? () => R : never>;
}

// ── Cookies de base pour les tests ───────────────────────────────────────────

const BASE_COOKIES = [
  { name: 'lark-session',   value: 'sess-abc123',     host: 'www.auchan.fr' },
  { name: 'lark-consentId', value: 'consent-uuid-xyz', host: 'www.auchan.fr' },
  { name: 'datadome',       value: 'dd-token-456',     host: 'www.auchan.fr' },
  { name: 'other',          value: 'ignored',           host: 'other.com'     },
];

// ─── FirefoxCookieProvider ───────────────────────────────────────────────────

describe('FirefoxCookieProvider', () => {
  let dbPath: string;

  beforeEach(async () => {
    dbPath = await createTestDb(BASE_COOKIES);
  });

  afterEach(async () => {
    await fs.unlink(dbPath).catch(() => {});
  });

  it('inclut tous les cookies www.auchan.fr / .auchan.fr (comportement navigateur)', async () => {
    const provider = new FirefoxCookieProvider(dbPath, () => sqlite3 as never);
    const cookie = await provider.getCookie();

    expect(cookie).toContain('lark-session=sess-abc123');
    expect(cookie).toContain('lark-consentId=consent-uuid-xyz');
    expect(cookie).toContain('datadome=dd-token-456');
    // Les cookies d'autres domaines ne doivent pas être inclus
    expect(cookie).not.toContain('other=');
  });

  it('getCookie() est mis en cache — queryDb appelé une seule fois', async () => {
    const provider = new FirefoxCookieProvider(dbPath, () => sqlite3 as never);
    const first = await provider.getCookie();
    const second = await provider.getCookie();
    expect(first).toBe(second);
  });

  it('invalidate() vide le cache et force une re-lecture', async () => {
    const provider = new FirefoxCookieProvider(dbPath, () => sqlite3 as never);
    const first = await provider.getCookie();
    provider.invalidate();
    const second = await provider.getCookie();
    // Les deux doivent être identiques (même DB), mais le cache a bien été invalidé
    expect(first).toBe(second);
  });

  it('lève une erreur si lark-session est absent', async () => {
    const partialDb = await createTestDb([
      { name: 'lark-consentId', value: 'c', host: 'www.auchan.fr' },
    ]);
    try {
      const provider = new FirefoxCookieProvider(partialDb, () => sqlite3 as never);
      await expect(provider.getCookie()).rejects.toThrow('lark-session');
    } finally {
      await fs.unlink(partialDb).catch(() => {});
    }
  });

  it('lève une erreur si lark-consentId est absent', async () => {
    const partialDb = await createTestDb([
      { name: 'lark-session', value: 's', host: 'www.auchan.fr' },
    ]);
    try {
      const provider = new FirefoxCookieProvider(partialDb, () => sqlite3 as never);
      await expect(provider.getCookie()).rejects.toThrow('lark-consentId');
    } finally {
      await fs.unlink(partialDb).catch(() => {});
    }
  });

  it('fonctionne sans datadome (affiche un warning mais ne lève pas)', async () => {
    const noDdDb = await createTestDb([
      { name: 'lark-session',   value: 's', host: 'www.auchan.fr' },
      { name: 'lark-consentId', value: 'c', host: 'www.auchan.fr' },
    ]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const provider = new FirefoxCookieProvider(noDdDb, () => sqlite3 as never);
      const cookie = await provider.getCookie();
      expect(cookie).toContain('lark-session=s');
      expect(cookie).not.toContain('datadome');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('datadome'));
    } finally {
      warnSpy.mockRestore();
      await fs.unlink(noDdDb).catch(() => {});
    }
  });

  it('lève une erreur si le fichier SQLite n\'existe pas', async () => {
    const provider = new FirefoxCookieProvider('/tmp/inexistant-99999.sqlite', () => sqlite3 as never);
    await expect(provider.getCookie()).rejects.toThrow();
  });

  it('utilise AUCHAN_FIREFOX_PROFILE si défini avec un chemin .sqlite direct', async () => {
    const savedEnv = process.env.AUCHAN_FIREFOX_PROFILE;
    process.env.AUCHAN_FIREFOX_PROFILE = dbPath;
    try {
      // Pas de dbPathOverride → passe par findCookiesDb → envProfile .sqlite
      const provider = new FirefoxCookieProvider(undefined, () => sqlite3 as never);
      const cookie = await provider.getCookie();
      expect(cookie).toContain('lark-session=sess-abc123');
    } finally {
      if (savedEnv !== undefined) process.env.AUCHAN_FIREFOX_PROFILE = savedEnv;
      else delete process.env.AUCHAN_FIREFOX_PROFILE;
    }
  });
});

// ─── createCookieProvider avec AUCHAN_BROWSER=firefox ────────────────────────

describe('createCookieProvider — AUCHAN_BROWSER=firefox', () => {
  let savedBrowser: string | undefined;
  let savedCookie: string | undefined;

  beforeEach(() => {
    savedBrowser = process.env.AUCHAN_BROWSER;
    savedCookie = process.env.AUCHAN_COOKIE;
    delete process.env.AUCHAN_COOKIE;
  });

  afterEach(() => {
    if (savedBrowser !== undefined) process.env.AUCHAN_BROWSER = savedBrowser;
    else delete process.env.AUCHAN_BROWSER;
    if (savedCookie !== undefined) process.env.AUCHAN_COOKIE = savedCookie;
    else delete process.env.AUCHAN_COOKIE;
  });

  it('retourne FirefoxCookieProvider si AUCHAN_BROWSER=firefox', () => {
    process.env.AUCHAN_BROWSER = 'firefox';
    expect(createCookieProvider()).toBeInstanceOf(FirefoxCookieProvider);
  });

  it('AUCHAN_COOKIE prime sur AUCHAN_BROWSER=firefox', () => {
    process.env.AUCHAN_COOKIE = 'x=y';
    process.env.AUCHAN_BROWSER = 'firefox';
    expect(createCookieProvider()).toBeInstanceOf(EnvCookieProvider);
  });
});
