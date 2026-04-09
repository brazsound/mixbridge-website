import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { TrackInfo } from '../hooks/useProToolsData';
import { SearchableSelect } from './SearchableSelect';

type DestType = 'below' | 'folder';

interface ImportBackPanelProps {
  connected: boolean;
  tracks: TrackInfo[];
  folderTracks: TrackInfo[];
  ptDataLoading: boolean;
}

export function ImportBackPanel({
  connected,
  tracks,
  folderTracks,
  ptDataLoading,
}: ImportBackPanelProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [destType, setDestType] = useState<DestType>('below');
  const [selectedTrackOrFolder, setSelectedTrackOrFolder] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const options = destType === 'below' ? tracks : folderTracks;
  const selectOptions = useMemo(
    () => options.map((t) => ({ value: t.name, label: t.name })),
    [options]
  );
  const panelRef = useRef<HTMLDivElement>(null);

  // Must be defined before the useEffect that depends on it
  const handleClose = useCallback(() => {
    setShowPanel(false);
    setFilePaths([]);
    setSelectedTrackOrFolder('');
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!showPanel) return;
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showPanel, handleClose]);

  const handleSelectFiles = useCallback(async () => {
    if (!window.ptsl?.selectFilesToImport) return;
    setMessage(null);
    const res = await window.ptsl.selectFilesToImport();
    if (res.canceled || !res.filePaths?.length) {
      setShowPanel(false);
      return;
    }
    setFilePaths(res.filePaths);
    setShowPanel(true);
    setSelectedTrackOrFolder('');
  }, []);

  const handleImport = useCallback(async () => {
    if (!window.ptsl?.importAudioBack || !filePaths.length || !selectedTrackOrFolder) return;
    setMessage(null);
    setImporting(true);
    try {
      const res = await window.ptsl.importAudioBack(filePaths, {
        type: destType,
        trackOrFolderName: selectedTrackOrFolder,
      });
      if (res.error) {
        setMessage({ type: 'error', text: res.error });
      } else {
        setMessage({
          type: 'success',
          text: `Imported ${res.trackCount ?? filePaths.length} file(s) successfully`,
        });
        setFilePaths([]);
        setSelectedTrackOrFolder('');
        setTimeout(() => {
          setShowPanel(false);
          setMessage(null);
        }, 2000);
      }
    } finally {
      setImporting(false);
    }
  }, [filePaths, destType, selectedTrackOrFolder]);

  if (!connected) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleSelectFiles}
        disabled={ptDataLoading}
        title="Import audio files back into the session"
        className="btn-glass"
        style={{ borderColor: 'rgba(34,197,94,0.35)' }}
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        Import Back
      </button>

      {showPanel && (
        <div
          className="absolute left-0 top-full mt-2 z-50 min-w-[320px] rounded-xl overflow-hidden glass"
          style={{
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
              Import {filePaths.length} file{filePaths.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-[var(--surface-hover-strong)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Where should the new tracks go?
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDestType('below');
                  setSelectedTrackOrFolder('');
                }}
                className="flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-colors"
                style={
                  destType === 'below'
                    ? {
                        background: 'rgba(255,255,255,0.1)',
                        borderColor: 'rgba(255,255,255,0.2)',
                        color: 'var(--text)',
                      }
                    : {
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: 'var(--text-muted)',
                      }
                }
              >
                Below track
              </button>
              <button
                type="button"
                onClick={() => {
                  setDestType('folder');
                  setSelectedTrackOrFolder('');
                }}
                className="flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-colors"
                style={
                  destType === 'folder'
                    ? {
                        background: 'rgba(255,255,255,0.1)',
                        borderColor: 'rgba(255,255,255,0.2)',
                        color: 'var(--text)',
                      }
                    : {
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: 'var(--text-muted)',
                      }
                }
              >
                Into folder
              </button>
            </div>

            <div>
              <label
                className="block text-[11px] font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {destType === 'below' ? 'Insert below' : 'Folder'}
              </label>
              <SearchableSelect
                value={selectedTrackOrFolder}
                onChange={setSelectedTrackOrFolder}
                options={selectOptions}
                placeholder={
                  options.length === 0
                    ? destType === 'folder'
                      ? 'No folders in session'
                      : 'No tracks'
                    : `Select ${destType === 'folder' ? 'folder' : 'track'}…`
                }
                emptyMessage={
                  destType === 'folder' ? 'No folders in session' : 'No tracks in session'
                }
                disabled={options.length === 0}
              />
            </div>

            {message && (
              <div
                className="px-3 py-2 text-xs rounded-lg"
                style={{
                  background:
                    message.type === 'success' ? 'var(--success-soft)' : 'var(--danger-soft)',
                  border: `1px solid ${message.type === 'success' ? 'rgba(50,215,75,0.3)' : 'rgba(255,69,58,0.3)'}`,
                  color: message.type === 'success' ? '#5ef07a' : '#ff8a80',
                }}
              >
                {message.text}
              </div>
            )}

            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !selectedTrackOrFolder || options.length === 0}
              className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors"
              style={{
                background: selectedTrackOrFolder ? 'var(--success)' : 'rgba(255,255,255,0.08)',
                color: selectedTrackOrFolder ? '#000' : 'var(--text-muted)',
              }}
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
