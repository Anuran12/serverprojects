"""
Production-level batch processing for 4000-5000 PDF documents.
Handles concurrent processing, memory management, and error recovery.
"""

import asyncio
import gc
import logging
import os
import time
import hashlib
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Iterator
import multiprocessing as mp
from queue import Queue
import psutil

# PDF processing
import fitz  # PyMuPDF
import pdfplumber
import pytesseract
from PIL import Image

# NLP and embeddings
import chromadb
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

@dataclass
class ProcessingConfig:
    """Configuration for batch processing."""
    max_workers: int = min(8, mp.cpu_count())
    batch_size: int = 100
    max_memory_mb: int = 4096
    chunk_size: int = 1500
    chunk_overlap: int = 200
    ocr_enabled: bool = True
    parallel_embeddings: bool = True
    checkpoint_interval: int = 50
    retry_attempts: int = 3

@dataclass
class DocumentResult:
    """Result of processing a single document."""
    file_path: str
    success: bool
    chunks: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    error: Optional[str] = None
    processing_time: float = 0.0
    file_size_mb: float = 0.0

class MemoryManager:
    """Manages memory usage during batch processing."""
    
    def __init__(self, max_memory_mb: int = 4096):
        self.max_memory_mb = max_memory_mb
        self.max_memory_bytes = max_memory_mb * 1024 * 1024
        
    def get_memory_usage(self) -> float:
        """Get current memory usage in MB."""
        process = psutil.Process()
        return process.memory_info().rss / (1024 * 1024)
        
    def is_memory_available(self, required_mb: float = 0) -> bool:
        """Check if enough memory is available."""
        current_mb = self.get_memory_usage()
        return (current_mb + required_mb) < self.max_memory_mb
        
    def force_cleanup(self):
        """Force garbage collection and cleanup."""
        gc.collect()
        
    def check_and_cleanup(self, threshold: float = 0.8) -> bool:
        """Check memory and cleanup if needed."""
        usage_ratio = self.get_memory_usage() / self.max_memory_mb
        if usage_ratio > threshold:
            logger.warning(f"High memory usage: {usage_ratio:.2f}, cleaning up...")
            self.force_cleanup()
            return True
        return False

