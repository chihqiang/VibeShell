export interface HostConfig {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  auth_method: string;
  password?: string | null;
  private_key_path?: string | null;
  group?: string | null;
  created_at: number;
  updated_at: number;
}
