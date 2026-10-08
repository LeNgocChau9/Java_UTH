"""
java_ast_parser.py
Module bóc tách cấu trúc mã nguồn Java bằng thư viện javalang.
Trích xuất: Package, Class, Annotations, Methods (tên, kiểu trả về, tham số, dòng bắt đầu/kết thúc).
TV4 — LivingDocs AI Engine — S1-11
"""

import javalang
from typing import Any


def _get_annotations(node) -> list[str]:
    """Lấy danh sách annotation của một class hoặc method."""
    annotations = []
    if hasattr(node, "annotations") and node.annotations:
        for ann in node.annotations:
            name = f"@{ann.name}"
            # Lấy các tham số annotation nếu có (vd: @RequestMapping("/orders"))
            if hasattr(ann, "element") and ann.element is not None:
                element = ann.element
                if hasattr(element, "value"):
                    name += f'("{element.value}")'
                elif isinstance(element, str):
                    name += f'("{element}")'
            annotations.append(name)
    return annotations


def _get_parameters(method_node) -> list[dict[str, str]]:
    """Bóc tách danh sách tham số của method."""
    params = []
    if hasattr(method_node, "parameters") and method_node.parameters:
        for param in method_node.parameters:
            # Xử lý kiểu dữ liệu phức tạp (vd: List<String>, Optional<User>)
            if hasattr(param.type, "name"):
                type_name = param.type.name
                # Thêm generic type nếu có (vd: List<String>)
                if hasattr(param.type, "arguments") and param.type.arguments:
                    type_args = []
                    for arg in param.type.arguments:
                        if hasattr(arg, "type") and arg.type and hasattr(arg.type, "name"):
                            type_args.append(arg.type.name)
                    if type_args:
                        type_name += f"<{', '.join(type_args)}>"
                # Mảng
                if param.type.dimensions:
                    type_name += "[]" * len(param.type.dimensions)
            else:
                type_name = str(param.type)

            params.append({
                "name": param.name,
                "type": type_name
            })
    return params


def _build_signature(method_node, class_name: str) -> str:
    """Xây dựng chuỗi chữ ký đầy đủ của method."""
    modifiers = " ".join(sorted(method_node.modifiers)) if method_node.modifiers else "public"
    return_type = method_node.return_type.name if method_node.return_type else "void"
    params = _get_parameters(method_node)
    params_str = ", ".join([f"{p['type']} {p['name']}" for p in params])
    return f"{modifiers} {return_type} {method_node.name}({params_str})"


def _estimate_end_line(method_node, source_lines: list[str]) -> int:
    """
    Ước tính dòng kết thúc của method bằng cách đếm cặp dấu ngoặc nhọn
    bắt đầu từ start_line.
    """
    if not hasattr(method_node, "position") or method_node.position is None:
        return -1
    start = method_node.position.line - 1  # 0-indexed
    depth = 0
    for i in range(start, len(source_lines)):
        line = source_lines[i]
        depth += line.count("{") - line.count("}")
        if depth > 0 and i > start:
            continue
        if depth <= 0 and i >= start:
            # Tìm được ngoặc đóng khớp đầu tiên
            if "{" in source_lines[start:i+1] or depth < 0:
                return i + 1  # 1-indexed
    return len(source_lines)


def parse_java_file(file_path: str, file_content: str) -> dict[str, Any]:
    """
    Phân tích cú pháp một file Java và trả về cấu trúc JSON gồm:
    - package_name: Tên package
    - class_name: Tên class
    - class_type: Loại (CLASS, INTERFACE, ENUM)
    - annotations: Danh sách annotation của class
    - modifiers: Các modifier của class (public, abstract...)
    - methods: Danh sách các method được bóc tách chi tiết
    - parse_error: Thông báo lỗi nếu không parse được
    """
    result = {
        "file_path": file_path,
        "package_name": None,
        "class_name": None,
        "class_type": "CLASS",
        "annotations": [],
        "modifiers": [],
        "methods": [],
        "parse_error": None
    }

    source_lines = file_content.splitlines()

    try:
        tree = javalang.parse.parse(file_content)
    except javalang.parser.JavaSyntaxError as e:
        result["parse_error"] = f"JavaSyntaxError: {str(e)}"
        return result
    except Exception as e:
        result["parse_error"] = f"ParseError: {str(e)}"
        return result

    # Package
    if tree.package:
        result["package_name"] = tree.package.name

    # Lấy class/interface/enum đầu tiên trong file
    type_declarations = list(tree.types)
    if not type_declarations:
        result["parse_error"] = "Không tìm thấy class/interface nào trong file."
        return result

    primary_type = type_declarations[0]

    # Xác định loại type
    if isinstance(primary_type, javalang.tree.ClassDeclaration):
        result["class_type"] = "CLASS"
    elif isinstance(primary_type, javalang.tree.InterfaceDeclaration):
        result["class_type"] = "INTERFACE"
    elif isinstance(primary_type, javalang.tree.EnumDeclaration):
        result["class_type"] = "ENUM"

    result["class_name"] = primary_type.name
    result["annotations"] = _get_annotations(primary_type)
    result["modifiers"] = list(primary_type.modifiers) if primary_type.modifiers else []

    # Bóc tách các method
    methods = []
    for _, method_node in tree.filter(javalang.tree.MethodDeclaration):
        start_line = method_node.position.line if method_node.position else -1
        end_line = _estimate_end_line(method_node, source_lines)

        return_type = "void"
        if method_node.return_type:
            return_type = method_node.return_type.name
            if hasattr(method_node.return_type, "arguments") and method_node.return_type.arguments:
                type_args = []
                for arg in method_node.return_type.arguments:
                    if hasattr(arg, "type") and arg.type and hasattr(arg.type, "name"):
                        type_args.append(arg.type.name)
                if type_args:
                    return_type += f"<{', '.join(type_args)}>"

        params = _get_parameters(method_node)

        method_entry = {
            "entity_type": "METHOD",
            "method_name": method_node.name,
            "class_name": result["class_name"],
            "return_type": return_type,
            "parameters": params,
            "signature": _build_signature(method_node, result["class_name"]),
            "annotations": _get_annotations(method_node),
            "modifiers": list(method_node.modifiers) if method_node.modifiers else [],
            "start_line": start_line,
            "end_line": end_line,
            "doc_status": "UNDOCUMENTED"
        }
        methods.append(method_entry)

    # Bóc tách constructor
    for _, ctor_node in tree.filter(javalang.tree.ConstructorDeclaration):
        start_line = ctor_node.position.line if ctor_node.position else -1
        end_line = _estimate_end_line(ctor_node, source_lines)
        params = _get_parameters(ctor_node)
        params_str = ", ".join([f"{p['type']} {p['name']}" for p in params])
        methods.append({
            "entity_type": "CONSTRUCTOR",
            "method_name": ctor_node.name,
            "class_name": result["class_name"],
            "return_type": None,
            "parameters": params,
            "signature": f"public {ctor_node.name}({params_str})",
            "annotations": _get_annotations(ctor_node),
            "modifiers": list(ctor_node.modifiers) if ctor_node.modifiers else [],
            "start_line": start_line,
            "end_line": end_line,
            "doc_status": "UNDOCUMENTED"
        })

    result["methods"] = methods
    return result
