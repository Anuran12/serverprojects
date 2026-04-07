#!/usr/bin/env python3
"""
Test PDF ingestion functionality
"""

import os
import sys
from pathlib import Path

# Add the backend app to path
sys.path.insert(0, 'backend')

from app.ingest import ingest_audit_reports
from app.db import get_db
from app.config import settings

def test_pdf_parsing():
    """Test PDF parsing with a single file"""
    audit_root = "Audit Report"

    if not os.path.exists(audit_root):
        print(f"Audit root {audit_root} does not exist")
        return

    # Find one PDF file to test
    pdf_files = list(Path(audit_root).rglob('*.pdf'))
    if not pdf_files:
        print("No PDF files found")
        return

    test_file = pdf_files[0]
    print(f"Testing with file: {test_file}")

    # Test the extraction functions
    try:
        from app.ingest import _extract_pages

        pages = _extract_pages(str(test_file))
        print(f"Successfully extracted {len(pages)} pages from {test_file}")

        if pages:
            print(f"First page preview: {pages[0][:200]}...")

        # Test metadata extraction
        from app.ingest import extract_metadata
        if pages:
            metadata = extract_metadata(pages[0])
            print(f"Extracted metadata: {metadata}")

        print("✅ PDF parsing test successful!")

    except Exception as e:
        print(f"❌ PDF parsing failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_pdf_parsing()