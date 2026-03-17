import React, { useState, useEffect, useCallback } from 'react';
import type { DefaultNaming } from '../hooks/useSettings';
import type { NamingPart, NamingTokenId } from '../utils/naming';
import {
  NAMING_TOKEN_DEFS,
  buildTemplateFromParts,
  applyNamingTemplate,
} from '../utils/naming';

interface SettingsNamingProps {
  defaultNaming: DefaultNaming;
  onSave: (naming: DefaultNaming) => void;
}

const TOKEN_ORDER: NamingTokenId[] = [
  'prefix',
  'name',
  'date',
  'time',
  'session',
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
  const parts = defaultNaming.templateParts ?? [{ id: 'prefix' as const, value: 'Stem' }, { id: 'name' }];
  const separator = defaultNaming.separator ?? '_';

  const { order: initialOrder, values: initialValues } = partsToOrderAndValues(parts);
  const [order, setOrder] = useState<NamingTokenId[]>(initialOrder);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [sep, setSep] = useState(separator);
  const [globalPrefix, setGlobalPrefix] = useState(defaultNaming.globalPrefix ?? '');
  const [globalSuffix, setGlobalSuffix] = useState(defaultNaming.globalSuffix ?? '');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    const { order: o, values: v } = partsToOrderAndValues(parts);
    setOrder(o);
    setValues(v);
    setSep(defaultNaming.separator ?? '_');
    setGlobalPrefix(defaultNaming.globalPrefix ?? '');
    setGlobalSuffix(defaultNaming.globalSuffix ?? '');
  }, [defaultNaming]);

  const currentParts = orderAndValuesToParts(order, values);
  const template = buildTemplateFromParts(currentParts, sep);
  const basePreview = applyNamingTemplate(template, { name: 'Kick' });
  const preview = globalPrefix + basePreview + globalSuffix;

  const saveToParent = useCallback(() => {
    onSave({
      ...defaultNaming,
      templateParts: currentParts,
      separator: sep,
      globalPrefix: globalPrefix.trim() || undefined,
      globalSuffix: globalSuffix.trim() || undefined,
    });
  }, [defaultNaming, currentParts, sep, globalPrefix, globalSuffix, onSave]);

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

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Choose which parts to include and drag to reorder. Preview updates as you change things.
      </p>

      {/* Part toggles */}
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
                  background: enabled ? 'rgba(10,132,255,0.2)' : 'var(--surface)',
                  border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
                  color: enabled ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {def.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Draggable preview */}
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
                {/* Insertion line before this chip (or after last when dropping at end) */}
                {dragOverIndex === index && draggingIndex !== null && draggingIndex !== index && index < order.length - 1 && (
                  <div
                    className="shrink-0 rounded-full"
                    style={{
                      width: '3px',
                      height: '20px',
                      background: 'var(--accent)',
                      boxShadow: '0 0 8px rgba(10,132,255,0.6)',
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
                  onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null); }}
                  onDragEnter={() => setDragOverIndex(index)}
                  onDragLeave={() => setDragOverIndex((i) => (i === index ? null : i))}
                  isDragging={draggingIndex === index}
                  isDropTarget={false}
                  previewValue={
                  id === 'name'
                    ? 'Kick'
                    : id === 'date'
                    ? new Date().toISOString().slice(0, 10)
                    : id === 'time'
                    ? new Date().toTimeString().slice(0, 5).replace(':', '-')
                    : id === 'session'
                    ? 'MySession'
                    : id === 'number'
                    ? '1'
                    : values[id] ?? ''
                }
                />
                {/* Insertion line after last chip when dropping at end */}
                {dragOverIndex === index && draggingIndex !== null && draggingIndex !== index && index === order.length - 1 && (
                  <div
                    className="shrink-0 rounded-full"
                    style={{
                      width: '3px',
                      height: '20px',
                      background: 'var(--accent)',
                      boxShadow: '0 0 8px rgba(10,132,255,0.6)',
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

      {/* Separator */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          Separator between parts
        </label>
        <input
          type="text"
          value={sep}
          onChange={(e) => setSep(e.target.value)}
          placeholder="e.g. _ or -"
          className="w-full px-2 py-1.5 rounded text-xs"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        />
      </div>

      {/* Global prefix & suffix */}
      <div className="space-y-2">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Add to every name
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

      <button
        type="button"
        onClick={saveToParent}
        className="px-3 py-1.5 text-xs rounded-md font-medium transition-colors"
        style={{
          background: 'var(--accent)',
          color: '#fff',
        }}
      >
        Save
      </button>
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
        background: isDropTarget ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.08)',
        border: `1px solid ${isDropTarget ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}`,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Content */}
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
