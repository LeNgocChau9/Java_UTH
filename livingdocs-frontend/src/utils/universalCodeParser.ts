import { CodeEntityDto } from "@/services/codeEntityService";

/**
 * Bộ trích xuất và phân tích phần tử mã nguồn phổ quát (Universal Multi-language AST Parser)
 * Hỗ trợ bóc tách đầy đủ Class, Interface, Method, Constructor, Field (thuộc tính), Annotation
 */
export function parseUniversalCodeEntities(
  filePath: string,
  content: string,
  repositoryId: number = 1
): CodeEntityDto[] {
  if (!content || !content.trim()) return [];

  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const lines = content.split("\n");

  switch (ext) {
    case "java":
      return parseJavaEntities(filePath, lines, repositoryId);
    case "py":
      return parsePythonEntities(filePath, lines, repositoryId);
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return parseJsTsEntities(filePath, lines, repositoryId);
    case "sql":
      return parseSqlEntities(filePath, lines, repositoryId);
    case "yml":
    case "yaml":
      return parseYamlEntities(filePath, lines, repositoryId);
    case "json":
      return parseJsonEntities(filePath, lines, repositoryId);
    case "env":
    case "example":
      return parseEnvEntities(filePath, lines, repositoryId);
    case "md":
      return parseMarkdownEntities(filePath, lines, repositoryId);
    default:
      return parseGenericEntities(filePath, lines, repositoryId);
  }
}

