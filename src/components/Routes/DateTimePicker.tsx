import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  min?: string;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDisplay(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Select date & time...',
  icon,
  min,
}: DateTimePickerProps) {
  const now = new Date();
  const parsed = value ? new Date(value) : null;

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(parsed?.getDate() ?? null);
  const [hours, setHours] = useState(parsed ? (parsed.getHours() % 12 || 12) : 12);
  const [minutes, setMinutes] = useState(parsed?.getMinutes() ?? 0);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed ? (parsed.getHours() >= 12 ? 'PM' : 'AM') : 'AM');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const inputRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Build the datetime-local string and call onChange
  const emitValue = useCallback((day: number, h: number, m: number, ap: 'AM' | 'PM') => {
    let h24 = h % 12;
    if (ap === 'PM') h24 += 12;
    const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}T${pad(h24)}:${pad(m)}`;
    onChange(iso);
  }, [viewYear, viewMonth, onChange]);

  // Sync internal state when value prop changes externally
  useEffect(() => {
    if (!value) return;
    const d = new Date(value);
    if (isNaN(d.getTime())) return;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(d.getDate());
    const h = d.getHours();
    setHours(h % 12 || 12);
    setMinutes(d.getMinutes());
    setAmpm(h >= 12 ? 'PM' : 'AM');
  }, [value]);

  // Position the dropdown
  const updatePosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const pickerHeight = 420;
      setDropdownPos({
        top: spaceBelow >= pickerHeight ? rect.bottom + 4 : rect.top - pickerHeight - 4,
        left: rect.left,
        width: Math.max(rect.width, 320),
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current && !inputRef.current.contains(target) &&
        pickerRef.current && !pickerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    emitValue(day, hours, minutes, ampm);
  };

  const handleTimeChange = (h: number, m: number, ap: 'AM' | 'PM') => {
    setHours(h);
    setMinutes(m);
    setAmpm(ap);
    if (selectedDay) {
      emitValue(selectedDay, h, m, ap);
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  // Min date check
  const minDate = min ? new Date(min) : null;
  const isDayDisabled = (day: number) => {
    if (!minDate) return false;
    const cellDate = new Date(viewYear, viewMonth, day, 23, 59, 59);
    return cellDate < minDate;
  };

  return (
    <div className="relative">
      <div
        ref={inputRef}
        onClick={() => {
          updatePosition();
          setIsOpen(!isOpen);
        }}
        className="w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all cursor-pointer flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className={value ? 'text-white' : 'text-[#D9DCE1]/50'}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </div>
        <Calendar className="w-4 h-4 text-[#00E5FF]" />
      </div>

      {isOpen && createPortal(
        <div
          ref={pickerRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className="bg-[#0C1E2C] border border-[#00E5FF]/40 rounded-xl shadow-[0_0_30px_rgba(0,229,255,0.25)] overflow-hidden"
        >
          {/* Month/Year Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#00E5FF]/20">
            <button
              type="button"
              onClick={prevMonth}
              title="Previous month"
              className="p-1.5 hover:bg-[#009FFD]/20 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[#00E5FF]" />
            </button>
            <span className="text-white font-medium text-sm">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              title="Next month"
              className="p-1.5 hover:bg-[#009FFD]/20 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-[#00E5FF]" />
            </button>
          </div>

          {/* Day Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '8px 12px 0' }}>
            {DAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 600, color: 'rgba(0,229,255,0.7)', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '4px 12px 8px', gap: '2px' }}>
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - firstDay + 1;
              const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
              const isSelected = isCurrentMonth && dayNum === selectedDay && parsed?.getMonth() === viewMonth && parsed?.getFullYear() === viewYear;
              const disabled = isCurrentMonth && isDayDisabled(dayNum);

              // Previous month trailing days
              if (dayNum < 1) {
                const prevDay = prevMonthDays + dayNum;
                return (
                  <div key={`prev-${i}`} style={{ textAlign: 'center', padding: '6px 0', fontSize: '12px', color: 'rgba(217,220,225,0.2)' }}>
                    {prevDay}
                  </div>
                );
              }

              // Next month leading days
              if (dayNum > daysInMonth) {
                const nextDay = dayNum - daysInMonth;
                return (
                  <div key={`next-${i}`} style={{ textAlign: 'center', padding: '6px 0', fontSize: '12px', color: 'rgba(217,220,225,0.2)' }}>
                    {nextDay}
                  </div>
                );
              }

              const baseStyle: React.CSSProperties = {
                textAlign: 'center',
                padding: '6px 0',
                fontSize: '12px',
                borderRadius: '8px',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                background: isSelected
                  ? '#00E5FF'
                  : isToday(dayNum)
                    ? 'rgba(0,159,253,0.2)'
                    : 'transparent',
                color: isSelected
                  ? '#07121A'
                  : isToday(dayNum)
                    ? '#00E5FF'
                    : disabled
                      ? 'rgba(217,220,225,0.2)'
                      : 'rgba(217,220,225,0.8)',
                fontWeight: isSelected ? 700 : isToday(dayNum) ? 500 : 400,
              };

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDayClick(dayNum)}
                  style={baseStyle}
                  onMouseEnter={(e) => {
                    if (!disabled && !isSelected) {
                      e.currentTarget.style.background = 'rgba(0,159,253,0.2)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!disabled && !isSelected) {
                      e.currentTarget.style.background = isToday(dayNum) ? 'rgba(0,159,253,0.2)' : 'transparent';
                      e.currentTarget.style.color = isToday(dayNum) ? '#00E5FF' : 'rgba(217,220,225,0.8)';
                    }
                  }}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Time Picker */}
          <div className="border-t border-[#00E5FF]/20 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span className="text-xs text-[#D9DCE1]/60">Time</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Hours */}
              <select
                value={hours}
                onChange={(e) => handleTimeChange(Number(e.target.value), minutes, ampm)}
                aria-label="Hours"
                className="bg-[#07121A] border border-[#00E5FF]/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00E5FF] appearance-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{pad(h)}</option>
                ))}
              </select>
              <span className="text-[#00E5FF] font-bold">:</span>
              {/* Minutes */}
              <select
                value={minutes}
                onChange={(e) => handleTimeChange(hours, Number(e.target.value), ampm)}
                aria-label="Minutes"
                className="bg-[#07121A] border border-[#00E5FF]/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00E5FF] appearance-none cursor-pointer"
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>{pad(m)}</option>
                ))}
              </select>
              {/* AM/PM */}
              <div className="flex rounded-lg overflow-hidden border border-[#00E5FF]/30">
                <button
                  type="button"
                  onClick={() => handleTimeChange(hours, minutes, 'AM')}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    ampm === 'AM'
                      ? 'bg-[#00E5FF] text-[#07121A]'
                      : 'bg-[#07121A] text-[#D9DCE1]/60 hover:text-white'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handleTimeChange(hours, minutes, 'PM')}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    ampm === 'PM'
                      ? 'bg-[#00E5FF] text-[#07121A]'
                      : 'bg-[#07121A] text-[#D9DCE1]/60 hover:text-white'
                  }`}
                >
                  PM
                </button>
              </div>
              {/* Done button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="ml-auto px-4 py-2 bg-[#28B463] hover:bg-[#28B463]/80 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
