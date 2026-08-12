export interface CreateCompanyUserDto {
  branch_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password: string;
  role_ids?: string[];
}

export interface UpdateCompanyUserDto {
  branch_id?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  status?: string;
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
