"""
tree_sitter_ast_parser.py
Module bóc tách cấu trúc mã nguồn Java bằng Tree-sitter (chính thức).
Nâng cấp: Bóc tách chính xác toàn diện Annotation (@RestController, @Service, @GetMapping, @PathVariable...),
Javadoc/Docstring, Class, Method, Constructor, Parameter types và Return types.
TV4 — LivingDocs AI Engine — Tuần 3 (Task #82)
"""

from typing import Any, Optional, List
import tree_sitter
import tree_sitter_java

# Khởi tạo Parser dùng chung một lần duy nhất
_JAVA_LANGUAGE = tree_sitter.Language(tree_sitter_java.language())
_PARSER = tree_sitter.Parser(_JAVA_LANGUAGE)


def _clean_javadoc(raw_comment: str) -> str:
    """Chuẩn hóa nội dung Javadoc / Docstring, loại bỏ các ký tự /**, *, */ bao quanh."""
    lines = raw_comment.splitlines()
    cleaned_lines = []
    for line in lines:
        s = line.strip()
        if s.startswith("/**"):
            s = s[3:].strip()
        elif s.startswith("*/"):
            s = s[2:].strip()
        elif s.startswith("*"):
            s = s[1:].strip()
        elif s.startswith("//"):
            s = s[2:].strip()
        if s:
            cleaned_lines.append(s)
    return "\n".join(cleaned_lines)


def _extract_prev_javadoc(parent_node, target_node, source_bytes: bytes) -> Optional[str]:
    """Tìm block_comment hoặc line_comment (Javadoc/docstring) ngay trước node đích nếu có."""
    prev_comment = None
    for child in parent_node.children:
        if child == target_node:
            break
        if child.type == "block_comment":
            text = source_bytes[child.start_byte:child.end_byte].decode("utf-8", errors="replace")
            if text.startswith("/**"):
                prev_comment = text
        elif child.type == "line_comment":
            text = source_bytes[child.start_byte:child.end_byte].decode("utf-8", errors="replace")
            prev_comment = text
        elif child.type not in (";", ","):
            # Nếu gặp node khác (không phải dấu phân cách) thì reset
            prev_comment = None

    if prev_comment:
        return _clean_javadoc(prev_comment)
    return None


def _extract_annotations(modifiers_node, source_bytes: bytes) -> List[str]:
    """
    Bóc tách toàn bộ annotations từ node modifiers.
    Hỗ trợ cả marker_annotation (@RestController, @Service) và annotation có tham số (@GetMapping("/orders")).
    """
    annotations = []
    if not modifiers_node:
        return annotations

    for child in modifiers_node.children:
        if child.type in ("marker_annotation", "annotation"):
            ann_text = source_bytes[child.start_byte:child.end_byte].decode("utf-8", errors="replace")
            # Chuẩn hóa khoảng trắng dư thừa
            ann_clean = " ".join(ann_text.split())
            if ann_clean:
                annotations.append(ann_clean)
    return annotations


def _extract_parameters(params_node, source_bytes: bytes) -> List[dict[str, Any]]:
    """
    Bóc tách danh sách tham số (tên biến, kiểu dữ liệu, các annotations của tham số)
    từ node formal_parameters.
    """
    params = []
    if not params_node:
        return params

    for child in params_node.children:
        if child.type in ("formal_parameter", "spread_parameter"):
            type_text = ""
            name_text = ""
            param_annotations = []

            for sub in child.children:
                if sub.type == "modifiers":
                    # Các annotation gắn với param: @PathVariable("id"), @RequestBody, @Valid
                    param_annotations = _extract_annotations(sub, source_bytes)
                elif sub.type == "identifier":
                    name_text = source_bytes[sub.start_byte:sub.end_byte].decode("utf-8", errors="replace").strip()
                elif sub.type not in ("variable_declarator_id", ","):
                    # Các node kiểu dữ liệu: type_identifier, generic_type, integral_type, array_type, boolean_type, floating_point_type...
                    type_text = source_bytes[sub.start_byte:sub.end_byte].decode("utf-8", errors="replace").strip()

            if name_text:
                params.append({
                    "name": name_text,
                    "type": type_text if type_text else "Object",
                    "annotations": param_annotations,
                })
    return params


