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
  number: { label: 'Track number', placeholder: '1, 2, 3...', hasCustomValue: false },
  suffix: { label: 'Suffix', placeholder: 'e.g. _v1', hasCustomValue: true },
};

/** Build template string from ordered parts, e.g. "Stem_{name}_{date}" */
export function buildTemplateFromParts(parts: NamingPart[], separator: string): string {
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
      case 'number':
        return '{number}';
      default:
        return '';
    }
  });
  return segments.filter((s) => s.length > 0).join(separator);
}

/** Apply template with context, replacing placeholders */
export function applyNamingTemplate(
  template: string,
  ctx: ApplyTemplateContext
): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5).replace(':', '-');
  return template
    .replace(/\{name\}/gi, ctx.name)
    .replace(/\{date\}/gi, date)
    .replace(/\{time\}/gi, time)
    .replace(/\{session\}/gi, ctx.sessionName ?? '')
    .replace(/\{number\}/gi, ctx.trackNumber != null ? String(ctx.trackNumber) : '');
}

/** Parse legacy template string into parts (for migration) */
export function parseLegacyTemplate(template: string): NamingPart[] {
  const regex = /\{(name|date|time|session|number)\}/gi;
  const matches: { id: NamingTokenId; index: number; len: number }[] = [];
  let m;
  while ((m = regex.exec(template)) !== null) {
    matches.push({ id: m[1].toLowerCase() as NamingTokenId, index: m.index, len: m[0].length });
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

  return ordered.length > 0 ? ordered : [{ id: 'prefix', value: 'Stem' }, { id: 'name' }];
}
