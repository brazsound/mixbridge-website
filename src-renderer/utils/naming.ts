/**
 * Naming template tokens and utilities.
 * Tokens are placeholders like {name}, {date}, {time} that get replaced when generating output names.
 */

export type NamingTokenId =
  | 'prefix'
  | 'name'
  | 'date'
  | 'time'
  | 'session'
  | 'sampleRate'
  | 'bitDepth'
  | 'number'
  | 'suffix';

export interface NamingPart {
  id: NamingTokenId;
  value?: string; // for prefix/suffix custom text
}

export interface ApplyTemplateContext {
  name: string;
  sessionName?: string;
  trackNumber?: number;
  /** Session sample rate in Hz (e.g. 44100). Used for {sampleRate}. */
  sampleRateHz?: number;
  /** Session bit depth (e.g. 16, 24, 32). Used for {bitDepth}. */
  bitDepth?: number;
}

/** Optional session audio fields passed when generating default bounce names. */
export type NamingSessionAudio = Pick<ApplyTemplateContext, 'sampleRateHz' | 'bitDepth'>;

/** Session name + sample rate / bit depth for naming tokens when adding queue items. */
export type NamingSessionCtx = NamingSessionAudio & Pick<ApplyTemplateContext, 'sessionName'>;

/** Separator between template parts (Stem, name, date, …). Stored on DefaultNaming.tokenFormat. */
export type PartSeparatorOption = 'hyphen' | 'underscore' | 'space' | 'none';

/** Global display rules for dynamic tokens (date / time / sample rate / bit depth). Stored on DefaultNaming.tokenFormat. */
export interface TokenFormatSettings {
  /** Character between ordered naming parts */
  partSeparator?: PartSeparatorOption;
  /** Insert a space before the separator character */
  partSeparatorSpaceBefore?: boolean;
  /** Insert a space after the separator character */
  partSeparatorSpaceAfter?: boolean;
  /** ISO YYYY-MM-DD, US MM/DD/YYYY, EU DD/MM/YYYY */
  dateStyle?: 'iso' | 'us' | 'eu';
  /** Use two-digit year in the date token */
  shortYear?: boolean;
  /** When true, time uses 24-hour style; when false, 12-hour with AM/PM */
  time24h?: boolean;
  /** Show sample rate as kHz (e.g. 44.1 kHz) vs raw Hz */
  sampleRateDisplay?: 'khz' | 'hz';
  /** Append unit (kHz or Hz). When false, numeric only. */
  sampleRateShowUnit?: boolean;
  /** When true (default), bit depth includes the "bit" suffix (see bitDepthHyphen) */
  bitDepthShowUnit?: boolean;
  /** When true, format as 24-bit; when false or omitted (default), format as 24bit */
  bitDepthHyphen?: boolean;
  /** When true, use a single space between adjacent {sampleRate} and {bitDepth} instead of the full part separator */
  sampleRateBitDepthNoSeparator?: boolean;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function partSeparatorOptionToChar(opt: PartSeparatorOption | undefined): string {
  switch (opt) {
    case 'underscore':
      return '_';
    case 'space':
      return ' ';
    case 'none':
      return '';
    case 'hyphen':
    default:
      return '-';
  }
}

/**
 * Join string between template parts from Formatting settings (or legacy single-character separator).
 */
export function formatPartSeparatorJoiner(tf: TokenFormatSettings | undefined, legacySeparator?: string): string {
  if (
    tf?.partSeparator !== undefined ||
    tf?.partSeparatorSpaceBefore !== undefined ||
    tf?.partSeparatorSpaceAfter !== undefined
  ) {
    const char = partSeparatorOptionToChar(tf?.partSeparator ?? 'hyphen');
    const before = tf?.partSeparatorSpaceBefore !== false;
    const after = tf?.partSeparatorSpaceAfter !== false;
    return (before ? ' ' : '') + char + (after ? ' ' : '');
  }
  return legacySeparator ?? '_';
}

export function formatDateForToken(d: Date, f?: TokenFormatSettings): string {
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const yFull = d.getFullYear();
  const yShort = String(yFull).slice(-2);
  const style = f?.dateStyle ?? 'iso';
  if (style === 'us') {
    return f?.shortYear ? `${m}/${day}/${yShort}` : `${m}/${day}/${yFull}`;
  }
  if (style === 'eu') {
    return f?.shortYear ? `${day}/${m}/${yShort}` : `${day}/${m}/${yFull}`;
  }
  return f?.shortYear ? `${yShort}-${m}-${day}` : `${yFull}-${m}-${day}`;
}

export function formatTimeForToken(d: Date, f?: TokenFormatSettings): string {
  const use24 = f?.time24h !== false;
  if (use24) {
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    return `${hh}-${mm}`;
  }
  let h = d.getHours();
  const am = h < 12;
  h = h % 12;
  if (h === 0) h = 12;
  const mm = pad2(d.getMinutes());
  const suf = am ? 'AM' : 'PM';
  return `${pad2(h)}-${mm}-${suf}`;
}

export function formatSampleRateForToken(hz: number | undefined, f?: TokenFormatSettings): string {
  if (hz == null || hz <= 0) return '';
  const showUnit = f?.sampleRateShowUnit !== false;
  const asKhz = f?.sampleRateDisplay !== 'hz';
  if (asKhz) {
    const k = hz / 1000;
    const s = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, '');
    return showUnit ? `${s} kHz` : s;
  }
  return showUnit ? `${hz} Hz` : String(hz);
}

