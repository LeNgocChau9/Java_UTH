import { diffLines, diffWordsWithSpace, Change } from "diff";

export type DiffLineType = "unchanged" | "added" | "removed" | "modified" | "empty";

export interface WordToken {
  text: string;
  type: "added" | "removed" | "unchanged";
}

export interface DiffCell {
  lineNum?: number;
  content: string;
  type: DiffLineType;
  wordTokens?: WordToken[];
}

export interface SideBySideRow {
  id: string;
  rowType: "unchanged" | "added" | "removed" | "modified";
  left: DiffCell;
  right: DiffCell;
  chunkIndex?: number;
}

export interface InlineDiffRow {
  id: string;
  type: "unchanged" | "added" | "removed";
  oldLineNum?: number;
  newLineNum?: number;
  content: string;
  chunkIndex?: number;
  wordTokens?: WordToken[];
}

export interface DiffSummary {
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  modifiedCount: number;
  totalChunks: number;
  isIdentical: boolean;
}

export interface DiffResult {
  sideBySideRows: SideBySideRow[];
  inlineRows: InlineDiffRow[];
  summary: DiffSummary;
  chunkRowIndices: {
    sideBySide: number[];
    inline: number[];
  };
}

/**
 * Tách một chuỗi thành danh sách dòng, xử lý an toàn \r\n và dòng kết thúc
 */
function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  // Nếu dòng cuối cùng là rỗng do ký tự newline ở cuối chuỗi, ta giữ lại hoặc loại bỏ tùy ngữ cảnh
  if (lines.length > 0 && lines[lines.length - 1] === "" && text.endsWith("\n")) {
    lines.pop();
  }
  return lines;
}

/**
 * Tính toán chênh lệch từng từ trong một dòng được sửa đổi (intra-line diff)
 */
function computeWordDiff(oldLine: string, newLine: string) {
  const words = diffWordsWithSpace(oldLine, newLine);
  const leftTokens: WordToken[] = [];
  const rightTokens: WordToken[] = [];

  for (const w of words) {
    if (w.removed) {
      leftTokens.push({ text: w.value, type: "removed" });
    } else if (w.added) {
      rightTokens.push({ text: w.value, type: "added" });
    } else {
      leftTokens.push({ text: w.value, type: "unchanged" });
      rightTokens.push({ text: w.value, type: "unchanged" });
    }
  }

  return { leftTokens, rightTokens };
}

/**
 * Tính toán diff song song (Side-by-Side) và hợp nhất (Inline) giữa 2 chuỗi nội dung văn bản
 */
