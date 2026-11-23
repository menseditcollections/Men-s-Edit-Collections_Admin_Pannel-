export type Category = "Shirt" | "Pant" | "T-Shirt";
export const CATEGORIES: Category[] = ["Shirt", "Pant", "T-Shirt"];

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: Category;
  price: number;
  purchasePrice: number | null;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  sizes: Size[];
}

export interface Size {
  id: string;
  productId: string;
  label: string;
  stock: number;
  sold: number;
  sortOrder: number;
  createdAt: string;
}

export interface DailySale {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  note: string | null;
  createdAt: string;
}

export type MovementType =
  | "sale"
  | "retrieve"
  | "stock_in"
  | "stock_out"
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "size_added"
  | "size_removed"
  | "daily_sale";

export interface Movement {
  id: string;
  productId: string | null;
  productName: string | null;
  sizeId: string | null;
  sizeLabel: string | null;
  type: MovementType;
  quantity: number;
  amount: number | null;
  note: string | null;
  createdAt: string;
}

export interface DayClosureItem {
  productName: string;
  sizeLabel: string | null;
  price: number;
  movementId?: string | null; // links back to the sale movement for edits
}

export interface DayClosure {
  id: string;
  date: string; // YYYY-MM-DD
  closedAt: string;
  items: DayClosureItem[];      // one entry per item sold
  saleCount: number;
  retrievedCount: number;
  itemSalesTotal: number;       // sales minus retrieves
  manualAmount: number;
  manualNote: string | null;
  grandTotal: number;
}

export interface Admin {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface DashboardStats {
  totalProducts: number;
  totalStock: number;
  totalSold: number;
  todaySales: number;      // item-sale revenue today
  totalSales: number;      // item-sale revenue all time
  todayManualSales: number;
  totalManualSales: number;
  lowStockCount: number;
  recentProducts: Product[];
  recentMovements: Movement[];
  salesLast7Days: { date: string; amount: number }[];
  categoryCounts: { category: string; count: number }[];
}
