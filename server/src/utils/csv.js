export function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows) {
  if (rows.length === 0) return '\uFEFF';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(','));
  }
  return '\uFEFF' + lines.join('\n');
}