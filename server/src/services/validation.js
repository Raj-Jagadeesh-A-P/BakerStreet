export function normalize(value, flags) {
  let s = String(value ?? '');
  if (flags?.normalize !== false) {
    s = s.trim().replace(/\s+/g, '');
  }
  if (flags?.caseInsensitive !== false) s = s.toLowerCase();
  return s;
}

export function sanitizeAnswer(caseRow, answer) {
  let s = String(answer ?? '').trim();
  if (caseRow.type === 'NUMBER') s = s.replace(/[^0-9.-]/g, '');
  if (caseRow.type === 'COMMIT_SHA') s = s.toLowerCase();
  return s;
}

export function isAnswerCorrect(caseRow, acceptedValues, answer) {
  const raw = String(answer ?? '');

  if (caseRow.regex) {
    const flags = caseRow.caseInsensitive === false ? '' : 'i';
    try {
      return new RegExp(caseRow.regex, flags).test(raw);
    } catch {
      return false;
    }
  }

  if (caseRow.type === 'MULTIPLE_CHOICE' && Array.isArray(caseRow.options?.options)) {
    const opts = caseRow.options.options.map((o) => normalize(o, caseRow));
    return opts.includes(normalize(raw, caseRow));
  }

  const target = normalize(raw, caseRow);
  return acceptedValues.some((v) => normalize(v, caseRow) === target);
}