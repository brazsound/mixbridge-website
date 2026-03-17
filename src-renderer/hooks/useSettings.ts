import { useState, useCallback, useEffect } from 'react';
import type { NamingPart } from '../utils/naming';
import type { ApplyTemplateContext } from '../utils/naming';
import { parseLegacyTemplate, buildTemplateFromParts, applyNamingTemplate } from '../utils/naming';

const STORAGE_KEY = 'stem-bounce-settings';

export interface DefaultNaming {
  /** Legacy: raw template string. Migrated to templateParts on load. */
  template?: string;
  /** Ordered parts for the name (prefix, name, date, etc.) */
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
}

const DEFAULT_PARTS: NamingPart[] = [
  { id: 'prefix', value: 'Stem' },
  { id: 'name' },
];

const DEFAULT: DefaultNaming = {
  template: 'Stem_{name}',
  templateParts: DEFAULT_PARTS,
  separator: '_',
  outputFolder: 'session',
};

function load(): DefaultNaming {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DefaultNaming>;
      const merged = { ...DEFAULT, ...parsed };
      if (!merged.templateParts && merged.template) {
        merged.templateParts = parseLegacyTemplate(merged.template);
        merged.separator = merged.separator ?? '_';
      }
      return merged;
    }
  } catch (_) {}
  return DEFAULT;
}

/** Get the template string from naming config (for applyTemplate) */
export function getTemplateString(naming: DefaultNaming): string {
  const parts = naming.templateParts ?? parseLegacyTemplate(naming.template ?? 'Stem_{name}');
  const sep = naming.separator ?? '_';
  return buildTemplateFromParts(parts, sep);
}

/** Apply naming config with global prefix/suffix to produce final output name */
export function applyNamingFromConfig(naming: DefaultNaming, ctx: ApplyTemplateContext): string {
  const template = getTemplateString(naming);
  const base = applyNamingTemplate(template, ctx);
  const prefix = naming.globalPrefix ?? '';
  const suffix = naming.globalSuffix ?? '';
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
