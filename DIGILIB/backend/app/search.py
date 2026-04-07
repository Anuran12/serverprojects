from __future__ import annotations

import time
from pathlib import Path
from typing import List

import chromadb
import numpy as np
from sentence_transformers import SentenceTransformer, CrossEncoder
from sqlalchemy.orm import Session

from .config import settings
from .cache import cache
from .models import AuditChunk, AuditDocument


_search_embedding_model = None
_search_embedding_model_path = None

class SearchService:
    def __init__(self) -> None:
        self.client = chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)
        self.collection = self.client.get_or_create_collection("audit_chunks")

        global _search_embedding_model, _search_embedding_model_path
        if _search_embedding_model is None:
            model_candidates = [
                settings.embedding_model_path,
                settings.fallback_embedding_model_path,
            ]
            last_error = None
            for model_path in model_candidates:
                try:
                    print(f"Loading search embedding model {model_path}...")
                    _search_embedding_model = SentenceTransformer(model_path)
                    _search_embedding_model_path = model_path
                    print(f"Search embedding model loaded successfully from {model_path}")
                    break
                except Exception as exc:
                    last_error = exc
                    print(f"Failed to load search embedding model {model_path}: {exc}")

            if _search_embedding_model is None:
                raise RuntimeError(
                    f"Unable to load any search embedding model from configured paths: {model_candidates}"
                ) from last_error
        self.model = _search_embedding_model

    def embed_query(self, query: str) -> List[float]:
        cache_key = f"embed:{query}"
        cached = cache.get(cache_key)
        if cached:
            return cached
        vector = self.model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
        vector = vector.astype(np.float32)
        target_dim = settings.embedding_dimensions
        current_dim = int(vector.shape[1]) if vector.ndim == 2 and vector.shape else 0
        if current_dim != target_dim and current_dim > 0:
            adjusted = np.zeros((vector.shape[0], target_dim), dtype=np.float32)
            copy_dim = min(current_dim, target_dim)
            adjusted[:, :copy_dim] = vector[:, :copy_dim]
            vector = adjusted
        result = vector[0].tolist()
        cache.set(cache_key, result, settings.cache_ttl_seconds)
        return result

    def query(self, query_vector: List[float], top_k: int, metadata_filter: dict | None):
        return self.collection.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            where=metadata_filter or None,
            include=["documents", "metadatas", "distances"],
        )


_reranker = None
_reranker_error = None


_reranker_model = None

class Reranker:
    def __init__(self) -> None:
        global _reranker_model
        if _reranker_model is None:
            model_path = Path(settings.reranker_model_path)
            if model_path.is_dir() and (model_path / "modules.json").exists():
                raise RuntimeError(
                    f"Configured reranker path {settings.reranker_model_path} looks like a bi-encoder SentenceTransformer model. "
                    "Use a CrossEncoder checkpoint path for reranking."
                )
            print(f"Loading reranker model {settings.reranker_model_path}...")
            _reranker_model = CrossEncoder(settings.reranker_model_path)
            print(f"Reranker model loaded successfully from {settings.reranker_model_path}")
        self.model = _reranker_model

    def score(self, query: str, passages: List[str]) -> List[float]:
        pairs = [(query, passage) for passage in passages]
        return [float(score) for score in self.model.predict(pairs)]


def get_reranker() -> Reranker:
    global _reranker, _reranker_error
    if _reranker is None and _reranker_error is None:
        try:
            _reranker = Reranker()
        except Exception as exc:
            _reranker_error = str(exc)
            print(f"Reranker disabled: {_reranker_error}")
    return _reranker


def get_active_search_embedding_model_path() -> str | None:
    return _search_embedding_model_path


def build_metadata_filter(filters: dict) -> dict:
    metadata_filter = {}
    for key, value in filters.items():
        if value:
            metadata_filter[key] = value
    return metadata_filter


def score_from_distance(distance: float) -> float:
    score = 1.0 - distance
    return max(0.0, min(1.0, score))


def fetch_results(
    db: Session,
    chroma_results,
    min_score: float,
    offset: int = 0,
    limit: int | None = None,
):
    results = []
    ids = chroma_results.get("ids", [[]])[0]
    documents = chroma_results.get("documents", [[]])[0]
    metadatas = chroma_results.get("metadatas", [[]])[0]
    distances = chroma_results.get("distances", [[]])[0]

    for idx, chroma_id in enumerate(ids):
        score = score_from_distance(distances[idx]) if idx < len(distances) else 0.0
        if score < min_score:
            continue

        meta = metadatas[idx] if idx < len(metadatas) else {}
        snippet = documents[idx] if idx < len(documents) else ""

        results.append(
            {
                "doc_id": meta.get("doc_id"),
                "file_name": meta.get("file_name"),
                "file_path": meta.get("file_path"),
                "audit_type": meta.get("audit_type"),
                "audit_year": meta.get("audit_year"),
                "division": meta.get("division"),
                "snippet": snippet,
                "score": score,
                "page_number": meta.get("page_number"),
                "chunk_index": meta.get("chunk_index"),
            }
        )

    total = len(results)
    if offset:
        results = results[offset:]
    if limit is not None:
        results = results[:limit]
    return results, total
