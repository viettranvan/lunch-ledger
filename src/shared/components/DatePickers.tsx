import { useContext, useState, useSyncExternalStore } from "react";
import { parseDate, today, type CalendarDate } from "@internationalized/date";
import {
  Button, ButtonContext, Calendar, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader,
  CalendarHeaderCell, DateField, DateInput, DatePicker, DateSegment, Dialog, DialogTrigger,
  Group, Heading, I18nProvider, Label, Modal, ModalOverlay, Popover, RangeCalendar,
  RangeCalendarStateContext,
} from "react-aria-components";
import "./DatePickers.css";

type DateRange = { from: string; to: string };

const wideScreen = "(min-width: 900px)";
function subscribeToViewport(callback: () => void) {
  const viewport = window.matchMedia(wideScreen);
  viewport.addEventListener("change", callback);
  return () => viewport.removeEventListener("change", callback);
}

function MonthGrid({ offset = 0 }: { offset?: number }) {
  return (
    <CalendarGrid offset={{ months: offset }} weekdayStyle="short">
      <CalendarGridHeader>{(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}</CalendarGridHeader>
      <CalendarGridBody>{(date) => <CalendarCell date={date} className="ledger-date-cell" />}</CalendarGridBody>
    </CalendarGrid>
  );
}

function DateSegments() {
  return <DateInput className="ledger-date-segments">{(segment) => <DateSegment segment={segment} />}</DateInput>;
}

function RangeDateField({ label, value, onChange }: {
  label: string; value: CalendarDate | null; onChange: (date: CalendarDate | null) => void;
}) {
  const calendar = useContext(RangeCalendarStateContext);
  return (
    <DateField value={value} onChange={(date) => {
      calendar?.setAnchorDate(null);
      onChange(date);
    }}>
      <Label>{label}</Label>
      <DateSegments />
    </DateField>
  );
}

export function InvoiceDatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  return (
    <I18nProvider locale="vi-VN">
      <DatePicker className="invoice-field" value={value ? parseDate(value) : null}
        onChange={(date) => onChange(date?.toString() ?? "")} granularity="day" isRequired validationBehavior="native">
        <Label>Ngày hóa đơn</Label>
        <Group className="input-field ledger-date-input">
          <DateSegments />
          <Button className="ledger-date-nav" aria-label="Mở lịch">▦</Button>
        </Group>
        <Popover className="ledger-date-surface ledger-single-date" placement="bottom end" data-modal-portal>
          <Dialog aria-label="Chọn ngày hóa đơn">
            <Calendar firstDayOfWeek="mon">
              <header className="ledger-date-header">
                <Button slot="previous" className="ledger-date-nav">‹</Button>
                <Heading />
                <Button slot="next" className="ledger-date-nav">›</Button>
              </header>
              <MonthGrid />
            </Calendar>
          </Dialog>
        </Popover>
      </DatePicker>
    </I18nProvider>
  );
}

function RangeMonth({ offset, twoMonths }: { offset: number; twoMonths: boolean }) {
  const calendar = useContext(RangeCalendarStateContext);
  const month = calendar?.visibleRange.start.add({ months: offset });
  return (
    <div className="ledger-range-month">
      <header className="ledger-date-header">
        {offset === 0 ? <Button slot="previous" className="ledger-date-nav">‹</Button> : <span />}
        <span>{month?.month}/{month?.year}</span>
        {!twoMonths || offset === 1 ? <Button slot="next" className="ledger-date-nav">›</Button> : <span />}
      </header>
      <MonthGrid offset={offset} />
    </div>
  );
}

function RangeActions({ valid, close, apply }: { valid: boolean; close: () => void; apply: () => void }) {
  const calendar = useContext(RangeCalendarStateContext);
  return (
    <ButtonContext.Provider value={null}>
      <div className="ledger-date-actions">
        <Button className="teams-channel-option" onPress={close}>Hủy</Button>
        <Button className="submit-btn small-btn" isDisabled={!valid || Boolean(calendar?.anchorDate)} onPress={apply}>
          Áp dụng
        </Button>
      </div>
    </ButtonContext.Provider>
  );
}

