import React, { useState, useEffect, useMemo } from "react";
import {
  Compass,
  Zap,
  Box,
  FileText,
  ChevronRight,
  Sparkles,
  Layers,
  CheckCircle2,
  Brain,
} from "lucide-react";
import {
  buildEngramMap,
  teleportToEngram,
  EngramNode,
  EngramMap,
} from "../lib/engramNavigator";

interface NavigationHubProps {
  onNavigateToChatWithPrompt?: (prompt: string) => void;
}

export const NavigationHub: React.FC<NavigationHubProps> = ({
  onNavigateToChatWithPrompt,
}) => {
  const [cueQuery, setCueQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    "all" | "sections" | "actions" | "canvases" | "concepts"
  >("all");
  const [engramMap, setEngramMap] = useState<EngramMap>(() => buildEngramMap());
  const [teleportedNodeId, setTeleportedNodeId] = useState<string | null>(null);

  // Refresh engram map on mount or when page DOM settles
  useEffect(() => {
    const map = buildEngramMap(true);
    setEngramMap(map);
  }, []);

  const handleTeleport = (node: EngramNode) => {
    setTeleportedNodeId(node.id);
    teleportToEngram(node);
    setTimeout(() => {
      setTeleportedNodeId(null);
    }, 2000);
  };

  // Filtered nodes based on category and search cue
  const displayedNodes = useMemo(() => {
    let pool: EngramNode[] = [];
    if (activeCategory === "all") {
      pool = engramMap.nodes;
    } else if (activeCategory === "sections") {
      pool = engramMap.sections;
    } else if (activeCategory === "actions") {
      pool = engramMap.actions;
    } else if (activeCategory === "canvases") {
      pool = engramMap.canvases;
    } else if (activeCategory === "concepts") {
      pool = engramMap.concepts;
    }

    const trimmed = cueQuery.trim().toLowerCase();
    if (!trimmed) return pool;

    return pool
      .map((node) => {
        let score = 0;
        const titleLower = node.title.toLowerCase();
        if (titleLower === trimmed) score += 10;
        else if (titleLower.includes(trimmed)) score += 5;
        if (node.description.toLowerCase().includes(trimmed)) score += 2;
        if (node.cueTerms.some((t) => t.includes(trimmed) || trimmed.includes(t))) {
          score += 3;
        }
        return { node, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.node);
  }, [engramMap, activeCategory, cueQuery]);

  const handleAskOverview = () => {
    if (onNavigateToChatWithPrompt) {
      onNavigateToChatWithPrompt("What is this website and what can I do here?");
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3.5 overflow-hidden bg-black/20 text-xs text-gray-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Compass size={15} />
          </div>
          <div>
            <h4 className="font-semibold text-white text-xs leading-none">
              AI Navigation Hub
            </h4>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Engram memory map • Universal site navigation
            </p>
          </div>
        </div>
        <button
          onClick={handleAskOverview}
          className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-200 hover:text-white font-medium flex items-center gap-1 cursor-pointer text-[10px] transition-all"
          title="Generate full site overview in chat"
        >
          <Sparkles size={11} />
          <span>Site Tour</span>
        </button>
      </div>

      {/* Associative Cue Search Input */}
      <div className="relative mb-2.5 shrink-0">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
          <Brain size={13} className="text-emerald-400/80" />
        </div>
        <input
          type="text"
          value={cueQuery}
          onChange={(e) => setCueQuery(e.target.value)}
          placeholder="Search landmarks or topics (e.g. 'pricing', 'features', 'docs')..."
          className="w-full bg-black/40 border border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 rounded-xl pl-8 pr-8 py-2 text-[16px] sm:text-xs text-white placeholder-gray-500 outline-none transition-all"
        />
        {cueQuery && (
          <button
            onClick={() => setCueQuery("")}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-white cursor-pointer"
          >
            ×
          </button>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1 shrink-0 text-[10px]">
        {[
          { id: "all", label: `All (${engramMap.nodes.length})` },
          { id: "sections", label: `Landmarks (${engramMap.sections.length})` },
          { id: "actions", label: `Tools (${engramMap.actions.length})` },
          { id: "canvases", label: `3D Viewports (${engramMap.canvases.length})` },
          { id: "concepts", label: `Topics (${engramMap.concepts.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id as any)}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all font-medium cursor-pointer border ${
              activeCategory === tab.id
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-white/5 border-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Engram Constellation List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 overscroll-contain">
        {displayedNodes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
            <Compass size={28} className="text-gray-600 animate-pulse" />
            <p className="text-xs">No matching engrams found for "{cueQuery}".</p>
            <p className="text-[10px] text-gray-500 max-w-[240px]">
              The page outline, buttons, and 3D canvases are continuously indexed to give you seamless navigation anywhere.
            </p>
          </div>
        ) : (
          displayedNodes.map((node) => {
            const isTeleported = teleportedNodeId === node.id;
            return (
              <div
                key={node.id}
                onClick={() => handleTeleport(node)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 group ${
                  isTeleported
                    ? "bg-emerald-950/60 border-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-[0.99]"
                    : "bg-white/[0.04] border-white/5 hover:bg-white/[0.08] hover:border-white/15 text-gray-200"
                }`}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors bg-white/5 group-hover:bg-emerald-500/20 text-gray-400 group-hover:text-emerald-300">
                  {node.type === "section" && <Layers size={13} />}
                  {node.type === "action" && <Zap size={13} />}
                  {node.type === "canvas" && <Box size={13} className="text-cyan-400" />}
                  {node.type === "concept" && <FileText size={13} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-xs text-white truncate">
                      {node.title}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-gray-400 border border-white/5 shrink-0">
                      {node.category}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate mt-0.5 font-mono">
                    {node.selector}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTeleport(node);
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                    isTeleported
                      ? "bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/30"
                      : "bg-white/10 group-hover:bg-emerald-600 text-gray-300 group-hover:text-white"
                  }`}
                  title="Teleport and spotlight element"
                >
                  {isTeleported ? (
                    <>
                      <CheckCircle2 size={11} />
                      <span>Arrived</span>
                    </>
                  ) : (
                    <>
                      <span>Jump</span>
                      <ChevronRight size={11} />
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Status */}
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-400 shrink-0">
        <span>
          {engramMap.nodes.length} landmarks & controls mapped
        </span>
        <span className="font-mono text-emerald-400">100% On-Device</span>
      </div>
    </div>
  );
};
