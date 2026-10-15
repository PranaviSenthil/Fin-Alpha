import re
import hashlib
import uuid
import io
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from bs4 import BeautifulSoup

from app.market_data.symbols import SYMBOL_MAP

logger = logging.getLogger(__name__)

# Optional pypdf import for PDF parsing
try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False
    logger.warning("pypdf is not installed. PDF ingestion will fail gracefully if attempted.")

class DocumentIngestionError(Exception):
    """Raised when document ingestion or validation fails."""
    pass

class DocumentChunker:
    """
    Splits long financial documents into meaningful overlapping chunks
    while preserving page numbers, section references, and paragraph integrity.
    """
    def __init__(self, target_chunk_size: int = 700, overlap_size: int = 150):
        self.target_chunk_size = target_chunk_size
        self.overlap_size = overlap_size

    def chunk_text(
        self,
        text: str,
        page_or_section: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Split a document text block into overlapping chunks.
        """
        if not text or not text.strip():
            return []

        text = text.strip()
        # If text is already shorter than target chunk size, return single chunk
        if len(text) <= self.target_chunk_size:
            return [{
                "text": text,
                "page_or_section": page_or_section or "Main Section",
                "token_estimate": len(text.split())
            }]

        paragraphs = [p.strip() for p in re.split(r'\n{2,}|\r\n{2,}', text) if p.strip()]
        chunks = []
        current_chunk = ""
        current_section = page_or_section or "General"

        for p in paragraphs:
            # Check if paragraph looks like a section header (e.g. "ITEM 1.", "FINANCIAL RESULTS", "MANAGEMENT DISCUSSION")
            if len(p) < 100 and (p.isupper() or re.match(r'^(Section|Item|Note|Part|Q[1-4]|Page|\d+\.)', p, re.IGNORECASE)):
                current_section = p

            if len(current_chunk) + len(p) + 2 <= self.target_chunk_size:
                if current_chunk:
                    current_chunk += "\n\n" + p
                else:
                    current_chunk = p
            else:
                if current_chunk:
                    chunks.append({
                        "text": current_chunk.strip(),
                        "page_or_section": current_section,
                        "token_estimate": len(current_chunk.split())
                    })
                    # Overlap: keep the tail of current_chunk
                    overlap_len = min(len(current_chunk), self.overlap_size)
                    tail = current_chunk[-overlap_len:]
                    # Break at space to avoid cutting words
                    space_idx = tail.find(' ')
                    if space_idx != -1:
                        tail = tail[space_idx + 1:]
                    current_chunk = (tail + "\n\n" + p).strip() if tail else p
                else:
                    # Single paragraph is longer than target_chunk_size, split by sentences
                    sentences = re.split(r'(?<=[.!?])\s+', p)
                    sent_accum = ""
                    for s in sentences:
                        if len(sent_accum) + len(s) + 1 <= self.target_chunk_size:
                            sent_accum = (sent_accum + " " + s).strip()
                        else:
                            if sent_accum:
                                chunks.append({
                                    "text": sent_accum.strip(),
                                    "page_or_section": current_section,
                                    "token_estimate": len(sent_accum.split())
                                })
                                overlap_len = min(len(sent_accum), self.overlap_size)
                                tail = sent_accum[-overlap_len:]
                                space_idx = tail.find(' ')
                                if space_idx != -1:
                                    tail = tail[space_idx + 1:]
                                sent_accum = (tail + " " + s).strip()
                            else:
                                # Hard split if a single sentence is huge
                                chunks.append({
                                    "text": s[:self.target_chunk_size].strip(),
                                    "page_or_section": current_section,
                                    "token_estimate": len(s[:self.target_chunk_size].split())
                                })
                                sent_accum = s[self.target_chunk_size:].strip()
                    current_chunk = sent_accum

        if current_chunk and current_chunk.strip():
            chunks.append({
                "text": current_chunk.strip(),
                "page_or_section": current_section,
                "token_estimate": len(current_chunk.split())
            })

        return chunks

class FinancialDocumentIngestionPipeline:
    """
    Modular ingestion pipeline for genuine financial documents.
    Extracts text from PDF, HTML, Markdown, and Plain Text.
    Validates company symbols, document metadata, and computes content hashes for deduplication.
    """
    def __init__(self):
        self.chunker = DocumentChunker()

    def normalize_symbol(self, raw_symbol: str) -> str:
        """Normalize symbol to standard 100-stock universe ticker."""
        sym = raw_symbol.strip().upper().replace(".NS", "").replace(".BO", "")
        if sym in SYMBOL_MAP:
            return sym
        if f"{sym}.NS" in SYMBOL_MAP:
            return sym
        # Check against provider symbols
        for s, meta in SYMBOL_MAP.items():
            if meta.get("provider_symbol", "").upper().replace(".NS", "") == sym:
                return s.replace(".NS", "")
        return sym

    def validate_metadata(
        self,
        symbol: str,
        title: str,
        publisher: str
    ) -> Tuple[str, str]:
        """Validate company symbol and title."""
        clean_sym = self.normalize_symbol(symbol)
        meta = SYMBOL_MAP.get(clean_sym) or SYMBOL_MAP.get(f"{clean_sym}.NS")
        if not meta:
            raise DocumentIngestionError(
                f"Symbol '{clean_sym}' is not recognized in the active VibeFinance 100-stock Indian universe."
            )
        
        company_name = meta["name"]
        if not title or len(title.strip()) < 3:
            raise DocumentIngestionError("Document title must be at least 3 characters.")
        if not publisher or len(publisher.strip()) < 2:
            raise DocumentIngestionError("Document publisher or disclosure source must be specified.")
            
        return clean_sym, company_name

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> List[Tuple[str, str]]:
        """
        Extract page-by-page text from PDF bytes using pypdf.
        Returns list of (page_label, page_text).
        """
        if not PYPDF_AVAILABLE:
            raise DocumentIngestionError(
                "PDF extraction library (pypdf) is unavailable in environment. Please install pypdf."
            )
        try:
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            if len(reader.pages) == 0:
                raise DocumentIngestionError("PDF document contains 0 pages.")

            pages_content = []
            for idx, page in enumerate(reader.pages, 1):
                extracted = page.extract_text() or ""
                extracted = extracted.strip()
                if extracted:
                    pages_content.append((f"Page {idx}", extracted))

            if not pages_content:
                raise DocumentIngestionError("PDF document contains no readable text (may be image-only scan or encrypted).")

            return pages_content
        except Exception as e:
            if isinstance(e, DocumentIngestionError):
                raise
            raise DocumentIngestionError(f"Failed to read PDF document: {str(e)}")

    def extract_text_from_html(self, html_content: str) -> str:
        """Extract clean readable text from HTML markup using BeautifulSoup."""
        try:
            soup = BeautifulSoup(html_content, "lxml" if "lxml" in BeautifulSoup.__module__ else "html.parser")
            # Remove scripts, styles, iframes
            for tag in soup(["script", "style", "noscript", "iframe", "svg"]):
                tag.decompose()

            text = soup.get_text(separator="\n\n")
            # Collapse excess blank lines
            clean = re.sub(r'\n{3,}', '\n\n', text).strip()
            return clean
        except Exception as e:
            raise DocumentIngestionError(f"Failed to parse HTML document: {str(e)}")

    def compute_hash(self, text: str) -> str:
        """Compute SHA-256 hash of normalized text for duplicate detection."""
        normalized = re.sub(r'\s+', ' ', text).strip().lower()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def process_document(
        self,
        symbol: str,
        title: str,
        doc_type: str,
        publisher: str,
        source_url: Optional[str] = None,
        publication_date: Optional[str] = None,
        raw_text: Optional[str] = None,
        file_bytes: Optional[bytes] = None,
        file_type: str = "text",
        page_or_section: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Validate, parse, hash, and chunk a financial document.
        Returns processed document payload ready for database persistence.
        """
        clean_sym, company_name = self.validate_metadata(symbol, title, publisher)
        now_iso = datetime.now(timezone.utc).isoformat()
        
        extracted_sections: List[Tuple[str, str]] = []

        # 1. Extract text according to file type
        file_type_lower = file_type.lower()
        if file_type_lower == "pdf":
            if not file_bytes:
                raise DocumentIngestionError("Binary file bytes required for PDF ingestion.")
            extracted_sections = self.extract_text_from_pdf(file_bytes)
            full_text = "\n\n".join([f"[{p_lbl}]\n{txt}" for p_lbl, txt in extracted_sections])
        elif file_type_lower == "html":
            content_str = file_bytes.decode("utf-8", errors="replace") if file_bytes else (raw_text or "")
            if not content_str.strip():
                raise DocumentIngestionError("Empty HTML document provided.")
            full_text = self.extract_text_from_html(content_str)
            extracted_sections = [(page_or_section or "Main Document", full_text)]
        else: # plain text, markdown, earnings transcript
            content_str = file_bytes.decode("utf-8", errors="replace") if file_bytes else (raw_text or "")
            full_text = content_str.strip()
            if not full_text:
                raise DocumentIngestionError("Document text cannot be empty.")
            extracted_sections = [(page_or_section or "Main Document", full_text)]

        if len(full_text.strip()) < 30:
            raise DocumentIngestionError(
                f"Document text too short ({len(full_text.strip())} chars). Minimum 30 characters of readable content required."
            )

        # 2. Content Hash for Deduplication
        content_hash = self.compute_hash(full_text)
        doc_id = f"doc_{clean_sym.lower()}_{content_hash[:12]}"

        # 3. Create Chunks
        all_chunks = []
        chunk_idx = 0

        for section_lbl, section_txt in extracted_sections:
            sub_chunks = self.chunker.chunk_text(section_txt, page_or_section=section_lbl)
            for sc in sub_chunks:
                chunk_id = f"{doc_id}_c{chunk_idx}"
                all_chunks.append({
                    "id": chunk_id,
                    "doc_id": doc_id,
                    "symbol": clean_sym,
                    "company_name": company_name,
                    "chunk_index": chunk_idx,
                    "page_or_section": sc["page_or_section"],
                    "text": sc["text"],
                    "token_count": sc["token_estimate"],
                    "created_at": now_iso
                })
                chunk_idx += 1

        if not all_chunks:
            raise DocumentIngestionError("Failed to generate any valid text chunks from document.")

        return {
            "document": {
                "id": doc_id,
                "symbol": clean_sym,
                "company_name": company_name,
                "title": title.strip(),
                "doc_type": doc_type.strip(),
                "publisher": publisher.strip(),
                "source_url": source_url.strip() if source_url else None,
                "publication_date": publication_date.strip() if publication_date else None,
                "content_hash": content_hash,
                "raw_text": full_text,
                "chunk_count": len(all_chunks),
                "metadata_json": metadata or {},
                "ingested_at": now_iso
            },
            "chunks": all_chunks
        }

ingestion_pipeline = FinancialDocumentIngestionPipeline()
