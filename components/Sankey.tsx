"use client";

import { useMemo } from "react";
import {
  sankey as d3sankey,
  sankeyLinkHorizontal,
  sankeyJustify,
} from "d3-sankey";
import type { GraphLinkDef, GraphNodeDef, ModelResult, Mode, Unit } from "@/lib/types";
import { formatFlow, formatReturn } from "@/lib/format";

// Rendering split (spec §9): React owns state + DOM; D3 owns the layout math.
// We compute the layout in a useMemo and render React elements from the
// D3-computed positions. CSS transitions on geometry give smooth re-animation
// on slider drag without a full re-layout flash.

const VIEW_W = 980;
const VIEW_H = 560;
const PAD_LEFT = 150;
const PAD_RIGHT = 180;
const NODE_WIDTH = 14;

const STREAM_COLOR: Record<string, string> = {
  protection: "#0e7490",
  excess: "#b45309",
  reserve: "#7c3aed",
};
const LOSS_COLOR = "#dc2626";

type LayoutNode = GraphNodeDef & {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  value: number;
};
type LayoutLink = Omit<GraphLinkDef, "source" | "target"> & {
  source: LayoutNode;
  target: LayoutNode;
  width: number;
  y0: number;
  y1: number;
};

function linkColor(link: Pick<GraphLinkDef, "negative" | "stream">): string {
  if (link.negative) return LOSS_COLOR;
  return STREAM_COLOR[link.stream] ?? "#94a3b8";
}

export interface SankeyProps {
  model: ModelResult;
  unit: Unit;
  mode: Mode;
  followCohort: string | null;
  followReserve: boolean;
  onSelectCohort: (cohortId: string | null) => void;
}

