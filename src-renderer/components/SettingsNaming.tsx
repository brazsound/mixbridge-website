import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { DefaultNaming, NamingPatternOverride } from '../hooks/useSettings';
import {
  DEFAULT_TEMPLATE_PARTS,
  DEFAULT_TOKEN_FORMAT,
  resolveNamingForType,
  type BounceNamingKind,
} from '../hooks/useSettings';
import type { NamingPart, NamingTokenId, PartSeparatorOption, TokenFormatSettings } from '../utils/naming';
import {
  NAMING_TOKEN_DEFS,
  buildTemplateFromParts,
  applyNamingTemplate,
  formatDateForToken,
  formatTimeForToken,
  formatSampleRateForToken,
  formatBitDepthForToken,
  formatPartSeparatorJoiner,
} from '../utils/naming';

interface SettingsNamingProps {
  defaultNaming: DefaultNaming;
  onSave: (naming: DefaultNaming) => void;
}

const PATTERN_TABS: { id: BounceNamingKind; label: string; hint: string }[] = [
  { id: 'mix', label: 'Mix', hint: 'Full mix and timeline / range bounces' },
  { id: 'batch', label: 'Batch', hint: 'One bounce per selected track' },
  { id: 'solo', label: 'Solo', hint: 'Solo stem bounces' },
  { id: 'mute', label: 'Mute', hint: 'Mute stem bounces' },
];

const TOKEN_ORDER: NamingTokenId[] = [
  'prefix',
  'name',
  'date',
  'time',
  'session',
  'sampleRate',
  'bitDepth',
  'number',
  'suffix',
];

function partsToOrderAndValues(parts: NamingPart[]): { order: NamingTokenId[]; values: Record<string, string> } {
  const order = parts.map((p) => p.id);
  const values: Record<string, string> = {};
  for (const p of parts) {
    if (p.value != null) values[p.id] = p.value;
  }
  return { order, values };
}

function orderAndValuesToParts(order: NamingTokenId[], values: Record<string, string>): NamingPart[] {
  return order.map((id) => ({ id, value: values[id] }));
}

