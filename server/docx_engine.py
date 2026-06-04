"""
DOCX Engine — reads resume, applies swap manifest, returns modified DOCX.

Key improvement: bold vocabulary preservation.
- Scans every bold run in the document to build a vocabulary of bolded terms.
- When writing a new bullet, splits the text into segments and bolds any
  segment that matches a term from the vocabulary.
- Falls back to bolding plausible tech/tool tokens (CamelCase, known acronyms)
  that weren't already in the vocabulary.
"""

import copy
import re
from dataclasses import dataclass
from typing import Optional

from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


# ── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class BulletPosition:
    para_index: int
    para: object  # the Paragraph object — avoids re-indexing into doc.paragraphs
    section: str
    role_index: int
    bullet_index: int
    text: str


# ── Paragraph classification ──────────────────────────────────────────────────

def is_heading(para) -> bool:
    style_name = para.style.name.lower() if para.style else ""
    if "heading" in style_name:
        return True
    text = para.text.strip()
    if not text:
        return False
    if len(text) < 50 and text == text.upper() and re.search(r"[A-Z]", text):
        return True
    return False


def is_role_header(para) -> bool:
    text = para.text.strip()
    if not text or len(text) > 120:
        return False
    # Must not be a list/bullet paragraph
    if is_bullet(para):
        return False
    runs = [r for r in para.runs if r.text.strip()]
    if not runs:
        return False
    if not all(r.bold for r in runs):
        return False
    # Role headers typically contain a separator (|, ·, —, ,) or a year range,
    # distinguishing them from standalone bolded bullet openers.
    has_separator = bool(re.search(r"[|·•,—–-]", text))
    has_year = bool(re.search(r"\b(19|20)\d{2}\b", text))
    return has_separator or has_year


def is_bullet(para) -> bool:
    text = para.text.strip()
    if not text:
        return False
    style_name = para.style.name.lower() if para.style else ""
    if "list" in style_name:
        return True
    pPr = para._p.find(qn("w:pPr"))
    if pPr is not None and pPr.find(qn("w:numPr")) is not None:
        return True
    if para.paragraph_format.left_indent and para.paragraph_format.left_indent > 0:
        return True
    return False


# ── Bold vocabulary ───────────────────────────────────────────────────────────

def build_bold_vocabulary(doc: Document) -> list[str]:
    """
    Collect every distinct bold run text from the document.
    Returns terms sorted by length descending so longer phrases match first.
    """
    vocab: set[str] = set()
    for para in iter_all_paragraphs(doc):
        for run in para.runs:
            term = run.text.strip()
            if run.bold and len(term) > 1:
                vocab.add(term)
                # Also add comma-split variants in case run contains "Python, AWS"
                for part in re.split(r"[,;/]", term):
                    part = part.strip()
                    if len(part) > 1:
                        vocab.add(part)
    return sorted(vocab, key=len, reverse=True)


def looks_like_tech_term(word: str) -> bool:
    """
    Heuristic: a word that looks like a technical skill/tool name.
    - CamelCase: PyTorch, LangChain, BigQuery
    - ALL-CAPS acronym 2–8 chars: AWS, GCP, NLP, REST
    - Known patterns: version numbers attached (Python3), dot notation (Node.js)
    """
    if re.match(r"^[A-Z]{2,8}$", word):
        return True
    if re.match(r"^[A-Z][a-z]+([A-Z][a-z]*)+", word):  # CamelCase
        return True
    if re.match(r"^[A-Z][a-zA-Z0-9]*\.[a-zA-Z]+", word):  # Node.js, scikit-learn
        return True
    return False