export default function Sankey({
  model,
  unit,
  mode,
  followCohort,
  followReserve,
  onSelectCohort,
}: SankeyProps) {
  const { nodes, links } = useMemo(() => {
    const count = model.cohorts.length;
    const padding = count > 120 ? 0.3 : count > 20 ? 3 : 14;
    const generator = d3sankey<GraphNodeDef, GraphLinkDef>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(padding)
      .nodeAlign(sankeyJustify)
      .nodeSort(null)
      .linkSort(null)
      .extent([
        [PAD_LEFT, 10],
        [VIEW_W - PAD_RIGHT, VIEW_H - 10],
      ]);

    // Clone so D3's mutation never touches our model arrays.
    const graph = generator({
      nodes: model.graph.nodes.map((n) => ({ ...n })),
      links: model.graph.links.map((l) => ({ ...l })),
    });
    return {
      nodes: graph.nodes as unknown as LayoutNode[],
      links: graph.links as unknown as LayoutLink[],
    };
  }, [model]);

  const linkPath = sankeyLinkHorizontal<GraphNodeDef, GraphLinkDef>();
  const cohortCount = model.cohorts.length;
  const labelFontSize = cohortCount > 20 ? 7 : 11;
  // Per-cohort right-edge labels become illegible past ~60 nodes (1-month view);
  // the band reads as a continuum and the cohort table carries the detail.
  const showCohortLabels = cohortCount <= 60;

  function linkOpacity(link: LayoutLink): number {
    // Sub-pixel keep-alive links are invisible anyway.
    if (link.width < 0.4) return 0;
    if (followReserve) return link.stream === "reserve" ? 0.85 : 0.06;
    if (followCohort) {
      const touches =
        link.target.cohortId === followCohort ||
        link.source.cohortId === followCohort;
      // Stage-1 (decompose) links feed everyone; keep them dim but visible.
      if (link.stage === "decompose") return touches ? 0.55 : 0.2;
      return touches ? 0.85 : 0.05;
    }
    return 0.5;
  }

  function nodeOpacity(node: LayoutNode): number {
    if (followReserve) {
      return node.kind === "reserve" || node.kind === "collective" ? 1 : 0.3;
    }
    if (followCohort) {
      if (node.kind === "cohort") return node.cohortId === followCohort ? 1 : 0.3;
      return 0.8;
    }
    return 1;
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full h-auto select-none"
      role="img"
      aria-label="Sankey diagram: collective result decomposed into protection, excess and reserve, then allocated to age cohorts."
      onClick={(e) => {
        // Click on empty canvas clears the cohort focus.
        if (e.target === e.currentTarget) onSelectCohort(null);
      }}
    >
      {/* Stage captions */}
      <text x={PAD_LEFT} y={VIEW_H - 2} fontSize={10} fill="#94a3b8">
        1 · Decompose
      </text>
      <text
        x={(VIEW_W - PAD_RIGHT + PAD_LEFT) / 2}
        y={VIEW_H - 2}
        fontSize={10}
        fill="#94a3b8"
        textAnchor="middle"
      >
        2 · Allocate to cohorts
      </text>

      {/* Links */}
      <g fill="none">
        {links.map((link) => {
          const d = linkPath(link as never) ?? undefined;
          return (
            <path
              key={`${link.source.id}->${link.target.id}`}
              className="sankey-link"
              d={d}
              stroke={linkColor(link)}
              strokeWidth={Math.max(0, link.width)}
              strokeOpacity={linkOpacity(link)}
              style={{
                transition:
                  "stroke-opacity 200ms ease, stroke-width 350ms ease, d 350ms ease",
              }}
            >
              <title>
                {`${labelFor(link.source)} → ${labelFor(link.target)}: ${formatFlow(
                  link.signedValue,
                  model.totalCapital,
                  unit,
                )}`}
              </title>
            </path>
          );
        })}
      </g>

      {/* Nodes */}
      <g>
        {nodes.map((node) => {
          const isCohort = node.kind === "cohort";
          const fill =
            node.kind === "stream"
              ? STREAM_COLOR[node.stream ?? ""]
              : node.kind === "reserve"
                ? STREAM_COLOR.reserve
                : node.kind === "collective"
                  ? "#0f172a"
                  : "#cbd5e1";
          const cohort = isCohort
            ? model.cohorts.find((c) => c.cohortId === node.cohortId)
            : undefined;
          const selectable = isCohort;
          return (
            <g
              key={node.id}
              opacity={nodeOpacity(node)}
              style={{ transition: "opacity 200ms ease" }}
            >
              <rect
                className="sankey-node"
                x={node.x0}
                y={node.y0}
                width={node.x1 - node.x0}
                height={Math.max(1, node.y1 - node.y0)}
                fill={fill}
                rx={2}
                cursor={selectable ? "pointer" : "default"}
                onClick={(e) => {
                  if (!selectable) return;
                  e.stopPropagation();
                  onSelectCohort(
                    followCohort === node.cohortId ? null : node.cohortId ?? null,
                  );
                }}
                style={{ transition: "y 350ms ease, height 350ms ease" }}
              >
                <title>{labelFor(node)}</title>
              </rect>

              {/* Left-edge labels for the collective + stream nodes */}
              {node.kind === "collective" && (
                <text
                  x={node.x0 - 10}
                  y={(node.y0 + node.y1) / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="#0f172a"
                >
                  <tspan x={node.x0 - 10} dy={-6}>
                    Collective result
                  </tspan>
                  <tspan x={node.x0 - 10} dy={15} fontWeight={400} fill="#475569">
                    {formatFlow(model.collectiveEur, model.totalCapital, unit)}
                  </tspan>
                </text>
              )}

              {(node.kind === "stream" || node.kind === "reserve") && (
                <text
                  x={(node.x0 + node.x1) / 2}
                  y={node.y0 - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill={fill}
                  style={{ transition: "y 350ms ease" }}
                >
                  {node.label}
                </text>
              )}

              {/* Right-edge payoff labels for cohorts */}
              {isCohort && cohort && showCohortLabels && (
                <text
                  x={node.x1 + 8}
                  y={(node.y0 + node.y1) / 2}
                  dominantBaseline="middle"
                  fontSize={labelFontSize}
                  fill="#334155"
                  cursor="pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCohort(
                      followCohort === node.cohortId ? null : node.cohortId ?? null,
                    );
                  }}
                  style={{ transition: "y 350ms ease" }}
                >
                  {cohortLabel(node, cohort.creditedReturn, unit, mode, cohortCount)}
                  <tspan
                    fontWeight={700}
                    fill={cohort.creditedReturn >= 0 ? "#15803d" : "#dc2626"}
                  >
                    {"  "}
                    {formatReturn(cohort.creditedReturn, unit)}
                  </tspan>
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function labelFor(node: GraphNodeDef): string {
  return node.label;
}

function cohortLabel(
  node: GraphNodeDef,
  _rate: number,
  _unit: Unit,
  _mode: Mode,
  count: number,
): string {
  // Compact labels when there are many one-year cohorts.
  if (count > 20) {
    const m = node.label.match(/^(\d{4})/);
    return m ? m[1] : node.label;
  }
  // "1956–1960 · age 65–69" -> "age 65–69"
  const parts = node.label.split("·");
  return parts.length > 1 ? parts[1].trim() : node.label;
}
