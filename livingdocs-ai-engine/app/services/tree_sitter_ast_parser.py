"""
tree_sitter_ast_parser.py
Module bóc tách cấu trúc mã nguồn đa ngôn ngữ bằng Tree-sitter (chính thức).
Hỗ trợ:
1. Java (.java): class, interface, record, enum, method, constructor, field, annotation, javadoc.
2. Python (.py): class, function, async def, method, constructor (__init__), field, decorators, docstring.
3. TypeScript / JavaScript (.ts, .tsx, .js, .jsx): class, interface, type, function, method, constructor, arrow function, decorators, JSDoc.
4. SQL (.sql): DDL CREATE TABLE, CREATE VIEW, CREATE FUNCTION, CREATE PROCEDURE, CREATE INDEX, comments.

TV1 — LivingDocs AI Engine — Tuần 5
"""

from typing import Any, Optional, List, Dict
import re
import tree_sitter
import tree_sitter_java
import tree_sitter_python
import tree_sitter_typescript
import tree_sitter_sql

# Khởi tạo các Languages và Parsers dùng chung (Singleton)
_JAVA_LANG = tree_sitter.Language(tree_sitter_java.language())
_PY_LANG = tree_sitter.Language(tree_sitter_python.language())
_TS_LANG = tree_sitter.Language(tree_sitter_typescript.language_typescript())
_TSX_LANG = tree_sitter.Language(tree_sitter_typescript.language_tsx())
import threading

_TS_LOCK = threading.Lock()
_PARSER_JAVA = tree_sitter.Parser(_JAVA_LANG)
_PARSER_PY = tree_sitter.Parser(_PY_LANG)
_PARSER_TS = tree_sitter.Parser(_TS_LANG)
_PARSER_TSX = tree_sitter.Parser(_TSX_LANG)
try:
    _SQL_LANG = tree_sitter.Language(tree_sitter_sql.language())
    _PARSER_SQL = tree_sitter.Parser(_SQL_LANG)
except Exception:
    _SQL_LANG = None
    _PARSER_SQL = None

def _node_text(node, source_bytes: bytes = b"") -> str:
    if node is None:
        return ""
    return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _clean_docstring(raw_comment: str) -> str:
    """Chuẩn hóa nội dung Javadoc / Docstring / Comment, loại bỏ ký tự bao quanh."""
    if not raw_comment:
        return ""
    lines = raw_comment.splitlines()
    cleaned_lines = []
    for line in lines:
        s = line.strip()
        if s.startswith('"""') or s.startswith("'''"):
            s = s[3:].strip()
            if s.endswith('"""') or s.endswith("'''"):
                s = s[:-3].strip()
        elif s.startswith("/**"):
            s = s[3:].strip()
        elif s.startswith("*/"):
            s = s[2:].strip()
        elif s.startswith("*"):
            s = s[1:].strip()
        elif s.startswith("//") or s.startswith("--") or s.startswith("#"):
            s = s[2:].strip()
        if s:
            cleaned_lines.append(s)
    return "\n".join(cleaned_lines)


def _extract_prev_comment(parent_node, target_node, source_bytes: bytes) -> Optional[str]:
    """Tìm comment ngay trước một node đích trong cùng một parent node."""
    prev_comment = None
    for child in parent_node.children:
        if child == target_node:
            break
        if child.type in ("block_comment", "line_comment", "comment"):
            text = _node_text(child, source_bytes)
            prev_comment = text
        elif child.type not in (";", ",", "\n"):
            prev_comment = None

    if prev_comment:
        return _clean_docstring(prev_comment)
    return None


# ==============================================================================
# 1. JAVA AST PARSER (Tree-sitter)
# ==============================================================================

def _extract_java_annotations(modifiers_node, source_bytes: bytes) -> List[str]:
    annotations = []
    if not modifiers_node:
        return annotations
    for child in modifiers_node.children:
        if child.type in ("marker_annotation", "annotation"):
            ann_text = _node_text(child, source_bytes)
            ann_clean = " ".join(ann_text.split())
            if ann_clean:
                annotations.append(ann_clean)
    return annotations


def _extract_java_parameters(params_node, source_bytes: bytes) -> List[Dict[str, Any]]:
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
                    param_annotations = _extract_java_annotations(sub, source_bytes)
                elif sub.type == "identifier":
                    name_text = _node_text(sub, source_bytes).strip()
                elif sub.type not in ("variable_declarator_id", ","):
                    type_text = _node_text(sub, source_bytes).strip()

            if name_text:
                params.append({
                    "name": name_text,
                    "type": type_text if type_text else "Object",
                    "annotations": param_annotations,
                })
    return params


