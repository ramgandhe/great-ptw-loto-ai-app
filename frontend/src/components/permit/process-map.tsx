"use client";

import { type KeyboardEvent } from "react";
import {
  EDGES,
  LANES,
  MAP_HEADER,
  MAP_HEIGHT,
  MAP_WIDTH,
  NODE_BY_ID,
  NODE_H,
  NODE_W,
  NODES,
  PHASES,
  type ProcessEdge,
  type ProcessNode,
} from "@/lib/permit/process";
import { PERMIT_STATUSES } from "@/lib/permit/status";
import { cn } from "@/lib/utils";

/** Same colour pairs as the status badge, so a stage looks the same everywhere. */
const NODE_TONE: Record<string, [fill: string, ink: string]> = {
  ...Object.fromEntries(PERMIT_STATUSES.map((s) => [s.key, [s.fill, s.ink]])),
  veto: ["--status-danger-bg", "--status-danger"],
};

const EDGE_INK: Record<NonNullable<ProcessEdge["tone"]>, string> = {
  forward: "var(--foreground)",
  back: "var(--status-warning)",
  stop: "var(--status-danger)",
};

export type MapRun = {
  current: string;
  visited: Set<string>;
  /** Edge id to number of times this permit travelled it. */
  edges: Map<string, number>;
  /** Short note under the current stage, e.g. "3 h here". */
  currentNote?: string;
};

export type MapSelection = { kind: "node" | "edge"; id: string } | null;

type Point = { x: number; y: number };

function centre(node: ProcessNode): Point {
  const lane = LANES.find((l) => l.id === node.lane)!;
  return { x: node.x, y: MAP_HEADER + lane.top + node.y };
}

/** Exit point and outward direction on the side of the box facing the other point. */
function anchor(c: Point, toward: Point): { p: Point; n: Point } {
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (Math.abs(dx) / (NODE_W / 2) >= Math.abs(dy) / (NODE_H / 2)) {
    const s = Math.sign(dx) || 1;
    return { p: { x: c.x + (s * NODE_W) / 2, y: c.y }, n: { x: s, y: 0 } };
  }
  const s = Math.sign(dy) || 1;
  return { p: { x: c.x, y: c.y + (s * NODE_H) / 2 }, n: { x: 0, y: s } };
}

function geometry(edge: ProcessEdge): { d: string; label: Point } {
  const a = centre(NODE_BY_ID.get(edge.from)!);
  const b = centre(NODE_BY_ID.get(edge.to)!);
  if (edge.from === edge.to) {
    const y = a.y + NODE_H / 2;
    return {
      d: `M ${a.x - 34} ${y} C ${a.x - 44} ${y + 44}, ${a.x + 44} ${y + 44}, ${a.x + 34} ${y}`,
      label: { x: a.x, y: y + 42 },
    };
  }
  const s = anchor(a, b);
  const e = anchor(b, a);
  const dist = Math.hypot(e.p.x - s.p.x, e.p.y - s.p.y);
  const k = Math.max(30, dist * 0.35);
  // Perpendicular offset keeps two-way pairs from drawing on top of each other.
  const len = dist || 1;
  const px = (-(e.p.y - s.p.y) / len) * (edge.bend ?? 0);
  const py = ((e.p.x - s.p.x) / len) * (edge.bend ?? 0);
  const c1 = { x: s.p.x + s.n.x * k + px, y: s.p.y + s.n.y * k + py };
  const c2 = { x: e.p.x + e.n.x * k + px, y: e.p.y + e.n.y * k + py };
  const t = edge.labelT ?? 0.5;
  const at = (a: number, b: number, c: number, d: number) =>
    (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
  const label = { x: at(s.p.x, c1.x, c2.x, e.p.x), y: at(s.p.y, c1.y, c2.y, e.p.y) };
  return { d: `M ${s.p.x} ${s.p.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${e.p.x} ${e.p.y}`, label };
}

function activate(event: KeyboardEvent, run: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    run();
  }
}

