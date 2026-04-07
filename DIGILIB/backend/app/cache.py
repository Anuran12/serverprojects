import json
import time
from typing import Any, Optional

import redis

from .config import settings


class Cache:
    def __init__(self) -> None:
        self._client = None
        try:
            self._client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            self._client.ping()
        except Exception:
            self._client = None
        self._memory = {}

    def get(self, key: str) -> Optional[Any]:
        if self._client:
            value = self._client.get(key)
            return json.loads(value) if value else None

        item = self._memory.get(key)
        if not item:
            return None
        expires_at, value = item
        if expires_at and expires_at < time.time():
            self._memory.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl: int) -> None:
        if self._client:
            self._client.setex(key, ttl, json.dumps(value))
            return
        expires_at = time.time() + ttl if ttl else None
        self._memory[key] = (expires_at, value)


cache = Cache()