export function SettingsNaming({ defaultNaming, onSave }: SettingsNamingProps) {
  const [subTab, setSubTab] = useState<'mix' | 'solo' | 'mute' | 'batch' | 'tokens'>('mix');

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-0.5 border-b"
        style={{ borderColor: 'var(--divider)' }}
      >
        {PATTERN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className="px-3 py-2 text-xs font-medium transition-colors rounded-t-md"
            style={{
              color: subTab === t.id ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: subTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
              background: subTab === t.id ? 'var(--surface-hover)' : 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSubTab('tokens')}
          className="px-3 py-2 text-xs font-medium transition-colors rounded-t-md"
          style={{
            color: subTab === 'tokens' ? 'var(--text)' : 'var(--text-muted)',
            borderBottom: subTab === 'tokens' ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: '-1px',
            background: subTab === 'tokens' ? 'var(--surface-hover)' : 'transparent',
          }}
        >
          Formatting settings
        </button>
      </div>

      {subTab === 'tokens' ? (
        <TokenSetupPanel defaultNaming={defaultNaming} onSave={onSave} />
      ) : (
        <NamingPatternPanel
          kind={subTab}
          defaultNaming={defaultNaming}
          onSave={onSave}
          onOpenFormattingSettings={() => setSubTab('tokens')}
        />
      )}
    </div>
  );
}

function NamingPatternPanel({
  kind,
  defaultNaming,
  onSave,
  onOpenFormattingSettings,
}: {
  kind: BounceNamingKind;
  defaultNaming: DefaultNaming;
  onSave: (n: DefaultNaming) => void;
  onOpenFormattingSettings: () => void;
}) {
  const resolved = useMemo(() => resolveNamingForType(defaultNaming, kind), [defaultNaming, kind]);
  const parts = resolved.templateParts ?? DEFAULT_TEMPLATE_PARTS;

  const { order: initialOrder, values: initialValues } = partsToOrderAndValues(parts);
  const [order, setOrder] = useState<NamingTokenId[]>(initialOrder);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [globalPrefix, setGlobalPrefix] = useState(resolved.globalPrefix ?? '');
  const [globalSuffix, setGlobalSuffix] = useState(resolved.globalSuffix ?? '');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showApplyElsewhere, setShowApplyElsewhere] = useState(false);
  const [applyElsewhereSelected, setApplyElsewhereSelected] = useState<Set<BounceNamingKind>>(new Set());
  const lastSavedOverrideRef = useRef<NamingPatternOverride | null>(null);

  const otherKinds = useMemo(
    () => PATTERN_TABS.map((t) => t.id).filter((k) => k !== kind),
    [kind]
  );

  useEffect(() => {
    setShowApplyElsewhere(false);
  }, [kind]);

  useEffect(() => {
    const r = resolveNamingForType(defaultNaming, kind);
    const p = r.templateParts ?? DEFAULT_TEMPLATE_PARTS;
    const { order: o, values: v } = partsToOrderAndValues(p);
    setOrder(o);
    setValues(v);
    setGlobalPrefix(r.globalPrefix ?? '');
    setGlobalSuffix(r.globalSuffix ?? '');
  }, [defaultNaming, kind]);

  const currentParts = orderAndValuesToParts(order, values);
  const partJoiner = formatPartSeparatorJoiner(defaultNaming.tokenFormat, defaultNaming.separator);
  const template = buildTemplateFromParts(currentParts, partJoiner, defaultNaming.tokenFormat);
  const basePreview = applyNamingTemplate(
    template,
    { name: 'Kick', sampleRateHz: 48000, bitDepth: 24, sessionName: 'MySession' },
    defaultNaming.tokenFormat
  );
  const preview = (globalPrefix || '') + basePreview + (globalSuffix || '');

  const saveToParent = useCallback(() => {
    const override: NamingPatternOverride = {
      templateParts: currentParts.map((p) => ({ ...p })),
      globalPrefix: globalPrefix.trim() || undefined,
      globalSuffix: globalSuffix.trim() || undefined,
    };
    lastSavedOverrideRef.current = override;
    onSave({
      ...defaultNaming,
      byType: {
        ...defaultNaming.byType,
        [kind]: override,
      },
    });
    setApplyElsewhereSelected(new Set(otherKinds));
    setShowApplyElsewhere(true);
  }, [defaultNaming, kind, currentParts, globalPrefix, globalSuffix, onSave, otherKinds]);

  const applyPatternToSelectedOthers = useCallback(() => {
    const o = lastSavedOverrideRef.current;
    if (!o || applyElsewhereSelected.size === 0) {
      setShowApplyElsewhere(false);
      return;
    }
    const copy: NamingPatternOverride = {
      templateParts: o.templateParts?.map((p) => ({ ...p })),
      globalPrefix: o.globalPrefix,
      globalSuffix: o.globalSuffix,
    };
    const nextByType = { ...defaultNaming.byType };
    for (const k of applyElsewhereSelected) {
      nextByType[k] = {
        templateParts: copy.templateParts?.map((p) => ({ ...p })),
        globalPrefix: copy.globalPrefix,
        globalSuffix: copy.globalSuffix,
      };
    }
    onSave({
      ...defaultNaming,
      byType: Object.keys(nextByType).length > 0 ? nextByType : undefined,
    });
    setShowApplyElsewhere(false);
  }, [applyElsewhereSelected, defaultNaming, onSave]);

  const toggleApplyTarget = useCallback((k: BounceNamingKind) => {
    setApplyElsewhereSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const resetToShared = useCallback(() => {
    const bt = { ...defaultNaming.byType };
    delete bt[kind];
    onSave({
      ...defaultNaming,
      byType: Object.keys(bt).length > 0 ? bt : undefined,
    });
  }, [defaultNaming, kind, onSave]);

  const toggleToken = useCallback((id: NamingTokenId) => {
    setOrder((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }, []);

  const moveToken = useCallback((fromIndex: number, toIndex: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const setTokenValue = useCallback((id: string, value: string) => {
    setValues((v) => ({ ...v, [id]: value }));
  }, []);

  const hasOverride = Boolean(defaultNaming.byType?.[kind]);
  const tabMeta = PATTERN_TABS.find((t) => t.id === kind);

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {tabMeta?.hint}. Names apply when you add this bounce type from the center section.{' '}
        {hasOverride ? (
          <span style={{ color: 'var(--accent)' }}>Custom pattern for {tabMeta?.label}.</span>
        ) : (
          <span>Using the default naming pattern until you save here.</span>
        )}
      </p>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Include in name
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TOKEN_ORDER.map((id) => {
            const def = NAMING_TOKEN_DEFS[id];
            const enabled = order.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleToken(id)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: enabled ? 'var(--accent-soft)' : 'var(--surface)',
                  border: `1px solid ${enabled ? 'var(--accent-border)' : 'var(--border)'}`,
                  color: enabled ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {def.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Order & preview
        </label>
        <div
          className="min-h-[44px] rounded-lg p-2.5 flex flex-wrap items-center gap-1.5"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          {order.length === 0 ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              Turn on at least one part above
            </span>
          ) : (
            order.map((id, index) => (
              <React.Fragment key={`${id}-${index}`}>
                {dragOverIndex === index && draggingIndex !== null && draggingIndex !== index && index < order.length - 1 && (
                  <div
                    className="shrink-0 rounded-full"
                    style={{
                      width: '3px',
                      height: '20px',
                      background: 'var(--accent)',
                      boxShadow: '0 0 8px var(--accent-glow)',
                    }}
                  />
                )}
                <TokenChip
                  id={id}
                  index={index}
                  value={values[id]}
                  onValueChange={(v) => setTokenValue(id, v)}
                  onDropAt={(fromIndex) => moveToken(fromIndex, index)}
                  onDragStart={() => setDraggingIndex(index)}
                  onDragEnd={() => {
                    setDraggingIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnter={() => setDragOverIndex(index)}
                  onDragLeave={() => setDragOverIndex((i) => (i === index ? null : i))}
                  isDragging={draggingIndex === index}
                  isDropTarget={false}
                  previewValue={
                    id === 'name'
                      ? 'Kick'
                      : id === 'date'
                        ? formatDateForToken(new Date(), defaultNaming.tokenFormat)
                        : id === 'time'
                          ? formatTimeForToken(new Date(), defaultNaming.tokenFormat)
                          : id === 'session'
                            ? 'MySession'
                            : id === 'sampleRate'
                              ? formatSampleRateForToken(48000, defaultNaming.tokenFormat)
                              : id === 'bitDepth'
                                ? formatBitDepthForToken(24, defaultNaming.tokenFormat)
                                : id === 'number'
                                  ? '1'
                                  : values[id] ?? ''
                  }
                />
                {dragOverIndex === index && draggingIndex !== null && draggingIndex !== index && index === order.length - 1 && (
                  <div
                    className="shrink-0 rounded-full"
                    style={{
                      width: '3px',
                      height: '20px',
                      background: 'var(--accent)',
                      boxShadow: '0 0 8px var(--accent-glow)',
                    }}
                  />
                )}
              </React.Fragment>
            ))
          )}
        </div>
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          Example: <span style={{ color: 'var(--text)' }}>{preview}</span>
        </p>
      </div>

      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Separator between parts is set in{' '}
        <button
          type="button"
          onClick={onOpenFormattingSettings}
          className="underline decoration-dotted underline-offset-2 hover:opacity-90"
          style={{
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          Formatting settings
        </button>.
      </p>

      <div className="space-y-2">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Add to every name ({tabMeta?.label})
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={globalPrefix}
              onChange={(e) => setGlobalPrefix(e.target.value)}
              placeholder="Prefix (e.g. ProjectName_)"
              className="w-full px-2 py-1.5 rounded text-xs"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={globalSuffix}
              onChange={(e) => setGlobalSuffix(e.target.value)}
              placeholder="Suffix (e.g. _v1)"
              className="w-full px-2 py-1.5 rounded text-xs"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveToParent}
          className="btn-accent text-xs px-3 py-1.5"
        >
          Save {tabMeta?.label} naming
        </button>
        {hasOverride && (
          <button type="button" onClick={resetToShared} className="btn-glass text-xs px-3 py-1.5">
            Use default naming
          </button>
        )}
      </div>

      {showApplyElsewhere && otherKinds.length > 0 && (
        <div
          className="rounded-[var(--radius-lg)] p-3 space-y-2"
          style={{ border: '1px solid var(--accent-border)', background: 'var(--accent-soft)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
            Use this pattern for other bounce types?
          </p>
          <div className="flex flex-wrap gap-3">
            {otherKinds.map((k) => {
              const label = PATTERN_TABS.find((t) => t.id === k)?.label ?? k;
              return (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyElsewhereSelected.has(k)}
                    onChange={() => toggleApplyTarget(k)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-xs" style={{ color: 'var(--text)' }}>
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={applyPatternToSelectedOthers}
              disabled={applyElsewhereSelected.size === 0}
              className="btn-accent text-xs px-3 py-1.5"
              style={{ opacity: applyElsewhereSelected.size === 0 ? 0.45 : 1 }}
            >
              Apply to selected
            </button>
            <button
              type="button"
              onClick={() => setShowApplyElsewhere(false)}
              className="btn-glass text-xs px-3 py-1.5"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TokenSetupPanel({
  defaultNaming,
  onSave,
}: {
  defaultNaming: DefaultNaming;
  onSave: (n: DefaultNaming) => void;
}) {
  const tf = defaultNaming.tokenFormat ?? {};
  const [dateStyle, setDateStyle] = useState<'iso' | 'us' | 'eu'>(tf.dateStyle ?? 'us');
  const [shortYear, setShortYear] = useState(tf.shortYear ?? true);
  const [time24h, setTime24h] = useState(tf.time24h !== false);
  const [sampleRateDisplay, setSampleRateDisplay] = useState<'khz' | 'hz'>(tf.sampleRateDisplay ?? 'khz');
  const [sampleRateShowUnit, setSampleRateShowUnit] = useState(tf.sampleRateShowUnit !== false);
  const [bitDepthShowUnit, setBitDepthShowUnit] = useState(tf.bitDepthShowUnit !== false);
  const [bitDepthHyphen, setBitDepthHyphen] = useState(tf.bitDepthHyphen === true);
  const [partSeparator, setPartSeparator] = useState<PartSeparatorOption>(tf.partSeparator ?? 'hyphen');
  const [partSepBefore, setPartSepBefore] = useState(tf.partSeparatorSpaceBefore !== false);
  const [partSepAfter, setPartSepAfter] = useState(tf.partSeparatorSpaceAfter !== false);
  const [srBdNoSep, setSrBdNoSep] = useState(tf.sampleRateBitDepthNoSeparator === true);

  useEffect(() => {
    const t = defaultNaming.tokenFormat ?? {};
    setDateStyle(t.dateStyle ?? 'us');
    setShortYear(t.shortYear ?? true);
    setTime24h(t.time24h !== false);
    setSampleRateDisplay(t.sampleRateDisplay ?? 'khz');
    setSampleRateShowUnit(t.sampleRateShowUnit !== false);
    setBitDepthShowUnit(t.bitDepthShowUnit !== false);
    setBitDepthHyphen(t.bitDepthHyphen === true);
    setPartSeparator(t.partSeparator ?? 'hyphen');
    setPartSepBefore(t.partSeparatorSpaceBefore !== false);
    setPartSepAfter(t.partSeparatorSpaceAfter !== false);
    setSrBdNoSep(t.sampleRateBitDepthNoSeparator === true);
  }, [defaultNaming]);

  const numberingPreview = useMemo(() => {
    const joiner = formatPartSeparatorJoiner(
      {
        partSeparator,
        partSeparatorSpaceBefore: partSepBefore,
        partSeparatorSpaceAfter: partSepAfter,
      },
      defaultNaming.separator
    );
    return `01${joiner}FinalMix`;
  }, [partSeparator, partSepBefore, partSepAfter, defaultNaming.separator]);

  const preview = useMemo(() => {
    const fmt: TokenFormatSettings = {
      partSeparator,
      partSeparatorSpaceBefore: partSepBefore,
      partSeparatorSpaceAfter: partSepAfter,
      dateStyle,
      shortYear,
      time24h,
      sampleRateDisplay,
      sampleRateShowUnit,
      bitDepthShowUnit,
      bitDepthHyphen,
      sampleRateBitDepthNoSeparator: srBdNoSep,
    };
    const partJoiner = formatPartSeparatorJoiner(
      {
        partSeparator,
        partSeparatorSpaceBefore: partSepBefore,
        partSeparatorSpaceAfter: partSepAfter,
      },
      defaultNaming.separator
    );
    const template = buildTemplateFromParts(
      [{ id: 'date' }, { id: 'time' }, { id: 'sampleRate' }, { id: 'bitDepth' }],
      partJoiner,
      fmt
    );
    return applyNamingTemplate(
      template,
      { name: 'Kick', sampleRateHz: 48000, bitDepth: 24, sessionName: 'MySession' },
      fmt
    );
  }, [
    dateStyle,
    shortYear,
    time24h,
    sampleRateDisplay,
    sampleRateShowUnit,
    bitDepthShowUnit,
    bitDepthHyphen,
    srBdNoSep,
    partSeparator,
    partSepBefore,
    partSepAfter,
    defaultNaming.separator,
  ]);

  const saveTokens = useCallback(() => {
    onSave({
      ...defaultNaming,
      tokenFormat: {
        partSeparator,
        partSeparatorSpaceBefore: partSepBefore,
        partSeparatorSpaceAfter: partSepAfter,
        dateStyle,
        shortYear,
        time24h,
        sampleRateDisplay,
        sampleRateShowUnit,
        bitDepthShowUnit,
        bitDepthHyphen,
        sampleRateBitDepthNoSeparator: srBdNoSep,
      },
    });
  }, [
    defaultNaming,
    partSeparator,
    partSepBefore,
    partSepAfter,
    dateStyle,
    shortYear,
    time24h,
    sampleRateDisplay,
    sampleRateShowUnit,
    bitDepthShowUnit,
    bitDepthHyphen,
    srBdNoSep,
    onSave,
  ]);

  const clearTokens = useCallback(() => {
    onSave({
      ...defaultNaming,
      tokenFormat: { ...DEFAULT_TOKEN_FORMAT },
    });
  }, [defaultNaming, onSave]);

  const fmtPreview: TokenFormatSettings = {
    partSeparator,
    partSeparatorSpaceBefore: partSepBefore,
    partSeparatorSpaceAfter: partSepAfter,
    dateStyle,
    shortYear,
    time24h,
    sampleRateDisplay,
    sampleRateShowUnit,
    bitDepthShowUnit,
    bitDepthHyphen,
    sampleRateBitDepthNoSeparator: srBdNoSep,
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-[var(--radius-lg)] p-3"
        style={{ border: '1px solid var(--divider)', background: 'rgba(0,0,0,0.22)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
            Separator Formatting
          </p>
          <div
            className="rounded-md px-2.5 py-1 text-[11px] font-mono shrink-0"
            style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid var(--divider-strong)',
              color: 'var(--text)',
            }}
          >
            {numberingPreview}
          </div>
        </div>
        <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
          Separator
        </label>
        <select
          value={partSeparator}
          onChange={(e) => setPartSeparator(e.target.value as PartSeparatorOption)}
          className="w-full px-2 py-1.5 rounded-lg text-xs mb-3"
          style={{
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid var(--divider-strong)',
            color: 'var(--text)',
          }}
        >
          <option value="hyphen">Hyphen (-)</option>
          <option value="underscore">Underscore (_)</option>
          <option value="space">Space</option>
          <option value="none">None</option>
        </select>
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={partSepBefore}
            onChange={(e) => setPartSepBefore(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span className="text-xs" style={{ color: 'var(--text)' }}>
            Space before separator
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={partSepAfter}
            onChange={(e) => setPartSepAfter(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span className="text-xs" style={{ color: 'var(--text)' }}>
            Space after separator
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          className="rounded-[var(--radius-lg)] p-3"
          style={{ border: '1px solid var(--divider)', background: 'rgba(0,0,0,0.22)' }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
            Date
          </p>
          <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
            Order
          </label>
          <select
            value={dateStyle}
            onChange={(e) => setDateStyle(e.target.value as 'iso' | 'us' | 'eu')}
            className="w-full px-2 py-1.5 rounded-lg text-xs mb-2"
            style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid var(--divider-strong)',
              color: 'var(--text)',
            }}
          >
            <option value="iso">YYYY-MM-DD (ISO)</option>
            <option value="us">MM/DD/YYYY (US)</option>
            <option value="eu">DD/MM/YYYY (EU)</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={shortYear}
              onChange={(e) => setShortYear(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span className="text-xs" style={{ color: 'var(--text)' }}>
              Short year (YY)
            </span>
          </label>
        </div>

        <div
          className="rounded-[var(--radius-lg)] p-3"
          style={{ border: '1px solid var(--divider)', background: 'rgba(0,0,0,0.22)' }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
            Time
          </p>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={time24h}
              onChange={(e) => setTime24h(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span className="text-xs" style={{ color: 'var(--text)' }}>
              24-hour time
            </span>
          </label>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            When off, time uses 12-hour with AM/PM.
          </p>
        </div>

        <div
          className="rounded-[var(--radius-lg)] p-3"
          style={{ border: '1px solid var(--divider)', background: 'rgba(0,0,0,0.22)' }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
            Sample rate
          </p>
          <div
            className="rounded-md px-2 py-1.5 text-xs mb-2 font-mono"
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--divider-strong)', color: 'var(--text)' }}
          >
            {formatSampleRateForToken(44100, fmtPreview)}
          </div>
          <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
            Display
          </label>
          <select
            value={sampleRateDisplay}
            onChange={(e) => setSampleRateDisplay(e.target.value as 'khz' | 'hz')}
            className="w-full px-2 py-1.5 rounded-lg text-xs mb-2"
            style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid var(--divider-strong)',
              color: 'var(--text)',
            }}
          >
            <option value="khz">kHz (e.g. 44.1 kHz)</option>
            <option value="hz">Hz (e.g. 44100 Hz)</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sampleRateShowUnit}
              onChange={(e) => setSampleRateShowUnit(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span className="text-xs" style={{ color: 'var(--text)' }}>
              Show unit
            </span>
          </label>
        </div>

        <div
          className="rounded-[var(--radius-lg)] p-3"
          style={{ border: '1px solid var(--divider)', background: 'rgba(0,0,0,0.22)' }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
            Bit depth
          </p>
          <div
            className="rounded-md px-2 py-1.5 text-xs mb-2 font-mono"
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--divider-strong)', color: 'var(--text)' }}
          >
            {formatBitDepthForToken(24, fmtPreview)}
          </div>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={bitDepthShowUnit}
              onChange={(e) => setBitDepthShowUnit(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span className="text-xs" style={{ color: 'var(--text)' }}>
              Show &quot;bit&quot; suffix
            </span>
          </label>
          {bitDepthShowUnit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={bitDepthHyphen}
                onChange={(e) => setBitDepthHyphen(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span className="text-xs" style={{ color: 'var(--text)' }}>
                Hyphen before &quot;bit&quot; (24-bit vs 24bit)
              </span>
            </label>
          )}
        </div>
      </div>

      <div
        className="rounded-[var(--radius-lg)] p-3"
        style={{ border: '1px solid var(--divider)', background: 'rgba(0,0,0,0.22)' }}
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={srBdNoSep}
            onChange={(e) => setSrBdNoSep(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span className="text-xs" style={{ color: 'var(--text)' }}>
            Single space between sample rate and bit depth (instead of the usual separator) when adjacent
          </span>
        </label>
      </div>

      <div
        className="rounded-lg px-3 py-2 text-xs"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Preview: </span>
        <span style={{ color: 'var(--text)' }}>{preview}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={saveTokens} className="btn-accent text-xs px-3 py-1.5">
          Save formatting
        </button>
        {defaultNaming.tokenFormat && (
          <button type="button" onClick={clearTokens} className="btn-glass text-xs px-3 py-1.5">
            Reset to app default
          </button>
        )}
      </div>
    </div>
  );
}

interface TokenChipProps {
  id: NamingTokenId;
  index: number;
  value: string | undefined;
  onValueChange: (v: string) => void;
  onDropAt: (fromIndex: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
  previewValue: string;
}

function TokenChip({
  id,
  index,
  value,
  onValueChange,
  onDropAt,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  isDragging,
  isDropTarget,
  previewValue,
}: TokenChipProps) {
  const def = NAMING_TOKEN_DEFS[id];
  const hasCustomValue = def.hasCustomValue;
  const [editing, setEditing] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart();
  };
  const handleDragEnd = () => {
    onDragEnd();
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    onDragEnter();
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) onDragLeave();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(from) && from !== index) onDropAt(from);
    onDragEnd();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex items-center gap-1 rounded px-2 py-1 cursor-grab active:cursor-grabbing transition-opacity transition-colors"
      style={{
        background: isDropTarget ? 'var(--accent-soft)' : 'rgba(255,255,255,0.08)',
        border: `1px solid ${isDropTarget ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}`,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>
          {def.label}:
        </span>
        {hasCustomValue && editing ? (
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onValueChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
            placeholder={def.placeholder}
            autoFocus
            className="flex-1 min-w-[60px] px-1.5 py-0.5 rounded text-xs bg-black/20 border border-white/10"
            style={{ color: 'var(--text)' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => hasCustomValue && setEditing(true)}
            className="text-xs truncate max-w-[80px] text-left"
            style={{ color: 'var(--text)' }}
          >
            {previewValue || (hasCustomValue ? def.placeholder : previewValue)}
          </button>
        )}
      </div>
    </div>
  );
}