export function formatBitDepthForToken(bits: number | undefined, f?: TokenFormatSettings): string {
  if (bits == null || bits <= 0) return '';
  const showUnit = f?.bitDepthShowUnit !== false;
  if (!showUnit) return String(bits);
  const hyphen = f?.bitDepthHyphen === true;
  return hyphen ? `${bits}-bit` : `${bits}bit`;
}

export const NAMING_TOKEN_DEFS: Record<
  NamingTokenId,
  { label: string; placeholder: string; hasCustomValue: boolean }
> = {
  prefix: { label: 'Prefix', placeholder: 'e.g. Stem', hasCustomValue: true },
  name: { label: 'Track name', placeholder: '{name}', hasCustomValue: false },
  date: { label: 'Date', placeholder: 'YYYY-MM-DD', hasCustomValue: false },
  time: { label: 'Time', placeholder: 'HH-MM', hasCustomValue: false },
  session: { label: 'Session name', placeholder: '{session}', hasCustomValue: false },
  sampleRate: { label: 'Sample rate', placeholder: '{sampleRate}', hasCustomValue: false },
  bitDepth: { label: 'Bit depth', placeholder: '{bitDepth}', hasCustomValue: false },
  number: { label: 'Track number', placeholder: '1, 2, 3...', hasCustomValue: false },
  suffix: { label: 'Suffix', placeholder: 'e.g. _v1', hasCustomValue: true },
};

/** Build template string from ordered parts, e.g. "Stem_{name}_{date}" */
export function buildTemplateFromParts(
  parts: NamingPart[],
  separator: string,
  tokenFormat?: TokenFormatSettings
): string {
  const segments = parts.map((p) => {
    switch (p.id) {
      case 'prefix':
      case 'suffix':
        return (p.value ?? '').trim();
      case 'name':
        return '{name}';
      case 'date':
        return '{date}';
      case 'time':
        return '{time}';
      case 'session':
        return '{session}';
      case 'sampleRate':
        return '{sampleRate}';
      case 'bitDepth':
        return '{bitDepth}';
      case 'number':
        return '{number}';
      default:
        return '';
    }
  });

  const rows: { id: NamingTokenId; segment: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = segments[i];
    if (seg.length > 0) rows.push({ id: parts[i].id, segment: seg });
  }

  if (rows.length === 0) return '';

  if (!tokenFormat?.sampleRateBitDepthNoSeparator) {
    return rows.map((r) => r.segment).join(separator);
  }

  let out = '';
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) {
      const prev = rows[i - 1].id;
      const curr = rows[i].id;
      const skipSep =
        (prev === 'sampleRate' && curr === 'bitDepth') || (prev === 'bitDepth' && curr === 'sampleRate');
      out += skipSep ? ' ' : separator;
    }
    out += rows[i].segment;
  }
  return out;
}

