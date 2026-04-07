import os

from rq import Worker, Queue, Connection
import redis

from .config import settings


def main() -> None:
    conn = redis.Redis.from_url(settings.redis_url)
    with Connection(conn):
        worker = Worker([Queue("ingest")])
        worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
