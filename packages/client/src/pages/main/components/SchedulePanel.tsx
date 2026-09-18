import { memo, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Event } from '../../../api';
import type { ScheduleCreateOptions } from '../hooks/useMainContentActions';
import { addMonths, daysInMonth, startOfMonth, toLocalDateKey } from '../utils/date';
import { cn } from '../../../utils/cn';
import { PanelTitleRow, panelTitleRowBg } from '../../../components/PanelDragHeader';
import { useThemeStore } from '../../../store';
import { getOrgTheme } from '../../../utils/orgTheme';

type EventFormState = {
  title: string;
  startAt: string;
  endAt: string;
  description: string;
};

type CreateTab = 'normal' | 'period' | 'repeat';

type SchedulePanelProps = {
  isDark: boolean;
  isNarrowLayout: boolean;
  panelWrapStyle: (maxWidth: number) => { className: string; style: React.CSSProperties };
  calendarMonth: Date;
  selectedDate: string;
  eventsByDate: Map<string, Event[]>;
  eventForm: EventFormState;
  editingEventId: string | null;
  setCalendarMonth: Dispatch<SetStateAction<Date>>;
  setSelectedDate: Dispatch<SetStateAction<string>>;
  setEventForm: Dispatch<SetStateAction<EventFormState>>;
  onUpdateEvent: () => void | Promise<void>;
  onCreateEvent: (options?: ScheduleCreateOptions) => void | Promise<void>;
  onCancelEdit: () => void;
  onEditEvent: (ev: Event) => void;
  onDeleteEvent: (eventId: string) => void | Promise<void>;
};

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const QUICK_TIME_PRESETS = ['09:00', '10:00', '13:00', '18:00'];

const inputBase =
  'w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors';

const actionBtn = 'rounded-xl px-4 py-2 text-sm font-semibold transition-colors';

const dateKeyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDaysToDateKey = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return dateKeyOf(date);
};

const minDateKey = (a: string, b: string) => (a <= b ? a : b);

const daysInclusiveBetween = (startKey: string, endKey: string) => {
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
};

const getMultiDaySegmentEnd = (rangeEnd: string, cellDateKey: string, cellWeekday: number) =>
  minDateKey(rangeEnd, addDaysToDateKey(cellDateKey, 6 - cellWeekday));

const formatDateLabel = (dateKey: string, compact?: boolean) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  if (compact) return `${year}.${month}.${day}`;
  return `${year}년 ${month}월 ${day}일`;
};

