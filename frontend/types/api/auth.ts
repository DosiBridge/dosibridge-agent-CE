/**
 * Authentication API types
 */

export interface User {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  role?: string;
  is_superadmin?: boolean;
  picture?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