def parse_java_ast(file_path: str, source_code: str) -> Dict[str, Any]:
    result = {
        "file_path": file_path,
        "language": "java",
        "package_name": None,
        "class_name": None,
        "class_type": "CLASS",
        "annotations": [],
        "javadoc": None,
        "modifiers": [],
        "start_line": 1,
        "end_line": len(source_code.splitlines()) or 1,
        "methods": [],
        "fields": [],
        "parse_error": None
    }

    try:
        source_bytes = source_code.encode("utf-8")
        with _TS_LOCK:
            tree = _PARSER_JAVA.parse(source_bytes)
        root = tree.root_node
    except Exception as e:
        result["parse_error"] = f"TreeSitterJavaError: {str(e)}"
        return result

    for child in root.children:
        if child.type == "package_declaration":
            for sub in child.children:
                if sub.type in ("scoped_identifier", "identifier"):
                    result["package_name"] = _node_text(sub, source_bytes).strip()
            break

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
        result["parse_error"] = "Không tìm thấy khai báo Class/Interface/Enum nào trong mã nguồn Java."
        return result

    result["start_line"] = class_node.start_point.row + 1
    result["end_line"] = class_node.end_point.row + 1
    result["javadoc"] = _extract_prev_comment(root, class_node, source_bytes)

    class_body_node = None
    for child in class_node.children:
        if child.type == "identifier":
            result["class_name"] = _node_text(child, source_bytes).strip()
        elif child.type == "modifiers":
            result["annotations"] = _extract_java_annotations(child, source_bytes)
            for sub in child.children:
                if sub.type in ("public", "protected", "private", "abstract", "final", "static"):
                    result["modifiers"].append(sub.type)
        elif child.type in ("class_body", "interface_body", "enum_body_declarations"):
            class_body_node = child

    if not class_body_node:
        return result

    methods = []
    fields = []
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
                    method_name = _node_text(sub, source_bytes).strip()
                elif sub.type == "formal_parameters":
                    params_node = sub
                elif sub.type not in ("block", ";") and not method_name:
                    return_type = _node_text(sub, source_bytes).strip()

            params = _extract_java_parameters(params_node, source_bytes)
            params_str_parts = []
            for p in params:
                p_ann_str = f"{' '.join(p['annotations'])} " if p.get("annotations") else ""
                params_str_parts.append(f"{p_ann_str}{p['type']} {p['name']}")
            params_str = ", ".join(params_str_parts)

            annotations = _extract_java_annotations(m_modifiers_node, source_bytes)
            javadoc = _extract_prev_comment(class_body_node, child, source_bytes)

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
                    ctor_name = _node_text(sub, source_bytes).strip()
                elif sub.type == "formal_parameters":
                    params_node = sub

            params = _extract_java_parameters(params_node, source_bytes)
            params_str_parts = []
            for p in params:
                p_ann_str = f"{' '.join(p['annotations'])} " if p.get("annotations") else ""
                params_str_parts.append(f"{p_ann_str}{p['type']} {p['name']}")
            params_str = ", ".join(params_str_parts)

            annotations = _extract_java_annotations(c_modifiers_node, source_bytes)
            javadoc = _extract_prev_comment(class_body_node, child, source_bytes)

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

        elif child.type == "field_declaration":
            # Bóc tách thuộc tính / Field (rất quan trọng cho Entity & DTO)
            f_modifiers_node = None
            field_type = "Object"
            field_name = ""
            f_start = child.start_point.row + 1
            f_end = child.end_point.row + 1

            for sub in child.children:
                if sub.type == "modifiers":
                    f_modifiers_node = sub
                elif sub.type == "variable_declarator":
                    for v_sub in sub.children:
                        if v_sub.type == "identifier":
                            field_name = _node_text(v_sub, source_bytes).strip()
                elif sub.type not in (";", ","):
                    field_type = _node_text(sub, source_bytes).strip()

            if field_name:
                annotations = _extract_java_annotations(f_modifiers_node, source_bytes)
                javadoc = _extract_prev_comment(class_body_node, child, source_bytes)
                fields.append({
                    "entity_type": "FIELD",
                    "method_name": field_name,
                    "class_name": result["class_name"],
                    "return_type": field_type,
                    "signature": f"{' '.join(annotations) + ' ' if annotations else ''}{field_type} {field_name}",
                    "annotations": annotations,
                    "javadoc": javadoc,
                    "start_line": f_start,
                    "end_line": f_end,
                    "doc_status": "DOCUMENTED" if javadoc or annotations else "UNDOCUMENTED"
                })

    result["methods"] = methods
    result["fields"] = fields
    return result


