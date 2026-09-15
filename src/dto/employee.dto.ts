export interface CreateCompanyUserDto {
  branch_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password: string;
  role_ids?: string[];
  avatar_url?: string | null;
  allowed_service_ids?: string[] | null;
  allowed_menu_ids?: string[] | null;
}

export interface UpdateCompanyUserDto {
  branch_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string | null;
  role_ids?: string[];
  status?: string;
  default_counter_id?: string | null;
  allowed_service_ids?: string[] | null;
  allowed_menu_ids?: string[] | null;
}

export interface CreateCompanyRoleDto {
  name: string;
  type?: string;
  description?: string;
  permission_codes?: string[];
}

export interface UpdateCompanyRoleDto {
  name?: string;
  description?: string;
  permission_codes?: string[];
}
