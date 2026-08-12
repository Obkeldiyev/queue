export interface CreateBranchDto {
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  phone?: string;
  email?: string;
  address_uz?: string;
  address_ru?: string;
  address_en?: string;
  latitude?: number;
  longitude?: number;
  working_hours?: Record<string, { open: string; close: string }>;
  timezone?: string;
}

export interface UpdateBranchDto {
  name_uz?: string;
  name_ru?: string;
  name_en?: string;
  phone?: string;
  email?: string;
  address_uz?: string;
  address_ru?: string;
  address_en?: string;
  latitude?: number;
  longitude?: number;
  working_hours?: Record<string, { open: string; close: string }>;
  timezone?: string;
  status?: string;
}
