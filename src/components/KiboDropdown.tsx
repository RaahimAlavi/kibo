// src/components/KiboDropdown.tsx
import React, { useEffect, useRef, useState } from 'react';

export interface KiboDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  group?: string;
}

interface KiboDropdownProps {
  value: string;
  options: KiboDropdownOption[];
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
  placeholder?: string;
  width?: number | string;
  maxWidth?: number | string;
  align?: 'left' | 'right';
}

export const KiboDropdown: React.FC<KiboDropdownProps> = ({
  value,
  options,
  onChange,
  onPreview,
  placeholder = 'Select...',
  width = 210,
  maxWidth = 240,
  align = 'right',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Group options preserving declaration order
  const groups: Array<{ name: string | null; items: KiboDropdownOption[] }> = [];
  for (const opt of options) {
    const gName = opt.group || null;
    const existing = groups.find((g) => g.name === gName);
    if (existing) {
      existing.items.push(opt);
    } else {
      groups.push({ name: gName, items: [opt] });
    }
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        maxWidth,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          width: '100%',
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: '#1C1C1F',
          color: '#F4F4F5',
          border: open ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(255, 255, 255, 0.11)',
          borderRadius: 8,
          padding: '0 10px',
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.15s ease, background 0.15s ease',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'left',
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            opacity: 0.65,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            [align]: 0,
            minWidth: '100%',
            width: Math.max(typeof width === 'number' ? width : 220, 230),
            maxHeight: 260,
            overflowY: 'auto',
            background: '#1B1B1E',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 10,
            boxShadow: '0 14px 34px rgba(0, 0, 0, 0.62)',
            padding: 5,
            zIndex: 9999,
          }}
        >
          {groups.map((grp, gIdx) => (
            <div key={grp.name || `g-${gIdx}`} style={{ marginTop: gIdx > 0 ? 6 : 0 }}>
              {grp.name && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: '#71717A',
                    padding: '5px 8px 4px',
                  }}
                >
                  {grp.name}
                </div>
              )}
              {grp.items.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 7,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
                      color: isSelected ? '#FFFFFF' : '#D4D4D8',
                      fontSize: 12,
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                      <div
                        style={{
                          fontWeight: isSelected ? 600 : 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {opt.label}
                      </div>
                      {opt.sublabel && (
                        <div
                          style={{
                            fontSize: 10.5,
                            color: '#8E8E93',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {opt.sublabel}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {onPreview && (
                        <button
                          type="button"
                          title="Preview voice"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreview(opt.value);
                          }}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#E4E4E7',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="6 4 20 12 6 20 6 4" />
                          </svg>
                        </button>
                      )}
                      {isSelected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#0A84FF"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
