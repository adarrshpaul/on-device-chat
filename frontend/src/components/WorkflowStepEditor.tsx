import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, ChevronDown, CornerDownLeft, Crosshair, Heading, KeyRound, Link2,
  ListChecks, Minus, MousePointerClick, Navigation, Plus, Repeat, ShieldCheck, TextCursorInput, Timer, ToggleLeft, Trash2, Type,
} from "lucide-react";
import type { WorkflowStep } from "../lib/types";
import { MAX_CLICK_REPEAT, DEFAULT_REPEAT_INTERVAL_MS, clickRepeatCount } from "../lib/types";
import {
  ACTION_TARGET_KINDS, PageElement, PageElementKind, PageScan, TARGET_REQUIRED,
  defaultStepTitle, matchTarget, suggestionsForAction,
} from "../lib/pageFormExtractor";
import { previewElement } from "../lib/elementPicker";
import { smartQuerySelector } from "../lib/domUtils";

type Action = WorkflowStep["action"];

const ACTIONS: { value: Action; label: string; icon: React.ElementType; activeClass: string }[] = [
  { value: "click", label: "Click", icon: MousePointerClick, activeClass: "bg-[#D4FF00] text-black font-black shadow-[0_0_10px_rgba(212,255,0,0.25)]" },
  { value: "type", label: "Type", icon: Type, activeClass: "bg-cyan-400 text-black font-black shadow-[0_0_10px_rgba(6,182,212,0.25)]" },
  { value: "select", label: "Select", icon: ListChecks, activeClass: "bg-emerald-400 text-black font-black shadow-[0_0_10px_rgba(16,185,129,0.25)]" },
  { value: "scroll", label: "Scroll", icon: ArrowDownToLine, activeClass: "bg-purple-400 text-black font-black shadow-[0_0_10px_rgba(168,85,247,0.25)]" },
  { value: "teleport", label: "Teleport", icon: Navigation, activeClass: "bg-indigo-400 text-black font-black shadow-[0_0_10px_rgba(129,140,248,0.25)]" },
  { value: "verify", label: "Verify", icon: ShieldCheck, activeClass: "bg-blue-400 text-black font-black shadow-[0_0_10px_rgba(96,165,250,0.25)]" },
  { value: "wait", label: "Wait", icon: Timer, activeClass: "bg-amber-400 text-black font-black shadow-[0_0_10px_rgba(251,191,36,0.25)]" },
];

const KIND_ICON: Record<PageElementKind, React.ElementType> = {
  text: TextCursorInput, textarea: TextCursorInput, secret: KeyRound, select: ListChecks,
  toggle: ToggleLeft, button: MousePointerClick, link: Link2, landmark: Heading,
};

const TARGET_NOUN: Partial<Record<Action, string>> = {
  type: "input fields", select: "dropdowns", click: "buttons & links", teleport: "sections",
};

const fieldCls =
  "w-full bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-[#D4FF00] transition-colors";

interface StepEditorProps {
  step: WorkflowStep;
  index: number;
  scan: PageScan | null;
  picking: boolean;
  onChange: (updates: Partial<WorkflowStep>) => void;
  onRemove: () => void;
  onPick: () => void;
}

