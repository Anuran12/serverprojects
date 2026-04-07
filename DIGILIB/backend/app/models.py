from sqlalchemy import Boolean, Column, Computed, DateTime, Integer, String, Text, ForeignKey, text as sa_text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import declarative_base, relationship


Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=sa_text("gen_random_uuid()"))
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, server_default=sa_text("'user'"))
    is_active = Column(Boolean, nullable=False, server_default=sa_text("true"))
    created_at = Column(DateTime, nullable=False, server_default=sa_text("now()"))
    updated_at = Column(DateTime, nullable=False, server_default=sa_text("now()"))


class AuditDocument(Base):
    __tablename__ = "audit_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=sa_text("gen_random_uuid()"))
    file_path = Column(Text, nullable=False)
    file_name = Column(String(255), nullable=False)
    audit_type = Column(String(80))
    audit_year = Column(String(20))
    division = Column(String(255))
    unit = Column(String(255))
    auditors = Column(String(255))
    audit_manager = Column(String(255))
    man_days = Column(Integer)
    working_days = Column(Integer)
    working_days_range = Column(String(255))
    audit_period = Column(String(255))
    finalization_dates = Column(String(255))
    metadata_json = Column("metadata", JSONB, server_default=sa_text("'{}'::jsonb"))
    created_at = Column(DateTime, nullable=False, server_default=sa_text("now()"))

    chunks = relationship("AuditChunk", back_populates="document")


class AuditChunk(Base):
    __tablename__ = "audit_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=sa_text("gen_random_uuid()"))
    doc_id = Column(UUID(as_uuid=True), ForeignKey("audit_documents.id"), nullable=False)
    page_number = Column(Integer, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    embedding = Column(Vector(768))
    tsv = Column(TSVECTOR, Computed("to_tsvector('english', text)", persisted=True))
    chroma_id = Column(String(128), unique=True, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=sa_text("now()"))

    document = relationship("AuditDocument", back_populates="chunks")