# ==============================================================================
# 2. PYTHON AST PARSER (Tree-sitter)
# ==============================================================================

def _extract_py_docstring(body_node, source_bytes: bytes) -> Optional[str]:
    """Lấy docstring đầu tiên trong thân class/function."""
    if not body_node:
        return None
    for child in body_node.children:
        if child.type == "expression_statement":
            for sub in child.children:
                if sub.type in ("string", "concatenated_string"):
                    raw = _node_text(sub, source_bytes)
                    return _clean_docstring(raw)
            break
        elif child.type not in ("comment", "\n"):
            break
    return None


def _extract_py_decorators(decorated_node, source_bytes: bytes) -> List[str]:
    """Lấy danh sách decorators (@...) từ decorated_definition."""
    decorators = []
    for child in decorated_node.children:
        if child.type == "decorator":
            dec_text = _node_text(child, source_bytes).strip()
            decorators.append(dec_text)
    return decorators


def parse_python_ast(file_path: str, source_code: str) -> Dict[str, Any]:
    result = {
        "file_path": file_path,
        "language": "python",
        "package_name": None,
        "class_name": None,
        "class_type": "CLASS",
        "annotations": [],
        "javadoc": None,
        "modifiers": [],
        "start_line": 1,
        "end_line": len(source_code.splitlines()) or 1,
        "methods": [],
        "fields": [],
        "parse_error": None
    }

    try:
        source_bytes = source_code.encode("utf-8")
        with _TS_LOCK:
            tree = _PARSER_PY.parse(source_bytes)
        root = tree.root_node
    except Exception as e:
        result["parse_error"] = f"TreeSitterPythonError: {str(e)}"
        return result

    # Duyệt root node
    top_classes = []
    top_functions = []

    def inspect_py_node(node, current_class=None):
        nonlocal top_classes, top_functions
        decorators = []
        actual_node = node

        if node.type == "decorated_definition":
            decorators = _extract_py_decorators(node, source_bytes)
            for sub in node.children:
                if sub.type in ("class_definition", "function_definition"):
                    actual_node = sub
                    break

        if actual_node.type == "class_definition":
            c_name = ""
            c_body = None
            c_start = actual_node.start_point.row + 1
            c_end = actual_node.end_point.row + 1

            for sub in actual_node.children:
                if sub.type == "identifier":
                    c_name = _node_text(sub, source_bytes).strip()
                elif sub.type == "block":
                    c_body = sub

            doc = _extract_py_docstring(c_body, source_bytes)
            class_item = {
                "class_name": c_name,
                "class_type": "CLASS",
                "annotations": decorators,
                "javadoc": doc,
                "start_line": c_start,
                "end_line": c_end,
                "methods": [],
                "fields": []
            }

            # Duyệt bên trong class
            if c_body:
                for c_child in c_body.children:
                    c_dec = []
                    target = c_child
                    if c_child.type == "decorated_definition":
                        c_dec = _extract_py_decorators(c_child, source_bytes)
                        for s in c_child.children:
                            if s.type in ("function_definition", "class_definition"):
                                target = s
                                break

                    if target.type == "function_definition":
                        m_name = ""
                        params_str = ""
                        ret_type = "None"
                        m_body = None
                        m_start = target.start_point.row + 1
                        m_end = target.end_point.row + 1

                        for s in target.children:
                            if s.type == "identifier":
                                m_name = _node_text(s, source_bytes).strip()
                            elif s.type == "parameters":
                                params_str = _node_text(s, source_bytes).strip("()")
                            elif s.type == "type":
                                ret_type = _node_text(s, source_bytes).strip()
                            elif s.type == "block":
                                m_body = s

                        m_doc = _extract_py_docstring(m_body, source_bytes)
                        is_ctor = m_name == "__init__"
                        sig_dec = f"{' '.join(c_dec)} " if c_dec else ""
                        sig = f"{sig_dec}def {m_name}({params_str}) -> {ret_type}"

                        class_item["methods"].append({
                            "entity_type": "CONSTRUCTOR" if is_ctor else "METHOD",
                            "method_name": m_name,
                            "class_name": c_name,
                            "return_type": None if is_ctor else ret_type,
                            "parameters": [{"name": p.strip(), "type": "Any", "annotations": []} for p in params_str.split(",") if p.strip()],
                            "signature": sig,
                            "annotations": c_dec,
                            "javadoc": m_doc,
                            "start_line": m_start,
                            "end_line": m_end,
                            "doc_status": "DOCUMENTED" if m_doc else "UNDOCUMENTED"
                        })

                    elif target.type == "expression_statement":
                        # Thuộc tính class: field_name: Type = value
                        for s in target.children:
                            if s.type == "assignment":
                                f_text = _node_text(s, source_bytes).strip()
                                parts = f_text.split("=")
                                f_left = parts[0].strip()
                                f_name = f_left.split(":")[0].strip()
                                f_type = f_left.split(":")[1].strip() if ":" in f_left else "Any"
                                class_item["fields"].append({
                                    "entity_type": "FIELD",
                                    "method_name": f_name,
                                    "class_name": c_name,
                                    "return_type": f_type,
                                    "signature": f_text,
                                    "annotations": [],
                                    "javadoc": None,
                                    "start_line": target.start_point.row + 1,
                                    "end_line": target.end_point.row + 1,
                                    "doc_status": "UNDOCUMENTED"
                                })

            top_classes.append(class_item)

        elif actual_node.type == "function_definition":
            # Hàm độc lập (Module Function)
            fn_name = ""
            fn_params = ""
            fn_ret = "None"
            fn_body = None
            fn_start = actual_node.start_point.row + 1
            fn_end = actual_node.end_point.row + 1

            for sub in actual_node.children:
                if sub.type == "identifier":
                    fn_name = _node_text(sub, source_bytes).strip()
                elif sub.type == "parameters":
                    fn_params = _node_text(sub, source_bytes).strip("()")
                elif sub.type == "type":
                    fn_ret = _node_text(sub, source_bytes).strip()
                elif sub.type == "block":
                    fn_body = sub

            fn_doc = _extract_py_docstring(fn_body, source_bytes)
            sig_dec = f"{' '.join(decorators)} " if decorators else ""
            sig = f"{sig_dec}def {fn_name}({fn_params}) -> {fn_ret}"

            top_functions.append({
                "entity_type": "FUNCTION",
                "method_name": fn_name,
                "class_name": None,
                "return_type": fn_ret,
                "parameters": [{"name": p.strip(), "type": "Any", "annotations": []} for p in fn_params.split(",") if p.strip()],
                "signature": sig,
                "annotations": decorators,
                "javadoc": fn_doc,
                "start_line": fn_start,
                "end_line": fn_end,
                "doc_status": "DOCUMENTED" if fn_doc else "UNDOCUMENTED"
            })

    for child in root.children:
        inspect_py_node(child)

    if top_classes:
        primary = top_classes[0]
        result["class_name"] = primary["class_name"]
        result["class_type"] = "CLASS"
        result["annotations"] = primary["annotations"]
        result["javadoc"] = primary["javadoc"]
        result["start_line"] = primary["start_line"]
        result["end_line"] = primary["end_line"]
        result["methods"] = primary["methods"] + top_functions
        result["fields"] = primary["fields"]
    else:
        file_simple = file_path.split("/")[-1].replace(".py", "")
        result["class_name"] = file_simple
        result["class_type"] = "MODULE"
        result["methods"] = top_functions

    return result


