// Tiny .xlsx writer for the planner export, ported from the extension (extension/src/xlsx.js).
// Writes SpreadsheetML parts into a store-only (uncompressed) ZIP, so there is
// no library to bundle and nothing remote to load.
// ponytail: no compression. A full plan is well under 200 KB uncompressed;
// add deflate (CompressionStream) if files ever get big.

type Side = [style: string, color: string];
export interface Style {
  bold?: boolean; italic?: boolean; size?: number; color?: string; fill?: string;
  h?: string; v?: string; wrap?: boolean;
  border?: Partial<Record<'top' | 'right' | 'bottom' | 'left', Side>>;
}
interface Cell { r: number; c: number; value: string | number | null | undefined; style: Style | null; xf?: number }
export interface Sheet {
  name: string; cells: Map<string, Cell>; merges: number[][];
  widths: Record<number, number>; heights: Record<number, number>;
  freezeRows: number; landscape: boolean; filter: string | null; printRows: number; gridLines?: boolean;
}
type Look = [fill: string, text: string, borderStyle: string, borderColor: string];
export interface ExportCard { code: string; title: string; units: number; offer: string; status: string; label: string; crit: boolean; note?: string; muted?: boolean }
export interface ExportModel {
  title: string; subtitle: string;
  columns: { name: string; sub: string; tag: string; units: number; cap: number | null; cards: ExportCard[] }[];
  courses: { code: string; title: string; units: number; term: string; status: string; label: string; prereqs: string }[];
}

/* ---------- ZIP (store only) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// files: [{ name, data: string | Uint8Array }] -> Uint8Array
function zipStore(files: { name: string; data: string | Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1; // fixed date keeps output reproducible
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const head = (sig: number, central: boolean) => {
      const b = new DataView(new ArrayBuffer(central ? 46 : 30));
      let p = 0;
      const u32 = (v: number) => { b.setUint32(p, v, true); p += 4; };
      const u16 = (v: number) => { b.setUint16(p, v, true); p += 2; };
      u32(sig);
      if (central) u16(20); // version made by
      u16(20); u16(0x0800); u16(0); // version needed, UTF-8 names, stored
      u16(0); u16(DOS_DATE);
      u32(crc); u32(data.length); u32(data.length);
      u16(name.length); u16(0);
      if (central) { u16(0); u16(0); u16(0); u32(0); u32(offset); }
      return new Uint8Array(b.buffer);
    };
    const local = head(0x04034B50, false);
    locals.push(local, name, data);
    centrals.push(head(0x02014B50, true), name);
    offset += local.length + name.length + data.length;
  });
  const cdSize = centrals.reduce((s, b) => s + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054B50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((s, b) => s + b.length, 0));
  let p = 0;
  parts.forEach(b => { out.set(b, p); p += b.length; });
  return out;
}

/* ---------- Workbook ---------- */

