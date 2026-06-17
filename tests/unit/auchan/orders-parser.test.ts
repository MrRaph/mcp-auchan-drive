import { describe, it, expect } from 'vitest';
import { parseOrdersPage } from '../../../src/auchan/orders-parser.js';

// HTML minimal reproduisant la structure réelle de /client/mes-commandes
const THREE_ORDERS_HTML = `
<html><body>
<ul>
  <li>
    <span>Drive</span>
    <span>Auchan Drive Caluire</span>
    <span>Commande n° 370069704 du 14 juin 2026</span>
    <span>Enregistrée</span>
    <span>14 Produits</span>
    <span>38,62 €</span>
    <a href="/client/mes-commandes/AROM-761999631/370069704">Modifier / Annuler...</a>
  </li>
  <li>
    <span>Drive</span>
    <span>Auchan Drive Lyon Nord</span>
    <span>Commande n° 370000001 du 2 mai 2026</span>
    <span>Retirée</span>
    <span>7 Produits</span>
    <span>21,50 €</span>
    <a href="/client/mes-commandes/AROM-123456789/370000001">Détails</a>
  </li>
  <li>
    <span>Drive</span>
    <span>Auchan Drive Caluire</span>
    <span>Commande n° 369000002 du 10 avril 2026</span>
    <span>Annulée</span>
    <span>3 Produits</span>
    <span>9,99 €</span>
    <a href="/client/mes-commandes/AROM-987654321/369000002">Détails</a>
  </li>
</ul>
</body></html>
`;

// HTML avec une seule commande "En cours de préparation"
const SINGLE_ORDER_HTML = `
<html><body>
<ul>
  <li>
    <span>Drive</span>
    <span>Auchan Drive Paris Est</span>
    <span>Commande n° 400000001 du 16 juin 2026</span>
    <span>En cours de préparation</span>
    <span>5 Produits</span>
    <span>15,00 €</span>
    <a href="/client/mes-commandes/AROM-111111111/400000001">Modifier / Annuler...</a>
  </li>
</ul>
</body></html>
`;

// HTML sans aucune commande (liste vide)
const EMPTY_HTML = `<html><body><ul></ul></body></html>`;

describe('parseOrdersPage', () => {
  // ── Liste de 3 commandes ────────────────────────────────────────────────────

  it('retourne 3 commandes depuis le HTML avec 3 entrées', () => {
    const orders = parseOrdersPage(THREE_ORDERS_HTML);
    expect(orders).toHaveLength(3);
  });

  it('extrait orderRef correctement', () => {
    const orders = parseOrdersPage(THREE_ORDERS_HTML);
    expect(orders[0].orderRef).toBe('AROM-761999631');
    expect(orders[1].orderRef).toBe('AROM-123456789');
    expect(orders[2].orderRef).toBe('AROM-987654321');
  });

  it('extrait orderNumber correctement', () => {
    const orders = parseOrdersPage(THREE_ORDERS_HTML);
    expect(orders[0].orderNumber).toBe('370069704');
    expect(orders[1].orderNumber).toBe('370000001');
    expect(orders[2].orderNumber).toBe('369000002');
  });

  it('extrait la date correctement', () => {
    const orders = parseOrdersPage(THREE_ORDERS_HTML);
    expect(orders[0].date).toBe('14 juin 2026');
    expect(orders[1].date).toBe('2 mai 2026');
    expect(orders[2].date).toBe('10 avril 2026');
  });

  it('extrait le nom du magasin', () => {
    const orders = parseOrdersPage(THREE_ORDERS_HTML);
    expect(orders[0].storeName).toBe('Auchan Drive Caluire');
    expect(orders[1].storeName).toBe('Auchan Drive Lyon Nord');
  });

  it('extrait le statut', () => {
    const orders = parseOrdersPage(THREE_ORDERS_HTML);
    expect(orders[0].status).toBe('Enregistrée');
    expect(orders[1].status).toBe('Retirée');
    expect(orders[2].status).toBe('Annulée');
  });

  it('extrait le nombre de produits', () => {
    const orders = parseOrdersPage(THREE_ORDERS_HTML);
    expect(orders[0].productCount).toBe(14);
    expect(orders[1].productCount).toBe(7);
    expect(orders[2].productCount).toBe(3);
  });

  it('extrait le total en centimes', () => {
    const orders = parseOrdersPage(THREE_ORDERS_HTML);
    expect(orders[0].total).toBe(3862);
    expect(orders[1].total).toBe(2150);
    expect(orders[2].total).toBe(999);
  });

  it('extrait le total formaté', () => {
    const orders = parseOrdersPage(THREE_ORDERS_HTML);
    expect(orders[0].totalFormatted).toBe('38,62 €');
    expect(orders[1].totalFormatted).toBe('21,50 €');
    expect(orders[2].totalFormatted).toBe('9,99 €');
  });

  it('extrait l\'URL de détail', () => {
    const orders = parseOrdersPage(THREE_ORDERS_HTML);
    expect(orders[0].detailUrl).toBe('/client/mes-commandes/AROM-761999631/370069704');
    expect(orders[1].detailUrl).toBe('/client/mes-commandes/AROM-123456789/370000001');
  });

  // ── Statut "En cours de préparation" ───────────────────────────────────────

  it('parse le statut "En cours de préparation"', () => {
    const orders = parseOrdersPage(SINGLE_ORDER_HTML);
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('En cours de préparation');
    expect(orders[0].orderRef).toBe('AROM-111111111');
    expect(orders[0].orderNumber).toBe('400000001');
    expect(orders[0].total).toBe(1500);
    expect(orders[0].productCount).toBe(5);
  });

  // ── Edge case : liste vide ──────────────────────────────────────────────────

  it('retourne [] pour une page sans commande', () => {
    const orders = parseOrdersPage(EMPTY_HTML);
    expect(orders).toEqual([]);
  });

  it('retourne [] pour un HTML vide', () => {
    const orders = parseOrdersPage('<html></html>');
    expect(orders).toEqual([]);
  });
});