# ==============================================================================
# 3. TYPESCRIPT / JAVASCRIPT AST PARSER (Tree-sitter)
# ==============================================================================

def parse_typescript_ast(file_path: str, source_code: str) -> Dict[str, Any]:
    result = {
        "file_path": file_path,
        "language": "typescript",
        "package_name": None,
        "class_name": None,
        "class_type": "CLASS",
        "annotations": [],
        "javadoc": None,
        "modifiers": [],
        "start_line": 1,
        "end_line": len(source_code.splitlines()) or 1,
        "methods": [],
        "fields": [],
        "parse_error": None
    }

    try:
        source_bytes = source_code.encode("utf-8")
        is_tsx = file_path.endswith(".tsx") or file_path.endswith(".jsx")
        with _TS_LOCK:
            tree = (_PARSER_TSX if is_tsx else _PARSER_TS).parse(source_bytes)
        root = tree.root_node
    except Exception as e:
        result["parse_error"] = f"TreeSitterTypeScriptError: {str(e)}"
        return result

    classes = []
    methods = []
    fields = []

    def inspect_ts_node(node):
        nonlocal classes, methods, fields
        target = node

        if node.type == "export_statement":
            for sub in node.children:
                if sub.type in ("class_declaration", "interface_declaration", "type_alias_declaration", "function_declaration", "lexical_declaration"):
                    target = sub
                    break

        if target.type == "class_declaration":
            c_name = ""
            c_body = None
            c_start = target.start_point.row + 1
            c_end = target.end_point.row + 1
            doc = _extract_prev_comment(root, node, source_bytes)

            for sub in target.children:
                if sub.type == "type_identifier":
                    c_name = _node_text(sub, source_bytes).strip()
                elif sub.type == "class_body":
                    c_body = sub

            classes.append({
                "class_name": c_name,
                "class_type": "CLASS",
                "start_line": c_start,
                "end_line": c_end,
                "javadoc": doc
            })

            if c_body:
                for sub in c_body.children:
                    if sub.type in ("method_definition", "public_field_definition"):
                        m_name = ""
                        m_sig = _node_text(sub, source_bytes).split("{")[0].strip()
                        m_doc = _extract_prev_comment(c_body, sub, source_bytes)
                        is_ctor = False

                        for s in sub.children:
                            if s.type == "property_identifier":
                                m_name = _node_text(s, source_bytes).strip()
                            elif s.type == "constructor":
                                is_ctor = True
                                m_name = c_name

                        if sub.type == "public_field_definition":
                            fields.append({
                                "entity_type": "FIELD",
                                "method_name": m_name,
                                "class_name": c_name,
                                "signature": m_sig,
                                "start_line": sub.start_point.row + 1,
                                "end_line": sub.end_point.row + 1,
                                "doc_status": "DOCUMENTED" if m_doc else "UNDOCUMENTED",
                                "javadoc": m_doc
                            })
                        else:
                            methods.append({
                                "entity_type": "CONSTRUCTOR" if is_ctor else "METHOD",
                                "method_name": m_name or "method",
                                "class_name": c_name,
                                "signature": m_sig,
                                "start_line": sub.start_point.row + 1,
                                "end_line": sub.end_point.row + 1,
                                "doc_status": "DOCUMENTED" if m_doc else "UNDOCUMENTED",
                                "javadoc": m_doc
                            })

        elif target.type == "interface_declaration":
            i_name = ""
            for sub in target.children:
                if sub.type == "type_identifier":
                    i_name = _node_text(sub, source_bytes).strip()
            doc = _extract_prev_comment(root, node, source_bytes)
            classes.append({
                "class_name": i_name,
                "class_type": "INTERFACE",
                "start_line": target.start_point.row + 1,
                "end_line": target.end_point.row + 1,
                "javadoc": doc
            })

        elif target.type == "function_declaration":
            f_name = ""
            for sub in target.children:
                if sub.type == "identifier":
                    f_name = _node_text(sub, source_bytes).strip()
            f_sig = _node_text(target, source_bytes).split("{")[0].strip()
            doc = _extract_prev_comment(root, node, source_bytes)
            methods.append({
                "entity_type": "FUNCTION",
                "method_name": f_name,
                "class_name": None,
                "signature": f_sig,
                "start_line": target.start_point.row + 1,
                "end_line": target.end_point.row + 1,
                "doc_status": "DOCUMENTED" if doc else "UNDOCUMENTED",
                "javadoc": doc
            })

    for child in root.children:
        inspect_ts_node(child)

    if classes:
        result["class_name"] = classes[0]["class_name"]
        result["class_type"] = classes[0]["class_type"]
        result["javadoc"] = classes[0]["javadoc"]
        result["start_line"] = classes[0]["start_line"]
        result["end_line"] = classes[0]["end_line"]
    else:
        file_simple = file_path.split("/")[-1].replace(".tsx", "").replace(".ts", "").replace(".js", "")
        result["class_name"] = file_simple
        result["class_type"] = "MODULE"

    result["methods"] = methods
    result["fields"] = fields
    return result


