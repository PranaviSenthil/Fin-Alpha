import re
import math
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from app.core.database import get_db
from app.ai.schemas import Citation, RetrievedEvidenceChunk
from app.ai.rag.ingestion import ingestion_pipeline, DocumentIngestionError

logger = logging.getLogger(__name__)

# Basic English stopwords (financial terms like 'margin', 'growth', 'deal' are preserved)
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
    "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had",
    "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd",
    "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
    "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off",
    "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over",
    "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
    "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't",
    "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when",
    "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's",
    "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your",
    "yours", "yourself", "yourselves"
}

def tokenize(text: str) -> List[str]:
    """Tokenize text into lowercase alphanumeric words, filtering basic stopwords."""
    words = re.findall(r'[a-zA-Z0-9_\$₹%]+', text.lower())
    return [w for w in words if len(w) > 1 and w not in STOPWORDS]

class FinancialDocumentRetriever:
    """
    RAG Storage and Retrieval Engine for Corporate Financial Documents.
    - Persists documents and chunks in SQLite.
    - Prevents duplicates via content hashes.
    - Strictly isolates company documents by ticker/symbol.
    - Performs BM25-style relevance ranking with exact phrase boosting.
    """

    def store_document(
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
        Ingest, process, and persist a financial document.
        Idempotent: if document with identical content hash exists, returns existing record.
        """
        processed = ingestion_pipeline.process_document(
            symbol=symbol,
            title=title,
            doc_type=doc_type,
            publisher=publisher,
            source_url=source_url,
            publication_date=publication_date,
            raw_text=raw_text,
            file_bytes=file_bytes,
            file_type=file_type,
            page_or_section=page_or_section,
            metadata=metadata
        )

        doc = processed["document"]
        chunks = processed["chunks"]

        with get_db() as conn:
            cursor = conn.cursor()

            # Check if document with same hash already exists
            cursor.execute(
                "SELECT id, symbol, title, chunk_count, ingested_at FROM financial_documents WHERE content_hash = ?",
                (doc["content_hash"],)
            )
            existing = cursor.fetchone()
            if existing:
                logger.info(f"Duplicate document detected for hash {doc['content_hash'][:8]}. Reusing existing ID {existing['id']}.")
                return {
                    "status": "existing_retained",
                    "doc_id": existing["id"],
                    "symbol": existing["symbol"],
                    "title": existing["title"],
                    "chunk_count": existing["chunk_count"],
                    "ingested_at": existing["ingested_at"],
                    "message": "Document content matches an existing filing. Duplicate skipped safely."
                }

            # Insert Document
            cursor.execute("""
                INSERT INTO financial_documents (
                    id, symbol, company_name, title, doc_type, publisher, source_url,
                    publication_date, content_hash, raw_text, chunk_count, metadata_json, ingested_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                doc["id"],
                doc["symbol"],
                doc["company_name"],
                doc["title"],
                doc["doc_type"],
                doc["publisher"],
                doc["source_url"],
                doc["publication_date"],
                doc["content_hash"],
                doc["raw_text"],
                doc["chunk_count"],
                json.dumps(doc["metadata_json"]),
                doc["ingested_at"]
            ))

            # Insert Chunks
            for c in chunks:
                cursor.execute("""
                    INSERT INTO financial_document_chunks (
                        id, doc_id, symbol, company_name, chunk_index, page_or_section,
                        text, token_count, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    c["id"],
                    c["doc_id"],
                    c["symbol"],
                    c["company_name"],
                    c["chunk_index"],
                    c["page_or_section"],
                    c["text"],
                    c["token_count"],
                    c["created_at"]
                ))

        return {
            "status": "created",
            "doc_id": doc["id"],
            "symbol": doc["symbol"],
            "title": doc["title"],
            "chunk_count": len(chunks),
            "ingested_at": doc["ingested_at"],
            "message": f"Successfully ingested {len(chunks)} chunks into financial corpus."
        }

    def list_documents(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """List ingested documents, optionally filtered by symbol."""
        with get_db() as conn:
            cursor = conn.cursor()
            if symbol:
                clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
                cursor.execute("""
                    SELECT id, symbol, company_name, title, doc_type, publisher, source_url,
                           publication_date, chunk_count, ingested_at
                    FROM financial_documents
                    WHERE symbol = ?
                    ORDER BY publication_date DESC, ingested_at DESC
                """, (clean_sym,))
            else:
                cursor.execute("""
                    SELECT id, symbol, company_name, title, doc_type, publisher, source_url,
                           publication_date, chunk_count, ingested_at
                    FROM financial_documents
                    ORDER BY symbol ASC, publication_date DESC, ingested_at DESC
                """)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve full document details and its chunks."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM financial_documents WHERE id = ?", (doc_id,))
            doc_row = cursor.fetchone()
            if not doc_row:
                return None
            doc = dict(doc_row)
            cursor.execute("""
                SELECT id, chunk_index, page_or_section, text, token_count
                FROM financial_document_chunks
                WHERE doc_id = ?
                ORDER BY chunk_index ASC
            """, (doc_id,))
            doc["chunks"] = [dict(c) for c in cursor.fetchall()]
            return doc

    def delete_document(self, doc_id: str) -> bool:
        """Delete document and its chunks from persistent database."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM financial_document_chunks WHERE doc_id = ?", (doc_id,))
            cursor.execute("DELETE FROM financial_documents WHERE id = ?", (doc_id,))
            return cursor.rowcount > 0

    def get_document_count_for_symbol(self, symbol: str) -> int:
        """Count number of documents stored for a specific symbol."""
        clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM financial_documents WHERE symbol = ?", (clean_sym,))
            row = cursor.fetchone()
            return row["count"] if row else 0

    def retrieve(
        self,
        symbol: str,
        query: str,
        top_k: int = 4,
        min_relevance: float = 0.05
    ) -> List[RetrievedEvidenceChunk]:
        """
        Retrieve relevant financial document chunks for a stock symbol.
        STRICT COMPANY ISOLATION: Never returns documents from other companies.
        Ranks using BM25-style TF-IDF with exact phrase boosting and returns top-k.
        """
        clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
        q_tokens = tokenize(query)
        q_lower = query.lower().strip()

        with get_db() as conn:
            cursor = conn.cursor()
            # Fetch all chunks strictly for the given symbol, joined with document metadata
            cursor.execute("""
                SELECT 
                    c.id as chunk_id,
                    c.doc_id,
                    c.symbol,
                    c.company_name,
                    c.chunk_index,
                    c.page_or_section,
                    c.text,
                    c.token_count,
                    d.title as document_title,
                    d.doc_type,
                    d.publisher,
                    d.source_url,
                    d.publication_date
                FROM financial_document_chunks c
                JOIN financial_documents d ON c.doc_id = d.id
                WHERE c.symbol = ?
            """, (clean_sym,))
            chunks = cursor.fetchall()

        if not chunks:
            return []

        # If query has no substantive tokens, use query string itself or return recent chunks
        if not q_tokens:
            q_tokens = [clean_sym.lower()]

        scored_chunks = []
        total_chunks = len(chunks)
        avg_chunk_tokens = sum(len(c["text"].split()) for c in chunks) / max(1, total_chunks)

        # Document Frequency for query terms across this company's corpus
        df_map = {}
        for token in q_tokens:
            df = sum(1 for c in chunks if token in c["text"].lower())
            df_map[token] = df

        k1 = 1.2
        b = 0.75

        for c in chunks:
            text = c["text"]
            text_lower = text.lower()
            tokens = tokenize(text)
            doc_len = len(tokens)
            term_counts = {}
            for t in tokens:
                term_counts[t] = term_counts.get(t, 0) + 1

            bm25_score = 0.0
            matched_terms_count = 0

            for q_term in q_tokens:
                if q_term in term_counts:
                    matched_terms_count += 1
                    tf = term_counts[q_term]
                    df = df_map.get(q_term, 1)
                    # Standard BM25 IDF
                    idf = math.log(1.0 + (total_chunks - df + 0.5) / (df + 0.5))
                    idf = max(0.2, idf)
                    # BM25 TF formula with length normalization
                    tf_norm = (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * (doc_len / max(1.0, avg_chunk_tokens))))
                    bm25_score += idf * tf_norm

            # Exact phrase match boost: if user searched for "operating margin" or "cloud revenue"
            if len(q_lower) >= 5 and q_lower in text_lower:
                bm25_score += 4.0

            # Title or Section match boost
            sec_lower = (c["page_or_section"] or "").lower()
            title_lower = (c["document_title"] or "").lower()
            for q_term in q_tokens:
                if q_term in sec_lower or q_term in title_lower:
                    bm25_score += 1.0

            # Normalize relevance score to a 0.0 - 1.0 scale
            norm_score = min(1.0, round(bm25_score / (len(q_tokens) * 3.5 + 2.0), 3))

            if norm_score >= min_relevance or matched_terms_count >= 1:
                scored_chunks.append({
                    "chunk": c,
                    "score": max(min_relevance, norm_score),
                    "matched_terms": matched_terms_count
                })

        # Sort by score descending
        scored_chunks.sort(key=lambda x: (x["score"], x["matched_terms"]), reverse=True)

        results: List[RetrievedEvidenceChunk] = []
        for item in scored_chunks[:top_k]:
            c = item["chunk"]
            results.append(RetrievedEvidenceChunk(
                chunk_id=c["chunk_id"],
                doc_id=c["doc_id"],
                symbol=c["symbol"],
                company_name=c["company_name"],
                document_title=c["document_title"],
                doc_type=c["doc_type"],
                publisher=c["publisher"],
                source_url=c["source_url"],
                publication_date=c["publication_date"],
                page_or_section=c["page_or_section"],
                text=c["text"],
                relevance_score=item["score"]
            ))

        return results

    def detect_conflicts(self, evidence_chunks: List[RetrievedEvidenceChunk]) -> List[Dict[str, Any]]:
        """
        Identify conflicting statements or disparate metrics across different documents or dates.
        Example: contradictory statements about margins, guidance or growth across quarters.
        """
        conflicts = []
        if len(evidence_chunks) < 2:
            return conflicts

        # Group by document publication dates
        dates = {c.publication_date for c in evidence_chunks if c.publication_date}
        
        # Check for opposing sentiment terms
        positive_keywords = ["growth", "expansion", "increase", "record high", "beat", "positive", "strong demand"]
        cautious_keywords = ["contraction", "compression", "decline", "slowdown", "headwind", "cautious", "drop"]

        pos_chunks = [c for c in evidence_chunks if any(k in c.text.lower() for k in positive_keywords)]
        cautious_chunks = [c for c in evidence_chunks if any(k in c.text.lower() for k in cautious_keywords)]

        if pos_chunks and cautious_chunks and len(dates) >= 1:
            # Highlight differing perspectives across disclosures
            p = pos_chunks[0]
            neg = cautious_chunks[0]
            if p.chunk_id != neg.chunk_id:
                conflicts.append({
                    "type": "disclosure_divergence",
                    "topic": "Operational / Margin Sentiment Divergence",
                    "statement_a": {
                        "source": p.document_title,
                        "date": p.publication_date or "Recent Filing",
                        "passage": p.text[:160] + "..."
                    },
                    "statement_b": {
                        "source": neg.document_title,
                        "date": neg.publication_date or "Secondary Filing",
                        "passage": neg.text[:160] + "..."
                    },
                    "explanation": (
                        f"Retrieved disclosures reflect mixed signals: '{p.document_title}' highlights expansion "
                        f"while '{neg.document_title}' outlines cautious headwinds. Both are preserved for balanced assessment."
                    )
                })

        return conflicts

    def chunks_to_citations(self, chunks: List[RetrievedEvidenceChunk]) -> List[Citation]:
        """Convert retrieved chunks into verifiable Citation models."""
        citations = []
        for idx, c in enumerate(chunks, 1):
            citations.append(Citation(
                citation_id=f"CIT-{c.symbol}-{idx}",
                document_title=c.document_title,
                company=c.company_name,
                ticker=c.symbol,
                source_url=c.source_url,
                publisher=c.publisher,
                publication_date=c.publication_date,
                page_or_section=c.page_or_section,
                passage=c.text,
                relevance_score=c.relevance_score,
                # Backward compatibility fields
                source=f"{c.document_title} ({c.publisher})",
                metric="Documentary Evidence",
                value=c.page_or_section,
                timestamp=c.publication_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                details={
                    "chunk_id": c.chunk_id,
                    "doc_id": c.doc_id,
                    "doc_type": c.doc_type,
                    "relevance_score": c.relevance_score
                }
            ))
        return citations

document_retriever = FinancialDocumentRetriever()
