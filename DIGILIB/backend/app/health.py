from __future__ import annotations

from pathlib import Path
from typing import Any

from .config import settings

try:
    from safetensors import safe_open

    SAFETENSORS_AVAILABLE = True
except Exception:
    SAFETENSORS_AVAILABLE = False


def _check_safetensors_file(file_path: Path) -> dict[str, Any]:
    details: dict[str, Any] = {
        "path": str(file_path),
        "exists": file_path.exists(),
        "size_bytes": file_path.stat().st_size if file_path.exists() else 0,
        "readable": False,
        "error": None,
    }
    if not file_path.exists():
        details["error"] = "missing"
        return details
    if not SAFETENSORS_AVAILABLE:
        details["error"] = "safetensors package unavailable"
        return details

    try:
        with safe_open(str(file_path), framework="pt") as f:
            _ = f.keys()
        details["readable"] = True
    except Exception as exc:
        details["error"] = str(exc)
    return details


def check_model_path(model_path: str) -> dict[str, Any]:
    path = Path(model_path)
    is_dir = path.is_dir()

    config_file = path / "config.json"
    safetensors_file = path / "model.safetensors"
    modules_file = path / "modules.json"
    tokenizer_config = path / "tokenizer_config.json"

    safetensors_status = _check_safetensors_file(safetensors_file)

    required_ok = is_dir and config_file.exists() and safetensors_status["readable"]
    optional_files = {
        "modules_json": modules_file.exists(),
        "tokenizer_config_json": tokenizer_config.exists(),
    }

    errors = []
    if not is_dir:
        errors.append("model path is not a directory")
    if not config_file.exists():
        errors.append("missing config.json")
    if not safetensors_status["readable"]:
        errors.append(f"invalid model.safetensors: {safetensors_status['error']}")

    return {
        "path": model_path,
        "ok": required_ok,
        "files": {
            "config_json": {
                "path": str(config_file),
                "exists": config_file.exists(),
                "size_bytes": config_file.stat().st_size if config_file.exists() else 0,
            },
            "model_safetensors": safetensors_status,
            **optional_files,
        },
        "errors": errors,
    }


def startup_model_health(
    active_ingest_model: str | None = None, active_search_model: str | None = None
) -> dict[str, Any]:
    candidates = [settings.embedding_model_path, settings.fallback_embedding_model_path]
    model_checks = [check_model_path(path) for path in candidates]
    effective_candidate = next((check["path"] for check in model_checks if check["ok"]), None)

    return {
        "embedding_candidates": model_checks,
        "effective_embedding_model_candidate": effective_candidate,
        "active_embedding_model_ingest": active_ingest_model,
        "active_embedding_model_search": active_search_model,
        "reranker_model": check_model_path(settings.reranker_model_path),
        "embedding_dimensions": settings.embedding_dimensions,
        "status": "ok" if effective_candidate else "error",
    }
