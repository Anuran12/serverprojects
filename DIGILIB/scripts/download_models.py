#!/usr/bin/env python3
"""
Download required models for DIGILIB
"""

import os
import sys
from pathlib import Path

def download_sentence_transformer_model(model_name: str, output_path: str):
    """Download a SentenceTransformer model"""
    try:
        from sentence_transformers import SentenceTransformer
        print(f"Downloading {model_name} to {output_path}...")

        # Create output directory if it doesn't exist
        os.makedirs(output_path, exist_ok=True)

        # Download and save the model
        model = SentenceTransformer(model_name)
        model.save(output_path)

        print(f"Successfully downloaded {model_name}")
        return True
    except Exception as e:
        print(f"Failed to download {model_name}: {e}")
        return False

def main():
    # Define models to download
    models = [
        {
            "name": "BAAI/bge-base-en-v1.5",
            "path": "models/bge-base-en-v1.5"
        },
        {
            "name": "cross-encoder/ms-marco-MiniLM-L-6-v2",
            "path": "models/ms-marco-MiniLM-L-6-v2"
        }
    ]

    success_count = 0

    for model in models:
        if download_sentence_transformer_model(model["name"], model["path"]):
            success_count += 1
        else:
            print(f"Failed to download {model['name']}")

    if success_count == len(models):
        print(f"\n✅ All {success_count} models downloaded successfully!")
        return 0
    else:
        print(f"\n❌ Only {success_count}/{len(models)} models downloaded successfully")
        return 1

if __name__ == "__main__":
    sys.exit(main())