/**
 * The permit process as a swimlane map: lanes are the people who act, columns the phases,
 * boxes the permit statuses and arrows the moves between them. With `run`, one permit's path is lit.
 */
export function ProcessMap({
  counts,
  run,
  selected,
  onSelect,
  className,
}: {
  counts?: Record<string, number>;
  run?: MapRun;
  selected?: MapSelection;
  onSelect?: (selection: MapSelection) => void;
  className?: string;
}) {
  const select = (kind: "node" | "edge", id: string) =>
    onSelect?.(selected?.kind === kind && selected.id === id ? null : { kind, id });

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-card", className)}>
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="h-auto w-full min-w-[56rem] select-none text-foreground"
        role="group"
        aria-label={run ? "This permit's path through the permit process" : "Permit process map"}
      >
        <defs>
          {Object.entries(EDGE_INK).map(([tone, ink]) => (
            <marker key={tone} id={`pm-arrow-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" style={{ fill: ink }} />
            </marker>
          ))}
        </defs>

        {/* Phase header and dividers */}
        {PHASES.map((phase, i) => (
          <g key={phase.label}>
            {i > 0 ? (
              <line x1={phase.from} x2={phase.from} y1={8} y2={MAP_HEIGHT} className="stroke-border" strokeDasharray="4 6" />
            ) : null}
            <text x={phase.from + 12} y={24} className="fill-muted-foreground text-[13px] font-semibold">
              {phase.label}
            </text>
          </g>
        ))}

        {/* Swimlanes */}
        {LANES.map((lane, i) => (
          <g key={lane.id}>
            <rect
              x={0}
              y={MAP_HEADER + lane.top}
              width={MAP_WIDTH}
              height={lane.height}
              className={i % 2 ? "fill-transparent" : "fill-muted/40"}
            />
            <line x1={0} x2={MAP_WIDTH} y1={MAP_HEADER + lane.top} y2={MAP_HEADER + lane.top} className="stroke-border" />
            <text x={14} y={MAP_HEADER + lane.top + 24} className="fill-foreground text-[13px] font-semibold">
              {lane.label}
            </text>
            <foreignObject x={14} y={MAP_HEADER + lane.top + 30} width={100} height={lane.height - 34}>
              <p className="text-[11px] leading-snug text-muted-foreground">{lane.roles}</p>
            </foreignObject>
          </g>
        ))}

        {/* Moves */}
        {EDGES.map((edge) => {
          const { d, label } = geometry(edge);
          const travelled = run?.edges.get(edge.id) ?? 0;
          const isSelected = selected?.kind === "edge" && selected.id === edge.id;
          // On a permit's map, untaken moves fade, except the ones open from where it is now.
          const next = run?.current === edge.from && edge.from !== edge.to;
          const faded = run ? travelled === 0 && !next : false;
          const ink = EDGE_INK[edge.tone ?? "forward"];
          const text = travelled > 1 ? `${edge.label} ×${travelled}` : edge.label;
          return (
            <g
              key={edge.id}
              role="button"
              tabIndex={0}
              aria-label={`${edge.label}: ${NODE_BY_ID.get(edge.from)?.title} to ${NODE_BY_ID.get(edge.to)?.title}, by ${edge.actor}${travelled ? `, taken ${travelled} time${travelled === 1 ? "" : "s"}` : ""}`}
              aria-pressed={isSelected}
              onClick={() => select("edge", edge.id)}
              onKeyDown={(event) => activate(event, () => select("edge", edge.id))}
              className="group cursor-pointer outline-none"
              style={{ opacity: faded ? 0.18 : next && !travelled ? 0.75 : 1 }}
            >
              <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
              <path
                d={d}
                fill="none"
                style={{ stroke: ink }}
                strokeWidth={travelled || isSelected ? 3 : 1.6}
                strokeOpacity={run || isSelected ? 1 : 0.7}
                strokeDasharray={edge.dashed ? "5 5" : undefined}
                markerEnd={`url(#pm-arrow-${edge.tone ?? "forward"})`}
                className={cn(travelled && run ? "pm-flow" : undefined)}
              />
              <text
                x={label.x}
                y={label.y + 4}
                textAnchor="middle"
                paintOrder="stroke"
                strokeWidth={5}
                strokeLinejoin="round"
                className={cn(
                  "stroke-card text-[11px] group-hover:underline group-focus-visible:underline",
                  travelled || isSelected ? "font-semibold" : "",
                )}
                style={{ fill: ink }}
              >
                {text}
              </text>
            </g>
          );
        })}

        {/* Stages */}
        {NODES.map((node) => {
          const c = centre(node);
          const [fill, ink] = NODE_TONE[node.id] ?? ["--muted", "--foreground"];
          const count = counts?.[node.id];
          const isCurrent = run?.current === node.id;
          const visited = run?.visited.has(node.id) ?? false;
          const isSelected = selected?.kind === "node" && selected.id === node.id;
          const rx = node.kind === "end" || node.kind === "event" ? NODE_H / 2 : 10;
          const sub = run
            ? isCurrent
              ? run.currentNote ?? "Now"
              : visited
                ? "Passed"
                : null
            : count
              ? `${count} now`
              : null;
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`${node.title}${isCurrent ? ", current stage" : visited ? ", passed" : ""}${count ? `, ${count} permits` : ""}`}
              aria-pressed={isSelected}
              onClick={() => select("node", node.id)}
              onKeyDown={(event) => activate(event, () => select("node", node.id))}
              className="group cursor-pointer outline-none"
              style={{ opacity: (run && !visited && !isCurrent) || count === 0 ? 0.55 : 1 }}
            >
              {isCurrent ? (
                <rect
                  x={c.x - NODE_W / 2 - 7}
                  y={c.y - NODE_H / 2 - 7}
                  width={NODE_W + 14}
                  height={NODE_H + 14}
                  rx={rx + 7}
                  fill="none"
                  style={{ stroke: `var(${ink})` }}
                  strokeWidth={2}
                  className="pm-pulse"
                />
              ) : null}
              <rect
                x={c.x - NODE_W / 2}
                y={c.y - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={rx}
                style={{ fill: `var(${fill})`, stroke: `var(${ink})` }}
                strokeWidth={isCurrent || isSelected ? 3 : 1.5}
                strokeDasharray={node.kind === "loop-back" || node.kind === "event" ? "5 4" : undefined}
                className="transition-[stroke-width] group-hover:[stroke-width:3] group-focus-visible:[stroke-width:3.5]"
              />
              {node.kind === "decision" ? (
                <rect
                  x={c.x - NODE_W / 2 + 7}
                  y={c.y - (sub ? 10 : 3) - 4}
                  width={8}
                  height={8}
                  transform={`rotate(45 ${c.x - NODE_W / 2 + 11} ${c.y - (sub ? 10 : 3)})`}
                  style={{ fill: `var(${ink})` }}
                />
              ) : null}
              <text
                x={c.x + (node.kind === "decision" ? 6 : 0)}
                y={c.y + (sub ? -3 : 5)}
                textAnchor="middle"
                className="text-[13px] font-semibold"
                style={{ fill: `var(${ink})` }}
              >
                {node.title}
              </text>
              {sub ? (
                <text
                  x={c.x + (node.kind === "decision" ? 6 : 0)}
                  y={c.y + 14}
                  textAnchor="middle"
                  className="text-[11px] tabular-nums"
                  style={{ fill: `var(${ink})`, opacity: 0.85 }}
                >
                  {sub}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Colour key for the map. */
export function ProcessMapLegend({ run = false }: { run?: boolean }) {
  const line = (ink: string, dashed = false) => (
    <svg width="28" height="10" aria-hidden className="shrink-0">
      <line x1="1" x2="27" y1="5" y2="5" style={{ stroke: ink }} strokeWidth="2.5" strokeDasharray={dashed ? "4 3" : undefined} />
    </svg>
  );
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">{line(EDGE_INK.forward)}Moves forward</li>
      <li className="flex items-center gap-1.5">{line(EDGE_INK.back)}Sends back</li>
      <li className="flex items-center gap-1.5">{line(EDGE_INK.stop)}Stops or holds</li>
      <li className="flex items-center gap-1.5">{line(EDGE_INK.stop, true)}Automatic or any time</li>
      <li className="flex items-center gap-1.5">
        <span className="size-2 rotate-45 bg-foreground/70" aria-hidden />
        Decision point
      </li>
      {run ? (
        <>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm border-2 border-foreground/70" aria-hidden />
            Current stage (pulsing)
          </li>
          <li>Faded: not reached. Clear arrows from the current stage: what can happen next</li>
        </>
      ) : null}
    </ul>
  );
}

/** What a selected stage or move means: who acts, what they need, what gets recorded, where it leads. */
export function ProcessDetails({
  selection,
  onSelect,
  children,
}: {
  selection: NonNullable<MapSelection>;
  onSelect: (selection: MapSelection) => void;
  /** Extra content for the selection, e.g. permits in this stage or this permit's visits. */
  children?: React.ReactNode;
}) {
  if (selection.kind === "edge") {
    const edge = EDGES.find((e) => e.id === selection.id);
    if (!edge) return null;
    const from = NODE_BY_ID.get(edge.from)!;
    const to = NODE_BY_ID.get(edge.to)!;
    return (
      <section aria-labelledby="pm-details" className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="pm-details" className="text-lg font-semibold">
          {edge.label}
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <StageChip id={from.id} onSelect={onSelect} />
          <span aria-hidden>→</span>
          <span className="sr-only">to</span>
          <StageChip id={to.id} onSelect={onSelect} />
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Who can do it</dt>
          <dd>{edge.actor}</dd>
          {edge.when ? (
            <>
              <dt className="text-muted-foreground">Only when</dt>
              <dd>{edge.when}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Recorded as</dt>
          <dd className="font-mono text-xs">{edge.actions.join(", ")}</dd>
        </dl>
        {children}
      </section>
    );
  }

  const node = NODE_BY_ID.get(selection.id);
  if (!node) return null;
  const outgoing = EDGES.filter((e) => e.from === node.id && e.to !== node.id);
  return (
    <section aria-labelledby="pm-details" className="grid gap-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 id="pm-details" className="text-lg font-semibold">
          {node.title}
        </h2>
        <p className="text-sm text-muted-foreground">{node.meaning}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold">Who moves it on</h3>
          <p className="mt-1 text-sm">{node.owner}</p>
          {outgoing.length ? (
            <ul className="mt-2 grid gap-1 text-sm">
              {outgoing.map((edge) => (
                <li key={edge.id}>
                  <button type="button" onClick={() => onSelect({ kind: "edge", id: edge.id })} className="text-left text-primary hover:underline">
                    {edge.label}
                  </button>
                  <span className="text-muted-foreground"> to {NODE_BY_ID.get(edge.to)?.title}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <h3 className="text-sm font-semibold">What they need</h3>
          {node.needs.length ? (
            <ul className="mt-1 grid list-disc gap-1 pl-4 text-sm marker:text-muted-foreground">
              {node.needs.map((need) => (
                <li key={need}>{need}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Nothing. This is an end state.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold">What gets recorded</h3>
          <ul className="mt-1 grid list-disc gap-1 pl-4 text-sm marker:text-muted-foreground">
            {node.records.map((record) => (
              <li key={record}>{record}</li>
            ))}
          </ul>
        </div>
      </div>
      {children}
    </section>
  );
}

export function StageChip({ id, onSelect }: { id: string; onSelect?: (selection: MapSelection) => void }) {
  const [fill, ink] = NODE_TONE[id] ?? ["--muted", "--foreground"];
  return (
    <button
      type="button"
      onClick={() => onSelect?.({ kind: "node", id })}
      className="rounded-full px-2.5 py-0.5 text-xs font-medium hover:underline"
      style={{ backgroundColor: `var(${fill})`, color: `var(${ink})` }}
    >
      {NODE_BY_ID.get(id)?.title ?? id}
    </button>
  );
}
