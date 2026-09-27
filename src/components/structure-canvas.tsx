'use client';

import { useState } from 'react';
import {
  Maximize2, Minus, Plus, Grid2X2, MousePointer2, MoveUpRight,
  Check, Layers, ChartNoAxesCombined
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Model, Solution, fmt } from '@/lib/solver';

export type Selection = { type: 'node' | 'member'; id: number };
export type View = 'model' | 'axial' | 'shear' | 'moment' | 'deformed';

export default function StructureCanvas({
  model,
  result,
  selection,
  onSelect,
  dirty,
  view,
  setView
}: {
  model: Model;
  result: Solution | null;
  selection: Selection;
  onSelect: (s: Selection) => void;
  dirty: boolean;
  view: View;
  setView: (v: View) => void;
}) {
  const [grid, setGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [reactions, setReactions] = useState(false);

  const xs = model.nodes.map(n => n.x);
  const ys = model.nodes.map(n => n.y);

  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, .1);
  const scale = Math.min(680 / spanX, 195 / spanY) * zoom;

  const px = (x: number) => 450 + (x - (maxX + minX) / 2) * scale;
  const py = (y: number) => 225 - (y - (maxY + minY) / 2) * scale;

  const defScale = result && result.maxDisp > 0
    ? 35 / (result.maxDisp * scale)
    : 1;

  const actualView = result ? view : 'model';

  const drawArrow = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    key: string
  ) => (
    <line
      key={key}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth="1.8"
      markerEnd={`url(#${color === '#078a79' ? 'reaction' : 'load'}-arrow)`}
    />
  );

  return (
    <section className="surface" aria-label="Structure workspace">
      <div className="canvas-header">
        <div className="canvas-title">
          <Layers size={16} />
          <span>Structural model</span>
          <span className={'status ' + (dirty ? 'dirty' : '')}>
            {dirty ? 'Modified' : result ? <><Check size={12} /> Solved</> : 'Ready'}
          </span>
        </div>

        <span className="canvas-caption">
          2D workspace <span className="mono"> / XY</span>
        </span>
      </div>

      <div className="view-bar">
        <Tabs
          value={view}
          onValueChange={v => setView(v as View)}
          className="view-tabs"
        >
          <TabsList aria-label="Diagram view">
            <TabsTrigger value="model">
              <MousePointer2 size={13} />Model
            </TabsTrigger>

            <TabsTrigger value="axial" disabled={!result}>
              Axial force
            </TabsTrigger>

            {model.kind !== 'truss' && (
              <>
                <TabsTrigger value="shear" disabled={!result}>Shear</TabsTrigger>
                <TabsTrigger value="moment" disabled={!result}>Moment</TabsTrigger>
              </>
            )}

            <TabsTrigger value="deformed" disabled={!result}>
              Deformation
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="canvas-controls">
          <button
            className={'icon-button ' + (grid ? 'active' : '')}
            aria-label="Toggle grid"
            title="Toggle grid"
            aria-pressed={grid}
            onClick={() => setGrid(!grid)}
          >
            <Grid2X2 size={15} />
          </button>

          <span className="divider" />

          <button
            className="icon-button"
            aria-label="Zoom out"
            onClick={() => setZoom(z => Math.max(.5, z - .15))}
          >
            <Minus size={15} />
          </button>

          <button
            className="icon-button"
            aria-label="Zoom in"
            onClick={() => setZoom(z => Math.min(1.6, z + .15))}
          >
            <Plus size={15} />
          </button>

          <button
            className="icon-button"
            aria-label="Fit model"
            title="Fit model"
            onClick={() => setZoom(1)}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div className={'drawing-area ' + (grid ? 'grid-on' : '')}>
        <div className="drawing-meta">
          <strong>
            {actualView === 'model'
              ? 'GEOMETRY + LOADS'
              : actualView === 'axial'
                ? 'AXIAL FORCE · kN'
                : actualView === 'shear'
                  ? 'SHEAR FORCE · kN'
                  : actualView === 'moment'
                    ? 'BENDING MOMENT · kN·m'
                    : `DEFORMED SHAPE · ×${fmt(defScale, 0)}`}
          </strong>

          <span>{model.nodes.length} nodes · {model.members.length} members</span>
        </div>

        <svg
          viewBox="0 0 900 410"
          role="img"
          aria-label={`${model.name}, ${actualView} diagram. Select nodes and members to edit.`}
        >
          <defs>
            <marker
              id="load-arrow"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M0 0 7 3.5 0 7Z" fill="#ca7761" />
            </marker>

            <marker
              id="reaction-arrow"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M0 0 7 3.5 0 7Z" fill="#078a79" />
            </marker>

            <pattern
              id="hatch"
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
            >
              <path d="M-1 6 6-1" stroke="#8da2ab" strokeWidth=".8" />
            </pattern>
          </defs>

          {model.members.map(m => {
            const a = model.nodes.find(n => n.id === m.a);
            const b = model.nodes.find(n => n.id === m.b);

            if (!a || !b) return null;

            const len = Math.hypot(b.x - a.x, b.y - a.y);
            const g = {
              c: len ? (b.x - a.x) / len : 1,
              s: len ? (b.y - a.y) / len : 0
            };

            const e = result?.elements.find(r => r.id === m.id);
            const sel = selection.type === 'member' && selection.id === m.id;

            const color = actualView === 'axial' && e
              ? Math.abs(e.axial) < 1e-7
                ? '#9fadb5'
                : e.axial > 0
                  ? '#078a79'
                  : '#a06bad'
              : '#267d71';

            let path = '';
            let diagram = '';

            if (e && actualView === 'deformed') {
              path = e.samples
                .map((p, i) =>
                  `${i ? 'L' : 'M'}${px(a.x + e.c * p.x + p.ux * defScale)},${py(a.y + e.s * p.x + p.uy * defScale)}`
                )
                .join(' ');
            }

            if (e && (actualView === 'moment' || actualView === 'shear')) {
              const f = 50 / Math.max(
                actualView === 'moment' ? result!.maxMoment : result!.maxShear,
                1e-9
              );

              diagram =
                `M${px(a.x)},${py(a.y)} ` +
                e.samples.map(p => {
                  const v = actualView === 'moment' ? p.M : p.V;

                  return `L${px(a.x + e.c * p.x) + e.s * v * f},${py(a.y + e.s * p.x) + e.c * v * f}`;
                }).join(' ') +
                ` L${px(b.x)},${py(b.y)} Z`;
            }

            return (
              <g key={m.id}>
                {diagram && (
                  <path
                    d={diagram}
                    fill="#a16cb321"
                    stroke="#a16cb3"
                    strokeWidth="1.5"
                  />
                )}

                <line
                  x1={px(a.x)}
                  y1={py(a.y)}
                  x2={px(b.x)}
                  y2={py(b.y)}
                  stroke={actualView === 'deformed' ? '#b0c0c7' : color}
                  strokeWidth={sel ? 4.5 : actualView === 'axial' ? 3.7 : 3}
                  strokeDasharray={actualView === 'deformed' ? '5 4' : undefined}
                  strokeLinecap="round"
                />

                {sel && (
                  <line
                    x1={px(a.x)}
                    y1={py(a.y)}
                    x2={px(b.x)}
                    y2={py(b.y)}
                    stroke="#40b99e"
                    strokeWidth="12"
                    opacity=".12"
                  />
                )}

                {path && (
                  <path
                    d={path}
                    fill="none"
                    stroke="#a16cb3"
                    strokeWidth="2.5"
                  />
                )}

                <line
                  tabIndex={0}
                  role="button"
                  aria-label={`Select member ${m.id}, nodes ${m.a} to ${m.b}`}
                  x1={px(a.x)}
                  y1={py(a.y)}
                  x2={px(b.x)}
                  y2={py(b.y)}
                  stroke="transparent"
                  strokeWidth="18"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelect({ type: 'member', id: m.id })}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      onSelect({ type: 'member', id: m.id });
                    }
                  }}
                />

                {actualView === 'model' && (
                  <text
                    className="member-label"
                    x={(px(a.x) + px(b.x)) / 2 + 8}
                    y={(py(a.y) + py(b.y)) / 2 - 9}
                    textAnchor="middle"
                  >
                    M{m.id}
                  </text>
                )}

                {actualView === 'axial' && e && (
                  <text
                    className="force-label"
                    fill={color}
                    x={(px(a.x) + px(b.x)) / 2}
                    y={(py(a.y) + py(b.y)) / 2 - 12}
                    textAnchor="middle"
                  >
                    {fmt(e.axial, 2)}
                  </text>
                )}

                {(actualView === 'shear' || actualView === 'moment') && e && (
                  <text
                    className="force-label"
                    fill="#9765a4"
                    x={(px(a.x) + px(b.x)) / 2 + 13}
                    y={(py(a.y) + py(b.y)) / 2 - 12}
                    textAnchor="middle"
                  >
                    |{fmt(actualView === 'moment' ? e.moment : e.shear, 2)}|
                  </text>
                )}

                {actualView === 'model' && m.q !== 0 && (
                  <g>
                    {Array.from({ length: 7 }, (_, i) => {
                      const x = px(a.x + (b.x - a.x) * (i + .5) / 7);
                      const y = py(a.y + (b.y - a.y) * (i + .5) / 7);
                      const sign = Math.sign(m.q);

                      return drawArrow(
                        x + g.s * sign * 31,
                        y + g.c * sign * 31,
                        x + g.s * sign * 6,
                        y + g.c * sign * 6,
                        '#ca7761',
                        `q${i}`
                      );
                    })}

                    <text
                      className="load-label"
                      textAnchor="middle"
                      x={(px(a.x) + px(b.x)) / 2 + g.s * Math.sign(m.q) * 48}
                      y={(py(a.y) + py(b.y)) / 2 + g.c * Math.sign(m.q) * 46}
                    >
                      {fmt(m.q)} kN/m
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {model.nodes.map((n, i) => {
            const x = px(n.x);
            const y = py(n.y);
            const sel = selection.type === 'node' && selection.id === n.id;
            const d = model.kind === 'truss' ? 2 : 3;

            return (
              <g key={n.id}>
                {n.support !== 'free' && (
                  <g
                    transform={`translate(${x},${y + 7}) ${n.support === 'roller-x' ? 'rotate(-90)' : ''}`}
                    stroke="#899da7"
                    strokeWidth="1.3"
                    fill="#f4f7f8"
                  >
                    {n.support === 'fixed' ? (
                      <>
                        <path d="M-15 0H15" strokeWidth="3" />
                        <rect
                          x="-15"
                          y="2"
                          width="30"
                          height="9"
                          fill="url(#hatch)"
                          stroke="none"
                        />
                      </>
                    ) : (
                      <>
                        <path d="M0 0-12 18H12Z" />

                        {n.support.startsWith('roller') && (
                          <>
                            <circle cx="-7" cy="22" r="2.5" />
                            <circle cx="7" cy="22" r="2.5" />
                          </>
                        )}

                        <path d={`M-18 ${n.support.startsWith('roller') ? 27 : 22}H18`} />
                        <rect
                          x="-18"
                          y={n.support.startsWith('roller') ? 28 : 23}
                          width="36"
                          height="6"
                          fill="url(#hatch)"
                          stroke="none"
                        />
                      </>
                    )}
                  </g>
                )}

                {actualView === 'model' && (
                  <g>
                    {n.fy !== 0 && (
                      <>
                        {drawArrow(
                          x,
                          y - Math.sign(n.fy) * (-64),
                          x,
                          y + Math.sign(n.fy) * 11,
                          '#ca7761',
                          'fy'
                        )}
                        <text
                          x={x + 10}
                          y={y + Math.sign(n.fy) * 53}
                          className="load-label"
                        >
                          {fmt(Math.abs(n.fy))} kN
                        </text>
                      </>
                    )}

                    {n.fx !== 0 && (
                      <>
                        {drawArrow(
                          x - Math.sign(n.fx) * 65,
                          y,
                          x - Math.sign(n.fx) * 12,
                          y,
                          '#ca7761',
                          'fx'
                        )}
                        <text
                          x={x - Math.sign(n.fx) * 47}
                          y={y - 12}
                          textAnchor="middle"
                          className="load-label"
                        >
                          {fmt(Math.abs(n.fx))} kN
                        </text>
                      </>
                    )}

                    {n.mz !== 0 && (
                      <>
                        <path
                          d={`M${x + 23},${y + 12} A26 26 0 1 ${n.mz > 0 ? 0 : 1} ${x - 23},${y - 12}`}
                          stroke="#ca7761"
                          strokeWidth="1.5"
                          fill="none"
                          markerEnd="url(#load-arrow)"
                        />
                        <text
                          x={x + 32}
                          y={y + 25}
                          className="load-label"
                        >
                          {fmt(n.mz)} kN·m
                        </text>
                      </>
                    )}
                  </g>
                )}

                {reactions && result && n.support !== 'free' && (
                  <g>
                    <text
                      className="force-label"
                      fill="#078a79"
                      x={x}
                      y={y + 59}
                      textAnchor="middle"
                    >
                      Rx {fmt(result.R[i * d], 2)} · Ry {fmt(result.R[i * d + 1], 2)} kN
                    </text>

                    {d === 3 && Math.abs(result.R[i * d + 2]) > 1e-8 && (
                      <text
                        className="force-label"
                        fill="#078a79"
                        x={x}
                        y={y + 77}
                        textAnchor="middle"
                      >
                        Mz {fmt(result.R[i * d + 2], 2)} kN·m
                      </text>
                    )}
                  </g>
                )}

                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`Select node ${n.id}`}
                  className="drawing-node"
                  onClick={() => onSelect({ type: 'node', id: n.id })}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      onSelect({ type: 'node', id: n.id });
                    }
                  }}
                >
                  <circle cx={x} cy={y} r="14" fill="transparent" />
                  {sel && <circle cx={x} cy={y} r="12" fill="#2ab69822" />}
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill={sel ? '#138b75' : '#fff'}
                    stroke="#267d71"
                    strokeWidth="2"
                  />
                  <text
                    x={x + (n.fy !== 0 ? 12 : 0)}
                    y={y + (n.support === 'free' ? 22 : -15)}
                    textAnchor="middle"
                  >
                    {n.id}
                  </text>
                </g>
              </g>
            );
          })}

          {!reactions && maxX > minX && (
            <g stroke="#bdcbd2" strokeWidth="1">
              <path
                d={`M${px(minX)},${py(minY) + 48}v19 M${px(maxX)},${py(minY) + 48}v19 M${px(minX)},${py(minY) + 60}H${px(maxX)}`}
              />
              <path
                d={`M${px(minX) - 4},${py(minY) + 64}l8-8 M${px(maxX) - 4},${py(minY) + 64}l8-8`}
              />
              <rect
                x="410"
                y={py(minY) + 49}
                width="80"
                height="20"
                fill="#fcfdfd"
                stroke="none"
              />
              <text
                className="dim-label"
                stroke="none"
                x="450"
                y={py(minY) + 64}
                textAnchor="middle"
              >
                {fmt(maxX - minX)} m
              </text>
            </g>
          )}

          <g
            transform="translate(33,345)"
            stroke="#8297a3"
            strokeWidth="1.2"
          >
            <path
              d="M0 26V-4 M-3 0 0-4 3 0 M0 26H28 M24 23l4 3-4 3"
              fill="none"
            />
            <text x="33" y="30" className="axis-label" stroke="none">x</text>
            <text x="-4" y="-12" className="axis-label" stroke="none">y</text>
          </g>
        </svg>

        <div className="canvas-legend">
          {actualView === 'axial' ? (
            <>
              <span><i className="legend-line" />Tension (+)</span>
              <span><i className="legend-line purple" />Compression (−)</span>
            </>
          ) : actualView === 'deformed' ? (
            <>
              <span><i className="legend-line" />Original</span>
              <span><i className="legend-line purple" />Deformed</span>
            </>
          ) : actualView === 'model' ? (
            <>
              <span><i className="legend-line" />Member</span>
              <span><i className="legend-line red" />Applied load</span>
            </>
          ) : (
            <span>
              <i className="legend-line purple" />
              Signed {actualView} · labels show max |value|
            </span>
          )}
        </div>
      </div>

      <div className="canvas-footer">
        <span><MousePointer2 size={13} />Select a node or member to edit</span>

        <label style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <Switch
            checked={reactions}
            onCheckedChange={setReactions}
            disabled={!result}
            size="sm"
            aria-label="Show reactions"
          />
          Reactions
        </label>

        <span className="mono">m · kN · kN·m</span>
      </div>
    </section>
  );
}