const XML_ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const xmlEsc = (s: unknown) => String(s).replace(/[&<>"]/g, ch => XML_ENT[ch])
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function colName(c: number): string { // 0 -> A
  let s = '';
  for (c += 1; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + (c - 1) % 26) + s;
  return s;
}
const ref = (r: number, c: number) => `${colName(c)}${r + 1}`;

function newSheet(name: string): Sheet {
  return { name, cells: new Map(), merges: [], widths: {}, heights: {}, freezeRows: 0, landscape: false, filter: null, printRows: 0 };
}

// style: { bold, italic, size, color, fill, h, v, wrap, border: { top, right, bottom, left: [style, color] } }
function put(sheet: Sheet, r: number, c: number, value: Cell['value'], style?: Style) {
  sheet.cells.set(`${r},${c}`, { r, c, value, style: style || null });
}

function merge(sheet: Sheet, r1: number, c1: number, r2: number, c2: number) {
  sheet.merges.push([r1, c1, r2, c2]);
}

function buildStyles(sheets: Sheet[]): string {
  const fonts = ['<font><sz val="10"/><color rgb="FF2E2524"/><name val="Calibri"/></font>'];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const idx = (list: string[], xml: string) => {
    let i = list.indexOf(xml);
    if (i < 0) i = list.push(xml) - 1;
    return i;
  };
  const cache = new Map<string, number>();
  const xfOf = (s: Style | null) => {
    if (!s) return 0;
    const key = JSON.stringify(s);
    if (cache.has(key)) return cache.get(key)!;
    const font = idx(fonts, `<font>${s.bold ? '<b/>' : ''}${s.italic ? '<i/>' : ''}<sz val="${s.size || 10}"/><color rgb="FF${s.color || '2E2524'}"/><name val="Calibri"/></font>`);
    const fill = s.fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${s.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const b = s.border || {};
    const side = (k: 'top' | 'right' | 'bottom' | 'left') => b[k] ? `<${k} style="${b[k][0]}"><color rgb="FF${b[k][1]}"/></${k}>` : `<${k}/>`;
    const border = s.border ? idx(borders, `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`) : 0;
    const align = `<alignment horizontal="${s.h || 'general'}" vertical="${s.v || 'center'}"${s.wrap ? ' wrapText="1"' : ''}/>`;
    const i = idx(xfs, `<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`);
    cache.set(key, i);
    return i;
  };
  sheets.forEach(sh => sh.cells.forEach(cell => { cell.xf = xfOf(cell.style); }));
  const list = (tag: string, arr: string[]) => `<${tag} count="${arr.length}">${arr.join('')}</${tag}>`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    list('fonts', fonts) + list('fills', fills) + list('borders', borders) +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    list('cellXfs', xfs) +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}

function sheetXML(sh: Sheet): string {
  const rows = new Map<number, Cell[]>();
  sh.cells.forEach(cell => {
    if (!rows.has(cell.r)) rows.set(cell.r, []);
    rows.get(cell.r)!.push(cell);
  });
  Object.keys(sh.heights).forEach(r => { if (!rows.has(Number(r))) rows.set(Number(r), []); });
  let maxR = 0;
  let maxC = 0;
  const data = Array.from(rows.keys()).sort((a, b) => a - b).map(r => {
    const cells = rows.get(r)!.sort((a, b) => a.c - b.c).map(cell => {
      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, cell.c);
      const s = cell.xf ? ` s="${cell.xf}"` : '';
      const v = cell.value;
      if (v == null || v === '') return `<c r="${ref(r, cell.c)}"${s}/>`;
      if (typeof v === 'number') return `<c r="${ref(r, cell.c)}"${s}><v>${v}</v></c>`;
      return `<c r="${ref(r, cell.c)}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join('');
    const ht = sh.heights[r] ? ` ht="${sh.heights[r]}" customHeight="1"` : '';
    return `<row r="${r + 1}"${ht}>${cells}</row>`;
  }).join('');
  const cols = Object.keys(sh.widths).map(Number).sort((a, b) => a - b)
    .map(c => `<col min="${c + 1}" max="${c + 1}" width="${sh.widths[c]}" customWidth="1"/>`).join('');
  const n = sh.freezeRows;
  const pane = n ? `<pane ySplit="${n}" topLeftCell="A${n + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${n + 1}" sqref="A${n + 1}"/>` : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<dimension ref="A1:${ref(maxR, maxC)}"/>` +
    `<sheetViews><sheetView workbookViewId="0" showGridLines="${sh.gridLines === false ? 0 : 1}">${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${data}</sheetData>` +
    (sh.filter ? `<autoFilter ref="${sh.filter}"/>` : '') +
    (sh.merges.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(([r1, c1, r2, c2]) => `<mergeCell ref="${ref(r1, c1)}:${ref(r2, c2)}"/>`).join('')}</mergeCells>` : '') +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    `<pageSetup orientation="${sh.landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>` +
    '</worksheet>';
}

// sheets -> Uint8Array of a complete .xlsx file
function writeXlsx(sheets: Sheet[]): Uint8Array {
  const styles = buildStyles(sheets);
  const ns = 'http://schemas.openxmlformats.org/';
  const defined = sheets.map((sh, i) => {
    const q = `'${sh.name.replace(/'/g, "''")}'`;
    const out = [];
    if (sh.printRows) out.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${q}!$1:$${sh.printRows}</definedName>`);
    if (sh.filter) out.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${q}!${sh.filter.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName>`);
    return out.join('');
  }).join('');
  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      `<Types xmlns="${ns}package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      '</Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      `<Relationships xmlns="${ns}package/2006/relationships"><Relationship Id="rId1" Type="${ns}officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      `<workbook xmlns="${ns}spreadsheetml/2006/main" xmlns:r="${ns}officeDocument/2006/relationships"><sheets>` +
      sheets.map((sh, i) => `<sheet name="${xmlEsc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      `</sheets>${defined ? `<definedNames>${defined}</definedNames>` : ''}</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      `<Relationships xmlns="${ns}package/2006/relationships">` +
      sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${sheets.length + 1}" Type="${ns}officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: styles },
    ...sheets.map((sh, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXML(sh) })),
  ];
  return zipStore(files);
}

/* ---------- Planner layout ---------- */

// Light theme colors from tokens.css, as hex. Tints are the token mixed into
// white (12%), the same weight the planner uses for status washes.
const XL = {
  brand: '7D2E26', onBrand: 'FFFFFF', brandTint: 'F5EEEE',
  ink: '2E2524', body: '474747', muted: '666666',
  border: 'EAD9D7', borderInput: 'DBBFBD', bgCard: 'FBF9F9', white: 'FFFFFF',
  ok: '1A7440', okTint: 'E4EEE8', bad: 'B12525', badTint: 'F6E5E5',
  info: '2962A3', infoTint: 'E5ECF4', warn: '8A5D0F',
};

// status -> card look: [fill, text color for the status word, border style, border color]
const CARD_LOOK: Record<string, Look> = {
  passed: [XL.okTint, XL.ok, 'thin', XL.ok],
  inprogress: [XL.infoTint, XL.info, 'thin', XL.info],
  failed: [XL.badTint, XL.bad, 'thin', XL.bad],
  retake: [XL.bgCard, XL.bad, 'dashed', XL.bad],
  ready: [XL.white, XL.brand, 'thin', XL.borderInput],
  planned: [XL.white, XL.muted, 'thin', XL.border],
  locked: [XL.bgCard, XL.muted, 'dashed', XL.borderInput],
};

const LEGEND: [string, string][] = [
  ['passed', 'Passed'], ['inprogress', 'Taking now'], ['failed', 'Failed'], ['retake', 'Retake'],
  ['ready', 'Ready'], ['planned', 'Planned'], ['locked', 'Waiting'], ['crit', 'Critical'],
];

// Outer border of a block: each cell gets only the sides on the block edge.
function edge(look: Look, crit: boolean, top: number, right: number, bottom: number, left: number) {
  const line: Side = crit ? ['medium', XL.brand] : [look[2], look[3]];
  const b: Style['border'] = {};
  if (top) b.top = line;
  if (right) b.right = line;
  if (bottom) b.bottom = line;
  if (left) b.left = line;
  return b;
}

// model: { title, subtitle, columns: [{ name, sub, tag, units, cap, cards: [{ code, title, units, offer, status, label, crit, note, muted }] }],
//          courses: [{ code, title, units, term, status, prereqs }] }
// Each term takes two sheet columns (course, units/offering) plus a thin gap.
function buildPlannerSheets(model: ExportModel): Sheet[] {
  const plan = newSheet('Plan');
  plan.landscape = true;
  plan.gridLines = false;
  const cols = model.columns;
  const span = Math.max(cols.length, 4) * 3 - 2; // last used column index
  cols.forEach((_, i) => {
    plan.widths[i * 3] = 22;
    plan.widths[i * 3 + 1] = 10;
    plan.widths[i * 3 + 2] = 2;
  });

  put(plan, 0, 0, model.title, { bold: true, size: 16, color: XL.brand });
  merge(plan, 0, 0, 0, span);
  plan.heights[0] = 26;
  put(plan, 1, 0, model.subtitle, { color: XL.body, wrap: true, v: 'top' });
  merge(plan, 1, 0, 1, span);
  plan.heights[1] = 30;

  // Legend chips, wrapping onto a new row after every term column is used.
  const perRow = Math.max(cols.length, 4);
  LEGEND.forEach(([st, label], i) => {
    const r = 2 + Math.floor(i / perRow);
    const c = (i % perRow) * 3;
    const crit = st === 'crit';
    const look = CARD_LOOK[crit ? 'planned' : st];
    const base = { fill: look[0], color: crit ? XL.brand : look[1], bold: true, h: 'center', size: 9 };
    put(plan, r, c, label, { ...base, border: edge(look, crit, 1, 0, 1, 1) });
    put(plan, r, c + 1, '', { ...base, border: edge(look, crit, 1, 1, 1, 0) });
    merge(plan, r, c, r, c + 1);
  });
  const head = 2 + Math.ceil(LEGEND.length / perRow) + 1; // one blank row after the legend
  plan.heights[head - 1] = 8;

  const headStyle = { bold: true, size: 11, color: XL.onBrand, fill: XL.brand };
  cols.forEach((col, i) => {
    const c = i * 3;
    put(plan, head, c, `${col.name}${col.sub ? `, ${col.sub}` : ''}`, headStyle);
    put(plan, head, c + 1, col.tag || '', { ...headStyle, h: 'right', size: 9 });
    const over = col.cap != null && col.units > col.cap;
    const unitText = col.cap != null ? `${col.units} of ${col.cap} units` : `${col.units} units`;
    const unitStyle = { fill: XL.brandTint, color: over ? XL.warn : XL.body, bold: over, size: 9 };
    put(plan, head + 1, c, over ? `${unitText}, over the cap` : unitText, unitStyle);
    put(plan, head + 1, c + 1, '', unitStyle);
    merge(plan, head + 1, c, head + 1, c + 1);
  });
  plan.heights[head] = 20;
  plan.freezeRows = head + 2;
  plan.printRows = head + 2;

  // Course blocks: code + units, title (two lines), status + offering, spacer.
  const first = head + 3;
  plan.heights[head + 2] = 6;
  const deepest = Math.max(1, ...cols.map(col => col.cards.length));
  for (let k = 0; k < deepest; k++) {
    const r = first + k * 4;
    plan.heights[r] = 16;
    plan.heights[r + 1] = 26;
    plan.heights[r + 2] = 15;
    plan.heights[r + 3] = 7;
  }
  cols.forEach((col, i) => {
    const c = i * 3;
    if (!col.cards.length) {
      put(plan, first, c, 'Nothing offered that fits', { italic: true, color: XL.muted, size: 9 });
      return;
    }
    col.cards.forEach((card, k) => {
      const r = first + k * 4;
      const look = CARD_LOOK[card.status] || CARD_LOOK.planned;
      const crit = !!card.crit;
      const ink = card.muted ? XL.muted : XL.ink;
      const fill = look[0];
      put(plan, r, c, card.code, { bold: true, size: 11, color: ink, fill, border: edge(look, crit, 1, 0, 0, 1) });
      put(plan, r, c + 1, `${card.units} units`, { size: 9, color: XL.body, fill, h: 'right', border: edge(look, crit, 1, 1, 0, 0) });
      put(plan, r + 1, c, card.title, { size: 9, color: card.muted ? XL.muted : XL.body, fill, wrap: true, v: 'top', border: edge(look, crit, 0, 0, 0, 1) });
      put(plan, r + 1, c + 1, '', { fill, border: edge(look, crit, 0, 1, 0, 0) });
      merge(plan, r + 1, c, r + 1, c + 1);
      // "Waiting" + "Waiting on X" reads twice; keep the longer one.
    const note = card.note || '';
    const lead = note.startsWith(card.label) ? [note] : [card.label, note && note[0].toLowerCase() + note.slice(1)];
    const status = [lead[0], crit ? 'critical' : '', lead[1] || ''].filter(Boolean).join(', ');
      put(plan, r + 2, c, status, { bold: true, size: 8, color: look[1], fill, border: edge(look, crit, 0, 0, 1, 1) });
      put(plan, r + 2, c + 1, card.offer, { size: 8, color: XL.muted, fill, h: 'right', border: edge(look, crit, 0, 1, 1, 0) });
    });
  });

  // Courses: one row per course, filterable.
  const list = newSheet('Courses');
  const heads = ['Code', 'Title', 'Units', 'Term', 'Status', 'Prerequisites'];
  [12, 54, 8, 22, 16, 44].forEach((w, c) => { list.widths[c] = w; });
  heads.forEach((h, c) => put(list, 0, c, h, { ...headStyle, size: 10, h: c === 2 ? 'center' : 'general' }));
  list.heights[0] = 20;
  const line: Side = ['thin', XL.border];
  const rowBorder = { bottom: line };
  model.courses.forEach((row, i) => {
    const r = i + 1;
    const look = CARD_LOOK[row.status] || CARD_LOOK.planned;
    put(list, r, 0, row.code, { bold: true, border: rowBorder });
    put(list, r, 1, row.title, { color: XL.body, border: rowBorder });
    put(list, r, 2, Number(row.units) || 0, { h: 'center', border: rowBorder });
    put(list, r, 3, row.term, { color: XL.body, border: rowBorder });
    put(list, r, 4, row.label, { bold: true, color: look[1], fill: look[0], border: rowBorder });
    put(list, r, 5, row.prereqs, { color: XL.body, border: rowBorder });
  });
  list.freezeRows = 1;
  list.printRows = 1;
  list.filter = `A1:F${Math.max(model.courses.length + 1, 2)}`;
  return [plan, list];
}

export { crc32, zipStore, writeXlsx, newSheet, put, merge, buildPlannerSheets, colName, XL, CARD_LOOK };
