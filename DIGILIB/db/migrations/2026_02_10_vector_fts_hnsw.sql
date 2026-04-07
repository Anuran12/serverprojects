-- Migration to 768-dim embeddings + FTS + HNSW
-- NOTE: This resets existing embeddings to NULL. Re-run ingestion after applying.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

ALTER TABLE audit_chunks
  ALTER COLUMN embedding TYPE vector(768) USING NULL::vector(768);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_chunks' AND column_name = 'tsv'
  ) THEN
    ALTER TABLE audit_chunks
      ADD COLUMN tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_chunks_embedding_hnsw
  ON audit_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);

CREATE INDEX IF NOT EXISTS idx_audit_chunks_tsv
  ON audit_chunks USING GIN (tsv);

VACUUM ANALYZE audit_chunks;
