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
