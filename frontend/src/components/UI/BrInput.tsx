import React, { useState, useEffect, useRef } from 'react';
import { maskDate, toISODate, toDisplayDate, parseBrCurrency } from '../../utils/formatters';

interface BrDateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
}

/**
 * Date input that shows DD/MM/AAAA mask and stores/returns YYYY-MM-DD
 */
export function BrDateInput({ value, onChange, className, ...props }: BrDateInputProps) {
  const [display, setDisplay] = useState(value ? toDisplayDate(value) : '');

  useEffect(() => {
    setDisplay(value ? toDisplayDate(value) : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskDate(e.target.value);
    setDisplay(masked);
    if (masked.length === 10) {
      const iso = toISODate(masked);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) onChange(iso);
    } else {
      onChange('');
    }
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder="DD/MM/AAAA"
      maxLength={10}
      className={className}
    />
  );
}

interface BrCurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string; // raw string that may have comma or dot
  onChange: (raw: string) => void;
}

/**
 * Currency input that accepts comma as decimal separator.
 * Stores and returns raw string (e.g. "1234,56" or "1234.56").
 * Use parseBrCurrency() to convert to float before saving.
 */
export function BrCurrencyInput({ value, onChange, className, onBlur, ...props }: BrCurrencyInputProps & { onBlur?: React.FocusEventHandler<HTMLInputElement> }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d.,]/g, '');
    const commas = (raw.match(/,/g) || []).length;
    const dots = (raw.match(/\./g) || []).length;
    if (commas > 1) raw = raw.slice(0, raw.lastIndexOf(','));
    if (dots > 1) raw = raw.slice(0, raw.lastIndexOf('.'));
    onChange(raw);
  };

  // On blur: format to 2 decimal places (e.g. "1500" → "1500,00", "12,5" → "12,50")
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (value) {
      const num = parseBrCurrency(value);
      if (!isNaN(num) && num > 0) {
        onChange(num.toFixed(2).replace('.', ','));
      }
    }
    onBlur?.(e);
  };

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="0,00"
      className={className}
    />
  );
}
