export interface CreatePageDto {
  name: string;
  slug: string;
  title?: string;
  description?: string;
  seo_title?: string;
  seo_description?: string;
  template?: string;
  is_homepage?: boolean;
}

export interface UpdatePageDto {
  name?: string;
  slug?: string;
  title?: string;
  description?: string;
  seo_title?: string;
  seo_description?: string;
  template?: string;
  is_homepage?: boolean;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export interface AddPageComponentDto {
  component_type: string;
  parent_component_id?: string;
  x_position?: number;
  y_position?: number;
  width?: number;
  height?: number;
  sort_order?: number;
  col_span?: number;
  row_span?: number;
  settings?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  mobile_styles?: Record<string, unknown>;
  animations?: Record<string, unknown>;
}

export interface UpdatePageComponentDto {
  x_position?: number;
  y_position?: number;
  width?: number;
  height?: number;
  sort_order?: number;
  col_span?: number;
  row_span?: number;
  settings?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  mobile_styles?: Record<string, unknown>;
  animations?: Record<string, unknown>;
  is_locked?: boolean;
  is_hidden?: boolean;
}
