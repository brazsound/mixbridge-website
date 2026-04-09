import { useState, useCallback, useEffect } from 'react';
import type { NamingPart, TokenFormatSettings } from '../utils/naming';
import type { ApplyTemplateContext } from '../utils/naming';
import {
  parseLegacyTemplate,
  buildTemplateFromParts,
  applyNamingTemplate,
  formatPartSeparatorJoiner,
} from '../utils/naming';

const STORAGE_KEY = 'mix-bridge-settings';

/** Bounce categories that can each have their own default naming pattern. */
export type BounceNamingKind = 'mix' | 'solo' | 'mute' | 'batch';

/** Per-type pattern; when absent for a kind, the default templateParts / prefix / suffix apply. Part separator is global (Formatting settings). */
export interface NamingPatternOverride {
  templateParts?: NamingPart[];
  globalPrefix?: string;
  globalSuffix?: string;
}

export interface DefaultNaming {
  /** Legacy: raw template string. Migrated to templateParts on load. */
  template?: string;
  /** Ordered parts for the name (prefix, name, date, etc.) — default for all types unless overridden in byType */
  templateParts?: NamingPart[];
  /** Separator between parts, e.g. "_" */
  separator?: string;
  /** Text prepended to every generated name */
  globalPrefix?: string;
  /** Text appended to every generated name */
  globalSuffix?: string;
  /** Default output folder label: "session" | "custom" */
  outputFolder: 'session' | 'custom';
  customOutputPath?: string;
  /** Optional pattern overrides per bounce type (Mix / Solo / Mute / Batch). */
  byType?: Partial<Record<BounceNamingKind, NamingPatternOverride>>;
  /** Part separator + display rules for tokens (Naming → Formatting settings). */
  tokenFormat?: TokenFormatSettings;
  /**
   * Increment when factory defaults change. If missing or lower than current, load() applies
   * canonical templateParts + tokenFormat (and clears a saved Batch-only override so Batch matches).
   */
  defaultsVersion?: number;
}

/**
 * Factory default: Track name → Session → Sample rate → Bit depth → Suffix (empty).
 * Preview example: Kick - MySession - 48 kHz 24bit (formatting: hyphens between parts, space between rate & depth).
 */
export const DEFAULT_TEMPLATE_PARTS: NamingPart[] = [
  { id: 'name' },
  { id: 'session' },
  { id: 'sampleRate' },
  { id: 'bitDepth' },
  { id: 'suffix', value: '' },
];

/** Exported for “Reset to app default” in Formatting settings. */
export const DEFAULT_TOKEN_FORMAT: TokenFormatSettings = {
  partSeparator: 'hyphen',
  partSeparatorSpaceBefore: true,
  partSeparatorSpaceAfter: true,
  dateStyle: 'us',
  shortYear: true,
  time24h: true,
  sampleRateDisplay: 'khz',
  sampleRateShowUnit: true,
  bitDepthShowUnit: true,
  bitDepthHyphen: false,
  sampleRateBitDepthNoSeparator: true,
};

const NAMING_DEFAULTS_VERSION = 2;

const DEFAULT: DefaultNaming = {
  template: '{name} - {session} - {sampleRate} {bitDepth}',
  templateParts: DEFAULT_TEMPLATE_PARTS,
  separator: '-',
  outputFolder: 'session',
  tokenFormat: { ...DEFAULT_TOKEN_FORMAT },
  defaultsVersion: NAMING_DEFAULTS_VERSION,
};

function load(): DefaultNaming {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DefaultNaming>;
      const storedVersion = parsed.defaultsVersion;
      const merged = { ...DEFAULT, ...parsed };
      merged.tokenFormat = {
        ...DEFAULT_TOKEN_FORMAT,
        ...(parsed.tokenFormat ?? {}),
      };
      if (!merged.templateParts && merged.template) {
        merged.templateParts = parseLegacyTemplate(merged.template);
        merged.separator = merged.separator ?? '_';
      }
      // Migrate legacy single-character separator into tokenFormat once
      const tf = { ...merged.tokenFormat };
      if (
        tf.partSeparator === undefined &&
        tf.partSeparatorSpaceBefore === undefined &&
        tf.partSeparatorSpaceAfter === undefined
      ) {
        const s = merged.separator ?? '_';
        tf.partSeparator =
          s === '_' ? 'underscore' : s === '-' ? 'hyphen' : s === ' ' ? 'space' : 'none';
        tf.partSeparatorSpaceBefore = false;
        tf.partSeparatorSpaceAfter = false;
      }
      merged.tokenFormat = tf;

      // One-time bump to v2: canonical Batch-style pattern + formatting (see DEFAULT_TEMPLATE_PARTS).
      if (storedVersion === undefined || storedVersion < NAMING_DEFAULTS_VERSION) {
        merged.templateParts = DEFAULT_TEMPLATE_PARTS.map((p) => ({ ...p }));
        merged.template = DEFAULT.template;
        merged.separator = DEFAULT.separator;
        merged.tokenFormat = { ...DEFAULT_TOKEN_FORMAT };
        if (merged.byType?.batch) {
          const bt = { ...merged.byType };
          delete bt.batch;
          merged.byType = Object.keys(bt).length ? bt : undefined;
        }
        merged.defaultsVersion = NAMING_DEFAULTS_VERSION;
      } else {
        merged.defaultsVersion = merged.defaultsVersion ?? NAMING_DEFAULTS_VERSION;
      }

      return merged;
    }
  } catch (_) {}
  return DEFAULT;
}

/** Get the template string from naming config (for applyTemplate) */
export function getTemplateString(naming: DefaultNaming): string {
  const parts = naming.templateParts ?? parseLegacyTemplate(naming.template ?? '{name} - {session} - {sampleRate} {bitDepth}');
  const sep = formatPartSeparatorJoiner(naming.tokenFormat, naming.separator);
  return buildTemplateFromParts(parts, sep, naming.tokenFormat);
}

/**
 * Merge default naming with an optional per–bounce-type override.
 * Range and full-mix bounces use kind `mix`.
 */
export function resolveNamingForType(naming: DefaultNaming, kind: BounceNamingKind): DefaultNaming {
  const o = naming.byType?.[kind];
  if (!o) return naming;
  return {
    ...naming,
    templateParts: o.templateParts ?? naming.templateParts,
    globalPrefix: o.globalPrefix !== undefined ? o.globalPrefix : naming.globalPrefix,
    globalSuffix: o.globalSuffix !== undefined ? o.globalSuffix : naming.globalSuffix,
  };
}

/** Apply naming config with global prefix/suffix to produce final output name */
export function applyNamingFromConfig(
  naming: DefaultNaming,
  ctx: ApplyTemplateContext,
  kind?: BounceNamingKind
): string {
  const n = kind ? resolveNamingForType(naming, kind) : naming;
  const template = getTemplateString(n);
  const base = applyNamingTemplate(template, ctx, naming.tokenFormat);
  const prefix = n.globalPrefix ?? '';
  const suffix = n.globalSuffix ?? '';
  return prefix + base + suffix;
}

function save(naming: DefaultNaming) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(naming));
  } catch (_) {}
}

export function useSettings() {
  const [defaultNaming, setDefaultNamingState] = useState<DefaultNaming>(load);

  useEffect(() => {
    save(defaultNaming);
  }, [defaultNaming]);

  const setDefaultNaming = useCallback((naming: DefaultNaming) => {
    setDefaultNamingState(naming);
  }, []);

  return { defaultNaming, setDefaultNaming };
}
