"""
rag_chunk_service.py
Dịch vụ phân đoạn ngữ nghĩa (Semantic Chunking) cho tài liệu kỹ thuật và mã nguồn.
- Markdown: Phân tách theo cấu trúc tiêu đề (#, ##, ###), bảo toàn phân cấp và chia nhỏ theo đoạn văn khi vượt quá max_chunk_size.
- Code: Bóc tách thực thể mã nguồn (Classes, Functions, Methods) sử dụng Tree-sitter AST parser đa ngôn ngữ.
"""

import re
import logging
from typing import List, Dict, Any, Optional

from app.schemas.ai_schemas import (
    RagChunkRequest,
    RagChunkResponse,
    RagChunkItem,
)
from app.services.tree_sitter_ast_parser import parse_multilingual_ast

logger = logging.getLogger(__name__)


class RagChunkService:

    @classmethod
    def chunk(cls, request: RagChunkRequest) -> RagChunkResponse:
        """Điều phối phân đoạn dựa trên content_type: MARKDOWN hoặc CODE."""
        content = request.content or ""
        if not content.strip():
            return RagChunkResponse(chunks=[], total_chunks=0)

        content_type = (request.content_type or "MARKDOWN").strip().upper()
        if content_type == "CODE":
            return cls._chunk_code(request)
        return cls._chunk_markdown(request)

    @classmethod
    def _chunk_markdown(cls, request: RagChunkRequest) -> RagChunkResponse:
        """
        Phân đoạn Markdown theo Heading hierarchy (#, ##, ###).
        Nếu một section vượt quá max_chunk_size, chia nhỏ tiếp theo các paragraph (\\n\\n).
        """
        lines = request.content.splitlines()
        max_size = max(200, request.max_chunk_size or 1500)

        # Regex nhận diện Heading (# ... ######)
        heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$")

        sections: List[Dict[str, Any]] = []
        current_section = {
            "title": "Giới thiệu chung",
            "level": 1,
            "lines": [],
            "start_line": 1,
        }
        hierarchy_stack: List[tuple[int, str]] = [(1, "Giới thiệu chung")]

        for idx, line in enumerate(lines, 1):
            match = heading_pattern.match(line)
            if match:
                # Nếu section hiện tại có nội dung, lưu lại
                if current_section["lines"]:
                    current_section["end_line"] = idx - 1
                    sections.append(current_section)

                hashes, heading_text = match.groups()
                level = len(hashes)
                clean_title = heading_text.strip()

                # Cập nhật hierarchy stack
                while hierarchy_stack and hierarchy_stack[-1][0] >= level:
                    hierarchy_stack.pop()
                hierarchy_stack.append((level, clean_title))

                full_title = " > ".join(t for _, t in hierarchy_stack)
                current_section = {
                    "title": full_title,
                    "level": level,
                    "lines": [line],
                    "start_line": idx,
                }
            else:
                current_section["lines"].append(line)

        if current_section["lines"]:
            current_section["end_line"] = len(lines)
            sections.append(current_section)

        # Bây giờ duyệt qua các section, nếu vượt max_size thì subdivide theo paragraphs
        chunks: List[RagChunkItem] = []
        chunk_idx = 1

        for sec in sections:
            sec_lines = sec["lines"]
            sec_text = "\n".join(sec_lines).strip()
            if not sec_text:
                continue

            if len(sec_text) <= max_size:
                chunks.append(
                    RagChunkItem(
                        chunk_id=f"chk_md_{chunk_idx}_{sec['start_line']}",
                        title=sec["title"],
                        chunk_type="HEADING",
                        content=sec_text,
                        start_line=sec["start_line"],
                        end_line=sec["end_line"],
                        char_count=len(sec_text),
                    )
                )
                chunk_idx += 1
            else:
                # Subdivide by paragraphs
                sub_chunks = cls._split_section_by_paragraphs(
                    sec_title=sec["title"],
                    lines=sec_lines,
                    start_line_offset=sec["start_line"],
                    max_size=max_size,
                    start_chunk_idx=chunk_idx,
                )
                chunks.extend(sub_chunks)
                chunk_idx += len(sub_chunks)

        return RagChunkResponse(chunks=chunks, total_chunks=len(chunks))

    @classmethod
    def _split_section_by_paragraphs(
        cls,
        sec_title: str,
        lines: List[str],
        start_line_offset: int,
        max_size: int,
        start_chunk_idx: int,
    ) -> List[RagChunkItem]:
        """Tách một section dài thành nhiều chunk nhỏ dựa trên các đoạn văn (paragraph)."""
        chunks: List[RagChunkItem] = []
        current_para_lines: List[str] = []
        current_start_line = start_line_offset
        current_len = 0
        part_idx = 1
        idx_counter = start_chunk_idx

        for offset, line in enumerate(lines):
            curr_abs_line = start_line_offset + offset
            line_len = len(line) + 1

            # Khi gặp dòng trống và kích thước đã vượt ngưỡng hợp lý
            if not line.strip() and current_len >= max_size * 0.7:
                if current_para_lines:
                    text_chunk = "\n".join(current_para_lines).strip()
                    if text_chunk:
                        chunks.append(
                            RagChunkItem(
                                chunk_id=f"chk_md_{idx_counter}_{current_start_line}",
                                title=f"{sec_title} (Phần {part_idx})",
                                chunk_type="HEADING",
                                content=text_chunk,
                                start_line=current_start_line,
                                end_line=curr_abs_line - 1,
                                char_count=len(text_chunk),
                            )
                        )
                        part_idx += 1
                        idx_counter += 1
                    current_para_lines = []
                    current_len = 0
                    current_start_line = curr_abs_line + 1
                continue

            current_para_lines.append(line)
            current_len += line_len

            # Nếu một đoạn văn quá dài không có dòng trống
            if current_len >= max_size:
                text_chunk = "\n".join(current_para_lines).strip()
                if text_chunk:
                    chunks.append(
                        RagChunkItem(
                            chunk_id=f"chk_md_{idx_counter}_{current_start_line}",
                            title=f"{sec_title} (Phần {part_idx})",
                            chunk_type="HEADING",
                            content=text_chunk,
                            start_line=current_start_line,
                            end_line=curr_abs_line,
                            char_count=len(text_chunk),
                        )
                    )
                    part_idx += 1
                    idx_counter += 1
                current_para_lines = []
                current_len = 0
                current_start_line = curr_abs_line + 1

        if current_para_lines:
            text_chunk = "\n".join(current_para_lines).strip()
            if text_chunk:
                chunks.append(
                    RagChunkItem(
                        chunk_id=f"chk_md_{idx_counter}_{current_start_line}",
                        title=f"{sec_title} (Phần {part_idx})" if part_idx > 1 else sec_title,
                        chunk_type="HEADING",
                        content=text_chunk,
                        start_line=current_start_line,
                        end_line=start_line_offset + len(lines) - 1,
                        char_count=len(text_chunk),
                    )
                )

        return chunks

    @classmethod
    def _chunk_code(cls, request: RagChunkRequest) -> RagChunkResponse:
        """
        Bóc tách thực thể mã nguồn (Classes, Functions, Methods) sử dụng Tree-sitter AST.
        """
        source_path = request.source_path or "Unknown.java"
        content = request.content
        code_lines = content.splitlines()

        parsed = parse_multilingual_ast(source_path, content)
        methods = parsed.get("methods", [])
        class_name = parsed.get("class_name")
        chunks: List[RagChunkItem] = []
        chunk_idx = 1

        # Nếu có danh sách methods/functions từ AST
        if methods:
            for item in methods:
                s_line = max(1, item.get("start_line", 1))
                e_line = min(len(code_lines), max(s_line, item.get("end_line", s_line)))
                snippet_lines = code_lines[s_line - 1 : e_line]
                snippet = "\n".join(snippet_lines).strip()
                if not snippet:
                    continue

                sig = item.get("signature") or f"{item.get('entity_type', 'METHOD')} {item.get('method_name', 'anonymous')}"
                entity_title = f"{class_name + '.' if class_name else ''}{sig}"

                chunks.append(
                    RagChunkItem(
                        chunk_id=f"chk_code_{chunk_idx}_{item.get('method_name', 'method')}",
                        title=entity_title,
                        chunk_type="CODE_ENTITY",
                        content=snippet,
                        start_line=s_line,
                        end_line=e_line,
                        char_count=len(snippet),
                    )
                )
                chunk_idx += 1

        # Nếu không trích xuất được method nào (ví dụ file script hoặc plain code)
        if not chunks:
            # Fallback phân đoạn code theo các khối dòng (line blocks)
            step = 50
            for i in range(0, len(code_lines), step):
                chunk_lines = code_lines[i : i + step]
                chunk_text = "\n".join(chunk_lines).strip()
                if not chunk_text:
                    continue
                start_l = i + 1
                end_l = min(len(code_lines), i + step)
                chunks.append(
                    RagChunkItem(
                        chunk_id=f"chk_code_{chunk_idx}_{start_l}",
                        title=f"{source_path}:L{start_l}-L{end_l}",
                        chunk_type="CODE_ENTITY",
                        content=chunk_text,
                        start_line=start_l,
                        end_line=end_l,
                        char_count=len(chunk_text),
                    )
                )
                chunk_idx += 1

        return RagChunkResponse(chunks=chunks, total_chunks=len(chunks))
