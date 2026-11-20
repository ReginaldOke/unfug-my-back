// Opening a file to import a routine from: plain text, notes, CSV, web pages, emails, rich text and JSON
// are read as they are; Word documents and Excel sheets are unzipped on the phone; a PDF's text is pulled
// out where it's stored as text. Returns text for readRoutine (routine-import.js), or null.

/** The files inside a zip (Word, Excel) as { name → () => Promise<string> }. */
async function unzip(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count && dv.getUint32(p, true) === 0x02014b50; n++) {
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    out[name] = async () => {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const bytes = new Uint8Array(buf, start, size);
      if (method === 0) return dec.decode(bytes);
      return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const xmlText = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** A Word document's paragraphs, with list items and table cells kept apart. */
async function docxText(zip) {
  const xml = await zip['word/document.xml']?.();
  if (!xml) return null;
  return xml.split(/<\/w:p>/).map(par => {
    const heading = /<w:pStyle w:val="(?:Heading|Title)/i.test(par);
    const bullet = /<w:numPr>/.test(par);
    const text = xmlText((par.match(/<w:t[^>]*>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? []).map(t => (t.startsWith('<w:t') ? t.replace(/<[^>]+>/g, '') : ' ')).join(''));
    const cellEnd = /<\/w:tc>/.test(par) ? ' | ' : '';
    return text.trim() ? `${heading ? '# ' : bullet ? '• ' : ''}${text}${cellEnd}` : '';
  }).join('\n').replace(/ \| \n(?=[^\n]* \| )/g, ' | ');
}

/** An Excel sheet as tab-separated rows (the first sheet with anything in it). */
async function xlsxText(zip) {
  const shared = await zip['xl/sharedStrings.xml']?.() ?? '';
  const strings = (shared.match(/<si>[\s\S]*?<\/si>/g) ?? []).map(si => xmlText((si.match(/<t[^>]*>[^<]*<\/t>/g) ?? []).map(t => t.replace(/<[^>]+>/g, '')).join('')));
  const sheets = Object.keys(zip).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  for (const name of sheets) {
    const xml = await zip[name]();
    const rows = (xml.match(/<row[\s\S]*?<\/row>/g) ?? []).map(row => {
      const cells = [];
      for (const c of row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
        const col = (c.match(/r="([A-Z]+)\d+"/)?.[1] ?? '').split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        const v = c.match(/<v>([^<]*)<\/v>/)?.[1] ?? c.match(/<t[^>]*>([^<]*)<\/t>/)?.[1] ?? '';
        cells[col >= 0 ? col : cells.length] = /t="s"/.test(c) ? strings[Number(v)] ?? '' : xmlText(v);
      }
      return Array.from(cells, x => (x ?? '').replace(/\t/g, ' ')).join('\t');
    }).filter(r => r.trim());
    if (rows.length) return rows.join('\n');
  }
  return null;
}

/** The text a PDF stores as text (most made from a document are; a scan isn't). */
async function pdfText(buf) {
  const raw = new TextDecoder('latin1').decode(buf);
  const chunks = [];
  const re = /<<((?:(?!<<)[\s\S])*?)>>\s*stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    let end = raw.indexOf('endstream', start);
    if (end < 0) break;
    // The stated length where there is one (the line break before endstream isn't part of the data)
    const length = m[1].match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/)?.[1];
    end = length ? Math.min(end, start + Number(length)) : raw.slice(start, end).replace(/\r?\n$/, '').length + start;
    const bytes = new Uint8Array(buf, start, end - start);
    let text = '';
    try { text = /FlateDecode/.test(m[1]) ? await inflate(bytes) : new TextDecoder('latin1').decode(bytes); } catch { continue; }
    if (!/\b(?:Tj|TJ)\b/.test(text)) continue;
    // Text shown with Tj and TJ; a move to a new line (Td, T*, ') starts a new line
    let line = '';
    for (const op of text.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj|\[(?:[^\]]*)\]\s*TJ|(-?[\d.]+)\s+(-?[\d.]+)\s+T[dD]|T\*|'/g)) {
      if (op[0].endsWith('Tj')) line += unescapePdf(op[0].slice(1, op[0].lastIndexOf(')')));
      else if (op[0].endsWith('TJ')) line += [...op[0].matchAll(/\((?:\\.|[^\\)])*\)|(-?\d+(?:\.\d+)?)/g)].map(x => (x[0].startsWith('(') ? unescapePdf(x[0].slice(1, -1)) : Number(x[0]) < -200 ? ' ' : '')).join('');
      else if (op[1] !== undefined && Number(op[2]) === 0) line += ' ';
      else { if (line.trim()) chunks.push(line); line = ''; }
    }
    if (line.trim()) chunks.push(line);
  }
  return chunks.length ? chunks.join('\n') : null;
}
/** Inflates what it can: a stream with junk at its end still gives up its text. */
async function inflate(bytes) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const parts = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); } } catch { /* keep what came out */ }
  return new TextDecoder('latin1').decode(await new Blob(parts).arrayBuffer());
}
const unescapePdf = s => s.replace(/\\([nrtbf()\\]|\d{1,3})/g, (_, c) => ({ n: '\n', r: '', t: ' ', b: '', f: '' }[c] ?? (/\d/.test(c) ? String.fromCharCode(parseInt(c, 8)) : c)));

/** The text in a file, ready for readRoutine, or null when nothing readable is in it. */
export async function readRoutineFile(file) {
  const name = file.name ?? '';
  if (/\.(?:docx|xlsx)$/i.test(name) || /officedocument/.test(file.type)) {
    const zip = await unzip(await file.arrayBuffer());
    if (!zip) return null;
    return zip['word/document.xml'] ? docxText(zip) : xlsxText(zip);
  }
  if (/\.pdf$/i.test(name) || file.type === 'application/pdf') return pdfText(await file.arrayBuffer());
  if (/^image\//.test(file.type)) return null;
  const text = await file.text();
  // Nothing but binary: not something to read
  return /[\x00-\x08\x0e-\x1f]/.test(text.slice(0, 2000)) ? null : text;
}