def parse_java_with_treesitter(file_path: str, source_code: str) -> dict[str, Any]:
    """
    Phân tích cú pháp Java bằng Tree-sitter.
    Trả về dict chuẩn: package_name, class_name, class_type, annotations, javadoc, methods, parse_error.
    """
    result = {
        "file_path": file_path,
        "package_name": None,
        "class_name": None,
        "class_type": "CLASS",
        "annotations": [],
        "javadoc": None,
        "modifiers": [],
        "start_line": 1,
        "end_line": len(source_code.splitlines()) or 1,
        "methods": [],
        "parse_error": None
    }

    try:
        source_bytes = source_code.encode("utf-8")
        tree = _PARSER.parse(source_bytes)
        root = tree.root_node
    except Exception as e:
        result["parse_error"] = f"TreeSitterParseError: {str(e)}"
        return result

    # 1. Bóc tách Package
    for child in root.children:
        if child.type == "package_declaration":
            for sub in child.children:
                if sub.type in ("scoped_identifier", "identifier"):
                    result["package_name"] = source_bytes[sub.start_byte:sub.end_byte].decode("utf-8", errors="replace").strip()
            break

    # 2. Tìm Class / Interface / Enum / Record declaration chính trong root
    class_node = None
    for child in root.children:
        if child.type in ("class_declaration", "interface_declaration", "enum_declaration", "record_declaration"):
            class_node = child
            if child.type == "interface_declaration":
                result["class_type"] = "INTERFACE"
            elif child.type == "enum_declaration":
                result["class_type"] = "ENUM"
            elif child.type == "record_declaration":
                result["class_type"] = "RECORD"
            else:
                result["class_type"] = "CLASS"
            break

    if not class_node:
        result["parse_error"] = "Không tìm thấy khai báo Class/Interface/Enum nào trong mã nguồn."
        return result

    result["start_line"] = class_node.start_point.row + 1
    result["end_line"] = class_node.end_point.row + 1

    # Lấy Javadoc của class (tìm block_comment đứng trước class_node ở root)
    result["javadoc"] = _extract_prev_javadoc(root, class_node, source_bytes)

    # Lấy tên Class, Modifiers, Annotations của class
    modifiers_node = None
    class_body_node = None
    for child in class_node.children:
        if child.type == "identifier":
            result["class_name"] = source_bytes[child.start_byte:child.end_byte].decode("utf-8", errors="replace").strip()
        elif child.type == "modifiers":
            modifiers_node = child
            result["annotations"] = _extract_annotations(modifiers_node, source_bytes)
            # Lấy modifier keywords (public, abstract, final...)
            for sub in child.children:
                if sub.type in ("public", "protected", "private", "abstract", "final", "static"):
                    result["modifiers"].append(sub.type)
        elif child.type in ("class_body", "interface_body", "enum_body_declarations"):
            class_body_node = child

    if not class_body_node:
        return result

    # 3. Duyệt Class Body để bóc tách Methods & Constructors
    methods = []
    for child in class_body_node.children:
        if child.type == "method_declaration":
            m_modifiers_node = None
            return_type = "void"
            method_name = ""
            params_node = None
            m_start_line = child.start_point.row + 1
            m_end_line = child.end_point.row + 1

            for sub in child.children:
                if sub.type == "modifiers":
                    m_modifiers_node = sub
                elif sub.type == "identifier":
                    method_name = source_bytes[sub.start_byte:sub.end_byte].decode("utf-8", errors="replace").strip()
                elif sub.type == "formal_parameters":
                    params_node = sub
                elif sub.type not in ("block", ";") and not method_name:
                    # Type return (type_identifier, generic_type, integral_type, void_type, boolean_type...)
                    return_type = source_bytes[sub.start_byte:sub.end_byte].decode("utf-8", errors="replace").strip()

            params = _extract_parameters(params_node, source_bytes)
            # Xây dựng chuỗi tham số đầy đủ gồm cả annotation nếu có
            params_str_parts = []
            for p in params:
                p_ann_str = f"{' '.join(p['annotations'])} " if p.get("annotations") else ""
                params_str_parts.append(f"{p_ann_str}{p['type']} {p['name']}")
            params_str = ", ".join(params_str_parts)

            annotations = _extract_annotations(m_modifiers_node, source_bytes)
            javadoc = _extract_prev_javadoc(class_body_node, child, source_bytes)

            mod_prefix = "public"
            if m_modifiers_node:
                mods = [s.type for s in m_modifiers_node.children if s.type in ("public", "protected", "private", "static", "final", "synchronized")]
                if mods:
                    mod_prefix = " ".join(mods)

            ann_prefix = f"{' '.join(annotations)} " if annotations else ""
            signature = f"{ann_prefix}{mod_prefix} {return_type} {method_name}({params_str})"

            methods.append({
                "entity_type": "METHOD",
                "method_name": method_name,
                "class_name": result["class_name"],
                "return_type": return_type,
                "parameters": params,
                "signature": signature,
                "annotations": annotations,
                "javadoc": javadoc,
                "start_line": m_start_line,
                "end_line": m_end_line,
                "doc_status": "DOCUMENTED" if javadoc else "UNDOCUMENTED"
            })

        elif child.type == "constructor_declaration":
            ctor_name = ""
            params_node = None
            c_modifiers_node = None
            c_start_line = child.start_point.row + 1
            c_end_line = child.end_point.row + 1

            for sub in child.children:
                if sub.type == "modifiers":
                    c_modifiers_node = sub
                elif sub.type == "identifier":
                    ctor_name = source_bytes[sub.start_byte:sub.end_byte].decode("utf-8", errors="replace").strip()
                elif sub.type == "formal_parameters":
                    params_node = sub

            params = _extract_parameters(params_node, source_bytes)
            params_str_parts = []
            for p in params:
                p_ann_str = f"{' '.join(p['annotations'])} " if p.get("annotations") else ""
                params_str_parts.append(f"{p_ann_str}{p['type']} {p['name']}")
            params_str = ", ".join(params_str_parts)

            annotations = _extract_annotations(c_modifiers_node, source_bytes)
            javadoc = _extract_prev_javadoc(class_body_node, child, source_bytes)

            mod_prefix = "public"
            if c_modifiers_node:
                mods = [s.type for s in c_modifiers_node.children if s.type in ("public", "protected", "private")]
                if mods:
                    mod_prefix = " ".join(mods)

            ann_prefix = f"{' '.join(annotations)} " if annotations else ""
            signature = f"{ann_prefix}{mod_prefix} {ctor_name}({params_str})"

            methods.append({
                "entity_type": "CONSTRUCTOR",
                "method_name": ctor_name,
                "class_name": result["class_name"],
                "return_type": None,
                "parameters": params,
                "signature": signature,
                "annotations": annotations,
                "javadoc": javadoc,
                "start_line": c_start_line,
                "end_line": c_end_line,
                "doc_status": "DOCUMENTED" if javadoc else "UNDOCUMENTED"
            })

    result["methods"] = methods
    return result
