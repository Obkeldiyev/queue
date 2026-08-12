export interface CreateQueueGroupDto {
  branch_id: string;
  service_id?: string;
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  prefix: string;
  number_format?: string;
  queue_type?: "SEQUENTIAL" | "PRIORITY" | "SMART" | "APPOINTMENT";
  daily_limit?: number;
  daily_reset_time?: string;
  priority_weight?: number;
  online_enabled?: boolean;
  auto_recall_enabled?: boolean;
  auto_recall_after_sec?: number;
  no_show_after_sec?: number;
  working_hours?: Record<string, { open: string; close: string }>;
}

export interface UpdateQueueGroupDto {
  name_uz?: string;
  name_ru?: string;
  name_en?: string;
  prefix?: string;
  number_format?: string;
  queue_type?: "SEQUENTIAL" | "PRIORITY" | "SMART" | "APPOINTMENT";
  daily_limit?: number;
  daily_reset_time?: string;
  priority_weight?: number;
  online_enabled?: boolean;
  auto_recall_enabled?: boolean;
  auto_recall_after_sec?: number;
  no_show_after_sec?: number;
  working_hours?: Record<string, { open: string; close: string }>;
  is_active?: boolean;
  sort_order?: number;
}

export interface IssueTicketDto {
  queue_group_id: string;
  branch_id: string;
  customer_id?: string;
  priority?: number;
  notes?: string;
  is_online?: boolean;
}

export interface CallNextDto {
  counter_id: string;
}

export interface TransferTicketDto {
  to_counter_id?: string;
  to_queue_group_id?: string;
  notes?: string;
}
