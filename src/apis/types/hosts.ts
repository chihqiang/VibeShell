import type { AuthMethod } from '@/lib/types';

export interface HostConfig {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  auth_method: AuthMethod;
  password?: string | null;
  private_key_path?: string | null;
  tags?: string[];
  created_at: number;
  updated_at: number;
  last_connected_at?: number | null;
}
