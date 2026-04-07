from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    audit_root: str
    chroma_host: str = "chroma"
    chroma_port: int = 8000
    embedding_model_path: str
    redis_url: str = "redis://redis:6379/0"
    cache_ttl_seconds: int = 300
    ingest_batch_size: int = 64
    reranker_model_path: str = "/models/ms-marco-MiniLM-L-6-v2"
    fallback_embedding_model_path: str = "/models/ms-marco-MiniLM-L-6-v2"
    embedding_dimensions: int = 768
    rerank_candidates: int = 50
    hnsw_ef_search: int = 100


settings = Settings()