def segment_text_with_bold(text: str, vocab: list[str]) -> list[tuple[str, bool]]:
    """
    Split `text` into (segment, is_bold) pairs using the bold vocabulary.
    Longer vocabulary terms are matched first to avoid partial matches.

    Strategy:
    1. Try to match vocabulary terms at every position.
    2. Mark matched terms as bold.
    3. For unmatched words, apply the tech-term heuristic.
    """
    # Build a list of (start, end, term) for all vocab matches (case-insensitive)
    matches: list[tuple[int, int, str]] = []
    lower_text = text.lower()

    for term in vocab:
        lower_term = term.lower()
        start = 0
        while True:
            idx = lower_text.find(lower_term, start)
            if idx == -1:
                break
            end = idx + len(term)
            # Only match on word boundaries to avoid partial-word hits
            before_ok = idx == 0 or not text[idx - 1].isalnum()
            after_ok = end >= len(text) or not text[end].isalnum()
            if before_ok and after_ok:
                matches.append((idx, end, text[idx:end]))
            start = idx + 1

    # Remove overlapping matches (keep longest / first)
    matches.sort(key=lambda m: (m[0], -(m[1] - m[0])))
    clean: list[tuple[int, int, str]] = []
    last_end = 0
    for s, e, t in matches:
        if s >= last_end:
            clean.append((s, e, t))
            last_end = e

    # Build segments
    segments: list[tuple[str, bool]] = []
    pos = 0
    for s, e, term in clean:
        if pos < s:
            # Non-matched region — apply heuristic word by word
            non_bold_text = text[pos:s]
            segments.extend(_heuristic_segments(non_bold_text))
        segments.append((term, True))
        pos = e
    if pos < len(text):
        segments.extend(_heuristic_segments(text[pos:]))

    return segments


def _heuristic_segments(text: str) -> list[tuple[str, bool]]:
    """
    For text not matched by vocabulary, bold individual words that look
    like tech terms. Preserves surrounding whitespace/punctuation.
    """
    if not text:
        return []

    segments: list[tuple[str, bool]] = []
    # Split on word boundaries, keeping delimiters
    tokens = re.split(r"(\s+|[,;:()\[\]\"'])", text)
    for token in tokens:
        if not token:
            continue
        word = token.strip(".,;:()[]\"' \t")
        if word and looks_like_tech_term(word):
            # Split token into prefix whitespace, word, suffix
            prefix = token[: token.index(word)]
            suffix = token[token.index(word) + len(word):]
            if prefix:
                segments.append((prefix, False))
            segments.append((word, True))
            if suffix:
                segments.append((suffix, False))
        else:
            segments.append((token, False))

    return segments


# ── Run creation helpers ──────────────────────────────────────────────────────

def _make_run_element(text: str, ref_rPr, bold: bool):
    """Create a <w:r> XML element with optional bold, cloning ref run properties."""
    new_r = OxmlElement("w:r")

    if ref_rPr is not None:
        rPr = copy.deepcopy(ref_rPr)
    else:
        rPr = OxmlElement("w:rPr")

    # Set bold
    b_el = rPr.find(qn("w:b"))
    bCs_el = rPr.find(qn("w:bCs"))

    if bold:
        if b_el is None:
            b_el = OxmlElement("w:b")
            rPr.insert(0, b_el)
        if bCs_el is None:
            bCs_el = OxmlElement("w:bCs")
            rPr.insert(1, bCs_el)
    else:
        # Explicitly remove bold so we don't inherit it
        if b_el is not None:
            rPr.remove(b_el)
        if bCs_el is not None:
            rPr.remove(bCs_el)

    new_r.insert(0, rPr)

    new_t = OxmlElement("w:t")
    new_t.text = text
    new_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    new_r.append(new_t)
    return new_r


def _get_ref_rPr(para):
    """Get the rPr of the first non-bold run in the paragraph as base style."""
    ref = None
    for r in para._p.findall(qn("w:r")):
        rPr = r.find(qn("w:rPr"))
        b = rPr.find(qn("w:b")) if rPr is not None else None
        if b is None:
            ref = rPr
            break
    if ref is None:
        # Fall back to first run's rPr
        runs = para._p.findall(qn("w:r"))
        if runs:
            ref = runs[0].find(qn("w:rPr"))
    return ref


def write_runs_with_bold(para_element, new_text: str, ref_rPr, vocab: list[str]):
    """
    Clear existing runs from para_element and write new ones with bold applied
    to any term matching the vocabulary or heuristic.
    """
    # Remove existing runs and hyperlinks
    for r in para_element.findall(qn("w:r")):
        para_element.remove(r)
    for h in para_element.findall(qn("w:hyperlink")):
        para_element.remove(h)

    segments = segment_text_with_bold(new_text, vocab)

    # Merge adjacent segments with same bold state to minimise run count
    merged: list[tuple[str, bool]] = []
    for text, bold in segments:
        if merged and merged[-1][1] == bold:
            merged[-1] = (merged[-1][0] + text, bold)
        else:
            merged.append((text, bold))

    for text, bold in merged:
        if not text:
            continue
        run_el = _make_run_element(text, ref_rPr, bold)
        para_element.append(run_el)


