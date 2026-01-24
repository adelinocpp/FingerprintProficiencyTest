// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Participant Types
export interface Participant {
  id: string;
  voluntary_email: string;
  voluntary_code: string;
  voluntary_name: string;
  carry_code: string;
  created_at: string;
  updated_at: string;
  last_access: string | null;
  status: 'active' | 'completed' | 'expired';
}

// Sample Types
export interface Sample {
  id: string;
  participant_id: string;
  carry_code: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'in_progress' | 'completed';
  groups?: Group[];
}

export interface Group {
  id: string;
  sample_id: string;
  group_index: number;
  group_id: string;
  has_same_source: boolean;
  created_at: string;
  status: 'pending' | 'completed';
  images?: GroupImage[];
}

export interface GroupImage {
  id: string;
  group_id: string;
  file_name: string;
  file_path: string;
  image_type: 'questionada' | 'padrao';
  index: number | null;
  sha256_hash: string;
}

// Result Types
export interface Result {
  id: string;
  sample_id: string;
  group_id: string;
  conclusive: boolean;
  has_match: boolean | null;
  matched_image_index: number | null;
  compatibility_degree: 1 | 2 | 3 | 4 | null;
  notes: string | null;
  submitted_at: string;
}

export interface ResultSubmission {
  group_id: string;
  conclusive: boolean;
  has_match: boolean | null;
  matched_image_index: number | null;
  compatibility_degree: 1 | 2 | 3 | 4 | null;
  notes: string | null;
}

// Auth Types
export interface LoginRequest {
  code: string;
}

export interface RegisterRequest {
  voluntary_email: string;
  voluntary_name: string;
  terms_accepted: boolean;
}

export interface LoginResponse {
  token: string;
  participant: Participant;
  samples: Sample[];
}

// UI State Types
export interface AuthState {
  token: string | null;
  participant: Participant | null;
  isLoading: boolean;
  error: string | null;
}

export interface SampleState {
  samples: Sample[];
  currentSample: Sample | null;
  isLoading: boolean;
  error: string | null;
}

export interface ResultState {
  results: Record<string, Result>;
  isSubmitting: boolean;
  error: string | null;
}

// Form Types
export interface RegisterFormData {
  voluntary_email: string;
  voluntary_name: string;
  terms_accepted: boolean;
}

export interface LoginFormData {
  code: string;
}

export interface ResultFormData {
  conclusive: boolean;
  has_match: boolean | null;
  matched_image_index: number | null;
  compatibility_degree: 1 | 2 | 3 | 4 | null;
  notes: string | null;
}

// Progress Types
export interface SampleProgress {
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
  status: string;
}

// Statistics Types
export interface ResultsStatistics {
  total_samples: number;
  total_groups: number;
  total_results: number;
  conclusive_results: number;
  with_match: number;
  without_match: number;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// Language Types
export type Language = 'pt-BR' | 'en' | 'es';

export interface I18nMessages {
  [key: string]: string | I18nMessages;
}
