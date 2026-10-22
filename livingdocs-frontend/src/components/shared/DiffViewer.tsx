import { diffLines } from "diff";

type DiffViewerProps = {
  oldText: string;
  newText: string;
  oldTitle?: string;
  newTitle?: string;
  className?: string;
};

type DiffRow = {
  oldLine?: number;
  newLine?: number;
  oldText?: string;
  newText?: string;
  changed: boolean;
};

function splitLines(value: string) {
  if (!value) return [];
  const lines = value.split(/\r\n|\n|\r/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function createDiffRows(oldText: string, newText: string): DiffRow[] {
  const changes = diffLines(oldText, newText);
  const rows: DiffRow[] = [];
  let oldLine = 1;
  let newLine = 1;
  let index = 0;

  while (index < changes.length) {
    const change = changes[index];

    if (!change.added && !change.removed) {
      for (const line of splitLines(change.value)) {
        rows.push({
          oldLine: oldLine++,
          newLine: newLine++,
          oldText: line,
          newText: line,
          changed: false,
        });
      }
      index += 1;
      continue;
    }

    const removed: string[] = [];
    const added: string[] = [];
    while (
      index < changes.length &&
      (changes[index].added || changes[index].removed)
    ) {
      const changedChunk = changes[index];
      if (changedChunk.removed) removed.push(...splitLines(changedChunk.value));
      if (changedChunk.added) added.push(...splitLines(changedChunk.value));
      index += 1;
    }

    for (let lineIndex = 0; lineIndex < Math.max(removed.length, added.length); lineIndex += 1) {
      const hasOldLine = lineIndex < removed.length;
      const hasNewLine = lineIndex < added.length;
      rows.push({
        oldLine: hasOldLine ? oldLine++ : undefined,
        newLine: hasNewLine ? newLine++ : undefined,
        oldText: removed[lineIndex],
        newText: added[lineIndex],
        changed: true,
      });
    }
  }

  return rows;
}

export function DiffViewer({
  oldText,
  newText,
  oldTitle = "Phiên bản cũ",
  newTitle = "Phiên bản mới",
  className,
}: DiffViewerProps) {
  const rows = createDiffRows(oldText, newText);

  return (
    <section
      aria-label="So sánh thay đổi giữa hai văn bản"
      className={`overflow-hidden rounded-lg border border-border bg-surface ${className ?? ""}`.trim()}
    >
      <div className="grid grid-cols-2 border-b border-border bg-muted text-sm font-semibold text-text-primary">
        <div className="border-r border-border px-4 py-3">{oldTitle}</div>
        <div className="px-4 py-3">{newTitle}</div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-text-secondary">
          Không có nội dung để so sánh.
        </p>
      ) : oldText === newText ? (
        <p className="border-b border-border px-4 py-2 text-xs text-text-secondary">
          Hai văn bản không có khác biệt.
        </p>
      ) : null}
      <div className="overflow-x-auto font-mono text-xs leading-6">
        {rows.map((row, index) => (
          <div
            className="grid min-w-[36rem] grid-cols-2"
            key={`${row.oldLine ?? "-"}-${row.newLine ?? "-"}-${index}`}
          >
            <div
              className={`flex min-w-0 border-r border-border ${
                row.changed && row.oldLine !== undefined
                  ? "bg-red-50 text-red-950"
                  : "text-text-primary"
              }`}
            >
              <span className="w-10 shrink-0 select-none border-r border-border/70 px-2 text-right text-text-disabled">
                {row.oldLine ?? ""}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre px-3">
                {row.oldText ?? ""}
              </span>
            </div>
            <div
              className={`flex min-w-0 ${
                row.changed && row.newLine !== undefined
                  ? "bg-emerald-50 text-emerald-950"
                  : "text-text-primary"
              }`}
            >
              <span className="w-10 shrink-0 select-none border-r border-border/70 px-2 text-right text-text-disabled">
                {row.newLine ?? ""}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre px-3">
                {row.newText ?? ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
