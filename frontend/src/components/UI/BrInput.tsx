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
export function BrCurrencyInput({ value, onChange, className, ...props }: BrCurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits, comma and dot only
    let raw = e.target.value.replace(/[^\d.,]/g, '');
    // Only one comma or dot allowed
    const commas = (raw.match(/,/g) || []).length;
    const dots = (raw.match(/\./g) || []).length;
    if (commas > 1) {
      raw = raw.slice(0, e.target.value.lastIndexOf(','));
    }
    if (dots > 1) {
      raw = raw.slice(0, e.target.value.lastIndexOf('.'));
    }
    onChange(raw);
  };

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      placeholder="0,00"
      className={className}
    />
  );
}
