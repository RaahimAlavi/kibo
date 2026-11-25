// src/components/AutoGrowTranscript.tsx
import React, { useLayoutEffect, useRef } from 'react';

interface AutoGrowTranscriptProps {
  value: string;
  onChange: (nextValue: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  maxHeight?: number;
}

export const AutoGrowTranscript: React.FC<AutoGrowTranscriptProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className = '',
  style,
  autoFocus,
  maxHeight = 168,
}) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(22, nextHeight)}px`;
    if (el.scrollHeight > maxHeight) {
      el.scrollTop = el.scrollHeight;
    }
  }, [value, maxHeight]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`kibo-autogrow-transcript ${className}`.trim()}
      style={style}
      autoFocus={autoFocus}
      spellCheck={false}
    />
  );
};