function RangePanel({ value, week, onChange, close, twoMonths }: {
  value: DateRange; week: DateRange; onChange: (range: DateRange) => void; close: () => void; twoMonths: boolean;
}) {
  const [start, setStart] = useState<CalendarDate | null>(() => parseDate(value.from));
  const [end, setEnd] = useState<CalendarDate | null>(() => parseDate(value.to));
  const [focused, setFocused] = useState(() => parseDate(value.from));
  const [selectionVersion, setSelectionVersion] = useState(0);
  const valid = start !== null && end !== null && start.compare(end) <= 0;
  const currentDay = today("Asia/Ho_Chi_Minh");
  const weekStart = parseDate(week.from);
  const weekEnd = parseDate(week.to);
  const presets = [
    { label: "Hôm nay", start: currentDay, end: currentDay },
    { label: "Tuần này", start: weekStart, end: weekEnd },
    { label: "Tuần trước", start: weekStart.subtract({ weeks: 1 }), end: weekEnd.subtract({ weeks: 1 }) },
  ];

  function editDate(position: "start" | "end", date: CalendarDate | null) {
    if (position === "start") setStart(date);
    else setEnd(date);
    if (date) setFocused(date);
  }

  return (
    <Dialog aria-label="Chọn khoảng ngày" className="ledger-range-panel">
      <div className="ledger-date-presets" aria-label="Khoảng ngày có sẵn" role="group">
        {presets.map((preset) => (
          <Button key={preset.label} className="teams-channel-option"
            aria-pressed={Boolean(start?.compare(preset.start) === 0 && end?.compare(preset.end) === 0)}
            onPress={() => {
              setStart(preset.start);
              setEnd(preset.end);
              setFocused(preset.start);
              setSelectionVersion((version) => version + 1);
            }}>{preset.label}</Button>
        ))}
      </div>
      <RangeCalendar key={selectionVersion} aria-label="Lịch chọn khoảng ngày" firstDayOfWeek="mon"
        value={valid ? { start, end } : null}
        onChange={(range) => { setStart(range.start); setEnd(range.end); }}
        focusedValue={focused} onFocusChange={setFocused}
        visibleDuration={{ months: twoMonths ? 2 : 1 }} pageBehavior="single">
        <div className="ledger-range-months">
          <RangeMonth offset={0} twoMonths={twoMonths} />
          {twoMonths && <RangeMonth offset={1} twoMonths />}
        </div>
        <div className="ledger-range-footer">
          <div className="ledger-range-fields">
            <RangeDateField label="Từ ngày" value={start} onChange={(date) => editDate("start", date)} />
            <RangeDateField label="Đến ngày" value={end} onChange={(date) => editDate("end", date)} />
          </div>
          <RangeActions valid={valid} close={close} apply={() => {
            if (!valid) return;
            onChange({ from: start.toString(), to: end.toString() });
            close();
          }} />
          {start && end && !valid && <p role="alert">Ngày kết thúc phải từ ngày bắt đầu trở đi.</p>}
        </div>
      </RangeCalendar>
    </Dialog>
  );
}

export function ReceiptDateRangePicker({ value, week, disabled, onChange }: {
  value: DateRange; week: DateRange; disabled: boolean; onChange: (range: DateRange) => void;
}) {
  const twoMonths = useSyncExternalStore(subscribeToViewport, () => window.matchMedia(wideScreen).matches);
  const [open, setOpen] = useState(false);
  const panel = open && <RangePanel value={value} week={week} twoMonths={twoMonths} onChange={onChange}
    close={() => setOpen(false)} />;
  const format = (date: string) => date.split("-").reverse().join("/");

  return (
    <I18nProvider locale="vi-VN">
      <DialogTrigger isOpen={open} onOpenChange={setOpen}>
        <Button className="teams-channel-option ledger-range-trigger" isDisabled={disabled}
          aria-label={`Chọn khoảng ngày, ${format(value.from)} đến ${format(value.to)}`}>
          <span aria-hidden="true">▦</span> {format(value.from)} – {format(value.to)}
        </Button>
        {twoMonths ? (
          <Popover className="ledger-date-surface ledger-range-popover" placement="bottom start">{panel}</Popover>
        ) : (
          <ModalOverlay className="ledger-date-overlay" isDismissable>
            <Modal className="ledger-date-surface">{panel}</Modal>
          </ModalOverlay>
        )}
      </DialogTrigger>
    </I18nProvider>
  );
}
