export interface KeyEntry {
  id: string;
  name: string;
  file_name: string;
  key_type: string;
  fingerprint: string;
  imported_at: number;
  password?: string | null;
}

export interface ImportKeyParams {
  sourcePath: string;
  name: string | null;
  password: string | null;
}

export interface ImportKeyContentParams {
  content: string;
  name: string;
  password: string | null;
}
