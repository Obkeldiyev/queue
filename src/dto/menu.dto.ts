export interface CreateMenuDto {
  parent_id?: string;
  name: string;
  label?: string;
  icon_class?: string;
  url?: string;
  page_id?: string;
  queue_group_id?: string;
  target?: "_blank" | "_self";
  sort_order?: number;
  is_visible?: boolean;
  requires_auth?: boolean;
}

export interface UpdateMenuDto {
  parent_id?: string;
  name?: string;
  label?: string;
  icon_class?: string;
  url?: string;
  page_id?: string;
  queue_group_id?: string;
  target?: "_blank" | "_self";
  sort_order?: number;
  is_visible?: boolean;
  requires_auth?: boolean;
}

export interface ReorderMenuDto {
  items: Array<{ id: string; sort_order: number }>;
}
