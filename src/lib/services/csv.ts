/**
 * Minimal, dependency-free RFC 4180 CSV parser/writer. Hand-written
 * rather than pulling in a parsing library — this repo already hand-rolls
 * small, self-contained binary/text formats when the alternative is a new
 * dependency for a narrow need (see scripts/build-favicon-ico.mjs), and a
 * CSV parser has no need for a library's full feature surface here. Never
 * evaluates cell content — it only ever produces strings, so there is no
 * code-execution surface from a malicious file, unlike a "smart" CSV
 * library that might try to infer types.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM if present — common from Excel-exported CSVs.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }

  return rows;
}

/**
 * Neutralizes formula-triggering prefixes (=, +, -, @, tab, CR) before
 * ProcessPilot writes a cell into a CSV it generates (e.g. the import
 * error report) — the standard CSV-injection mitigation, since a
 * spreadsheet application treats a cell starting with one of these as a
 * formula to evaluate when the file is opened.
 */
export function sanitizeCsvCell(value: string): string {
  const needsEscaping = /^[=+\-@\t\r]/.test(value);
  const escaped = needsEscaping ? `'${value}` : value;
  return /[",\n\r]/.test(escaped) ? `"${escaped.replace(/"/g, '""')}"` : escaped;
}

export function writeCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(sanitizeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(sanitizeCsvCell).join(","));
  }
  return lines.join("\r\n");
}
