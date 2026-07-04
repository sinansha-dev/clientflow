export type Role = 'ADMIN' | 'DEVELOPER' | 'CLIENT';
export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
  phone?: string | null;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{ path: string; message: string }>;
}
