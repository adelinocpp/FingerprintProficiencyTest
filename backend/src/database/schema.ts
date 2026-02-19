/**
 * Schema SQL para o banco de dados SQLite
 * Cria todas as tabelas necessárias para o sistema
 */

export const schema = `
-- Tabela de participantes
CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  voluntary_email TEXT UNIQUE NOT NULL,
  voluntary_code TEXT UNIQUE NOT NULL,
  voluntary_name TEXT NOT NULL,
  carry_code TEXT UNIQUE NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0, 1)),
  email_verification_token TEXT,
  token_expires_at TEXT,
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_access TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'expired')),
  
  CONSTRAINT email_format CHECK(voluntary_email LIKE '%@%.%'),
  CONSTRAINT code_length CHECK(LENGTH(voluntary_code) = 6 AND LENGTH(carry_code) = 5)
);

-- Índices para participantes
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(voluntary_email);
CREATE INDEX IF NOT EXISTS idx_participants_voluntary_code ON participants(voluntary_code);
CREATE INDEX IF NOT EXISTS idx_participants_carry_code ON participants(carry_code);
CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);

-- Tabela de amostras
CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  carry_code TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
  
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- Índices para amostras
CREATE INDEX IF NOT EXISTS idx_samples_participant_id ON samples(participant_id);
CREATE INDEX IF NOT EXISTS idx_samples_carry_code ON samples(carry_code);
CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);

-- Tabela de grupos
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  group_index INTEGER NOT NULL,
  group_id TEXT UNIQUE NOT NULL,
  has_same_source INTEGER NOT NULL CHECK(has_same_source IN (0, 1)),
  questionada_filename TEXT NOT NULL,
  questionada_quality INTEGER DEFAULT 0,
  padroes_filenames TEXT NOT NULL,
  matched_image_index INTEGER,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),

  FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
);

-- Índices para grupos
CREATE INDEX IF NOT EXISTS idx_groups_sample_id ON groups(sample_id);
CREATE INDEX IF NOT EXISTS idx_groups_group_id ON groups(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status);

-- Tabela de imagens dos grupos
CREATE TABLE IF NOT EXISTS group_images (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  image_type TEXT NOT NULL CHECK(image_type IN ('questionada', 'padrao')),
  image_index INTEGER,
  sha256_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT valid_index CHECK((image_type = 'questionada' AND image_index IS NULL) OR (image_type = 'padrao' AND image_index BETWEEN 0 AND 9))
);

-- Índices para imagens
CREATE INDEX IF NOT EXISTS idx_group_images_group_id ON group_images(group_id);
CREATE INDEX IF NOT EXISTS idx_group_images_sha256 ON group_images(sha256_hash);

-- Tabela de resultados
CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  conclusive INTEGER NOT NULL CHECK(conclusive IN (0, 1)),
  has_match INTEGER,
  matched_image_index INTEGER CHECK(matched_image_index IS NULL OR (matched_image_index BETWEEN 0 AND 9)),
  compatibility_degree INTEGER CHECK(compatibility_degree IS NULL OR (compatibility_degree BETWEEN 1 AND 4)),
  notes TEXT,
  submitted_at TEXT NOT NULL,
  
  FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  UNIQUE(sample_id, group_id)
);

-- Índices para resultados
CREATE INDEX IF NOT EXISTS idx_results_sample_id ON results(sample_id);
CREATE INDEX IF NOT EXISTS idx_results_group_id ON results(group_id);

-- Tabela de rastreamento de arquivos
CREATE TABLE IF NOT EXISTS file_tracking (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  used_at TEXT NOT NULL,
  
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  UNIQUE(participant_id, sha256_hash)
);

-- Índices para rastreamento
CREATE INDEX IF NOT EXISTS idx_file_tracking_participant_id ON file_tracking(participant_id);
CREATE INDEX IF NOT EXISTS idx_file_tracking_sha256 ON file_tracking(sha256_hash);

-- Tabela de logs de acesso
CREATE TABLE IF NOT EXISTS access_logs (
  id TEXT PRIMARY KEY,
  participant_id TEXT,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  user_agent TEXT,
  
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE SET NULL
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_access_logs_participant_id ON access_logs(participant_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_ip_address ON access_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);

-- Tabela de tokens CSRF
CREATE TABLE IF NOT EXISTS csrf_tokens (
  id TEXT PRIMARY KEY,
  participant_id TEXT,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- Índices para CSRF
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_participant_id ON csrf_tokens(participant_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires_at ON csrf_tokens(expires_at);

-- Tabela de certificados
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  sample_id TEXT NOT NULL,
  certificate_code TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL,
  file_path TEXT,
  
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
);

-- Índices para certificados
CREATE INDEX IF NOT EXISTS idx_certificates_participant_id ON certificates(participant_id);
CREATE INDEX IF NOT EXISTS idx_certificates_sample_id ON certificates(sample_id);

-- Tabela de estatísticas de comparação
CREATE TABLE IF NOT EXISTS comparison_statistics (
  id TEXT PRIMARY KEY,
  same_source_mean REAL NOT NULL,
  same_source_std_dev REAL NOT NULL,
  same_source_min REAL NOT NULL,
  same_source_max REAL NOT NULL,
  same_source_p25 REAL NOT NULL,
  same_source_p50 REAL NOT NULL,
  same_source_p75 REAL NOT NULL,
  same_source_p95 REAL NOT NULL,
  different_source_mean REAL NOT NULL,
  different_source_std_dev REAL NOT NULL,
  different_source_min REAL NOT NULL,
  different_source_max REAL NOT NULL,
  different_source_p25 REAL NOT NULL,
  different_source_p50 REAL NOT NULL,
  different_source_p75 REAL NOT NULL,
  different_source_p95 REAL NOT NULL,
  calculated_at TEXT NOT NULL
);

-- Tabela de cache de pares de comparação
CREATE TABLE IF NOT EXISTS pairwise_cache (
  id TEXT PRIMARY KEY,
  arquivo_a TEXT NOT NULL,
  quali_a INTEGER NOT NULL,
  arquivo_b TEXT NOT NULL,
  quali_b INTEGER NOT NULL,
  mesma_fonte INTEGER NOT NULL CHECK(mesma_fonte IN (0, 1)),
  mesmo_arquivo INTEGER NOT NULL CHECK(mesmo_arquivo IN (0, 1)),
  score REAL NOT NULL,
  loaded_at TEXT NOT NULL,
  
  UNIQUE(arquivo_a, arquivo_b)
);

-- Índices para cache
CREATE INDEX IF NOT EXISTS idx_pairwise_arquivo_a ON pairwise_cache(arquivo_a);
CREATE INDEX IF NOT EXISTS idx_pairwise_arquivo_b ON pairwise_cache(arquivo_b);
CREATE INDEX IF NOT EXISTS idx_pairwise_mesma_fonte ON pairwise_cache(mesma_fonte);

-- Tabela de marcações de minúcias
CREATE TABLE IF NOT EXISTS minutiae_markings (
  id TEXT PRIMARY KEY,
  result_id TEXT,
  group_id TEXT NOT NULL,
  sample_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  image_type TEXT NOT NULL CHECK(image_type IN ('questionada', 'padrao')),
  image_index INTEGER,
  x REAL NOT NULL,
  y REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- Índices para minúcias
CREATE INDEX IF NOT EXISTS idx_minutiae_group_id ON minutiae_markings(group_id);
CREATE INDEX IF NOT EXISTS idx_minutiae_participant_id ON minutiae_markings(participant_id);
CREATE INDEX IF NOT EXISTS idx_minutiae_sample_id ON minutiae_markings(sample_id);
`;

/**
 * Queries de inicialização
 */
export const initQueries = [
  // Habilita foreign keys
  'PRAGMA foreign_keys = ON;',
  
  // Habilita WAL mode para melhor concorrência
  'PRAGMA journal_mode = WAL;',
  
  // Aumenta cache
  'PRAGMA cache_size = 10000;',
  
  // Sincronização normal
  'PRAGMA synchronous = NORMAL;',
];

/**
 * Queries de limpeza
 */
export const cleanupQueries = [
  // Remove amostras expiradas (mais de 120 dias)
  `DELETE FROM samples 
   WHERE status = 'pending' 
   AND datetime(created_at, '+120 days') < datetime('now')`,
  
  // Remove tokens CSRF expirados
  `DELETE FROM csrf_tokens 
   WHERE datetime(expires_at) < datetime('now')`,
  
  // Remove logs de acesso antigos (mais de 90 dias)
  `DELETE FROM access_logs 
   WHERE datetime(timestamp, '+90 days') < datetime('now')`,
];
