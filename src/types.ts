export interface Product {
  id: string;
  label: string;
  brand?: string;
  price: number;
  pricePerUnit?: number;
  available: boolean;
  nutriScore?: string;
}

export interface CartItem {
  productId: string;
  label: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  distance?: number;
  type: string;
}

export interface CookieProvider {
  getCookie(): Promise<string>;
  invalidate(): void;
}

export interface FavoriteProduct {
  name: string;           // "Boisson gazeuse à l'orange"
  brand?: string;          // "ORANGINA"
  format?: string;        // "1,5l"
  category: string;       // "Eaux, jus, sodas, thés glacés"
  price: number;          // centimes (193)
  priceFormatted: string; // "1,93 €"
  pricePerUnit?: string;  // "1,29 € / l"
  promo?: string;         // "-50% sur le 2ème"
  productUrl: string;     // "/orangina-boisson-gazeuse-a-l-orange/pr-C1820950"
  productCode?: string;   // "C1820950" (extrait du slug)
  available: boolean;
}

export interface Order {
  orderRef: string;
  orderNumber: string;
  date: string;
  storeName: string;
  status: string;
  productCount: number;
  total: number;
  totalFormatted: string;
  detailUrl: string;
}

export type OrderPeriod =
  | '10days'
  | '30days'
  | '3months'
  | '6months'
  | 'current_year'
  | '2025'
  | '2024';


export interface LoyaltyInfo {
  card: {
    number: string;
    holder: string;
  };
  balance: {
    amountCents: number;
    amountFormatted: string;
    expiryDate: string;
  };
  waoohAccountNumber: string;
  jourW: {
    active: boolean;
    day?: string;
    benefit?: string;
  };
  challenges: {
    cagnotteCents: number;
    cagnotteFormatted: string;
    deadline?: string;
  };
}

export interface LoyaltyTransaction {
  date: string;            // "04/06/2026"
  channel: string;         // "Drive" | "Magasin"
  storeName: string;       // "Auchan Drive Saint-Genis (Chapônost)"
  amountCents: number;     // +53 ou -200 (centimes, signé)
  amountFormatted: string; // "+0,53 €" ou "-2,00 €"
}
