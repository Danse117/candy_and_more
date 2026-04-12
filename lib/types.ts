export interface Product {
  id: string;
  upc: string;
  name: string;
  description: string;
  price: number;
  category: string;
  photoUrl: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface OrderPayload {
  customerFirstName: string;
  customerLastName: string;
  customerEmail?: string;
  customerPhone?: string;
  storeAddress?: string;
  note?: string;
  items: Array<{
    productId: string;
    name: string;
    upc: string;
    quantity: number;
    price: number;
  }>;
  totalPrice: number;
  submittedAt: string;
}
