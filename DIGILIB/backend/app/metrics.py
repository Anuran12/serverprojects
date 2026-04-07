import time
from dataclasses import dataclass, field


@dataclass
class Metrics:
    searches_total: int = 0
    searches_cached: int = 0
    search_latency_ms_sum: int = 0
    last_search_ms: int = 0
    ingest_jobs_queued: int = 0

    def record_search(self, latency_ms: int, cache_hit: bool) -> None:
        self.searches_total += 1
        self.last_search_ms = latency_ms
        self.search_latency_ms_sum += latency_ms
        if cache_hit:
            self.searches_cached += 1

    def record_ingest_job(self) -> None:
        self.ingest_jobs_queued += 1

    def snapshot(self) -> dict:
        avg_latency = (
            self.search_latency_ms_sum / self.searches_total if self.searches_total else 0
        )
        cache_rate = (
            self.searches_cached / self.searches_total if self.searches_total else 0
        )
        return {
            "searches_total": self.searches_total,
            "searches_cached": self.searches_cached,
            "cache_hit_rate": round(cache_rate, 3),
            "avg_search_latency_ms": round(avg_latency, 2),
            "last_search_ms": self.last_search_ms,
            "ingest_jobs_queued": self.ingest_jobs_queued,
        }


metrics = Metrics()
