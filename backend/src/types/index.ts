// Participant Types
export interface Participant {
  id: string;
  voluntary_email: string;
  voluntary_code: string;
  voluntary_name: string;
  carry_code: string;
  email_verified: number;
  email_verification_token: string | null;
  token_expires_at: string | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  last_access: string | null;
  status: 'active' | 'completed' | 'expired';
}

export interface RegisterRequest {
  voluntary_email: string;
  voluntary_name: string;
  terms_accepted: boolean;
}

export interface LoginRequest {
  code: string; // Can be VOLUNTARY_CODE or CARRY_CODE
}

export interface LoginResponse {
  token: string;
  participant: Participant;
  samples: Sample[];
}

// Sample Types
export interface Sample {
  id: string;
  participant_id: string;
  carry_code: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'in_progress' | 'completed';
  groups: Group[];
}

export interface Group {
  id: string;
  sample_id: string;
  group_index: number;
  group_id: string; // 4 letters + 5 numbers
  has_same_source: boolean;
  questionada_filename: string;
  padroes_filenames: string; // JSON array
  matched_image_index: number | null;
  created_at: string;
  status: 'pending' | 'completed';
}

export interface GroupImage {
  id: string;
  group_id: string;
  file_name: string;
  file_path: string;
  image_type: 'questionada' | 'padrao';
  index: number | null; // null for questionada, 0-9 for padrao
  sha256_hash: string;
}

// Result Types
export interface ResultSubmission {
  group_id: string;
  conclusive: boolean;
  has_match: boolean | null;
  matched_image_index: number | null;
  compatibility_degree: 1 | 2 | 3 | 4 | null;
  notes: string | null;
}

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

// File Tracking Types
export interface FileTracking {
  id: string;
  participant_id: string;
  file_name: string;
  file_path: string;
  sha256_hash: string;
  used_at: string;
}

// Access Log Types
export interface AccessLog {
  id: string;
  participant_id: string | null;
  ip_address: string;
  endpoint: string;
  method: string;
  status_code: number;
  timestamp: string;
  user_agent: string;
}

// Email Types
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

// Certificate Types
export interface CertificateData {
  participant_name: string;
  voluntary_code: string;
  carry_code: string;
  completion_date: string;
  groups_evaluated: number;
  certificate_id: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Pagination Types
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Code Generation Types
export interface GeneratedCodes {
  voluntary_code: string;
  carry_code: string;
}

// CSV Types
export interface PairwiseComparison {
  arquivo_a: string;
  quali_a: number;
  arquivo_b: string;
  quali_b: number;
  mesma_fonte: 0 | 1;
  mesmo_arquivo: 0 | 1;
  score: number;
}

export interface ComparisonStatistics {
  same_source: {
    mean: number;
    std_dev: number;
    min: number;
    max: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  different_source: {
    mean: number;
    std_dev: number;
    min: number;
    max: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
}

// Authentication Types
export interface JwtPayload {
  participant_id: string;
  voluntary_code: string;
  iat: number;
  exp: number;
}

export interface AuthContext {
  participant_id: string;
  voluntary_code: string;
  ip_address: string;
  user_agent: string;
}

// Image Degradation Types
export interface DegradationConfig {
  width: number;
  height: number;
  min_area_percent: number;
  max_area_percent: number;
  min_eccentricity: number;
  max_eccentricity: number;
}

export interface DegradationParams {
  area_percent: number;
  eccentricity: number;
  rotation: number;
  center_x: number;
  center_y: number;
}
