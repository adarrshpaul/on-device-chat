import React, { useState } from "react";
import type { UISpec } from "../lib/types";
import { UISpecEngine } from "../lib/uiSpecEngine";
import { Check, Play, Settings, ListChecks, Loader2 } from "lucide-react";

interface UISpecRendererProps {
  specs: UISpec[];
  onSelectChoice?: (choice: string) => void;
  onExecuteAction?: (actionName: string, payload?: Record<string, unknown>) => void;
  onActionCompleted?: (specId: string, result: { success: boolean; latencyMs: number }) => void;
}

export const UISpecRenderer: React.FC<UISpecRendererProps> = ({
  specs,
  onSelectChoice,
  onExecuteAction,
  onActionCompleted,
}) => {
  if (!specs || specs.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5 my-2 w-full max-w-full overflow-hidden">
      {specs.map((spec) => (
        <SingleUISpecCard
          key={spec.id}
          spec={spec}
          onSelectChoice={onSelectChoice}
          onExecuteAction={onExecuteAction}
          onActionCompleted={onActionCompleted}
        />
      ))}
    </div>
  );
};

const SingleUISpecCard: React.FC<{
  spec: UISpec;
  onSelectChoice?: (choice: string) => void;
  onExecuteAction?: (actionName: string, payload?: Record<string, unknown>) => void;
  onActionCompleted?: (specId: string, result: { success: boolean; latencyMs: number }) => void;
}> = ({ spec, onSelectChoice, onExecuteAction, onActionCompleted }) => {
  // Confirm state
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [hasSucceeded, setHasSucceeded] = useState(false);

  // Batch preview selection state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => {
    if (spec.kind === "batchPreview") {
      return new Set(spec.rows.filter((r) => r.selected).map((r) => r.id));
    }
    return new Set();
  });

  // ParamForm state
  const [formValues, setFormValues] = useState<Record<string, any>>(() => {
    if (spec.kind === "paramForm") {
      const init: Record<string, any> = {};
      spec.fields.forEach((f) => {
        init[f.name] = f.defaultValue ?? "";
      });
      return init;
    }
    return {};
  });

  // --- 1. Confirm Card ---
  if (spec.kind === "confirm") {
    const handleRunConfirm = async () => {
      setIsRunning(true);
      setStatusText(null);
      if (onExecuteAction) {
        onExecuteAction(spec.action.tool, { ref: spec.action.ref, value: spec.action.value });
      }
      const res = await UISpecEngine.executeAction(spec.action);
      setIsRunning(false);
      if (res.success) {
        setHasSucceeded(true);
        setStatusText(`Done in ${res.latencyMs}ms`);
        onActionCompleted?.(spec.id, res);
      } else {
        setStatusText(res.error || "Action failed");
      }
    };

    return (
      <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 shadow-md backdrop-blur-md">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-purple-500/20 text-purple-300">
              <Play size={12} />
            </span>
            <span className="text-xs font-semibold text-purple-200">{spec.title}</span>
          </div>
          {spec.action.repeatCount && spec.action.repeatCount > 1 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-900/60 text-purple-300 border border-purple-500/40">
              ×{spec.action.repeatCount}
            </span>
          )}
        </div>

        {spec.description && (
          <p className="text-[12px] text-gray-300 mb-2 leading-relaxed">{spec.description}</p>
        )}

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400 mb-2.5 truncate">
          <span className="text-gray-500">Target:</span>
          <code className="text-purple-300 truncate">{spec.action.ref.selector}</code>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          {statusText && (
            <span
              className={`text-[11px] font-mono ${
                hasSucceeded ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {statusText}
            </span>
          )}
          <button
            type="button"
            disabled={isRunning || hasSucceeded}
            onClick={handleRunConfirm}
            className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              hasSucceeded
                ? "bg-emerald-900/40 text-emerald-300 border border-emerald-500/30"
                : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg active:scale-95"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Executing...</span>
              </>
            ) : hasSucceeded ? (
              <>
                <Check size={12} />
                <span>Confirmed</span>
              </>
            ) : (
              <>
                <Play size={12} />
                <span>Confirm & Execute</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- 2. Batch Preview Card ---
  if (spec.kind === "batchPreview") {
    const allSelected = selectedRowIds.size === spec.rows.length;
    const toggleAll = () => {
      if (allSelected) {
        setSelectedRowIds(new Set());
      } else {
        setSelectedRowIds(new Set(spec.rows.map((r) => r.id)));
      }
    };

    const toggleRow = (id: string) => {
      const next = new Set(selectedRowIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedRowIds(next);
    };

    const handleRunBatch = async () => {
      setIsRunning(true);
      const chosenRows = spec.rows.filter((r) => selectedRowIds.has(r.id));
      let successCount = 0;
      for (const row of chosenRows) {
        const res = await UISpecEngine.executeAction({
          tool: "click",
          ref: row.ref,
        });
        if (res.success) successCount++;
        await new Promise((r) => setTimeout(r, 150));
      }
      setIsRunning(false);
      setHasSucceeded(true);
      setStatusText(`Ran ${successCount}/${chosenRows.length} items`);
    };

    return (
      <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-sky-500/20 text-sky-300">
              <ListChecks size={12} />
            </span>
            <span className="text-xs font-semibold text-sky-200">{spec.title}</span>
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>

        {spec.summary && (
          <p className="text-[11px] text-gray-300 mb-2 leading-relaxed">{spec.summary}</p>
        )}

        <div className="max-h-36 overflow-y-auto border border-white/10 rounded-lg bg-black/40 text-[11px] my-2 divide-y divide-white/5">
          {spec.rows.map((row) => (
            <label
              key={row.id}
              className="flex items-center gap-2 p-1.5 hover:bg-white/5 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={selectedRowIds.has(row.id)}
                onChange={() => toggleRow(row.id)}
                className="rounded border-gray-600 bg-gray-800 text-sky-500 shrink-0"
              />
              <span className="truncate text-gray-200">{row.cells.join(" • ")}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-gray-400">
            {statusText || `${selectedRowIds.size} of ${spec.rows.length} selected`}
          </span>
          <button
            type="button"
            disabled={isRunning || selectedRowIds.size === 0 || hasSucceeded}
            onClick={handleRunBatch}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Running...</span>
              </>
            ) : hasSucceeded ? (
              <>
                <Check size={12} />
                <span>Finished</span>
              </>
            ) : (
              <span>Run Selected ({selectedRowIds.size})</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- 3. Param Form Card ---
  if (spec.kind === "paramForm") {
    const handleApply = async () => {
      setIsRunning(true);
      // Fill each field into live DOM if ref is available
      let filled = 0;
      for (const field of spec.fields) {
        if (field.ref) {
          const val = String(formValues[field.name] ?? "");
          const res = await UISpecEngine.executeAction({
            tool: "type",
            ref: field.ref,
            value: val,
          });
          if (res.success) filled++;
        }
      }
      setIsRunning(false);
      setHasSucceeded(true);
      setStatusText(`Applied ${filled} values`);
    };

    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="p-1 rounded-md bg-amber-500/20 text-amber-300">
            <Settings size={12} />
          </span>
          <span className="text-xs font-semibold text-amber-200">{spec.title}</span>
        </div>

        {spec.description && (
          <p className="text-[11px] text-gray-300 mb-2">{spec.description}</p>
        )}

        <div className="flex flex-col gap-2 my-2">
          {spec.fields.map((field) => (
            <div key={field.name} className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-300 flex items-center justify-between">
                <span>{field.label}</span>
                {field.required && <span className="text-amber-400">*</span>}
              </label>
              {field.type === "enum" && field.options ? (
                <select
                  value={formValues[field.name]}
                  onChange={(e) =>
                    setFormValues({ ...formValues, [field.name]: e.target.value })
                  }
                  className="px-2 py-1 rounded bg-black/50 border border-white/10 text-xs text-gray-200 outline-none focus:border-amber-400"
                >
                  {field.options.map((opt) => (
                    <option key={opt} value={opt} className="bg-gray-900 text-white">
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === "boolean" ? (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-200">
                  <input
                    type="checkbox"
                    checked={Boolean(formValues[field.name])}
                    onChange={(e) =>
                      setFormValues({ ...formValues, [field.name]: e.target.checked })
                    }
                    className="rounded bg-gray-800 border-gray-600 text-amber-500"
                  />
                  <span>Enable</span>
                </label>
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  min={field.min}
                  max={field.max}
                  value={formValues[field.name]}
                  onChange={(e) =>
                    setFormValues({ ...formValues, [field.name]: e.target.value })
                  }
                  className="px-2 py-1 rounded bg-black/50 border border-white/10 text-xs text-gray-200 outline-none focus:border-amber-400"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-gray-400">{statusText}</span>
          <button
            type="button"
            disabled={isRunning || hasSucceeded}
            onClick={handleApply}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 cursor-pointer ml-auto"
          >
            {isRunning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Applying...</span>
              </>
            ) : hasSucceeded ? (
              <>
                <Check size={12} />
                <span>Applied</span>
              </>
            ) : (
              <span>{spec.submitLabel || "Apply to Page"}</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- 4. Choices Card ---
  if (spec.kind === "choices") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-md">
        <div className="text-[11px] font-medium text-gray-300 mb-2">{spec.prompt}</div>
        <div className="flex flex-wrap gap-1.5">
          {spec.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectChoice?.(opt.label)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/10 hover:bg-white/20 text-gray-200 flex items-center gap-1.5 transition-all cursor-pointer border border-white/10 active:scale-95"
            >
              <span>{opt.label}</span>
              {typeof opt.score === "number" && (
                <span className="text-[9px] font-mono px-1 rounded bg-black/40 text-purple-300">
                  {Math.round(opt.score * 100)}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
};
export default UISpecRenderer;
