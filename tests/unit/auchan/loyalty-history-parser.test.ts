import { describe, it, expect } from 'vitest';
import { parseLoyaltyHistoryPage } from '../../../src/auchan/loyalty-history-parser.js';

// HTML minimal reproduisant la structure réelle de /fidelite/ma-carte/historique
// Contient 5 transactions mixtes (gains + débits)
const FULL_HTML = `
<html><body>
<table>
  <thead>
    <tr><th>Date</th><th>Canal</th><th>Magasin</th><th>Montant</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>04/06/2026</td>
      <td>Drive</td>
      <td>Auchan Drive Saint-Genis (Chapônost)</td>
      <td>+0,53</td>
    </tr>
    <tr>
      <td>01/06/2026</td>
      <td>Magasin</td>
      <td>Auchan Supermarché Lyon Garibaldi</td>
      <td>+1,20</td>
    </tr>
    <tr>
      <td>28/05/2026</td>
      <td>Drive</td>
      <td>Auchan Drive Saint-Genis (Chapônost)</td>
      <td>-2,00</td>
    </tr>
    <tr>
      <td>15/05/2026</td>
      <td>Magasin</td>
      <td>Auchan Hypermarché Metz</td>
      <td>+5,48</td>
    </tr>
    <tr>
      <td>10/05/2026</td>
      <td>Drive</td>
      <td>Auchan Drive Lille Nord</td>
      <td>-10,00</td>
    </tr>
  </tbody>
</table>
</body></html>
`;

// HTML avec montants incluant le symbole €
const HTML_WITH_EURO = `
<html><body>
<table><tbody>
  <tr>
    <td>04/06/2026</td>
    <td>Drive</td>
    <td>Auchan Drive Test</td>
    <td>+0,53 €</td>
  </tr>
  <tr>
    <td>03/06/2026</td>
    <td>Magasin</td>
    <td>Auchan Magasin Test</td>
    <td>-2,00 €</td>
  </tr>
</tbody></table>
</body></html>
`;

// HTML avec historique vide
const EMPTY_HTML = `
<html><body>
<table><tbody>
</tbody></table>
</body></html>
`;

describe('parseLoyaltyHistoryPage', () => {
  // ── Nombre de transactions ──────────────────────────────────────────────────

  it('retourne 5 transactions pour un tableau de 5 lignes', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions).toHaveLength(5);
  });

  it('retourne un tableau vide si le HTML ne contient pas de lignes valides', () => {
    const transactions = parseLoyaltyHistoryPage(EMPTY_HTML);
    expect(transactions).toHaveLength(0);
  });

  it('retourne un tableau vide sur un HTML vide', () => {
    const transactions = parseLoyaltyHistoryPage('<html></html>');
    expect(transactions).toHaveLength(0);
  });

  it('ignore les lignes d\'entête <th> (pas de <td>)', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    // Seules les 5 lignes de données doivent être parsées
    expect(transactions).toHaveLength(5);
  });

  // ── Première transaction (gain Drive) ─────────────────────────────────────

  it('extrait la date de la première transaction', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[0].date).toBe('04/06/2026');
  });

  it('extrait le canal de la première transaction', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[0].channel).toBe('Drive');
  });

  it('extrait le nom du magasin de la première transaction', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[0].storeName).toBe('Auchan Drive Saint-Genis (Chapônost)');
  });

  it('parse le montant positif en centimes', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[0].amountCents).toBe(53);
  });

  it('formate le montant positif avec signe +', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[0].amountFormatted).toBe('+0,53 €');
  });

  // ── Montants négatifs ──────────────────────────────────────────────────────

  it('parse le montant négatif en centimes signés', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[2].amountCents).toBe(-200);
  });

  it('formate le montant négatif avec signe -', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[2].amountFormatted).toBe('-2,00 €');
  });

  it('parse un débit de 10,00 € en centimes signés', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[4].amountCents).toBe(-1000);
    expect(transactions[4].amountFormatted).toBe('-10,00 €');
  });

  // ── Montant avec symbole € dans le HTML ───────────────────────────────────

  it('gère les montants qui incluent le symbole € dans le HTML', () => {
    const transactions = parseLoyaltyHistoryPage(HTML_WITH_EURO);
    expect(transactions).toHaveLength(2);
    expect(transactions[0].amountCents).toBe(53);
    expect(transactions[0].amountFormatted).toBe('+0,53 €');
    expect(transactions[1].amountCents).toBe(-200);
    expect(transactions[1].amountFormatted).toBe('-2,00 €');
  });

  it('formate les montants sans signe explicite comme positifs (+)', () => {
    const html = `
<html><body><table><tbody>
  <tr><td>04/06/2026</td><td>Drive</td><td>Auchan Drive Test</td><td>0,53</td></tr>
</tbody></table></body></html>`;
    const transactions = parseLoyaltyHistoryPage(html);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].amountCents).toBe(53);
    expect(transactions[0].amountFormatted).toBe('+0,53 €');
  });

  // ── Deuxième transaction (gain Magasin) ───────────────────────────────────

  it('extrait le canal Magasin correctement', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[1].channel).toBe('Magasin');
  });

  it('parse un gain de 1,20 € en centimes', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[1].amountCents).toBe(120);
    expect(transactions[1].amountFormatted).toBe('+1,20 €');
  });

  // ── Quatrième transaction (gain 5,48 €) ───────────────────────────────────

  it('parse un gain de 5,48 € en centimes', () => {
    const transactions = parseLoyaltyHistoryPage(FULL_HTML);
    expect(transactions[3].amountCents).toBe(548);
    expect(transactions[3].amountFormatted).toBe('+5,48 €');
  });
});
