export interface CreateServiceDto {
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  description_uz?: string;
  description_ru?: string;
  description_en?: string;
  estimated_time_mins?: number;
  priority_level?: number;
  working_hours?: Record<string, { open: string; close: string }>;
  color?: string;
}

export interface UpdateServiceDto {
  name_uz?: string;
  name_ru?: string;
  name_en?: string;
  description_uz?: string;
  description_ru?: string;
  description_en?: string;
  estimated_time_mins?: number;
  priority_level?: number;
  working_hours?: Record<string, { open: string; close: string }>;
  color?: string;
  status?: string;
}