/** Collapse "-  -" when optional tokens (e.g. {session}) expand to empty. */
function collapseAdjacentHyphenSeparators(s: string): string {
  let out = s;
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/\s+-\s+-\s+/g, ' - ');
  }
  return out;
}

/** Apply template with context, replacing placeholders */
export function applyNamingTemplate(
  template: string,
  ctx: ApplyTemplateContext,
  tokenFormat?: TokenFormatSettings
): string {
  const now = new Date();
  let date: string;
  let time: string;
  if (!tokenFormat) {
    date = now.toISOString().slice(0, 10);
    time = now.toTimeString().slice(0, 5).replace(':', '-');
  } else {
    date = formatDateForToken(now, tokenFormat);
    time = formatTimeForToken(now, tokenFormat);
  }
  const sampleRate = formatSampleRateForToken(ctx.sampleRateHz, tokenFormat);
  const bitDepth = formatBitDepthForToken(ctx.bitDepth, tokenFormat);
  const raw = template
    .replace(/\{name\}/gi, ctx.name)
    .replace(/\{date\}/gi, date)
    .replace(/\{time\}/gi, time)
    .replace(/\{session\}/gi, ctx.sessionName ?? '')
    .replace(/\{sampleRate\}/gi, sampleRate)
    .replace(/\{bitDepth\}/gi, bitDepth)
    .replace(/\{number\}/gi, ctx.trackNumber != null ? String(ctx.trackNumber) : '');
  return collapseAdjacentHyphenSeparators(raw);
}

function tokenPlaceholderToId(key: string): NamingTokenId {
  const k = key.toLowerCase();
  if (k === 'samplerate') return 'sampleRate';
  if (k === 'bitdepth') return 'bitDepth';
  return k as NamingTokenId;
}

/** Parse legacy template string into parts (for migration) */
export function parseLegacyTemplate(template: string): NamingPart[] {
  const regex = /\{(name|date|time|session|number|sampleRate|bitDepth)\}/gi;
  const matches: { id: NamingTokenId; index: number; len: number }[] = [];
  let m;
  while ((m = regex.exec(template)) !== null) {
    matches.push({ id: tokenPlaceholderToId(m[1]), index: m.index, len: m[0].length });
  }
  matches.sort((a, b) => a.index - b.index);

  const ordered: NamingPart[] = [];
  let prefix = matches[0] ? template.slice(0, matches[0].index).replace(/\s+$/, '') : template.replace(/\s+$/, '');
  prefix = prefix.replace(/[-_\s]+$/, ''); // strip trailing separators
  if (prefix) {
    ordered.push({ id: 'prefix', value: prefix });
  }
  for (const x of matches) {
    ordered.push({ id: x.id });
  }
  const last = matches[matches.length - 1];
  if (last) {
    const suffixStart = last.index + last.len;
    let suffix = template.slice(suffixStart).replace(/^\s+/, '');
    suffix = suffix.replace(/^[-_\s]+/, ''); // strip leading separators
    if (suffix) {
      ordered.push({ id: 'suffix', value: suffix });
    }
  }

  return ordered.length > 0
    ? ordered
    : [
        { id: 'name' },
        { id: 'session' },
        { id: 'sampleRate' },
        { id: 'bitDepth' },
        { id: 'suffix', value: '' },
      ];
}
