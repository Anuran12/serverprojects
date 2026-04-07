from pydantic import BaseModel, Field
from typing import List, Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"
    is_active: bool = True


class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_active: bool


class SearchFilters(BaseModel):
    audit_year: Optional[str] = None
    division: Optional[str] = None
    audit_type: Optional[str] = None
    unit: Optional[str] = None
    audit_manager: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    top_k: int = 20
    offset: int = 0
    min_score: float = 0.25
    search_type: str = Field(default="semantic", pattern="^(semantic|keyword|hybrid|pgvector)$")
    filters: SearchFilters = SearchFilters()


class SearchResult(BaseModel):
    doc_id: str
    file_name: str
    file_path: str
    audit_type: Optional[str]
    audit_year: Optional[str]
    division: Optional[str]
    snippet: str
    score: float
    page_number: int
    chunk_index: int


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    returned: int
    offset: int
    avg_score: float
    search_time_ms: int
    cache_hit: bool
    warning: str | None = None


class FilterOptions(BaseModel):
    audit_year: List[str] = []
    division: List[str] = []
    audit_type: List[str] = []
    unit: List[str] = []
    audit_manager: List[str] = []
