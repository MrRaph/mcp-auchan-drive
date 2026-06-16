import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EnvCookieProvider,
  ChromeCookieProvider,
  createCookieProvider,
} from '../../../src/auth/cookies.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Crée un loader mocké qui retourne les cookies fournis. */
function makeLoader(cookies: Record<string, string>) {
  const getCookiesPromised = vi.fn().mockResolvedValue(cookies);
  const loader = vi.fn().mockResolvedValue({ getCookiesPromised });
  return { loader, getCookiesPromised };
}

// ─── EnvCookieProvider ────────────────────────────────────────────────────────

describe('EnvCookieProvider', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.AUCHAN_COOKIE;
    delete process.env.AUCHAN_COOKIE;
  });

  afterEach(() => {
    if (saved !== undefined) process.env.AUCHAN_COOKIE = saved;
    else delete process.env.AUCHAN_COOKIE;
  });

  it('getCookie() retourne la valeur de AUCHAN_COOKIE', async () => {
    process.env.AUCHAN_COOKIE = 'lark-session=abc; datadome=xyz; lark-consentId=uuid';
    const p = new EnvCookieProvider();
    await expect(p.getCookie()).resolves.toBe('lark-session=abc; datadome=xyz; lark-consentId=uuid');
  });

  it('getCookie() rejette si AUCHAN_COOKIE absent', async () => {
    const p = new EnvCookieProvider();
    await expect(p.getCookie()).rejects.toThrow('AUCHAN_COOKIE env var is not set');
  });

  it('invalidate() ne lève pas et getCookie() fonctionne après', async () => {
    process.env.AUCHAN_COOKIE = 'x=y';
    const p = new EnvCookieProvider();
    p.invalidate(); // synchrone, no-op
    await expect(p.getCookie()).resolves.toBe('x=y');
  });
});

// ─── ChromeCookieProvider ─────────────────────────────────────────────────────

const FULL_COOKIES = {
  'lark-session': 'sess1',
  'datadome': 'dd1',
  'lark-consentId': 'cid1',
  'extra-cookie': 'ignored',
};

describe('ChromeCookieProvider', () => {
  it('getCookie() retourne les 3 cookies dans le bon ordre', async () => {
    const { loader } = makeLoader(FULL_COOKIES);
    const p = new ChromeCookieProvider('Default', loader);
    await expect(p.getCookie()).resolves.toBe(
      'lark-session=sess1; datadome=dd1; lark-consentId=cid1',
    );
  });

  it('les cookies supplémentaires sont ignorés dans la chaîne', async () => {
    const { loader } = makeLoader(FULL_COOKIES);
    const p = new ChromeCookieProvider('Default', loader);
    const cookie = await p.getCookie();
    expect(cookie).not.toContain('extra-cookie');
  });

  it('getCookie() appelle le loader une seule fois si appelé 2× (cache)', async () => {
    const { loader } = makeLoader(FULL_COOKIES);
    const p = new ChromeCookieProvider('Default', loader);
    await p.getCookie();
    await p.getCookie();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('invalidate() vide le cache : le loader est rappelé après', async () => {
    const { loader } = makeLoader(FULL_COOKIES);
    const p = new ChromeCookieProvider('Default', loader);
    await p.getCookie();
    p.invalidate();
    await p.getCookie();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('throw si datadome est absent', async () => {
    const { loader } = makeLoader({ 'lark-session': 's', 'lark-consentId': 'c' });
    const p = new ChromeCookieProvider('Default', loader);
    await expect(p.getCookie()).rejects.toThrow('datadome');
  });

  it('throw avec tous les cookies manquants listés', async () => {
    const { loader } = makeLoader({});
    const p = new ChromeCookieProvider('Default', loader);
    await expect(p.getCookie()).rejects.toThrow(
      'Missing required cookies: lark-session, datadome, lark-consentId',
    );
  });
});

// ─── createCookieProvider ─────────────────────────────────────────────────────

describe('createCookieProvider', () => {
  let saved: string | undefined;
  beforeEach(() => { saved = process.env.AUCHAN_COOKIE; });
  afterEach(() => {
    if (saved !== undefined) process.env.AUCHAN_COOKIE = saved;
    else delete process.env.AUCHAN_COOKIE;
  });

  it('retourne EnvCookieProvider si AUCHAN_COOKIE défini', () => {
    process.env.AUCHAN_COOKIE = 'x=y';
    expect(createCookieProvider()).toBeInstanceOf(EnvCookieProvider);
  });

  it('retourne ChromeCookieProvider si AUCHAN_COOKIE absent', () => {
    delete process.env.AUCHAN_COOKIE;
    expect(createCookieProvider()).toBeInstanceOf(ChromeCookieProvider);
  });
});