export const StepEditor: React.FC<StepEditorProps> = ({ step, index, scan, picking, onChange, onRemove, onPick }) => {
  const matched = useMemo(() => matchTarget(scan, step.target), [scan, step.target]);
  const showTarget = step.action !== "wait" && step.action !== "tour";
  const missingTarget = TARGET_REQUIRED.has(step.action) && !step.target?.trim();
  const kinds = ACTION_TARGET_KINDS[step.action];
  const incompatible = matched && kinds && !kinds.includes(matched.kind);

  const chooseTarget = (target: string, el?: PageElement) => {
    const titleIsAuto = !step.title || (matched && step.title === defaultStepTitle(step.action, matched));
    onChange({
      target,
      ...(el && titleIsAuto ? { title: defaultStepTitle(step.action, el) } : {}),
      ...(el?.kind === "select" && !step.value ? { value: (el.element as HTMLSelectElement).value } : {}),
    });
  };

  return (
    <div className={`p-3 rounded-xl bg-[#090d18] border space-y-2.5 text-[11px] shadow-sm transition-all ${missingTarget ? "border-amber-400/60 ring-1 ring-amber-400/20" : "border-white/12 hover:border-white/20"}`}>
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-black text-[#D4FF00] font-mono font-black text-[10px] flex items-center justify-center shrink-0 border border-[#D4FF00]/40 shadow-xs">
          {index + 1}
        </span>
        <input
          value={step.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={`Step ${index + 1} label (e.g. Click Headphones)`}
          className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-white placeholder-gray-500 focus:outline-none focus:text-[#D4FF00]"
        />
        <button
          onClick={onRemove}
          className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
          title="Remove step"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div role="radiogroup" aria-label="Action" className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-black/60 border border-white/10">
        {ACTIONS.map(({ value, label, icon: Icon, activeClass }) => {
          const active = step.action === value;
          return (
            <button
              key={value}
              role="radio"
              aria-checked={active}
              title={label}
              onClick={() => onChange({ action: value })}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10.5px] cursor-pointer transition-all ${
                active ? activeClass : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {showTarget && (
        <TargetCombobox
          action={step.action}
          value={step.target || ""}
          matched={matched}
          scan={scan}
          picking={picking}
          invalid={missingTarget}
          onChange={chooseTarget}
          onPick={onPick}
        />
      )}
      {incompatible && (
        <p className="flex items-center gap-1 text-[9px] text-amber-300/80">
          <AlertTriangle size={10} /> “{matched.label}” is a {matched.kind}; {step.action} expects {TARGET_NOUN[step.action] ?? "another element"}.
        </p>
      )}

      {step.action === "click" && (
        <RepeatField step={step} onChange={onChange} />
      )}

      {(step.action === "type" || step.action === "select" || step.action === "wait") && (
        <ValueField step={step} field={matched} onChange={onChange} />
      )}
    </div>
  );
};

interface TargetComboboxProps {
  action: Action;
  value: string;
  matched?: PageElement;
  scan: PageScan | null;
  picking: boolean;
  invalid: boolean;
  onChange: (target: string, el?: PageElement) => void;
  onPick: () => void;
}

const TargetCombobox: React.FC<TargetComboboxProps> = ({ action, value, matched, scan, picking, invalid, onChange, onPick }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const noun = TARGET_NOUN[action] ?? "elements";

  const formTitles = useMemo(() => new Map(scan?.forms.map((f) => [f.key, f.title]) ?? []), [scan]);
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = suggestionsForAction(scan, action);
    const filtered = q
      ? all.filter((e) => `${e.label} ${e.context ?? ""} ${e.placeholder ?? ""} ${e.selector}`.toLowerCase().includes(q))
      : all;
    return filtered.slice(0, 50);
  }, [scan, action, query]);
  const custom = query.trim();
  const showCustomRow = !!custom && !options.some((o) => o.selector === custom);
  const rowCount = options.length + (showCustomRow ? 1 : 0);

  const resolves = useMemo(() => !value || !!smartQuerySelector(value), [value, scan?.scannedAt]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => previewElement(open ? options[active]?.element ?? null : null), [open, active, options]);
  useEffect(() => () => previewElement(null), []);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const commit = (i: number) => {
    if (i < options.length) onChange(options[i].selector, options[i]);
    else if (showCustomRow) onChange(custom);
    close();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rowCount > 0) commit(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const MatchedIcon = matched ? KIND_ICON[matched.kind] : null;

  return (
    <div className="space-y-0.5">
      <div className="flex gap-1">
        {open ? (
          <input
            autoFocus
            role="combobox"
            aria-expanded
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(close, 200)}
            placeholder={`Search ${noun} on this page, or type a selector`}
            className={fieldCls}
          />
        ) : (
          <button
            onClick={() => setOpen(true)}
            className={`${fieldCls} flex items-center gap-1.5 text-left cursor-pointer min-w-0 ${invalid ? "!border-amber-500/50" : ""}`}
          >
            {matched && MatchedIcon ? (
              <>
                <MatchedIcon size={11} className="text-purple-300 shrink-0" />
                <span className="truncate text-gray-100">{matched.label}</span>
                {matched.context && <span className="truncate text-gray-500">· {matched.context}</span>}
              </>
            ) : value ? (
              <span className="truncate font-mono text-gray-300">{value}</span>
            ) : (
              <span className="text-gray-500 truncate">Choose from {noun}…</span>
            )}
            <span className="ml-auto flex items-center gap-1 shrink-0">
              {value && (
                <span
                  title={resolves ? "Found on this page" : "Not found on this page"}
                  className={`w-1.5 h-1.5 rounded-full ${resolves ? "bg-emerald-400" : "bg-amber-400"}`}
                />
              )}
              <ChevronDown size={11} className="text-gray-500" />
            </span>
          </button>
        )}
        <button
          onClick={onPick}
          title={picking ? "Cancel picking" : "Pick element from page"}
          className={`shrink-0 px-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-center ${
            picking
              ? "bg-[#D4FF00] border-[#D4FF00] text-black font-bold animate-pulse shadow-[0_0_12px_rgba(212,255,0,0.4)]"
              : "bg-black/60 border-white/15 text-gray-400 hover:text-[#D4FF00] hover:border-[#D4FF00]/50"
          }`}
        >
          <Crosshair size={13} />
        </button>
      </div>

      {matched && !open && <div className="font-mono text-[9px] text-gray-500 truncate pl-0.5">{value}</div>}

      {open && (
        <ul role="listbox" className="max-h-44 overflow-y-auto rounded border border-white/10 bg-[#0b0f1c] divide-y divide-white/5 shadow-2xl">
          {options.map((o, i) => {
            const RowIcon = KIND_ICON[o.kind];
            const formTitle = o.formKey ? formTitles.get(o.formKey) : undefined;
            const meta = [o.context, formTitle && `in ${formTitle}`, o.kind !== "secret" && o.value && `= ${o.value}`]
              .filter(Boolean)
              .join(" · ");
            return (
              <li
                key={o.key}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(i);
                }}
                className={`flex items-center gap-1.5 px-1.5 py-1 cursor-pointer ${i === active ? "bg-purple-500/15" : ""} ${o.disabled ? "opacity-50" : ""}`}
              >
                <RowIcon size={11} className="text-purple-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-gray-100">
                    {o.label}
                    {o.required && <span className="text-rose-400"> *</span>}
                  </div>
                  <div className="truncate text-[9px] text-gray-500">{meta || o.tag}</div>
                </div>
                <span className="font-mono text-[9px] text-gray-600 truncate max-w-[90px]">{o.selector}</span>
              </li>
            );
          })}
          {showCustomRow && (
            <li
              role="option"
              aria-selected={active === options.length}
              onMouseEnter={() => setActive(options.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(options.length);
              }}
              className={`px-1.5 py-1 cursor-pointer text-[10px] text-gray-300 ${active === options.length ? "bg-purple-500/15" : ""}`}
            >
              Use <span className="font-mono text-purple-200">{custom}</span> as custom selector
            </li>
          )}
          {rowCount === 0 && (
            <li className="px-2 py-2 text-[10px] text-gray-500">
              No {noun} found on this page. Pick one with <Crosshair size={10} className="inline" /> or type a CSS selector.
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

const ValueField: React.FC<{ step: WorkflowStep; field?: PageElement; onChange: (u: Partial<WorkflowStep>) => void }> = ({
  step,
  field,
  onChange,
}) => {
  if (step.action === "wait") {
    return (
      <label className="flex items-center gap-1.5 text-[10px] text-gray-400">
        Wait
        <input
          type="number"
          min={800}
          step={100}
          value={step.value || "1500"}
          onChange={(e) => onChange({ value: e.target.value })}
          className={`${fieldCls} !w-20`}
        />
        ms
      </label>
    );
  }

  if (step.action === "select") {
    if (field?.options?.length) {
      const current = field.options.find((o) => o.value === step.value || o.text === step.value);
      return (
        <select value={current?.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} className={fieldCls}>
          <option value="" disabled>
            Choose option to select…
          </option>
          {field.options.map((o) => (
            <option key={`${o.value}|${o.text}`} value={o.value}>
              {o.text}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input value={step.value || ""} onChange={(e) => onChange({ value: e.target.value })} placeholder="Option text or value" className={fieldCls} />
    );
  }

  const suggestions = [
    ...(field?.value && field.value !== step.value ? [{ label: `Current: ${field.value}`, value: field.value }] : []),
    ...(field?.datalist ?? []).filter((v) => v !== step.value).slice(0, 6).map((v) => ({ label: v, value: v })),
  ];

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <input
          type={field?.kind === "secret" ? "password" : "text"}
          value={step.value || ""}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={field ? `Text to type into “${field.label}”` : "Text to type"}
          className={fieldCls}
        />
        <button
          onClick={() => onChange({ pressEnter: !step.pressEnter })}
          title="Press Enter after typing"
          aria-pressed={!!step.pressEnter}
          className={`shrink-0 px-1.5 rounded border cursor-pointer ${
            step.pressEnter ? "bg-purple-600/30 border-purple-400/60 text-purple-200" : "bg-[#111626] border-white/10 text-gray-500 hover:text-white"
          }`}
        >
          <CornerDownLeft size={11} />
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s.label}
              onClick={() => onChange({ value: s.value })}
              className="px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-[9px] text-purple-200 hover:bg-purple-500/20 truncate max-w-[150px] cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {field?.kind === "secret" && (
        <p className="flex items-center gap-1 text-[9px] text-amber-300/80">
          <AlertTriangle size={10} /> Saved unencrypted on this device.
        </p>
      )}
    </div>
  );
};

interface RepeatFieldProps {
  step: WorkflowStep;
  onChange: (updates: Partial<WorkflowStep>) => void;
}

const RepeatField: React.FC<RepeatFieldProps> = ({ step, onChange }) => {
  const count = clickRepeatCount(step);
  const interval = step.repeatIntervalMs ?? DEFAULT_REPEAT_INTERVAL_MS;

  const setCount = (val: number) => {
    const clamped = Math.max(1, Math.min(MAX_CLICK_REPEAT, Math.round(val)));
    onChange({
      repeatCount: clamped > 1 ? clamped : undefined,
      repeatIntervalMs: clamped > 1 ? (step.repeatIntervalMs ?? DEFAULT_REPEAT_INTERVAL_MS) : undefined,
    });
  };

  const setInterval = (val: number) => {
    const clamped = Math.max(50, Math.min(5000, Math.round(val)));
    onChange({ repeatIntervalMs: clamped });
  };

  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/60 border border-white/10 text-[10.5px]">
      <div className="flex items-center gap-1.5 text-gray-300 font-medium">
        <Repeat size={12} className={count > 1 ? "text-[#D4FF00]" : "text-gray-500"} />
        <span>Action Multiplier</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-white/15 bg-black/80 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setCount(count - 1)}
            disabled={count <= 1}
            title="Decrease repeat count"
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
          >
            <Minus size={10} />
          </button>
          <span className="px-2 font-mono text-xs font-black text-[#D4FF00] min-w-[24px] text-center">
            ×{count}
          </span>
          <button
            type="button"
            onClick={() => setCount(count + 1)}
            disabled={count >= MAX_CLICK_REPEAT}
            title="Increase repeat count (e.g. click 3 times)"
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
          >
            <Plus size={10} />
          </button>
        </div>
        <span className="text-gray-400 text-[10px] font-mono">{count === 1 ? "time" : "times"}</span>

        {count > 1 && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-white/10 text-gray-300">
            <span className="text-[10px]">interval:</span>
            <input
              type="number"
              min={50}
              max={5000}
              step={50}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value) || DEFAULT_REPEAT_INTERVAL_MS)}
              title="Interval between repeated clicks in milliseconds"
              className="w-14 bg-black/80 border border-white/15 rounded px-1.5 py-0.5 text-[10.5px] font-mono text-[#D4FF00] text-center focus:outline-none focus:border-[#D4FF00]"
            />
            <span className="text-[10px] font-mono text-gray-400">ms</span>
          </div>
        )}
      </div>
    </div>
  );
};

