export interface CreateCompanyDto {
  name: string;
  slug: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  timezone?: string;
  locale?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface UpdateCompanyDto {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  timezone?: string;
  locale?: string;
  primary_color?: string;
  secondary_color?: string;
  status?: string;
  settings?: Record<string, unknown>;
}

export interface CreateSubscriptionDto {
  name: string;
  description?: string;
  monthly_price: number;
  yearly_price: number;
  max_branches?: number;
  max_users?: number;
  max_devices?: number;
  max_storage_gb?: number;
  online_queue_enabled?: boolean;
  ordering_enabled?: boolean;
  analytics_enabled?: boolean;
  custom_domain_enabled?: boolean;
  api_access_enabled?: boolean;
}

export interface AssignSubscriptionDto {
  subscription_id: string;
  expires_at: string;
  payment_method?: string;
  amount_paid?: number;
}
