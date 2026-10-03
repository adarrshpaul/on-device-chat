import { ToolCall } from '../lib/api';
import { Settings, CheckCircle2 } from 'lucide-react';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

export default function ToolCallCard({ toolCall }: ToolCallCardProps) {
  let formattedArgs = '';
  try {
    formattedArgs = JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2);
  } catch {
    formattedArgs = toolCall.function.arguments;
  }

  return (
    <div className="bg-[#1e293b] border border-[var(--g4-border)] rounded-lg p-3 text-sm shadow-inner font-mono">
      <div className="flex items-center gap-2 mb-2 text-[var(--g4-text-main)]">
        <Settings size={16} className="text-[var(--g4-primary)]" />
        <span className="font-semibold">Calling: {toolCall.function.name}</span>
      </div>
      <div className="bg-black/30 p-2 rounded whitespace-pre-wrap text-xs text-[var(--g4-text-muted)] mb-2">
        {formattedArgs}
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--g4-text-muted)]">
        <CheckCircle2 size={14} className="text-green-500" />
        <span>Executed</span>
      </div>
    </div>
  );
}
