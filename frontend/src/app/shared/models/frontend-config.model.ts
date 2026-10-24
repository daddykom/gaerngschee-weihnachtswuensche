export type UserGroup = 'admin' | 'user' | 'wunschbesteller' | 'wunscherfueller';

export interface FrontendConfig {
  id: string;
  variableName: string;
  value: string | string[] | null;
  description: string;
  accessGroup: UserGroup[];
  updateGroup: UserGroup[];
  label: string;
  pattern: string | null;
  placeholder: string | null;
  canUpdate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicFrontendConfig {
  variableName: string;
  value: string | string[] | null;
}