class PDFProcessor:
    """Handles PDF processing with multiple extraction methods."""
    
    def __init__(self, config: ProcessingConfig):
        self.config = config
        self.ocr_enabled = config.ocr_enabled
        
    def extract_text_fitz(self, pdf_path: str) -> List[Tuple[int, str]]:
        """Extract text using PyMuPDF (fast)."""
        try:
            doc = fitz.open(pdf_path)
            pages = []
            for i, page in enumerate(doc):
                text = page.get_text("text") or ""
                pages.append((i + 1, text))
            doc.close()
            return pages
        except Exception as e:
            logger.error(f"Fitz extraction failed for {pdf_path}: {e}")
            return []
            
    def extract_text_pdfplumber(self, pdf_path: str) -> List[Tuple[int, str]]:
        """Extract text using pdfplumber (better for tables)."""
        try:
            pages = []
            with pdfplumber.open(pdf_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text() or ""
                    pages.append((i + 1, text))
            return pages
        except Exception as e:
            logger.error(f"Pdfplumber extraction failed for {pdf_path}: {e}")
            return []
            
    def extract_text_ocr(self, pdf_path: str) -> List[Tuple[int, str]]:
        """Extract text using OCR (fallback for scanned PDFs)."""
        if not self.ocr_enabled:
            return []
            
        try:
            doc = fitz.open(pdf_path)
            pages = []
            
            for i, page in enumerate(doc):
                # Convert page to image
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scale for better OCR
                img_data = pix.tobytes("png")
                
                # OCR with PIL and Tesseract
                img = Image.open(io.BytesIO(img_data))
                text = pytesseract.image_to_string(img, config='--psm 6')
                pages.append((i + 1, text))
                
            doc.close()
            return pages
            
        except Exception as e:
            logger.error(f"OCR extraction failed for {pdf_path}: {e}")
            return []
            
    def process_pdf(self, pdf_path: str) -> List[Tuple[int, str]]:
        """Process PDF with fallback methods."""
        methods = [
            ("fitz", self.extract_text_fitz),
            ("pdfplumber", self.extract_text_pdfplumber),
            ("ocr", self.extract_text_ocr)
        ]
        
        for method_name, method_func in methods:
            try:
                pages = method_func(pdf_path)
                if pages and any(len(text.strip()) > 50 for _, text in pages):
                    logger.debug(f"Successfully extracted text using {method_name} for {pdf_path}")
                    return pages
            except Exception as e:
                logger.warning(f"Method {method_name} failed for {pdf_path}: {e}")
                continue
                
        logger.error(f"All extraction methods failed for {pdf_path}")
        return []

class MetadataExtractor:
    """Extracts metadata from file paths and content."""
    
    def __init__(self):
        import re
        self.year_pattern = re.compile(r'\b(19|20)\d{2}\b')
        self.division_patterns = [
            re.compile(r'(IT|Information Technology)', re.I),
            re.compile(r'(Finance|Financial|Accounting)', re.I),
            re.compile(r'(HR|Human Resources)', re.I),
            re.compile(r'(Operations|Operational)', re.I),
            re.compile(r'(Risk|Risk Management)', re.I),
            re.compile(r'(Compliance|Regulatory)', re.I)
        ]
        
    def extract_from_path(self, file_path: str) -> Dict[str, Any]:
        """Extract metadata from file path structure."""
        path_parts = Path(file_path).parts
        metadata = {
            'year_range': None,
            'audit_type': None,
            'file_name': Path(file_path).name
        }
        
        # Extract year range (e.g., "2023-2024")
        for part in path_parts:
            if '-' in part and any(c.isdigit() for c in part):
                if len([x for x in part.split('-') if x.isdigit() and len(x) == 4]) == 2:
                    metadata['year_range'] = part
                    break
                    
        # Extract audit type
        audit_types = ['IT AUDIT', 'System audit', 'Project Audit', 'Financial Audit']
        for part in path_parts:
            for audit_type in audit_types:
                if audit_type.lower() in part.lower():
                    metadata['audit_type'] = audit_type
                    break
                    
        return metadata
        
    def extract_from_content(self, content: str) -> Dict[str, Any]:
        """Extract metadata from document content."""
        metadata = {
            'year': None,
            'division': None,
            'document_type': None
        }
        
        # Extract year
        year_matches = self.year_pattern.findall(content)
        if year_matches:
            # Get the most recent year
            years = [int(match[0] + match[1]) for match in year_matches]
            metadata['year'] = str(max(years))
            
        # Extract division
        for pattern in self.division_patterns:
            match = pattern.search(content)
            if match:
                metadata['division'] = match.group(1)
                break
                
        # Simple document type detection
        content_lower = content.lower()
        if 'audit report' in content_lower:
            metadata['document_type'] = 'Audit Report'
        elif 'assessment' in content_lower:
            metadata['document_type'] = 'Assessment'
        elif 'review' in content_lower:
            metadata['document_type'] = 'Review'
            
        return metadata

class TextChunker:
    """Advanced text chunking with context preservation."""
    
    def __init__(self, chunk_size: int = 1500, overlap: int = 200):
        self.chunk_size = chunk_size
        self.overlap = overlap
        
    def chunk_text(self, text: str, preserve_sentences: bool = True) -> List[Tuple[int, int, int, str]]:
        """Chunk text with optional sentence preservation."""
        if not text or len(text.strip()) < 10:
            return []
            
        if preserve_sentences:
            return self._chunk_by_sentences(text)
        else:
            return self._chunk_by_characters(text)
            
    def _chunk_by_sentences(self, text: str) -> List[Tuple[int, int, int, str]]:
        """Chunk text by sentences to preserve context."""
        import re
        
        # Split into sentences
        sentence_pattern = re.compile(r'(?<=[.!?])\s+')
        sentences = sentence_pattern.split(text)
        
        chunks = []
        current_chunk = ""
        current_start = 0
        chunk_id = 0
        
        for sentence in sentences:
            # Check if adding this sentence would exceed chunk size
            potential_chunk = current_chunk + " " + sentence if current_chunk else sentence
            
            if len(potential_chunk) <= self.chunk_size:
                current_chunk = potential_chunk
            else:
                # Save current chunk if it has content
                if current_chunk.strip():
                    end_pos = current_start + len(current_chunk)
                    chunks.append((chunk_id, current_start, end_pos, current_chunk.strip()))
                    chunk_id += 1
                    
                    # Start new chunk with overlap
                    overlap_text = current_chunk[-self.overlap:] if len(current_chunk) > self.overlap else current_chunk
                    current_chunk = overlap_text + " " + sentence
                    current_start = end_pos - len(overlap_text)
                else:
                    # First sentence
                    current_chunk = sentence
                    
        # Add final chunk
        if current_chunk.strip():
            end_pos = current_start + len(current_chunk)
            chunks.append((chunk_id, current_start, end_pos, current_chunk.strip()))
            
        return chunks
        
    def _chunk_by_characters(self, text: str) -> List[Tuple[int, int, int, str]]:
        """Chunk text by characters (fallback method)."""
        chunks = []
        text_length = len(text)
        chunk_id = 0
        start = 0
        
        while start < text_length:
            end = min(start + self.chunk_size, text_length)
            chunk_text = text[start:end].strip()
            
            if chunk_text:
                chunks.append((chunk_id, start, end, chunk_text))
                chunk_id += 1
                
            # Move start position with overlap
            start = end - self.overlap
            if start < 0:
                start = 0
                
        return chunks

class BatchProcessor:
    """Main batch processing orchestrator."""
    
    def __init__(self, config: ProcessingConfig = None):
        self.config = config or ProcessingConfig()
        self.memory_manager = MemoryManager(self.config.max_memory_mb)
        self.pdf_processor = PDFProcessor(self.config)
        self.metadata_extractor = MetadataExtractor()
        self.text_chunker = TextChunker(self.config.chunk_size, self.config.chunk_overlap)
        
        # Progress tracking
        self.processed_files = 0
        self.failed_files = 0
        self.total_chunks = 0
        self.start_time = None
        
    def get_file_hash(self, file_path: str) -> str:
        """Compute SHA256 hash of file."""
        hasher = hashlib.sha256()
        try:
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except Exception as e:
            logger.error(f"Error computing hash for {file_path}: {e}")
            return ""
            
    def process_single_document(self, file_path: str) -> DocumentResult:
        """Process a single PDF document."""
        start_time = time.time()
        
        try:
            # Get file info
            file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
            file_hash = self.get_file_hash(file_path)
            
            # Extract metadata from path
            path_metadata = self.metadata_extractor.extract_from_path(file_path)
            
            # Extract text from PDF
            pages = self.pdf_processor.process_pdf(file_path)
            if not pages:
                return DocumentResult(
                    file_path=file_path,
                    success=False,
                    chunks=[],
                    metadata=path_metadata,
                    error="No text extracted",
                    processing_time=time.time() - start_time,
                    file_size_mb=file_size
                )
                
            # Combine text from all pages
            full_text = "\n\n".join([text for _, text in pages])
            
            # Extract content metadata
            content_metadata = self.metadata_extractor.extract_from_content(full_text)
            
            # Combine metadata
            combined_metadata = {**path_metadata, **content_metadata}
            combined_metadata.update({
                'file_hash': file_hash,
                'file_size_mb': file_size,
                'total_pages': len(pages),
                'file_path': file_path
            })
            
            # Chunk text
            all_chunks = []
            for page_num, page_text in pages:
                if page_text.strip():
                    page_chunks = self.text_chunker.chunk_text(page_text)
                    
                    for chunk_id, start, end, chunk_text in page_chunks:
                        chunk_metadata = combined_metadata.copy()
                        chunk_metadata.update({
                            'page': page_num,
                            'chunk_id': chunk_id,
                            'start': start,
                            'end': end,
                            'chunk_length': len(chunk_text)
                        })
                        
                        all_chunks.append({
                            'text': chunk_text,
                            'metadata': chunk_metadata,
                            'doc_id': f"{file_hash}-{page_num}-{chunk_id}"
                        })
                        
            return DocumentResult(
                file_path=file_path,
                success=True,
                chunks=all_chunks,
                metadata=combined_metadata,
                processing_time=time.time() - start_time,
                file_size_mb=file_size
            )
            
        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")
            return DocumentResult(
                file_path=file_path,
                success=False,
                chunks=[],
                metadata={},
                error=str(e),
                processing_time=time.time() - start_time,
                file_size_mb=0
            )
            
    def process_batch(self, file_paths: List[str]) -> List[DocumentResult]:
        """Process a batch of documents concurrently."""
        results = []
        
        with ThreadPoolExecutor(max_workers=self.config.max_workers) as executor:
            # Submit all tasks
            future_to_path = {
                executor.submit(self.process_single_document, path): path 
                for path in file_paths
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_path):
                path = future_to_path[future]
                try:
                    result = future.result()
                    results.append(result)
                    
                    if result.success:
                        self.processed_files += 1
                        self.total_chunks += len(result.chunks)
                    else:
                        self.failed_files += 1
                        
                    # Memory management
                    self.memory_manager.check_and_cleanup()
                    
                except Exception as e:
                    logger.error(f"Error processing {path}: {e}")
                    results.append(DocumentResult(
                        file_path=path,
                        success=False,
                        chunks=[],
                        metadata={},
                        error=str(e)
                    ))
                    self.failed_files += 1
                    
        return results
        
    def process_directory(self, 
                         directory: str, 
                         pattern: str = "**/*.pdf",
                         progress_callback=None) -> Iterator[List[DocumentResult]]:
        """Process all PDFs in directory with progress tracking."""
        self.start_time = time.time()
        
        # Find all PDF files
        pdf_files = list(Path(directory).glob(pattern))
        total_files = len(pdf_files)
        
        logger.info(f"Found {total_files} PDF files to process")
        
        if progress_callback:
            progress_callback(0, total_files, "Starting batch processing...")
            
        # Process in batches
        for i in range(0, total_files, self.config.batch_size):
            batch_files = [str(f) for f in pdf_files[i:i + self.config.batch_size]]
            
            if progress_callback:
                progress_callback(
                    i, 
                    total_files, 
                    f"Processing batch {i // self.config.batch_size + 1}"
                )
                
            batch_results = self.process_batch(batch_files)
            yield batch_results
            
            # Memory cleanup between batches
            self.memory_manager.force_cleanup()
            
        if progress_callback:
            progress_callback(total_files, total_files, "Processing complete!")
            
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get processing statistics."""
        elapsed_time = time.time() - self.start_time if self.start_time else 0
        
        return {
            'total_processed': self.processed_files,
            'total_failed': self.failed_files,
            'total_chunks': self.total_chunks,
            'elapsed_time': elapsed_time,
            'files_per_second': self.processed_files / elapsed_time if elapsed_time > 0 else 0,
            'chunks_per_file': self.total_chunks / self.processed_files if self.processed_files > 0 else 0,
            'memory_usage_mb': self.memory_manager.get_memory_usage(),
            'success_rate': self.processed_files / (self.processed_files + self.failed_files) if (self.processed_files + self.failed_files) > 0 else 0
        }
        
    def save_checkpoint(self, checkpoint_path: str, processed_files: List[str]):
        """Save processing checkpoint."""
        import json
        
        checkpoint_data = {
            'processed_files': processed_files,
            'stats': self.get_processing_stats(),
            'timestamp': time.time()
        }
        
        with open(checkpoint_path, 'w') as f:
            json.dump(checkpoint_data, f, indent=2)
            
    def load_checkpoint(self, checkpoint_path: str) -> List[str]:
        """Load processing checkpoint."""
        import json
        
        try:
            with open(checkpoint_path, 'r') as f:
                checkpoint_data = json.load(f)
            return checkpoint_data.get('processed_files', [])
        except FileNotFoundError:
            return []
        except Exception as e:
            logger.error(f"Error loading checkpoint: {e}")
            return []
