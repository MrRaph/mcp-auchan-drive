import { describe, it, expect } from 'vitest';
import { parseLoyaltyPage } from '../../../src/auchan/loyalty-parser.js';

// HTML minimal reproduisant la structure réelle de /fidelite/accueil
// Les valeurs sensibles ont été remplacées par des données fictives.
const FULL_HTML = `
<html><body>
<div class="o-cardSelector__cardNumberAndName">
  <div class="o-cardSelector__cardNumber">N° <strong>0000000000000</strong></div>
  <div class="o-cardSelector__cardName">DOE John</div>
</div>

<div class="t-myLoyalty__amount o-loyaltyMyCard__amount">
  <div class="o-loyaltyMyCard__row">
    <span>Ma cagnotte au 04/06/2026</span>
    <span class="a-waaohTag a-waaohTag--xlarge a-waaohTag--transparent">3,46 €</span>
  </div>
</div>

<div class="-waaohAccountID">Mon numéro de compte Waooh : 00000000</div>

<div class="m-discountClubBox">
  <div class="m-discountClubBox__title -waaoh">Votre jour W! est activé !</div>
  <div class="m-discountClubBox__title -noBold">
    Chaque <strong>mercredi</strong>, vous bénéficiez de
    <strong>10 % cagnottés sur tous les produits frais des Halles*</strong>
  </div>
</div>

<section class="t-myLoyalty__section t-myLoyalty__section--challenges">
  <div class="m-emptyBox__title -noBold">
    <strong>Jusqu’au 30 juin 2026</strong>, profitez des Défis Waaoh.
  </div>
  <div class="a-waaohChallengeTag">
    Cagnotte Défis Waaoh
    <span class="a-waaohChallengeTag__amount">
      0,00 €
    </span>
  </div>
</section>
</body></html>
`;

// Variante : Jour W! inactif, cagnotte non nulle sur les défis, champs absents
const PARTIAL_HTML = `
<html><body>
<div class="o-cardSelector__cardNumberAndName">
  <div class="o-cardSelector__cardNumber">N° <strong>1234567890123</strong></div>
  <div class="o-cardSelector__cardName">DUPONT Jean</div>
</div>
<div class="t-myLoyalty__amount o-loyaltyMyCard__amount">
  <div class="o-loyaltyMyCard__row">
    <span>Ma cagnotte au 31/12/2026</span>
    <span class="a-waaohTag a-waaohTag--xlarge a-waaohTag--transparent">12,50 €</span>
  </div>
</div>
<div class="-waaohAccountID">Mon numéro de compte Waooh : 99887766</div>
<div class="a-waaohChallengeTag">
  Cagnotte Défis Waaoh
  <span class="a-waaohChallengeTag__amount">5,00 €</span>
</div>
</body></html>
`;

describe('parseLoyaltyPage', () => {
  // ── Carte ──────────────────────────────────────────────────────────────────

  it('extrait le numéro de carte', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.card.number).toBe('0000000000000');
  });

  it('extrait le nom du titulaire', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.card.holder).toBe('DOE John');
  });

  // ── Cagnotte principale ────────────────────────────────────────────────────

  it('extrait le montant de la cagnotte en centimes', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.balance.amountCents).toBe(346);
  });

  it('extrait le montant formaté de la cagnotte', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.balance.amountFormatted).toBe('3,46 €');
  });

  it('extrait la date d\'expiration de la cagnotte', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.balance.expiryDate).toBe('04/06/2026');
  });

  it('parse correctement une cagnotte à 12,50 €', () => {
    const info = parseLoyaltyPage(PARTIAL_HTML);
    expect(info.balance.amountCents).toBe(1250);
    expect(info.balance.amountFormatted).toBe('12,50 €');
    expect(info.balance.expiryDate).toBe('31/12/2026');
  });

  // ── Waooh ─────────────────────────────────────────────────────────────────

  it('extrait le numéro de compte Waooh', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.waoohAccountNumber).toBe('00000000');
  });

  // ── Jour W! ────────────────────────────────────────────────────────────────

  it('détecte Jour W! actif', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.jourW.active).toBe(true);
  });

  it('extrait le jour de la semaine du Jour W!', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.jourW.day).toBe('mercredi');
  });

  it('extrait le bénéfice du Jour W!', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.jourW.benefit).toBe('10 % cagnottés sur tous les produits frais des Halles*');
  });

  it('retourne Jour W! inactif si la phrase est absente', () => {
    const info = parseLoyaltyPage(PARTIAL_HTML);
    expect(info.jourW.active).toBe(false);
    expect(info.jourW.day).toBeUndefined();
    expect(info.jourW.benefit).toBeUndefined();
  });

  // ── Défis Waaoh ───────────────────────────────────────────────────────────

  it('extrait la deadline des défis (apostrophe U+2019)', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.challenges.deadline).toBe('30 juin 2026');
  });

  it('extrait la deadline des défis (apostrophe ASCII U+0027)', () => {
    const html = FULL_HTML.replace(/Jusqu\u2019au/g, "Jusqu'au");
    const info = parseLoyaltyPage(html);
    expect(info.challenges.deadline).toBe('30 juin 2026');
  });

  it('extrait la cagnotte des défis en centimes', () => {
    const info = parseLoyaltyPage(FULL_HTML);
    expect(info.challenges.cagnotteCents).toBe(0);
    expect(info.challenges.cagnotteFormatted).toBe('0,00 €');
  });

  it('parse une cagnotte défis non nulle', () => {
    const info = parseLoyaltyPage(PARTIAL_HTML);
    expect(info.challenges.cagnotteCents).toBe(500);
    expect(info.challenges.cagnotteFormatted).toBe('5,00 €');
  });

  it('retourne deadline undefined si absente', () => {
    const info = parseLoyaltyPage(PARTIAL_HTML);
    expect(info.challenges.deadline).toBeUndefined();
  });

  // ── Robustesse ─────────────────────────────────────────────────────────────

  it('retourne des valeurs par défaut sur un HTML vide', () => {
    const info = parseLoyaltyPage('<html></html>');
    expect(info.card.number).toBe('');
    expect(info.card.holder).toBe('');
    expect(info.balance.amountCents).toBe(0);
    expect(info.balance.amountFormatted).toBe('0,00 €');
    expect(info.balance.expiryDate).toBe('');
    expect(info.waoohAccountNumber).toBe('');
    expect(info.jourW.active).toBe(false);
    expect(info.challenges.cagnotteCents).toBe(0);
  });
});