# ── Section map ───────────────────────────────────────────────────────────────

def iter_all_paragraphs(doc: Document):
    """
    Yield all paragraphs in document order, including those inside table cells.
    python-docx's doc.paragraphs only returns top-level paragraphs and misses
    table content entirely, which breaks section mapping for table-layout resumes.
    """
    from docx.text.paragraph import Paragraph as _Para
    body = doc.element.body
    for child in body:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if tag == "p":
            yield _Para(child, doc)
        elif tag == "tbl":
            for row in child.findall(".//" + qn("w:tr")):
                for cell in row.findall(qn("w:tc")):
                    for p_el in cell.findall(qn("w:p")):
                        yield _Para(p_el, doc)


def extract_text(doc: Document) -> str:
    return "\n".join(p.text for p in iter_all_paragraphs(doc) if p.text.strip())


def build_section_map(doc: Document) -> list[BulletPosition]:
    positions: list[BulletPosition] = []
    current_section = "Experience"
    current_role = -1
    current_bullet = -1

    all_paras = list(iter_all_paragraphs(doc))
    for idx, para in enumerate(all_paras):
        text = para.text.strip()
        if not text:
            continue
        if is_heading(para):
            current_section = text
            current_role = -1
            current_bullet = -1
            continue
        if is_role_header(para):
            current_role += 1
            current_bullet = -1
            continue
        if is_bullet(para):
            current_bullet += 1
            positions.append(BulletPosition(
                para_index=idx,
                para=para,
                section=current_section,
                role_index=max(current_role, 0),
                bullet_index=current_bullet,
                text=text,
            ))
    return positions


# ── Apply swaps ───────────────────────────────────────────────────────────────

def apply_swaps_with_report(doc: Document, swaps: list[dict]) -> tuple[Document, list[dict], list[dict]]:
    applied: list[dict] = []
    skipped: list[dict] = []

    if not swaps:
        return doc, applied, skipped

    # Build bold vocabulary from the whole document before we start editing
    vocab = build_bold_vocabulary(doc)

    positions = build_section_map(doc)

    for idx, swap in enumerate(swaps):
        swap_id = swap.get("id") or f"swap_{idx}"
        if swap.get("action") != "swap":
            skipped.append({"id": swap_id, "reason": "unsupported action"})
            continue

        section = swap.get("section", "")
        role_idx = swap.get("roleIndex", swap.get("role_index", 0))
        bullet_idx = swap.get("bulletIndex", swap.get("bullet_index", 0))
        new_text = swap.get("newBullet", swap.get("new_bullet", "")).strip()

        if not new_text:
            skipped.append({"id": swap_id, "reason": "missing replacement bullet"})
            continue

        # Find target bullet
        match: Optional[BulletPosition] = None
        for pos in positions:
            if pos.section == section and pos.role_index == role_idx and pos.bullet_index == bullet_idx:
                match = pos
                break

        if match is None:
            original = swap.get("originalBullet", swap.get("original_bullet", ""))
            for pos in positions:
                if original and original[:40].lower() in pos.text.lower():
                    match = pos
                    break

        if match is None:
            skipped.append({"id": swap_id, "reason": "target bullet not found"})
            continue

        target_para = match.para
        ref_rPr = _get_ref_rPr(target_para)

        write_runs_with_bold(target_para._p, new_text, ref_rPr, vocab)
        applied.append({"id": swap_id})

        for p in positions:
            if p.para_index == match.para_index:
                p.text = new_text

    return doc, applied, skipped


def apply_swaps(doc: Document, swaps: list[dict]) -> Document:
    doc, _, _ = apply_swaps_with_report(doc, swaps)
    return doc


def count_bullets(doc: Document) -> int:
    return len(build_section_map(doc))
