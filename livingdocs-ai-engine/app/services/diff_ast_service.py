"""
diff_ast_service.py
Dịch vụ đối chiếu AST Java giữa 2 phiên bản mã nguồn (Base vs Head của Pull Request).
Nhiệm vụ:
- Phát hiện chính xác các hàm Java bị XÓA (DELETED), THÊM MỚI (ADDED), ĐỔI TÊN (RENAMED),
  THAY ĐỔI THAM SỐ / CHỮ KÝ (PARAM_CHANGED, RETURN_TYPE_CHANGED, SIGNATURE_CHANGED),
  và THAY ĐỔI LOGIC NỘI DUNG (BODY_CHANGED).
- Trích xuất danh sách các thực thể bị ảnh hưởng (Affected Entities) phục vụ kiểm tra sai lệch tài liệu.
TV2 — LivingDocs Code Diff Pipeline
"""

from typing import Any, Optional, List, Dict
import difflib
from app.services.tree_sitter_ast_parser import parse_java_with_treesitter


def _normalize_type(t: Optional[str]) -> str:
    """Loại bỏ khoảng trắng thừa trong kiểu dữ liệu (vd: List< String > -> List<String>)."""
    if not t:
        return ""
    return "".join(t.split())


def _params_match(params1: List[Dict[str, Any]], params2: List[Dict[str, Any]]) -> bool:
    """So sánh 2 danh sách tham số dựa trên kiểu dữ liệu chuẩn hóa."""
    if len(params1) != len(params2):
        return False
    for p1, p2 in zip(params1, params2):
        if _normalize_type(p1.get("type")) != _normalize_type(p2.get("type")):
            return False
    return True


def _param_signature(params: List[Dict[str, Any]]) -> str:
    """Chuỗi đại diện cho danh sách kiểu tham số (vd: '(String,int)')."""
    types = [_normalize_type(p.get("type")) for p in params]
    return f"({','.join(types)})"


def _extract_body_text(source_code: str, start_line: int, end_line: int) -> str:
    """Trích xuất khối code của method từ start_line tới end_line (1-indexed)."""
    lines = source_code.splitlines()
    if start_line < 1 or start_line > len(lines):
        return ""
    s_idx = max(0, start_line - 1)
    e_idx = min(len(lines), end_line)
    return "\n".join(lines[s_idx:e_idx]).strip()


def _calculate_body_similarity(body1: str, body2: str) -> float:
    """Tính độ tương đồng văn bản giữa 2 thân hàm (0.0 -> 1.0)."""
    if not body1 and not body2:
        return 1.0
    if not body1 or not body2:
        return 0.0
    # Chuẩn hóa khoảng trắng
    clean1 = "\n".join([line.strip() for line in body1.splitlines() if line.strip()])
    clean2 = "\n".join([line.strip() for line in body2.splitlines() if line.strip()])
    return difflib.SequenceMatcher(None, clean1, clean2).ratio()