# ==============================================================================
# 4. SQL DDL AST PARSER (Tree-sitter)
# ==============================================================================

def parse_sql_ast(file_path: str, source_code: str) -> Dict[str, Any]:
    result = {
        "file_path": file_path,
        "language": "sql",
        "package_name": None,
        "class_name": file_path.split("/")[-1],
        "class_type": "SCHEMA",
        "annotations": [],
        "javadoc": None,
        "modifiers": [],
        "start_line": 1,
        "end_line": len(source_code.splitlines()) or 1,
        "methods": [],
        "fields": [],
        "parse_error": None
    }

    if _PARSER_SQL is None:
        methods = []
        for idx, stmt in enumerate(source_code.split(";"), start=1):
            stmt_text = stmt.strip()
            if not stmt_text:
                continue
            m_tbl = re.search(r"CREATE\s+(?:OR\s+REPLACE\s+)?(TABLE|VIEW|FUNCTION|PROCEDURE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w\"]+\.)?[\"']?(\w+)[\"']?", stmt_text, re.IGNORECASE)
            if m_tbl:
                kind = m_tbl.group(1).upper()
                name = m_tbl.group(2)
                first_line = stmt_text.splitlines()[0]
                methods.append({
                    "entity_type": kind,
                    "method_name": name,
                    "class_name": result["class_name"],
                    "signature": first_line,
                    "start_line": 1,
                    "end_line": len(stmt_text.splitlines()),
                    "doc_status": "UNDOCUMENTED",
                    "javadoc": f"Đối tượng {kind}: {name}"
                })
        result["methods"] = methods
        return result

    try:
        source_bytes = source_code.encode("utf-8")
        with _TS_LOCK:
            tree = _PARSER_SQL.parse(source_bytes)
        root = tree.root_node
    except Exception as e:
        result["parse_error"] = f"TreeSitterSqlError: {str(e)}"
        return result

    methods = []
    fields = []

    # Duyệt các câu lệnh DDL trong SQL
    for child in root.children:
        if child.type in ("statement", "create_table_statement", "create_view_statement"):
            stmt_text = _node_text(child, source_bytes).strip()
            comment = _extract_prev_comment(root, child, source_bytes)
            start_l = child.start_point.row + 1
            end_l = child.end_point.row + 1

            # Match CREATE TABLE / VIEW / FUNCTION / INDEX
            m_tbl = re.search(r"CREATE\s+(?:OR\s+REPLACE\s+)?(TABLE|VIEW|FUNCTION|PROCEDURE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w\"]+\.)?[\"']?(\w+)[\"']?", stmt_text, re.IGNORECASE)
            if m_tbl:
                kind = m_tbl.group(1).upper()
                name = m_tbl.group(2)
                first_line = stmt_text.splitlines()[0]

                if kind == "TABLE":
                    methods.append({
                        "entity_type": "TABLE",
                        "method_name": name,
                        "class_name": result["class_name"],
                        "signature": first_line,
                        "start_line": start_l,
                        "end_line": end_l,
                        "doc_status": "DOCUMENTED" if comment else "UNDOCUMENTED",
                        "javadoc": comment or f"Bảng CSDL {name}"
                    })
                else:
                    methods.append({
                        "entity_type": kind,
                        "method_name": name,
                        "class_name": result["class_name"],
                        "signature": first_line,
                        "start_line": start_l,
                        "end_line": end_l,
                        "doc_status": "DOCUMENTED" if comment else "UNDOCUMENTED",
                        "javadoc": comment or f"Đối tượng {kind}: {name}"
                    })

    result["methods"] = methods
    return result


# ==============================================================================
# HÀM ĐIỀU PHỐI ĐA NGÔN NGỮ CHÍNH THỨC
# ==============================================================================

def parse_multilingual_ast(file_path: str, source_code: str) -> Dict[str, Any]:
    """
    Điểm vào phân tích AST tự động nhận diện ngôn ngữ dựa trên đuôi file.
    Tương thích 100% với định dạng trả về của Java AST cũ.
    """
    ext = file_path.split(".")[-1].lower() if "." in file_path else ""

    if ext == "java":
        return parse_java_ast(file_path, source_code)
    elif ext == "py":
        return parse_python_ast(file_path, source_code)
    elif ext in ("ts", "tsx", "js", "jsx"):
        return parse_typescript_ast(file_path, source_code)
    elif ext == "sql":
        return parse_sql_ast(file_path, source_code)
    else:
        # Mặc định thử Java nếu không rõ đuôi file
        return parse_java_ast(file_path, source_code)


# Alias duy trì tính tương thích ngược hoàn toàn với code cũ
parse_java_with_treesitter = parse_multilingual_ast