// 1. JAVA PARSER (Hỗ trợ Class, Method, Constructor và Fields / Thuộc tính DTO)
function parseJavaEntities(filePath: string, lines: string[], repositoryId: number): CodeEntityDto[] {
  const entities: CodeEntityDto[] = [];
  let currentClass = "";
  let pendingDoc = "";
  let pendingAnnotations: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const lineNum = i + 1;

    // Comments / Javadoc
    if (line.startsWith("/**") || line.startsWith("*") || line.startsWith("//")) {
      const cleaned = line.replace(/^\/\*\*|\*\/|\*|\/\//g, "").trim();
      if (cleaned) pendingDoc += (pendingDoc ? "\n" : "") + cleaned;
      continue;
    }

    // Annotations (e.g. @Data, @Getter, @Schema, @NotBlank)
    if (line.startsWith("@")) {
      pendingAnnotations.push(line);
      continue;
    }

    // 1. Class / Interface / Enum / Record
    const classMatch = line.match(/(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(class|interface|enum|record)\s+([A-Za-z0-9_]+)/);
    if (classMatch) {
      const type = classMatch[1].toUpperCase();
      const name = classMatch[2];
      currentClass = name;
      const annText = pendingAnnotations.length > 0 ? pendingAnnotations.join(" ") + " " : "";
      entities.push({
        repositoryId,
        filePath,
        entityType: type as any,
        className: name,
        signature: `${annText}${line.replace(/\{$/, "").trim()}`,
        startLine: lineNum,
        endLine: Math.min(lineNum + 40, lines.length),
        docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingDoc || (pendingAnnotations.length > 0 ? `Annotations: ${pendingAnnotations.join(", ")}` : undefined),
      });
      pendingDoc = "";
      pendingAnnotations = [];
      continue;
    }

    // 2. Method / Constructor
    const methodMatch = line.match(/(?:public|protected|private|static|final|synchronized|abstract|\s)*\s+([\w<>\[\],\s]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*[{;]?/);
    if (methodMatch && !line.includes("new ") && !line.startsWith("return") && !line.startsWith("if") && !line.startsWith("for") && !line.startsWith("while")) {
      const retType = methodMatch[1].trim();
      const methodName = methodMatch[2];
      const params = methodMatch[3].trim();
      const isCtor = currentClass && methodName === currentClass;

      if (!["if", "for", "while", "switch", "catch"].includes(methodName)) {
        entities.push({
          repositoryId,
          filePath,
          entityType: isCtor ? "CONSTRUCTOR" : "METHOD",
          className: currentClass || undefined,
          methodName,
          signature: line.replace(/\{$/, "").trim(),
          returnType: isCtor ? undefined : retType,
          parameters: params || undefined,
          startLine: lineNum,
          endLine: Math.min(lineNum + 15, lines.length),
          docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
          javadoc: pendingDoc || (pendingAnnotations.length > 0 ? pendingAnnotations.join(" ") : undefined),
        });
        pendingDoc = "";
        pendingAnnotations = [];
        continue;
      }
    }

    // 3. Field / Thuộc tính DTO (private String email; private Long id;)
    const fieldMatch = line.match(/(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?([\w<>\[\]]+)\s+([A-Za-z0-9_]+)\s*(?:=[^;]+)?\s*;/);
    if (fieldMatch && currentClass && !line.startsWith("return") && !line.startsWith("import") && !line.startsWith("package")) {
      const fieldType = fieldMatch[1];
      const fieldName = fieldMatch[2];

      if (!["class", "interface", "enum", "record", "void"].includes(fieldType)) {
        entities.push({
          repositoryId,
          filePath,
          entityType: "FIELD" as any,
          className: currentClass,
          methodName: fieldName,
          signature: line.replace(/;$/, "").trim(),
          returnType: fieldType,
          startLine: lineNum,
          endLine: lineNum,
          docStatus: pendingDoc || pendingAnnotations.length > 0 ? "DOCUMENTED" : "UNDOCUMENTED",
          javadoc: pendingDoc || (pendingAnnotations.length > 0 ? `Ràng buộc & Chú thích: ${pendingAnnotations.join(" | ")}` : `Thuộc tính ${fieldName} kiểu ${fieldType}`),
        });
        pendingDoc = "";
        pendingAnnotations = [];
        continue;
      }
    }

    if (line.length > 0 && !line.startsWith("@")) {
      pendingDoc = "";
      pendingAnnotations = [];
    }
  }

  return entities;
}

// 2. PYTHON PARSER
function parsePythonEntities(filePath: string, lines: string[], repositoryId: number): CodeEntityDto[] {
  const entities: CodeEntityDto[] = [];
  let currentClass = "";
  let pendingDoc = "";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const lineNum = i + 1;

    // Docstring
    if (line.startsWith('"""') || line.startsWith("'''") || line.startsWith("#")) {
      const cleaned = line.replace(/^"""|'''|#|"""$|'''$/g, "").trim();
      if (cleaned) pendingDoc += (pendingDoc ? "\n" : "") + cleaned;
      continue;
    }

    // Python Class
    const classMatch = line.match(/^class\s+([A-Za-z0-9_]+)(?:\(([^)]*)\))?:/);
    if (classMatch) {
      currentClass = classMatch[1];
      entities.push({
        repositoryId,
        filePath,
        entityType: "CLASS",
        className: currentClass,
        signature: line.replace(/:$/, "").trim(),
        startLine: lineNum,
        endLine: Math.min(lineNum + 35, lines.length),
        docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingDoc || undefined,
      });
      pendingDoc = "";
      continue;
    }

    // Python Function / Method (sync & async)
    const funcMatch = line.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const params = funcMatch[2].trim();
      const returnType = funcMatch[3]?.trim();
      const isMethod = rawLine.startsWith("    ") || rawLine.startsWith("\t");

      let methodDoc = pendingDoc;
      if (!methodDoc && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
          methodDoc = nextLine.replace(/^"""|'''|"""$|'''$/g, "").trim();
        }
      }

      entities.push({
        repositoryId,
        filePath,
        entityType: isMethod ? "METHOD" : "FUNCTION",
        className: isMethod ? currentClass : undefined,
        methodName: funcName,
        signature: line.replace(/:$/, "").trim(),
        returnType: returnType || "None",
        parameters: params || undefined,
        startLine: lineNum,
        endLine: Math.min(lineNum + 20, lines.length),
        docStatus: methodDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: methodDoc || undefined,
      });
      pendingDoc = "";
      continue;
    }

    // Python class field (variable: type = val)
    const pyFieldMatch = rawLine.match(/^(?:    |\t)([A-Za-z0-9_]+)\s*:\s*([^=\n]+)(?:\s*=.*)?$/);
    if (pyFieldMatch && currentClass) {
      const fieldName = pyFieldMatch[1];
      const fieldType = pyFieldMatch[2].trim();
      entities.push({
        repositoryId,
        filePath,
        entityType: "FIELD" as any,
        className: currentClass,
        methodName: fieldName,
        signature: line,
        returnType: fieldType,
        startLine: lineNum,
        endLine: lineNum,
        docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingDoc || `Thuộc tính ${fieldName} kiểu ${fieldType}`,
      });
      pendingDoc = "";
      continue;
    }

    if (line.length > 0 && !line.startsWith("@")) {
      pendingDoc = "";
    }
  }

  return entities;
}

// 3. TYPESCRIPT / JAVASCRIPT PARSER
function parseJsTsEntities(filePath: string, lines: string[], repositoryId: number): CodeEntityDto[] {
  const entities: CodeEntityDto[] = [];
  let currentClass = "";
  let pendingDoc = "";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const lineNum = i + 1;

    if (line.startsWith("/**") || line.startsWith("*") || line.startsWith("//")) {
      const cleaned = line.replace(/^\/\*\*|\*\/|\*|\/\//g, "").trim();
      if (cleaned) pendingDoc += (pendingDoc ? "\n" : "") + cleaned;
      continue;
    }

    // Interface / Type
    const typeMatch = line.match(/^(?:export\s+)?(interface|type)\s+([A-Za-z0-9_]+)/);
    if (typeMatch) {
      entities.push({
        repositoryId,
        filePath,
        entityType: typeMatch[1].toUpperCase() as any,
        className: typeMatch[2],
        signature: line.replace(/\{$/, "").trim(),
        startLine: lineNum,
        endLine: Math.min(lineNum + 20, lines.length),
        docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingDoc || undefined,
      });
      pendingDoc = "";
      continue;
    }

    // Class
    const classMatch = line.match(/^(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_]+)/);
    if (classMatch) {
      currentClass = classMatch[1];
      entities.push({
        repositoryId,
        filePath,
        entityType: "CLASS",
        className: currentClass,
        signature: line.replace(/\{$/, "").trim(),
        startLine: lineNum,
        endLine: Math.min(lineNum + 50, lines.length),
        docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingDoc || undefined,
      });
      pendingDoc = "";
      continue;
    }

    // Function Declaration
    const funcMatch = line.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
    if (funcMatch) {
      entities.push({
        repositoryId,
        filePath,
        entityType: "FUNCTION",
        className: currentClass || undefined,
        methodName: funcMatch[1],
        signature: line.replace(/\{$/, "").trim(),
        parameters: funcMatch[2].trim() || undefined,
        startLine: lineNum,
        endLine: Math.min(lineNum + 25, lines.length),
        docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingDoc || undefined,
      });
      pendingDoc = "";
      continue;
    }

    // Const Arrow Function
    const arrowMatch = line.match(/^(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=>]+)?\s*=>/);
    if (arrowMatch) {
      entities.push({
        repositoryId,
        filePath,
        entityType: "METHOD",
        methodName: arrowMatch[1],
        signature: line.replace(/\{$/, "").trim(),
        parameters: arrowMatch[2].trim() || undefined,
        startLine: lineNum,
        endLine: Math.min(lineNum + 20, lines.length),
        docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingDoc || undefined,
      });
      pendingDoc = "";
      continue;
    }

    if (line.length > 0) pendingDoc = "";
  }

  return entities;
}

// 4. SQL PARSER
function parseSqlEntities(filePath: string, lines: string[], repositoryId: number): CodeEntityDto[] {
  const entities: CodeEntityDto[] = [];
  let pendingComment = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (line.startsWith("--") || line.startsWith("/*") || line.startsWith("*")) {
      const c = line.replace(/^--|\/\*|\*\/|\*/g, "").trim();
      if (c) pendingComment += (pendingComment ? " " : "") + c;
      continue;
    }

    const tableMatch = line.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?(TABLE|VIEW|FUNCTION|PROCEDURE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?["']?([\w]+)["']?/i);
    if (tableMatch) {
      const type = tableMatch[1].toUpperCase();
      const name = tableMatch[2];
      entities.push({
        repositoryId,
        filePath,
        entityType: type === "TABLE" ? "CLASS" : "METHOD",
        className: type === "TABLE" ? name : undefined,
        methodName: type !== "TABLE" ? name : undefined,
        signature: line.replace(/;$/, "").trim(),
        startLine: lineNum,
        endLine: Math.min(lineNum + 30, lines.length),
        docStatus: pendingComment ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingComment ? `[SQL ${type}] ${pendingComment}` : `Định nghĩa ${type} trong cơ sở dữ liệu: ${name}`,
      });
      pendingComment = "";
    } else if (line.length > 0) {
      pendingComment = "";
    }
  }

  return entities;
}

// 5. YAML PARSER
function parseYamlEntities(filePath: string, lines: string[], repositoryId: number): CodeEntityDto[] {
  const entities: CodeEntityDto[] = [];
  let currentTop = "";
  let pendingDoc = "";

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const lineNum = i + 1;

    if (line.startsWith("#")) {
      const c = line.replace(/^#+/, "").trim();
      if (c) pendingDoc += (pendingDoc ? " " : "") + c;
      continue;
    }

    const rootKeyMatch = raw.match(/^([A-Za-z0-9_-]+):\s*$/);
    if (rootKeyMatch) {
      currentTop = rootKeyMatch[1];
      entities.push({
        repositoryId,
        filePath,
        entityType: "CLASS",
        className: currentTop,
        signature: `${currentTop}: [Root Section]`,
        startLine: lineNum,
        endLine: Math.min(lineNum + 20, lines.length),
        docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingDoc ? `Cấu hình ${currentTop}: ${pendingDoc}` : `Khối cấu hình gốc ${currentTop}`,
      });
      pendingDoc = "";
      continue;
    }

    const subMatch = raw.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (subMatch) {
      const subKey = subMatch[1];
      entities.push({
        repositoryId,
        filePath,
        entityType: "METHOD",
        className: currentTop || undefined,
        methodName: subKey,
        signature: `${currentTop ? currentTop + "." : ""}${subKey}`,
        startLine: lineNum,
        endLine: Math.min(lineNum + 15, lines.length),
        docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingDoc ? `Chi tiết ${subKey}: ${pendingDoc}` : `Dịch vụ / mục cấu hình: ${subKey}`,
      });
      pendingDoc = "";
      continue;
    }

    if (line.length > 0) pendingDoc = "";
  }

  return entities;
}

// 6. JSON PARSER
function parseJsonEntities(filePath: string, lines: string[], repositoryId: number): CodeEntityDto[] {
  try {
    const obj = JSON.parse(lines.join("\n"));
    const entities: CodeEntityDto[] = [];
    Object.keys(obj).forEach((key, idx) => {
      const val = obj[key];
      const isObj = typeof val === "object" && val !== null;
      entities.push({
        repositoryId,
        filePath,
        entityType: isObj ? "CLASS" : "METHOD",
        className: isObj ? key : undefined,
        methodName: !isObj ? key : undefined,
        signature: `"${key}": ${isObj ? (Array.isArray(val) ? "Array" : "Object") : typeof val}`,
        startLine: idx + 2,
        endLine: idx + 10,
        docStatus: "DOCUMENTED",
        javadoc: `Thuộc tính JSON: ${key} (${typeof val})`,
      });
    });
    return entities;
  } catch {
    return [];
  }
}

// 7. ENV PARSER
function parseEnvEntities(filePath: string, lines: string[], repositoryId: number): CodeEntityDto[] {
  const entities: CodeEntityDto[] = [];
  let pendingDoc = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (line.startsWith("#")) {
      const c = line.replace(/^#+/, "").trim();
      if (c) pendingDoc += (pendingDoc ? " " : "") + c;
      continue;
    }

    const envMatch = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (envMatch) {
      const key = envMatch[1];
      const val = envMatch[2];
      entities.push({
        repositoryId,
        filePath,
        entityType: "METHOD",
        methodName: key,
        signature: `${key}=${val ? "***" : ""}`,
        startLine: lineNum,
        endLine: lineNum,
        docStatus: pendingDoc ? "DOCUMENTED" : "UNDOCUMENTED",
        javadoc: pendingDoc ? `Biến môi trường ${key}: ${pendingDoc}` : `Biến môi trường: ${key}`,
      });
      pendingDoc = "";
    } else if (line.length > 0) {
      pendingDoc = "";
    }
  }

  return entities;
}

// 8. MARKDOWN PARSER
function parseMarkdownEntities(filePath: string, lines: string[], repositoryId: number): CodeEntityDto[] {
  const entities: CodeEntityDto[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;
    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const title = hMatch[2];
      entities.push({
        repositoryId,
        filePath,
        entityType: level === 1 ? "CLASS" : "METHOD",
        className: level === 1 ? title : undefined,
        methodName: level > 1 ? title : undefined,
        signature: line,
        startLine: lineNum,
        endLine: Math.min(lineNum + 20, lines.length),
        docStatus: "DOCUMENTED",
        javadoc: `Tiêu đề cấp ${level} trong tài liệu: ${title}`,
      });
    }
  }
  return entities;
}

// 9. GENERIC / FALLBACK
function parseGenericEntities(filePath: string, lines: string[], repositoryId: number): CodeEntityDto[] {
  const fileName = filePath.split("/").pop() || "File";
  return [
    {
      repositoryId,
      filePath,
      entityType: "CLASS",
      className: fileName,
      signature: fileName,
      startLine: 1,
      endLine: lines.length || 1,
      docStatus: "DOCUMENTED",
      javadoc: `Tập tin trong kho lưu trữ: ${filePath} (${lines.length} dòng)`,
    },
  ];
}