class DiffAstService:

    @classmethod
    def compare_java_files(
        cls,
        file_path: str,
        base_code: Optional[str],
        head_code: Optional[str],
        base_commit_hash: Optional[str] = None,
        head_commit_hash: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        So sánh AST giữa base_code (commit cũ) và head_code (commit mới).
        Trả về:
        - file_status: MODIFIED, ADDED, DELETED, UNCHANGED
        - affected_entities: Danh sách các hàm bị ảnh hưởng kèm chi tiết thay đổi
        - summary: Thống kê số lượng (added, deleted, modified, renamed)
        """
        base_code = base_code or ""
        head_code = head_code or ""

        # Trường hợp file mới hoàn toàn
        if not base_code.strip() and head_code.strip():
            parsed_head = parse_java_with_treesitter(file_path, head_code)
            entities = []
            for m in parsed_head.get("methods", []):
                entities.append({
                    "entity_type": m["entity_type"],
                    "class_name": m["class_name"],
                    "method_name": m["method_name"],
                    "change_type": "ADDED",
                    "impact_level": "LOW",
                    "old_signature": None,
                    "new_signature": m["signature"],
                    "old_parameters": None,
                    "new_parameters": ", ".join([f"{p['type']} {p['name']}" for p in m.get("parameters", [])]),
                    "old_return_type": None,
                    "new_return_type": m.get("return_type"),
                    "start_line": m["start_line"],
                    "end_line": m["end_line"],
                    "details": f"Phương thức mới '{m['method_name']}' được thêm vào file."
                })
            return {
                "file_path": file_path,
                "file_status": "ADDED",
                "class_name": parsed_head.get("class_name"),
                "total_affected": len(entities),
                "summary": {"added": len(entities), "deleted": 0, "modified": 0, "renamed": 0},
                "affected_entities": entities
            }

        # Trường hợp file bị xóa hoàn toàn
        if base_code.strip() and not head_code.strip():
            parsed_base = parse_java_with_treesitter(file_path, base_code)
            entities = []
            for m in parsed_base.get("methods", []):
                entities.append({
                    "entity_type": m["entity_type"],
                    "class_name": m["class_name"],
                    "method_name": m["method_name"],
                    "change_type": "DELETED",
                    "impact_level": "CRITICAL",
                    "old_signature": m["signature"],
                    "new_signature": None,
                    "old_parameters": ", ".join([f"{p['type']} {p['name']}" for p in m.get("parameters", [])]),
                    "new_parameters": None,
                    "old_return_type": m.get("return_type"),
                    "new_return_type": None,
                    "start_line": m["start_line"],
                    "end_line": m["end_line"],
                    "details": f"File bị xóa, phương thức '{m['method_name']}' đã bị xóa hoàn toàn."
                })
            return {
                "file_path": file_path,
                "file_status": "DELETED",
                "class_name": parsed_base.get("class_name"),
                "total_affected": len(entities),
                "summary": {"added": 0, "deleted": len(entities), "modified": 0, "renamed": 0},
                "affected_entities": entities
            }

        # Parse cả 2 phiên bản bằng AST Tree-sitter
        parsed_base = parse_java_with_treesitter(file_path, base_code)
        parsed_head = parse_java_with_treesitter(file_path, head_code)

        base_methods: List[Dict[str, Any]] = parsed_base.get("methods", [])
        head_methods: List[Dict[str, Any]] = parsed_head.get("methods", [])

        # Gán body_text cho từng method để phục vụ phát hiện đổi tên hoặc body change
        for m in base_methods:
            m["body_text"] = _extract_body_text(base_code, m["start_line"], m["end_line"])
        for m in head_methods:
            m["body_text"] = _extract_body_text(head_code, m["start_line"], m["end_line"])

        affected_entities = []
        matched_head_indices = set()
        unmatched_base_methods = []

        # Bước 1: Khớp theo tên hàm (method_name)
        for base_m in base_methods:
            b_name = base_m["method_name"]
            # Tìm các hàm ở head có cùng tên
            candidates = [
                (idx, hm) for idx, hm in enumerate(head_methods)
                if hm["method_name"] == b_name and idx not in matched_head_indices
            ]

            if candidates:
                # Nếu có ứng viên trùng tên, tìm xem có cái nào trùng tham số không
                best_idx, best_head_m = None, None
                for idx, hm in candidates:
                    if _params_match(base_m.get("parameters", []), hm.get("parameters", [])):
                        best_idx, best_head_m = idx, hm
                        break
                
                # Nếu không trùng chính xác tham số, lấy ứng viên đầu tiên cùng tên (đổi tham số)
                if best_head_m is None:
                    best_idx, best_head_m = candidates[0]

                matched_head_indices.add(best_idx)

                # Phân tích các loại thay đổi
                b_ret = _normalize_type(base_m.get("return_type"))
                h_ret = _normalize_type(best_head_m.get("return_type"))
                b_params_str = ", ".join([f"{p['type']} {p['name']}" for p in base_m.get("parameters", [])])
                h_params_str = ", ".join([f"{p['type']} {p['name']}" for p in best_head_m.get("parameters", [])])
                params_same = _params_match(base_m.get("parameters", []), best_head_m.get("parameters", []))
                return_same = (b_ret == h_ret)

                body_sim = _calculate_body_similarity(base_m["body_text"], best_head_m["body_text"])

                change_type = None
                impact_level = "LOW"
                detail_parts = []

                if not params_same and not return_same:
                    change_type = "SIGNATURE_CHANGED"
                    impact_level = "CRITICAL"
                    detail_parts.append(f"Chữ ký thay đổi: Kiểu trả về từ [{b_ret}] thành [{h_ret}], tham số từ ({b_params_str}) thành ({h_params_str})")
                elif not params_same:
                    change_type = "PARAM_CHANGED"
                    impact_level = "HIGH"
                    detail_parts.append(f"Thay đổi danh sách tham số: từ ({b_params_str}) thành ({h_params_str})")
                elif not return_same:
                    change_type = "RETURN_TYPE_CHANGED"
                    impact_level = "HIGH"
                    detail_parts.append(f"Thay đổi kiểu dữ liệu trả về: từ [{b_ret}] thành [{h_ret}]")
                elif body_sim < 0.98:
                    change_type = "BODY_CHANGED"
                    impact_level = "MEDIUM"
                    detail_parts.append(f"Logic thân hàm thay đổi (độ tương đồng {int(body_sim*100)}%)")

                if change_type:
                    affected_entities.append({
                        "entity_type": best_head_m["entity_type"],
                        "class_name": best_head_m["class_name"],
                        "method_name": b_name,
                        "change_type": change_type,
                        "impact_level": impact_level,
                        "old_signature": base_m["signature"],
                        "new_signature": best_head_m["signature"],
                        "old_parameters": b_params_str,
                        "new_parameters": h_params_str,
                        "old_return_type": base_m.get("return_type"),
                        "new_return_type": best_head_m.get("return_type"),
                        "start_line": best_head_m["start_line"],
                        "end_line": best_head_m["end_line"],
                        "details": "; ".join(detail_parts)
                    })
            else:
                unmatched_base_methods.append(base_m)

        # Bước 2: Đối với các hàm base chưa khớp, kiểm tra xem có bị RENAMED sang hàm ở head không
        remaining_head = [
            (idx, hm) for idx, hm in enumerate(head_methods)
            if idx not in matched_head_indices
        ]

        deleted_base_methods = []
        for base_m in unmatched_base_methods:
            renamed_match = None
            renamed_idx = None

            for idx, hm in remaining_head:
                if idx in matched_head_indices:
                    continue
                # Kiểm tra cùng kiểu tham số và cùng kiểu trả về + thân hàm tương đồng cao
                same_params = _params_match(base_m.get("parameters", []), hm.get("parameters", []))
                same_ret = (_normalize_type(base_m.get("return_type")) == _normalize_type(hm.get("return_type")))
                body_sim = _calculate_body_similarity(base_m["body_text"], hm["body_text"])

                # Tiêu chí nhận diện đổi tên: (Cùng param và return VÀ thân hàm > 70%) HOẶC (thân hàm > 85%)
                if (same_params and same_ret and body_sim >= 0.70) or (body_sim >= 0.85):
                    renamed_match = hm
                    renamed_idx = idx
                    break

            if renamed_match:
                matched_head_indices.add(renamed_idx)
                b_params_str = ", ".join([f"{p['type']} {p['name']}" for p in base_m.get("parameters", [])])
                h_params_str = ", ".join([f"{p['type']} {p['name']}" for p in renamed_match.get("parameters", [])])
                affected_entities.append({
                    "entity_type": renamed_match["entity_type"],
                    "class_name": renamed_match["class_name"],
                    "method_name": renamed_match["method_name"],
                    "change_type": "RENAMED",
                    "impact_level": "HIGH",
                    "old_signature": base_m["signature"],
                    "new_signature": renamed_match["signature"],
                    "old_parameters": b_params_str,
                    "new_parameters": h_params_str,
                    "old_return_type": base_m.get("return_type"),
                    "new_return_type": renamed_match.get("return_type"),
                    "start_line": renamed_match["start_line"],
                    "end_line": renamed_match["end_line"],
                    "details": f"Phương thức được đổi tên từ '{base_m['method_name']}' thành '{renamed_match['method_name']}'"
                })
            else:
                deleted_base_methods.append(base_m)

        # Bước 3: Các hàm base còn lại là DELETED
        for base_m in deleted_base_methods:
            b_params_str = ", ".join([f"{p['type']} {p['name']}" for p in base_m.get("parameters", [])])
            affected_entities.append({
                "entity_type": base_m["entity_type"],
                "class_name": base_m["class_name"],
                "method_name": base_m["method_name"],
                "change_type": "DELETED",
                "impact_level": "CRITICAL",
                "old_signature": base_m["signature"],
                "new_signature": None,
                "old_parameters": b_params_str,
                "new_parameters": None,
                "old_return_type": base_m.get("return_type"),
                "new_return_type": None,
                "start_line": base_m["start_line"],
                "end_line": base_m["end_line"],
                "details": f"Phương thức '{base_m['method_name']}' đã bị xóa khỏi class."
            })

        # Bước 4: Các hàm head chưa được ghép cặp là ADDED
        for idx, head_m in enumerate(head_methods):
            if idx not in matched_head_indices:
                h_params_str = ", ".join([f"{p['type']} {p['name']}" for p in head_m.get("parameters", [])])
                affected_entities.append({
                    "entity_type": head_m["entity_type"],
                    "class_name": head_m["class_name"],
                    "method_name": head_m["method_name"],
                    "change_type": "ADDED",
                    "impact_level": "LOW",
                    "old_signature": None,
                    "new_signature": head_m["signature"],
                    "old_parameters": None,
                    "new_parameters": h_params_str,
                    "old_return_type": None,
                    "new_return_type": head_m.get("return_type"),
                    "start_line": head_m["start_line"],
                    "end_line": head_m["end_line"],
                    "details": f"Phương thức mới '{head_m['method_name']}' được thêm vào."
                })

        # Thống kê
        summary = {
            "added": len([e for e in affected_entities if e["change_type"] == "ADDED"]),
            "deleted": len([e for e in affected_entities if e["change_type"] == "DELETED"]),
            "renamed": len([e for e in affected_entities if e["change_type"] == "RENAMED"]),
            "modified": len([e for e in affected_entities if e["change_type"] in ("PARAM_CHANGED", "RETURN_TYPE_CHANGED", "SIGNATURE_CHANGED", "BODY_CHANGED")])
        }

        file_status = "MODIFIED" if affected_entities else "UNCHANGED"

        return {
            "file_path": file_path,
            "file_status": file_status,
            "class_name": parsed_head.get("class_name") or parsed_base.get("class_name"),
            "total_affected": len(affected_entities),
            "summary": summary,
            "affected_entities": affected_entities
        }
