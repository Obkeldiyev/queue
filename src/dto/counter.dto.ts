export interface CreateCounterDto {
  branch_id: string;
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  number: number;
  description?: string;
}

export interface UpdateCounterDto {
  name_uz?: string;
  name_ru?: string;
  name_en?: string;
  description?: string;
  is_active?: boolean;
  number?: number;
}

export interface AssignQueueToCounterDto {
  queue_group_id: string;
  sort_order?: number;
}

export interface OpenCounterSessionDto {
  counter_id: string;
}
