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
