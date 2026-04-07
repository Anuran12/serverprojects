CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    audit_type VARCHAR(80),
    audit_year VARCHAR(20),
    division VARCHAR(255),
    unit VARCHAR(255),
    auditors VARCHAR(255),
    audit_manager VARCHAR(255),
    man_days INTEGER,
    working_days INTEGER,
    working_days_range VARCHAR(255),
    audit_period VARCHAR(255),
    finalization_dates VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES audit_documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding VECTOR(768),
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
    chroma_id VARCHAR(128) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_chunks_embedding_hnsw ON audit_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);
CREATE INDEX IF NOT EXISTS idx_audit_chunks_tsv ON audit_chunks USING GIN (tsv);

CREATE INDEX IF NOT EXISTS idx_audit_documents_year ON audit_documents(audit_year);
CREATE INDEX IF NOT EXISTS idx_audit_documents_division ON audit_documents(division);
CREATE INDEX IF NOT EXISTS idx_audit_documents_type ON audit_documents(audit_type);
CREATE INDEX IF NOT EXISTS idx_audit_chunks_doc ON audit_chunks(doc_id);