export function computeDocumentDiff(oldText: string, newText: string): DiffResult {
  const oldContent = oldText ?? "";
  const newContent = newText ?? "";

  // Trường hợp 2 nội dung giống hệt nhau
  if (oldContent === newContent) {
    const rawLines = splitLines(oldContent);
    const sideBySideRows: SideBySideRow[] = rawLines.map((line, idx) => ({
      id: `sbs-eq-${idx}`,
      rowType: "unchanged",
      left: { lineNum: idx + 1, content: line, type: "unchanged" },
      right: { lineNum: idx + 1, content: line, type: "unchanged" },
    }));

    const inlineRows: InlineDiffRow[] = rawLines.map((line, idx) => ({
      id: `inl-eq-${idx}`,
      type: "unchanged",
      oldLineNum: idx + 1,
      newLineNum: idx + 1,
      content: line,
    }));

    return {
      sideBySideRows,
      inlineRows,
      summary: {
        addedCount: 0,
        removedCount: 0,
        unchangedCount: rawLines.length,
        modifiedCount: 0,
        totalChunks: 0,
        isIdentical: true,
      },
      chunkRowIndices: { sideBySide: [], inline: [] },
    };
  }

  const changes: Change[] = diffLines(oldContent, newContent);

  const sideBySideRows: SideBySideRow[] = [];
  const inlineRows: InlineDiffRow[] = [];
  const sbsChunkIndices: number[] = [];
  const inlineChunkIndices: number[] = [];

  let oldLineNum = 1;
  let newLineNum = 1;
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;
  let modifiedCount = 0;
  let currentChunk = 0;

  let i = 0;
  while (i < changes.length) {
    const change = changes[i];

    if (!change.added && !change.removed) {
      // Khối không thay đổi
      const lines = splitLines(change.value);
      for (const line of lines) {
        sideBySideRows.push({
          id: `sbs-u-${oldLineNum}-${newLineNum}`,
          rowType: "unchanged",
          left: { lineNum: oldLineNum, content: line, type: "unchanged" },
          right: { lineNum: newLineNum, content: line, type: "unchanged" },
        });

        inlineRows.push({
          id: `inl-u-${oldLineNum}-${newLineNum}`,
          type: "unchanged",
          oldLineNum,
          newLineNum,
          content: line,
        });

        oldLineNum++;
        newLineNum++;
        unchangedCount++;
      }
      i++;
    } else {
      // Bắt đầu một khối chênh lệch (Diff Chunk)
      currentChunk++;
      const sbsChunkStart = sideBySideRows.length;
      const inlineChunkStart = inlineRows.length;
      sbsChunkIndices.push(sbsChunkStart);
      inlineChunkIndices.push(inlineChunkStart);

      // Gom nhóm removed và added đi liền nhau
      let removedLines: string[] = [];
      let addedLines: string[] = [];

      if (change.removed) {
        removedLines = splitLines(change.value);
        if (i + 1 < changes.length && changes[i + 1].added) {
          addedLines = splitLines(changes[i + 1].value);
          i += 2;
        } else {
          i += 1;
        }
      } else if (change.added) {
        addedLines = splitLines(change.value);
        i += 1;
      }

      addedCount += addedLines.length;
      removedCount += removedLines.length;

      // Xây dựng side-by-side rows
      const maxRows = Math.max(removedLines.length, addedLines.length);
      for (let r = 0; r < maxRows; r++) {
        const hasLeft = r < removedLines.length;
        const hasRight = r < addedLines.length;

        if (hasLeft && hasRight) {
          // Cả hai bên đều có dòng => Modified (Sửa đổi)
          modifiedCount++;
          const leftLineText = removedLines[r];
          const rightLineText = addedLines[r];
          const { leftTokens, rightTokens } = computeWordDiff(leftLineText, rightLineText);

          sideBySideRows.push({
            id: `sbs-mod-${oldLineNum}-${newLineNum}`,
            rowType: "modified",
            chunkIndex: currentChunk,
            left: {
              lineNum: oldLineNum,
              content: leftLineText,
              type: "removed",
              wordTokens: leftTokens,
            },
            right: {
              lineNum: newLineNum,
              content: rightLineText,
              type: "added",
              wordTokens: rightTokens,
            },
          });
          oldLineNum++;
          newLineNum++;
        } else if (hasLeft) {
          // Chỉ có bên trái => Xóa dòng
          const leftLineText = removedLines[r];
          sideBySideRows.push({
            id: `sbs-rem-${oldLineNum}-${r}`,
            rowType: "removed",
            chunkIndex: currentChunk,
            left: {
              lineNum: oldLineNum,
              content: leftLineText,
              type: "removed",
            },
            right: {
              content: "",
              type: "empty",
            },
          });
          oldLineNum++;
        } else {
          // Chỉ có bên phải => Thêm dòng mới
          const rightLineText = addedLines[r];
          sideBySideRows.push({
            id: `sbs-add-${newLineNum}-${r}`,
            rowType: "added",
            chunkIndex: currentChunk,
            left: {
              content: "",
              type: "empty",
            },
            right: {
              lineNum: newLineNum,
              content: rightLineText,
              type: "added",
            },
          });
          newLineNum++;
        }
      }

      // Xây dựng inline rows (khối xóa trước, khối thêm sau)
      // Nếu là sửa đổi 1 dòng vs 1 dòng, ta có thể gắn wordTokens để xem rõ từ được đổi
      const isOneToOne = removedLines.length === 1 && addedLines.length === 1;
      let singleWordDiff: { leftTokens: WordToken[]; rightTokens: WordToken[] } | null = null;
      if (isOneToOne) {
        singleWordDiff = computeWordDiff(removedLines[0], addedLines[0]);
      }

      let curOld = oldLineNum - removedLines.length;
      for (let r = 0; r < removedLines.length; r++) {
        inlineRows.push({
          id: `inl-rem-${curOld}`,
          type: "removed",
          oldLineNum: curOld,
          content: removedLines[r],
          chunkIndex: currentChunk,
          wordTokens: isOneToOne && singleWordDiff ? singleWordDiff.leftTokens : undefined,
        });
        curOld++;
      }

      let curNew = newLineNum - addedLines.length;
      for (let r = 0; r < addedLines.length; r++) {
        inlineRows.push({
          id: `inl-add-${curNew}`,
          type: "added",
          newLineNum: curNew,
          content: addedLines[r],
          chunkIndex: currentChunk,
          wordTokens: isOneToOne && singleWordDiff ? singleWordDiff.rightTokens : undefined,
        });
        curNew++;
      }
    }
  }

  return {
    sideBySideRows,
    inlineRows,
    summary: {
      addedCount,
      removedCount,
      unchangedCount,
      modifiedCount,
      totalChunks: currentChunk,
      isIdentical: addedCount === 0 && removedCount === 0,
    },
    chunkRowIndices: {
      sideBySide: sbsChunkIndices,
      inline: inlineChunkIndices,
    },
  };
}
