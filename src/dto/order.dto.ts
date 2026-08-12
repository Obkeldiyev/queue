export interface CreateOrderDto {
  branch_id: string;
  customer_id?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    notes?: string;
    modifiers?: string[];
  }>;
  payment_method?: string;
  notes?: string;
}

export interface UpdateOrderStatusDto {
  status: "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED" | "REFUNDED";
}

export interface CreateProductDto {
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  discount_price?: number;
  sku?: string;
  preparation_time_mins?: number;
  sort_order?: number;
}

export interface UpdateProductDto {
  category_id?: string;
  name?: string;
  description?: string;
  price?: number;
  discount_price?: number;
  sku?: string;
  preparation_time_mins?: number;
  sort_order?: number;
  is_available?: boolean;
  status?: string;
}

export interface CreateProductCategoryDto {
  parent_id?: string;
  name: string;
  description?: string;
  sort_order?: number;
}
