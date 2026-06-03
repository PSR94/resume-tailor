"""
Resume Tailor — Local FastAPI Server
Runs on localhost:7842

Endpoints:
  GET  /health          — health check
  POST /extract-text    — extract plain text from DOCX
  POST /apply-swaps     — apply swap manifest to DOCX, return modified DOCX
"""

import base64
import io
import re
from datetime import datetime
from typing import Any

import uvicorn
from docx import Document
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from docx_engine import apply_swaps, count_bullets, extract_text

app = FastAPI(title="Resume Tailor Server", version="1.0.0")

# Allow calls from the Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExtractRequest(BaseModel):
    resume_base64: str


class SwapManifest(BaseModel):
    jobTitle: str = ""
    company: str = ""
    swaps: list[dict[str, Any]] = []


class ApplySwapsRequest(BaseModel):
    resume_base64: str
    manifest: SwapManifest


@app.get("/health")
def health():
    return {"status": "ok", "service": "Resume Tailor"}


@app.post("/extract-text")
def extract_text_endpoint(req: ExtractRequest):
    """Extract plain text from a base64-encoded DOCX."""
    try:
        docx_bytes = base64.b64decode(req.resume_base64)
        doc = Document(io.BytesIO(docx_bytes))
        text = extract_text(doc)
        return {"text": text, "char_count": len(text)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text: {e}")


@app.post("/apply-swaps")
def apply_swaps_endpoint(req: ApplySwapsRequest):
    """Apply swap manifest to the DOCX and return modified file as base64."""
    try:
        docx_bytes = base64.b64decode(req.resume_base64)
        doc = Document(io.BytesIO(docx_bytes))

        bullet_count_before = count_bullets(doc)

        approved_swaps = [s for s in req.manifest.swaps if s.get("approved", True)]
        doc = apply_swaps(doc, approved_swaps)

        bullet_count_after = count_bullets(doc)

        if bullet_count_before != bullet_count_after:
            raise HTTPException(
                status_code=422,
                detail=f"Bullet count changed: {bullet_count_before} → {bullet_count_after}. Swap rejected.",
            )

        # Serialize to bytes
        output = io.BytesIO()
        doc.save(output)
        output.seek(0)
        result_base64 = base64.b64encode(output.read()).decode()

        # Build filename
        job_slug = re.sub(r"[^a-zA-Z0-9]+", "_", req.manifest.jobTitle or "role")[:30]
        company_slug = re.sub(r"[^a-zA-Z0-9]+", "_", req.manifest.company or "co")[:20]
        date = datetime.now().strftime("%Y%m%d")
        filename = f"Resume_{job_slug}_{company_slug}_{date}.docx"

        return {
            "docx_base64": result_base64,
            "filename": filename,
            "swaps_applied": len(approved_swaps),
            "bullet_count_before": bullet_count_before,
            "bullet_count_after": bullet_count_after,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}")


if __name__ == "__main__":
    print("━" * 50)
    print("  Resume Tailor Server")
    print("  http://localhost:7842")
    print("━" * 50)
    uvicorn.run(app, host="localhost", port=7842, log_level="info")