const formatTimeLabel = (time: string) => {
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr || '0');
  const isAm = h < 12;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${isAm ? '오전' : '오후'} ${hour12}:${String(m).padStart(2, '0')}`;
};

const parseTimeParts = (time: string) => {
  const [h = '09', m = '00'] = time.split(':');
  const hour = Math.min(23, Math.max(0, Number(h || '0')));
  const minute = Math.min(59, Math.max(0, Number(m || '0')));
  return { hour, minute };
};

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function SchedulePanel({
  isDark,
  isNarrowLayout,
  panelWrapStyle,
  calendarMonth,
  selectedDate,
  eventsByDate,
  eventForm,
  editingEventId,
  setCalendarMonth,
  setSelectedDate,
  setEventForm,
  onUpdateEvent,
  onCreateEvent,
  onCancelEdit,
  onEditEvent,
  onDeleteEvent,
}: SchedulePanelProps) {
  const accentTheme = useThemeStore((s) => s.accentTheme);
  const orgTheme = getOrgTheme(accentTheme);
  const useCustomAccent = !isDark && orgTheme.id !== 'default';
  const selectedEvents = eventsByDate.get(selectedDate) || [];
  const [createTab, setCreateTab] = useState<CreateTab>('normal');
  const [periodRange, setPeriodRange] = useState<{ startDate: string; endDate: string }>({
    startDate: selectedDate,
    endDate: selectedDate,
  });
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [repeatUntil, setRepeatUntil] = useState(selectedDate);
  const [rangeBaseMonth, setRangeBaseMonth] = useState<Date>(() => startOfMonth(new Date(selectedDate)));
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [draftPeriodRange, setDraftPeriodRange] = useState<{ startDate: string; endDate: string }>({
    startDate: selectedDate,
    endDate: selectedDate,
  });
  const [draftRangeBaseMonth, setDraftRangeBaseMonth] = useState<Date>(() => startOfMonth(new Date(selectedDate)));
  const [draftRangeAnchorDate, setDraftRangeAnchorDate] = useState<string | null>(null);
  const [singleDateModal, setSingleDateModal] = useState<{
    isOpen: boolean;
    target: 'start' | 'end' | null;
    baseMonth: Date;
  }>({
    isOpen: false,
    target: null,
    baseMonth: startOfMonth(new Date(selectedDate)),
  });
  const [timeModal, setTimeModal] = useState<{
    isOpen: boolean;
    target: 'start' | 'end' | null;
    context: 'event' | 'period';
    draftHour: number;
    draftMinute: number;
  }>({
    isOpen: false,
    target: null,
    context: 'event',
    draftHour: 9,
    draftMinute: 0,
  });

  useEffect(() => {
    if (editingEventId) return;
    setPeriodRange((prev) => ({
      startDate: prev.startDate || selectedDate,
      endDate: prev.endDate || selectedDate,
    }));
    setRepeatUntil((prev) => prev || selectedDate);
  }, [selectedDate, editingEventId]);

  const dayCellHeight = isNarrowLayout ? 'h-16' : 'h-[72px]';
  const dateRangeGridClass = isNarrowLayout
    ? 'mb-2 grid grid-cols-1 gap-2'
    : 'mb-2 grid grid-cols-1 gap-2 md:grid-cols-2';
  const pickerFieldClass = cn(
    'flex w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-xl border px-3 py-2 text-sm outline-none focus:outline-none',
    isDark
      ? 'border-brand-dark/30 bg-slate-900 text-slate-100'
      : 'border-brand-dark/25 bg-white text-slate-700',
  );
  const dateTimeTextClass = 'min-w-0 flex-1 truncate whitespace-nowrap text-left';
  const pickerIconSlotClass = 'flex h-[14px] w-[14px] shrink-0 items-center justify-center';
  const pickerIconColorClass = isDark ? 'text-brand-light' : 'text-brand-dark';
  const modalOverlayClass = cn(
    'inset-0 flex items-center justify-center bg-black/40',
    isNarrowLayout ? 'absolute z-[2000] p-2' : 'fixed z-[2000] p-4',
  );
  const modalSurfaceClass = (wide = true) =>
    cn(
      'w-full rounded-2xl border',
      isNarrowLayout ? 'max-w-full p-3' : wide ? 'max-w-[760px] p-4' : 'max-w-[540px] p-4',
      isDark ? 'border-brand-dark/30 bg-slate-900' : 'border-brand-dark/20 bg-white shadow-soft',
    );
  const startTime = eventForm.startAt.slice(11, 16) || '09:00';
  const endTime = eventForm.endAt.slice(11, 16) || '18:00';
  const startDatePart = eventForm.startAt.slice(0, 10) || selectedDate;
  const endDatePart = eventForm.endAt.slice(0, 10) || selectedDate;

  useEffect(() => {
    if (editingEventId || createTab !== 'period') return;
    setEventForm((f) => ({
      ...f,
      startAt: `${periodRange.startDate}T${f.startAt.slice(11, 16) || '09:00'}`,
      endAt: `${periodRange.endDate}T${f.endAt.slice(11, 16) || '18:00'}`,
    }));
  }, [createTab, editingEventId, periodRange.startDate, periodRange.endDate, setEventForm]);

  const selectDraftRangeDate = (dateKey: string) => {
    if (!draftRangeAnchorDate) {
      setDraftPeriodRange({ startDate: dateKey, endDate: dateKey });
      setDraftRangeAnchorDate(dateKey);
      return;
    }
    const [startDate, endDate] = dateKey >= draftRangeAnchorDate
      ? [draftRangeAnchorDate, dateKey]
      : [dateKey, draftRangeAnchorDate];
    setDraftPeriodRange({ startDate, endDate });
    setDraftRangeAnchorDate(null);
  };

  const openRangeModal = () => {
    setDraftPeriodRange(periodRange);
    setDraftRangeBaseMonth(rangeBaseMonth);
    setDraftRangeAnchorDate(null);
    setIsRangeModalOpen(true);
  };

  const applyRangeModal = () => {
    setPeriodRange(draftPeriodRange);
    setRangeBaseMonth(draftRangeBaseMonth);
    setIsRangeModalOpen(false);
  };

  const setEventDateTime = (target: 'start' | 'end', nextDate: string, nextTime: string) => {
    setEventForm((prev) => {
      const currentStartDate = prev.startAt.slice(0, 10) || selectedDate;
      const currentEndDate = prev.endAt.slice(0, 10) || selectedDate;
      const currentStartTime = prev.startAt.slice(11, 16) || '09:00';
      const currentEndTime = prev.endAt.slice(11, 16) || '18:00';
      const startAt = target === 'start'
        ? `${nextDate}T${nextTime}`
        : `${currentStartDate}T${currentStartTime}`;
      const endAt = target === 'end'
        ? `${nextDate}T${nextTime}`
        : `${currentEndDate}T${currentEndTime}`;
      return { ...prev, startAt, endAt };
    });
  };

  const openSingleDateModal = (target: 'start' | 'end') => {
    const currentDate = target === 'start' ? startDatePart : endDatePart;
    setSingleDateModal({
      isOpen: true,
      target,
      baseMonth: startOfMonth(new Date(currentDate || selectedDate)),
    });
  };

  const applySingleDate = (dateKey: string) => {
    if (!singleDateModal.target) return;
    const targetTime = singleDateModal.target === 'start' ? startTime : endTime;
    setEventDateTime(singleDateModal.target, dateKey, targetTime);
    setSingleDateModal((prev) => ({ ...prev, isOpen: false, target: null }));
  };

  const applyTimeValue = (target: 'start' | 'end', context: 'event' | 'period', time: string) => {
    if (!time) return;
    if (context === 'period') {
      setEventForm((f) => ({
        ...f,
        startAt: target === 'start' ? `${periodRange.startDate}T${time}` : f.startAt,
        endAt: target === 'end' ? `${periodRange.endDate}T${time}` : f.endAt,
      }));
    } else {
      const datePart = target === 'start' ? startDatePart : endDatePart;
      setEventDateTime(target, datePart, time);
    }
  };

  const getCurrentTimeValue = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const openTimeModal = (target: 'start' | 'end', context: 'event' | 'period' = 'event') => {
    const source = target === 'start' ? startTime : endTime;
    const { hour, minute } = parseTimeParts(source);
    setTimeModal({
      isOpen: true,
      target,
      context,
      draftHour: hour,
      draftMinute: minute,
    });
  };

  const closeTimeModal = () => {
    setTimeModal((prev) => ({ ...prev, isOpen: false, target: null, context: 'event' }));
  };

  const applyTimeModal = () => {
    if (!timeModal.target) return;
    const time = `${String(timeModal.draftHour).padStart(2, '0')}:${String(timeModal.draftMinute).padStart(2, '0')}`;
    applyTimeValue(timeModal.target, timeModal.context, time);
    closeTimeModal();
  };

  const renderSingleDateMonth = (month: Date, monthOffset: number) => {
    const monthStart = startOfMonth(month);
    const firstDow = monthStart.getDay();
    const totalDays = daysInMonth(month);
    const currentTarget = singleDateModal.target;
    const activeDate = currentTarget === 'end' ? endDatePart : startDatePart;
    const items: Array<{ key: string; dateKey?: string; day?: number }> = [];
    for (let i = 0; i < firstDow; i += 1) items.push({ key: `sm-empty-${monthOffset}-${i}` });
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      items.push({ key: `sm-${monthOffset}-${day}`, dateKey: dateKeyOf(date), day });
    }
    return (
      <div className={cn('rounded-xl border p-2', isDark ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-white')}>
        <div className={cn('mb-2 text-center text-sm font-semibold', isDark ? 'text-slate-100' : 'text-slate-700')}>
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div key={`${monthOffset}-${label}`} className={cn('text-center text-[10px] font-medium', isDark ? 'text-slate-500' : 'text-slate-400')}>
              {label}
            </div>
          ))}
          {items.map((item) => {
            if (!item.dateKey || !item.day) return <div key={item.key} className="h-8" />;
            const isActive = item.dateKey === activeDate;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => applySingleDate(item.dateKey!)}
                className={cn(
                  'h-8 rounded-md text-xs font-semibold transition-colors outline-none focus:outline-none',
                  isActive
                    ? (isDark ? 'bg-brand-light text-white' : 'bg-brand-dark text-white')
                    : isDark
                      ? 'text-slate-300 hover:bg-slate-800'
                      : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {item.day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRangeMonth = (
    month: Date,
    monthOffset: number,
    range: { startDate: string; endDate: string },
    onSelectDate: (dateKey: string) => void,
  ) => {
    const monthStart = startOfMonth(month);
    const firstDow = monthStart.getDay();
    const totalDays = daysInMonth(month);
    const items: Array<{ key: string; dateKey?: string; day?: number }> = [];
    for (let i = 0; i < firstDow; i += 1) items.push({ key: `rm-empty-${monthOffset}-${i}` });
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      items.push({ key: `rm-${monthOffset}-${day}`, dateKey: dateKeyOf(date), day });
    }
    return (
      <div className={cn('rounded-xl border p-2', isDark ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-white')}>
        <div className={cn('mb-2 text-center text-sm font-semibold', isDark ? 'text-slate-100' : 'text-slate-700')}>
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div key={`${monthOffset}-${label}`} className={cn('text-center text-[10px] font-medium', isDark ? 'text-slate-500' : 'text-slate-400')}>
              {label}
            </div>
          ))}
          {items.map((item) => {
            if (!item.dateKey || !item.day) return <div key={item.key} className="h-8" />;
            const isStart = item.dateKey === range.startDate;
            const isEnd = item.dateKey === range.endDate;
            const isInRange = item.dateKey >= range.startDate && item.dateKey <= range.endDate;
            const isBoundary = isStart || isEnd;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectDate(item.dateKey!)}
                className={cn(
                  'h-8 rounded-md text-xs font-semibold transition-colors outline-none focus:outline-none',
                  isBoundary
                    ? (isDark ? 'bg-brand-light text-white' : 'bg-brand-dark text-white')
                    : isInRange
                      ? (isDark ? 'bg-brand-dark/20 text-blue-200' : 'bg-brand-dark/15 text-brand-dark')
                      : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')
                )}
              >
                {item.day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const calendarCells = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const firstDow = start.getDay();
    const totalDays = daysInMonth(calendarMonth);
    const cells: Array<{
      key: string;
      day?: number;
      dateKey?: string;
      isSelected?: boolean;
      isToday?: boolean;
      events?: Event[];
    }> = [];

    for (let i = 0; i < firstDow; i += 1) {
      cells.push({ key: `empty-${i}` });
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const dateKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const events = eventsByDate.get(dateKey) || [];
      cells.push({
        key: dateKey,
        day,
        dateKey,
        isSelected: dateKey === selectedDate,
        isToday: dateKey === toLocalDateKey(new Date().toISOString()),
        events,
      });
    }
    return cells;
  }, [calendarMonth, eventsByDate, selectedDate]);

  const calendarEventLayout = useMemo(() => {
    const maxVisibleLanes = 2;
    const layout = new Map<string, { rows: Array<Event | null>; hiddenCount: number }>();
    const monthStart = startOfMonth(calendarMonth);
    const totalDays = daysInMonth(calendarMonth);
    const monthDateKeys: string[] = [];
    for (let day = 1; day <= totalDays; day += 1) {
      monthDateKeys.push(dateKeyOf(new Date(monthStart.getFullYear(), monthStart.getMonth(), day)));
    }
    if (monthDateKeys.length === 0) return layout;

    const monthFirstKey = monthDateKeys[0];
    const monthLastKey = monthDateKeys[monthDateKeys.length - 1];
    const eventRangeById = new Map<string, { event: Event; startKey: string; endKey: string; startMs: number; isMultiDay: boolean }>();

    monthDateKeys.forEach((dateKey) => {
      const events = eventsByDate.get(dateKey) || [];
      events.forEach((ev) => {
        if (eventRangeById.has(ev.id)) return;
        const startKeyRaw = toLocalDateKey(ev.startAt);
        const endKeyRaw = toLocalDateKey(ev.endAt);
        if (!startKeyRaw || !endKeyRaw) return;
        const [startKey, endKey] = startKeyRaw <= endKeyRaw
          ? [startKeyRaw, endKeyRaw]
          : [endKeyRaw, startKeyRaw];
        const clampedStart = startKey < monthFirstKey ? monthFirstKey : startKey;
        const clampedEnd = endKey > monthLastKey ? monthLastKey : endKey;
        if (clampedStart > clampedEnd) return;
        const startMs = Number.isFinite(new Date(ev.startAt).getTime()) ? new Date(ev.startAt).getTime() : 0;
        eventRangeById.set(ev.id, {
          event: ev,
          startKey: clampedStart,
          endKey: clampedEnd,
          startMs,
          isMultiDay: clampedStart < clampedEnd,
        });
      });
    });

    const sortedRanges = [...eventRangeById.values()].sort((a, b) => {
      if (a.isMultiDay !== b.isMultiDay) return a.isMultiDay ? -1 : 1;
      if (a.startKey !== b.startKey) return a.startKey.localeCompare(b.startKey);
      if (a.startMs !== b.startMs) return a.startMs - b.startMs;
      return String(a.event.id).localeCompare(String(b.event.id));
    });

    const laneEndByIndex: string[] = [];
    const eventLaneById = new Map<string, number>();

    sortedRanges.forEach((item) => {
      let lane = 0;
      while (laneEndByIndex[lane] && item.startKey <= laneEndByIndex[lane]) lane += 1;
      laneEndByIndex[lane] = item.endKey;
      eventLaneById.set(item.event.id, lane);
    });

    monthDateKeys.forEach((dateKey) => {
      const dayEvents = (eventsByDate.get(dateKey) || [])
        .filter((ev) => eventLaneById.has(ev.id))
        .sort((a, b) => {
          const laneA = eventLaneById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
          const laneB = eventLaneById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
          if (laneA !== laneB) return laneA - laneB;
          const aStart = Number.isFinite(new Date(a.startAt).getTime()) ? new Date(a.startAt).getTime() : 0;
          const bStart = Number.isFinite(new Date(b.startAt).getTime()) ? new Date(b.startAt).getTime() : 0;
          if (aStart !== bStart) return aStart - bStart;
          return String(a.id).localeCompare(String(b.id));
        });

      const rows: Array<Event | null> = Array.from({ length: maxVisibleLanes }, () => null);
      let visibleCount = 0;
      dayEvents.forEach((ev) => {
        const lane = eventLaneById.get(ev.id);
        if (lane === undefined || lane >= maxVisibleLanes) return;
        if (!rows[lane]) {
          rows[lane] = ev;
          visibleCount += 1;
        }
      });
      layout.set(dateKey, {
        rows,
        hiddenCount: Math.max(0, dayEvents.length - visibleCount),
      });
    });

    return layout;
  }, [calendarMonth, eventsByDate]);

  const wrap = panelWrapStyle(900);
  return (
    <section className={cn(wrap.className, 'relative')} style={wrap.style}>
      <PanelTitleRow
        isDark={isDark}
        title="일정"
        className={useCustomAccent ? undefined : panelTitleRowBg(isDark)}
        style={useCustomAccent ? { background: orgTheme.headerBg } : undefined}
      />

      <div
        className={cn(
          'flex-1 min-h-0 overflow-auto',
          isNarrowLayout ? 'p-3.5' : 'p-6',
          isDark ? 'bg-slate-900' : 'bg-slate-50',
        )}
      >
        <article
          className={cn(
            'mb-4 rounded-2xl border p-4',
            isDark
              ? 'border-brand-dark/30 bg-slate-800/80'
              : 'border-[rgba(var(--color-brand-dark-rgb),0.2)] bg-white shadow-sm'
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4
              className={cn(
                'text-base font-semibold tracking-tight',
                isDark ? 'text-slate-100' : 'text-slate-700'
              )}
            >
              {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="이전 달"
                onClick={() => setCalendarMonth((m) => addMonths(m, -1))}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                  !useCustomAccent && (isDark
                    ? 'bg-brand-dark text-white hover:bg-brand-light'
                    : 'bg-brand-dark text-white hover:bg-brand-light'),
                  useCustomAccent && 'text-white'
                )}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="다음 달"
                onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                  !useCustomAccent && (isDark
                    ? 'bg-brand-dark text-white hover:bg-brand-light'
                    : 'bg-brand-dark text-white hover:bg-brand-light'),
                  useCustomAccent && 'text-white'
                )}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-1.5 gap-x-0">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className={cn(
                  'pb-1 text-center text-[11px] font-semibold',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}
              >
                {label}
              </div>
            ))}

            {calendarCells.map((cell) => {
              if (!cell.day || !cell.dateKey) {
                return <div key={cell.key} className={cn(dayCellHeight)} />;
              }
              const dayLayout = calendarEventLayout.get(cell.dateKey) || { rows: [null, null], hiddenCount: 0 };
              const visible = dayLayout.rows;
              const hiddenCount = dayLayout.hiddenCount;
              const [year, month, day] = (cell.dateKey || '').split('-').map(Number);
              const cellWeekday = new Date(year, (month || 1) - 1, day || 1).getDay();
              const hasSpanningSegmentStart = visible.some((event) => {
                if (!event) return false;
                const startKey = toLocalDateKey(event.startAt);
                const endKey = toLocalDateKey(event.endAt);
                if (!startKey || !endKey) return false;
                const rangeStart = startKey <= endKey ? startKey : endKey;
                const rangeEnd = startKey <= endKey ? endKey : startKey;
                const isMultiDay = rangeStart < rangeEnd;
                if (!isMultiDay) return false;
                const isRangeStart = rangeStart === cell.dateKey;
                return isRangeStart || cellWeekday === 0;
              });
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateKey!)}
                  className={cn(
                    dayCellHeight,
                    'relative overflow-visible rounded-xl p-1.5 text-left transition-colors',
                    hasSpanningSegmentStart && 'z-[2]',
                    cell.isSelected
                      ? (useCustomAccent ? '' : isDark ? 'bg-brand-dark/20' : 'bg-brand-dark/10')
                      : isDark
                        ? 'bg-slate-900 hover:bg-slate-800'
                        : 'bg-white hover:bg-slate-50'
                  )}
                  style={cell.isSelected && useCustomAccent ? { background: orgTheme.activeBg } : undefined}
                >
                  <span
                    className={cn(
                      'mx-auto mb-1 flex h-5 w-5 items-center justify-center text-xs font-semibold',
                      cell.isSelected
                        ? (useCustomAccent ? '' : isDark ? 'text-blue-200' : 'text-brand-dark')
                        : cell.isToday
                          ? isDark
                            ? 'text-sky-200'
                            : 'text-sky-600'
                          : isDark
                            ? 'text-slate-200'
                            : 'text-slate-600'
                    )}
                    style={cell.isSelected && useCustomAccent ? { color: orgTheme.activeText } : undefined}
                  >
                    {cell.day}
                  </span>
                  <div className="min-h-[28px] space-y-0.5">
                    {visible.map((event, index) => {
                      if (!event) {
                        return <div key={`empty-row-${cell.dateKey}-${index}`} className="h-[17px]" />;
                      }
                      const startKey = toLocalDateKey(event.startAt);
                      const endKey = toLocalDateKey(event.endAt);
                      const hasRange = Boolean(startKey && endKey);
                      const rangeStart = hasRange ? (startKey! <= endKey! ? startKey! : endKey!) : null;
                      const rangeEnd = hasRange ? (startKey! <= endKey! ? endKey! : startKey!) : null;
                      const isMultiDay = Boolean(rangeStart && rangeEnd && rangeStart < rangeEnd);
                      const isRangeStart = isMultiDay && rangeStart === cell.dateKey;
                      const isRangeEnd = isMultiDay && rangeEnd === cell.dateKey;
                      const startsSegmentThisWeek = isMultiDay && (isRangeStart || cellWeekday === 0);
                      const endsSegmentThisWeek = isMultiDay && (isRangeEnd || cellWeekday === 6);
                      const showTitle = !isMultiDay || startsSegmentThisWeek;
                      const segmentEndKey =
                        isMultiDay && rangeEnd && showTitle
                          ? getMultiDaySegmentEnd(rangeEnd, cell.dateKey!, cellWeekday)
                          : null;
                      const spanInSegment =
                        segmentEndKey && cell.dateKey
                          ? daysInclusiveBetween(cell.dateKey, segmentEndKey)
                          : 1;
                      const barTone = isDark
                        ? 'bg-brand-dark/20 text-blue-200'
                        : 'bg-[rgba(var(--color-brand-dark-rgb),0.15)] text-[var(--color-brand-dark)]';

                      if (isMultiDay) {
                        const barShape =
                          startsSegmentThisWeek && endsSegmentThisWeek
                            ? 'rounded-md'
                            : startsSegmentThisWeek
                              ? '-mr-1.5 rounded-l-md rounded-r-none'
                              : endsSegmentThisWeek
                                ? '-ml-1.5 rounded-l-none rounded-r-md'
                                : '-mx-1.5 rounded-none';

                        return (
                          <div key={event.id} className="relative h-[17px]">
                            <div
                              className={cn(
                                'h-full px-1.5 py-[1px] text-[10px] font-medium',
                                barShape,
                                barTone,
                              )}
                              aria-hidden
                            >
                              {'\u00A0'}
                            </div>
                            {showTitle && (
                              <div
                                className="pointer-events-none absolute top-0 left-0 z-[1] flex h-full items-center px-1.5 text-[10px] font-medium whitespace-nowrap"
                                style={{ width: `${spanInSegment * 100}%` }}
                                title={event.title}
                              >
                                {event.title}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={event.id}
                          className={cn(
                            'truncate rounded-md px-1.5 py-[1px] text-[10px] font-medium',
                            barTone,
                          )}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      );
                    })}
                  </div>
                  {hiddenCount > 0 && (
                    <div
                      className={cn(
                        'pointer-events-none absolute right-1.5 top-1.5 rounded px-1 text-[10px] font-semibold',
                        isDark ? 'bg-brand-dark/20 text-brand-light' : 'bg-brand-dark/15 text-brand-dark'
                      )}
                    >
                      +{hiddenCount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                isDark
                  ? 'bg-brand-dark/20 text-blue-200'
                  : 'bg-[rgba(var(--color-brand-dark-rgb),0.15)] text-[var(--color-brand-dark)]'
              )}
            >
              선택: {selectedDate}
            </span>
            <button
              type="button"
              onClick={() => {
                const key = toLocalDateKey(new Date().toISOString());
                if (key) {
                  setSelectedDate(key);
                  setCalendarMonth(startOfMonth(new Date()));
                }
              }}
              className={cn(
                actionBtn,
                'border',
                isDark
                  ? 'border-brand-dark/50 bg-brand-dark/10 text-blue-200 hover:bg-brand-dark/20'
                  : 'border-[rgba(var(--color-brand-dark-rgb),0.3)] bg-white text-[var(--color-brand-dark)] hover:bg-[rgba(var(--color-brand-dark-rgb),0.1)]'
              )}
            >
              오늘로 이동
            </button>
          </div>
        </article>

        <article
          className={cn(
            'mb-4 rounded-2xl border p-4',
            isDark ? 'border-brand-dark/30 bg-slate-800/70' : 'border-[rgba(var(--color-brand-dark-rgb),0.2)] bg-[rgba(var(--color-brand-dark-rgb),0.05)]'
          )}
        >
          {!editingEventId && (
            <div className="mb-3 flex flex-wrap gap-2">
              {([
                { id: 'normal', label: '일반' },
                { id: 'period', label: '기간' },
                { id: 'repeat', label: '반복' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCreateTab(tab.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    createTab === tab.id
                      ? (useCustomAccent ? 'border-transparent text-white' : (isDark ? 'border-brand-dark bg-brand-dark text-white' : 'border-brand-dark bg-brand-dark text-white'))
                      : (useCustomAccent
                          ? 'border-transparent bg-transparent'
                          : isDark
                            ? 'border-brand-dark/40 bg-transparent text-brand-light hover:bg-brand-dark/15'
                            : 'border-brand-dark/40 bg-white text-brand-dark hover:bg-brand-dark/10')
                  )}
                  style={
                    useCustomAccent
                      ? createTab === tab.id
                        ? { background: orgTheme.accent }
                        : { color: orgTheme.accent, background: orgTheme.activeBg }
                      : undefined
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <h5
            className={cn(
              'mb-3 text-sm font-semibold',
              !useCustomAccent && (isDark ? 'text-blue-200' : 'text-brand-dark')
            )}
            style={useCustomAccent ? { color: orgTheme.accent } : undefined}
          >
            {editingEventId ? '일정 수정' : '새 일정 추가'}
          </h5>

          <input
            type="text"
            placeholder="제목"
            value={eventForm.title}
            onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
            className={cn(
              inputBase,
              'mb-2',
              isDark
                ? 'border-brand-dark/30 bg-slate-900 text-slate-100 placeholder:text-slate-500'
                : 'border-brand-dark/25 bg-white text-slate-700 placeholder:text-slate-400'
            )}
          />

          {(editingEventId || createTab === 'normal') && (
            <div className={dateRangeGridClass}>
              <div className={cn('rounded-xl border p-3', isDark ? 'border-brand-dark/30 bg-slate-900/70' : 'border-brand-dark/20 bg-white')}>
                <div className={cn('mb-2 text-xs font-semibold', isDark ? 'text-blue-200' : 'text-brand-dark')}>시작</div>
                <button
                  type="button"
                  onClick={() => openSingleDateModal('start')}
                  className={cn(pickerFieldClass, 'mb-2')}
                >
                  <span className={dateTimeTextClass}>{formatDateLabel(startDatePart, isNarrowLayout)}</span>
                  <span className={pickerIconSlotClass}>
                    <CalendarIcon className={pickerIconColorClass} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openTimeModal('start', 'event')}
                  className={cn(pickerFieldClass, 'mb-0')}
                >
                  <span className={dateTimeTextClass}>{formatTimeLabel(startTime)}</span>
                  <span className={pickerIconSlotClass}>
                    <ClockIcon className={pickerIconColorClass} />
                  </span>
                </button>
              </div>

              <div className={cn('rounded-xl border p-3', isDark ? 'border-brand-dark/30 bg-slate-900/70' : 'border-brand-dark/20 bg-white')}>
                <div className={cn('mb-2 text-xs font-semibold', isDark ? 'text-blue-200' : 'text-brand-dark')}>종료</div>
                <button
                  type="button"
                  onClick={() => openSingleDateModal('end')}
                  className={cn(pickerFieldClass, 'mb-2')}
                >
                  <span className={dateTimeTextClass}>{formatDateLabel(endDatePart, isNarrowLayout)}</span>
                  <span className={pickerIconSlotClass}>
                    <CalendarIcon className={pickerIconColorClass} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openTimeModal('end', 'event')}
                  className={cn(pickerFieldClass, 'mb-0')}
                >
                  <span className={dateTimeTextClass}>{formatTimeLabel(endTime)}</span>
                  <span className={pickerIconSlotClass}>
                    <ClockIcon className={pickerIconColorClass} />
                  </span>
                </button>
              </div>
            </div>
          )}

          {!editingEventId && createTab === 'repeat' && (
            <div className={dateRangeGridClass}>
              <div className={cn('rounded-xl border p-3', isDark ? 'border-brand-dark/30 bg-slate-900/70' : 'border-brand-dark/20 bg-white')}>
                <div className={cn('mb-2 text-xs font-semibold', isDark ? 'text-blue-200' : 'text-brand-dark')}>반복 시작</div>
                <button
                  type="button"
                  onClick={() => openSingleDateModal('start')}
                  className={cn(pickerFieldClass, 'mb-2')}
                >
                  <span className={dateTimeTextClass}>{formatDateLabel(startDatePart, isNarrowLayout)}</span>
                  <span className={pickerIconSlotClass}>
                    <CalendarIcon className={pickerIconColorClass} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openTimeModal('start', 'event')}
                  className={cn(pickerFieldClass, 'mb-0')}
                >
                  <span className={dateTimeTextClass}>{formatTimeLabel(startTime)}</span>
                  <span className={pickerIconSlotClass}>
                    <ClockIcon className={pickerIconColorClass} />
                  </span>
                </button>
              </div>

              <div className={cn('rounded-xl border p-3', isDark ? 'border-brand-dark/30 bg-slate-900/70' : 'border-brand-dark/20 bg-white')}>
                <div className={cn('mb-2 text-xs font-semibold', isDark ? 'text-blue-200' : 'text-brand-dark')}>반복 종료</div>
                <button
                  type="button"
                  onClick={() => openSingleDateModal('end')}
                  className={cn(pickerFieldClass, 'mb-2')}
                >
                  <span className={dateTimeTextClass}>{formatDateLabel(endDatePart, isNarrowLayout)}</span>
                  <span className={pickerIconSlotClass}>
                    <CalendarIcon className={pickerIconColorClass} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openTimeModal('end', 'event')}
                  className={cn(pickerFieldClass, 'mb-0')}
                >
                  <span className={dateTimeTextClass}>{formatTimeLabel(endTime)}</span>
                  <span className={pickerIconSlotClass}>
                    <ClockIcon className={pickerIconColorClass} />
                  </span>
                </button>
              </div>
            </div>
          )}

          {!editingEventId && createTab === 'period' && (
            <>
              <div className={cn('mb-2 rounded-xl border p-2', isDark ? 'border-brand-dark/30 bg-slate-900/70' : 'border-brand-dark/25 bg-white/70')}>
                <div className={cn('flex gap-2', isNarrowLayout ? 'flex-col items-stretch' : 'flex-row items-center justify-between')}>
                  <div className={cn('min-w-0 text-xs font-semibold leading-snug', isDark ? 'text-blue-200' : 'text-brand-dark')}>
                    선택 기간: {formatDateLabel(periodRange.startDate, isNarrowLayout)} ~ {formatDateLabel(periodRange.endDate, isNarrowLayout)}
                  </div>
                  <button
                    type="button"
                    onClick={openRangeModal}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 self-start whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-semibold outline-none focus:outline-none',
                      isDark
                        ? 'border-brand-dark/35 bg-brand-dark/10 text-blue-200 hover:bg-brand-dark/20'
                        : 'border-brand-dark/30 bg-white text-brand-dark hover:bg-brand-dark/10'
                    )}
                    aria-label="기간 캘린더 열기"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    기간 선택
                  </button>
                </div>
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openTimeModal('start', 'period')}
                  className={cn(pickerFieldClass, 'mb-0 min-w-0 flex-1 basis-28')}
                >
                  <span className={dateTimeTextClass}>{formatTimeLabel(startTime)}</span>
                  <span className={pickerIconSlotClass}>
                    <ClockIcon className={pickerIconColorClass} />
                  </span>
                </button>
                <span className={cn('text-sm font-medium', isDark ? 'text-brand-light' : 'text-brand-dark')}>~</span>
                <button
                  type="button"
                  onClick={() => openTimeModal('end', 'period')}
                  className={cn(pickerFieldClass, 'mb-0 min-w-0 flex-1 basis-28')}
                >
                  <span className={dateTimeTextClass}>{formatTimeLabel(endTime)}</span>
                  <span className={pickerIconSlotClass}>
                    <ClockIcon className={pickerIconColorClass} />
                  </span>
                </button>
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK_TIME_PRESETS.map((time) => (
                  <button
                    key={`period-preset-${time}`}
                    type="button"
                    onClick={() => {
                      applyTimeValue('start', 'period', time);
                      applyTimeValue('end', 'period', time);
                    }}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                      isDark
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    )}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </>
          )}

          {!editingEventId && createTab === 'repeat' && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="relative w-32">
                <select
                  value={repeatType}
                  onChange={(e) => setRepeatType(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  className={cn(
                    inputBase,
                    'mb-0 w-full appearance-none pr-8',
                    isDark
                      ? 'border-brand-dark/30 bg-slate-900 text-slate-100'
                      : 'border-brand-dark/25 bg-white text-slate-700'
                  )}
                >
                  <option value="daily">매일</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매월</option>
                </select>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(
                    'pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2',
                    isDark ? 'text-slate-300' : 'text-slate-500'
                  )}
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <span
                className={cn(
                  'text-xs font-semibold',
                  isDark ? 'text-brand-light' : 'text-brand-dark'
                )}
              >
                종료일
              </span>
              <input
                type="date"
                value={repeatUntil}
                onChange={(e) => setRepeatUntil(e.target.value)}
                className={cn(
                  inputBase,
                  'mb-0 min-w-[180px] flex-1 focus:ring-0',
                  isDark
                    ? 'border-brand-dark/30 bg-slate-900 text-slate-100'
                    : 'border-brand-dark/25 bg-white text-slate-700'
                )}
              />
            </div>
          )}

          <input
            type="text"
            placeholder="설명 (선택)"
            value={eventForm.description}
            onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
            className={cn(
              inputBase,
              isDark
                ? 'border-brand-dark/30 bg-slate-900 text-slate-100 placeholder:text-slate-500'
                : 'border-brand-dark/25 bg-white text-slate-700 placeholder:text-slate-400'
            )}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {editingEventId ? (
              <>
                <button
                  type="button"
                  onClick={() => void onUpdateEvent()}
                  className={cn(
                    actionBtn,
                    'text-white',
                    !useCustomAccent && (isDark
                      ? 'bg-brand-dark hover:bg-brand-light'
                      : 'bg-brand-dark hover:bg-brand-light')
                  )}
                  style={useCustomAccent ? { background: orgTheme.accent } : undefined}
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className={cn(
                    actionBtn,
                    'border',
                    isDark
                      ? 'border-brand-dark/40 bg-transparent text-blue-200 hover:bg-brand-dark/10'
                      : 'border-brand-dark/30 bg-white text-brand-dark hover:bg-brand-dark/10'
                  )}
                >
                  취소
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (createTab === 'period') {
                    void onCreateEvent({
                      mode: 'period',
                      periodStartDate: periodRange.startDate,
                      periodEndDate: periodRange.endDate,
                    });
                    return;
                  }
                  if (createTab === 'repeat') {
                    void onCreateEvent({
                      mode: 'repeat',
                      repeatType,
                      repeatUntil,
                    });
                    return;
                  }
                  void onCreateEvent();
                }}
                className={cn(
                  actionBtn,
                  'text-white',
                  !useCustomAccent && (isDark
                    ? 'bg-brand-dark hover:bg-brand-light'
                    : 'bg-brand-dark hover:bg-brand-light')
                )}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
              >
                추가
              </button>
            )}
          </div>
        </article>

        <div className="mb-2 flex items-center justify-between px-1">
          <h5
            className={cn(
              'text-sm font-semibold',
              isDark ? 'text-blue-200' : 'text-brand-dark'
            )}
          >
            선택한 날짜 일정
          </h5>
          <span
            className={cn(
              'text-xs font-medium',
              isDark ? 'text-brand-light' : 'text-brand-dark'
            )}
          >
            {selectedEvents.length}건
          </span>
        </div>

        {selectedEvents.length === 0 ? (
          <p
            className={cn(
              'rounded-xl px-4 py-3 text-sm',
              isDark ? 'bg-brand-dark/15 text-blue-200' : 'bg-brand-dark/10 text-brand-dark'
            )}
          >
            선택한 날짜에 일정이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((ev) => (
              <li
                key={ev.id}
                className={cn(
                  'flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3',
                  isDark
                    ? 'border-brand-dark/30 bg-slate-800/80'
                    : 'border-[rgba(var(--color-brand-dark-rgb),0.2)] bg-white shadow-sm'
                )}
              >
                <div className="min-w-0 flex-1">
                  <strong
                    className={cn(
                      'mb-1 block truncate text-sm font-semibold',
                      isDark ? 'text-blue-200' : 'text-brand-dark'
                    )}
                  >
                    {ev.title}
                  </strong>
                  <span
                    className={cn(
                      'mb-1 block text-xs leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis',
                      isDark ? 'text-brand-light' : 'text-brand-dark'
                    )}
                  >
                    {new Date(ev.startAt).toLocaleString('ko-KR')} ~ {new Date(ev.endAt).toLocaleString('ko-KR')}
                  </span>
                  {ev.description && (
                    <span
                      className={cn(
                        'block text-sm',
                        isDark ? 'text-slate-300' : 'text-slate-500'
                      )}
                    >
                      {ev.description}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onEditEvent(ev)}
                    className={cn(
                      actionBtn,
                      'px-3 py-1.5 text-xs text-white',
                      !useCustomAccent && (isDark
                        ? 'bg-brand-dark hover:bg-brand-light'
                        : 'bg-brand-dark hover:bg-brand-light')
                    )}
                    style={useCustomAccent ? { background: orgTheme.accent } : undefined}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteEvent(ev.id)}
                    className={cn(
                      actionBtn,
                      'border px-3 py-1.5 text-xs',
                      isDark
                        ? 'border-rose-300/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                        : 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                    )}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {singleDateModal.isOpen && (editingEventId || createTab === 'normal' || createTab === 'repeat') && (
        <div
          className={cn(modalOverlayClass, 'z-[1995] bg-black/35')}
          onClick={() => setSingleDateModal((prev) => ({ ...prev, isOpen: false, target: null }))}
        >
          <div
            className={modalSurfaceClass(true)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className={cn('text-sm font-semibold', isDark ? 'text-blue-200' : 'text-brand-dark')}>
                {singleDateModal.target === 'end' ? '종료일 선택' : '시작일 선택'}
              </div>
              <button
                type="button"
                onClick={() => setSingleDateModal((prev) => ({ ...prev, isOpen: false, target: null }))}
                className={cn('h-8 w-8 rounded-md border text-sm', isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}
                aria-label="날짜 선택 모달 닫기"
              >
                ×
              </button>
            </div>

            <div className="mb-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors text-white', !useCustomAccent && (isDark ? 'bg-brand-dark hover:bg-brand-light' : 'bg-brand-dark hover:bg-brand-light'))}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
                onClick={() => setSingleDateModal((prev) => ({ ...prev, baseMonth: addMonths(prev.baseMonth, -1) }))}
                aria-label="날짜 이전 달"
              >
                ‹
              </button>
              <button
                type="button"
                className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors text-white', !useCustomAccent && (isDark ? 'bg-brand-dark hover:bg-brand-light' : 'bg-brand-dark hover:bg-brand-light'))}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
                onClick={() => setSingleDateModal((prev) => ({ ...prev, baseMonth: addMonths(prev.baseMonth, 1) }))}
                aria-label="날짜 다음 달"
              >
                ›
              </button>
            </div>

            <div className={cn('grid gap-2', isNarrowLayout ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2')}>
              {renderSingleDateMonth(singleDateModal.baseMonth, 0)}
              {!isNarrowLayout && renderSingleDateMonth(addMonths(singleDateModal.baseMonth, 1), 1)}
            </div>
          </div>
        </div>
      )}

      {timeModal.isOpen && (
        <div
          className={cn(modalOverlayClass, 'z-[1998] bg-black/35')}
          onClick={closeTimeModal}
        >
          <div
            className={modalSurfaceClass(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className={cn('text-sm font-semibold', isDark ? 'text-blue-200' : 'text-brand-dark')}>
                  시간 선택
                </div>
                <div className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  시/분을 직접 조정해 주세요
                </div>
              </div>
              <button
                type="button"
                onClick={closeTimeModal}
                className={cn(
                  'h-8 w-8 rounded-md border text-sm',
                  isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                )}
                aria-label="시간 선택 모달 닫기"
              >
                ×
              </button>
            </div>

            <div className={cn('mb-3 rounded-xl p-3 text-center text-sm font-semibold', isDark ? 'bg-brand-dark/15 text-blue-200' : 'bg-brand-dark/10 text-brand-dark')}>
              {formatTimeLabel(`${String(timeModal.draftHour).padStart(2, '0')}:${String(timeModal.draftMinute).padStart(2, '0')}`)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={cn('rounded-xl border p-3', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50')}>
                <div className={cn('mb-2 text-xs font-semibold', isDark ? 'text-slate-300' : 'text-slate-600')}>시</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTimeModal((prev) => ({ ...prev, draftHour: Math.max(0, prev.draftHour - 1) }))}
                    className={cn('h-9 w-9 rounded-lg border text-base font-bold', isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-white')}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={timeModal.draftHour}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTimeModal((prev) => ({ ...prev, draftHour: Number.isNaN(val) ? prev.draftHour : Math.min(23, Math.max(0, val)) }));
                    }}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                      isDark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-700'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setTimeModal((prev) => ({ ...prev, draftHour: Math.min(23, prev.draftHour + 1) }))}
                    className={cn('h-9 w-9 rounded-lg border text-base font-bold', isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-white')}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className={cn('rounded-xl border p-3', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50')}>
                <div className={cn('mb-2 text-xs font-semibold', isDark ? 'text-slate-300' : 'text-slate-600')}>분</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTimeModal((prev) => ({ ...prev, draftMinute: Math.max(0, prev.draftMinute - 1) }))}
                    className={cn('h-9 w-9 rounded-lg border text-base font-bold', isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-white')}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={timeModal.draftMinute}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTimeModal((prev) => ({ ...prev, draftMinute: Number.isNaN(val) ? prev.draftMinute : Math.min(59, Math.max(0, val)) }));
                    }}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                      isDark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-700'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setTimeModal((prev) => ({ ...prev, draftMinute: Math.min(59, prev.draftMinute + 1) }))}
                    className={cn('h-9 w-9 rounded-lg border text-base font-bold', isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-white')}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_TIME_PRESETS.map((time) => (
                <button
                  key={`time-modal-${time}`}
                  type="button"
                  onClick={() => {
                    const { hour, minute } = parseTimeParts(time);
                    setTimeModal((prev) => ({ ...prev, draftHour: hour, draftMinute: minute }));
                  }}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                    isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {time}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const { hour, minute } = parseTimeParts(getCurrentTimeValue());
                  setTimeModal((prev) => ({ ...prev, draftHour: hour, draftMinute: minute }));
                }}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                  isDark ? 'bg-brand-dark/15 text-blue-200 hover:bg-brand-dark/25' : 'bg-brand-dark/10 text-brand-dark hover:bg-brand-dark/20'
                )}
              >
                지금
              </button>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeTimeModal}
                className={cn(
                  actionBtn,
                  'border',
                  isDark
                    ? 'border-brand-dark/40 bg-transparent text-blue-200 hover:bg-brand-dark/10'
                    : 'border-brand-dark/30 bg-white text-brand-dark hover:bg-brand-dark/10'
                )}
              >
                취소
              </button>
              <button
                type="button"
                onClick={applyTimeModal}
                className={cn(
                  actionBtn,
                  'text-white',
                  !useCustomAccent && (isDark
                    ? 'bg-brand-dark hover:bg-brand-light'
                    : 'bg-brand-dark hover:bg-brand-light')
                )}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}

      {isRangeModalOpen && !editingEventId && createTab === 'period' && (
        <div
          className={modalOverlayClass}
          onClick={() => setIsRangeModalOpen(false)}
        >
          <div
            className={modalSurfaceClass(true)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className={cn('text-sm font-semibold', isDark ? 'text-blue-200' : 'text-brand-dark')}>
                  출발일/도착일을 선택해 주세요
                </div>
                <div className={cn('text-xs', isDark ? 'text-brand-light' : 'text-brand-dark')}>
                  {draftRangeAnchorDate ? '종료일을 선택해 주세요' : '시작일을 먼저 선택해 주세요'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRangeModalOpen(false)}
                className={cn('h-8 w-8 rounded-md border text-sm', isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}
                aria-label="기간 선택 모달 닫기"
              >
                ×
              </button>
            </div>

            <div className="mb-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors text-white', !useCustomAccent && (isDark ? 'bg-brand-dark hover:bg-brand-light' : 'bg-brand-dark hover:bg-brand-light'))}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
                onClick={() => setDraftRangeBaseMonth((m) => addMonths(m, -1))}
                aria-label="기간 이전 달"
              >
                ‹
              </button>
              <button
                type="button"
                className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors text-white', !useCustomAccent && (isDark ? 'bg-brand-dark hover:bg-brand-light' : 'bg-brand-dark hover:bg-brand-light'))}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
                onClick={() => setDraftRangeBaseMonth((m) => addMonths(m, 1))}
                aria-label="기간 다음 달"
              >
                ›
              </button>
            </div>

            <div className={cn('mb-3 grid gap-2', isNarrowLayout ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2')}>
              {renderRangeMonth(draftRangeBaseMonth, 0, draftPeriodRange, selectDraftRangeDate)}
              {!isNarrowLayout && renderRangeMonth(addMonths(draftRangeBaseMonth, 1), 1, draftPeriodRange, selectDraftRangeDate)}
            </div>

            <div className="mb-3 flex items-center justify-between gap-2">
              <span className={cn('min-w-0 text-xs font-medium leading-snug', isDark ? 'text-blue-200' : 'text-brand-dark')}>
                선택 기간: {formatDateLabel(draftPeriodRange.startDate, isNarrowLayout)} ~ {formatDateLabel(draftPeriodRange.endDate, isNarrowLayout)}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRangeModalOpen(false)}
                className={cn(
                  actionBtn,
                  'border',
                  isDark
                    ? 'border-brand-dark/40 bg-transparent text-blue-200 hover:bg-brand-dark/10'
                    : 'border-brand-dark/30 bg-white text-brand-dark hover:bg-brand-dark/10'
                )}
              >
                취소
              </button>
              <button
                type="button"
                onClick={applyRangeModal}
                className={cn(
                  actionBtn,
                  'text-white',
                  !useCustomAccent && (isDark
                    ? 'bg-brand-dark hover:bg-brand-light'
                    : 'bg-brand-dark hover:bg-brand-light')
                )}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(SchedulePanel);
