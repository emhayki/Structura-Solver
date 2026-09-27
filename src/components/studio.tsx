'use client';

import { useEffect, useState } from 'react';
import {
  Triangle, Play, BookOpen, FileDown, ArrowDownToLine, Plus, Trash2, Info,
  MoveUpRight, Network, Ruler, ArrowDown, ChevronRight, CircleCheck, Activity,
  Square, Box, AlertCircle, Check, Braces
} from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog';

import StructureCanvas, { Selection, View } from './structure-canvas';
import { Calculations, ModelTables, ResultTables } from './calculations';
import {
  Model, Kind, Joint, Member, Support, Solution,
  clonePreset, presets, solve, fmt
} from '@/lib/solver';

const supportNames: Record<Support, string> = {
  free: 'Free joint',
  pin: 'Pin · restrain x & y',
  'roller-y': 'Roller · restrain y',
  'roller-x': 'Roller · restrain x',
  fixed: 'Fixed support'
};

const initial = clonePreset('warren');

function NumberField({
  label, unit, value, onChange, min
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => setText(String(value)), [value]);

  return (
    <label className="field">
      <span className="field-label">{label}<small>{unit}</small></span>
      <input
        type="number"
        step="any"
        min={min}
        value={text}
        aria-label={`${label} (${unit})`}
        onChange={e => {
          setText(e.target.value);
          if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) {
            onChange(e.target.valueAsNumber);
          }
        }}
        onBlur={() => {
          if (text === '') setText(String(value));
        }}
      />
    </label>
  );
}

function Choice({
  label, value, onChange, choices
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  choices: { value: string; label: string }[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          {choices.map(x => (
            <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export default function Studio() {
  const [model, setModel] = useState<Model>(initial);
  const [result, setResult] = useState<Solution | null>(() => solve(initial));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState('warren');
  const [editor, setEditor] = useState('nodes');
  const [selection, setSelection] = useState<Selection>({ type: 'node', id: 6 });
  const [view, setView] = useState<View>('model');
  const [bottomTab, setBottomTab] = useState('results');
  const [help, setHelp] = useState(false);
  const [deleting, setDeleting] = useState<Selection | null>(null);
  const [report, setReport] = useState(false);

  const visibleResult = dirty ? null : result;
  const selectedNode = model.nodes.find(n => selection.type === 'node' && n.id === selection.id) ?? model.nodes[0];
  const selectedMember = model.members.find(m => selection.type === 'member' && m.id === selection.id) ?? model.members[0];

  const update = (next: Model) => {
    setModel(next);
    setDirty(true);
    setError('');
    setPreset('custom');
  };

  const updateNode = (patch: Partial<Joint>) => {
    update({
      ...model,
      nodes: model.nodes.map(n => n.id === selectedNode?.id ? { ...n, ...patch } : n)
    });
  };

  const updateMember = (patch: Partial<Member>) => {
    update({
      ...model,
      members: model.members.map(m => m.id === selectedMember?.id ? { ...m, ...patch } : m)
    });
  };

  const loadPreset = (key: string) => {
    const next = clonePreset(key);
    setModel(next);
    setResult(solve(next));
    setDirty(false);
    setError('');
    setPreset(key);
    setSelection({ type: 'node', id: next.nodes[0].id });
    setView('model');
    setEditor('nodes');
  };

  const changeKind = (kind: Kind) => {
    loadPreset(kind === 'truss' ? 'warren' : kind === 'beam' ? 'simple' : 'portal');
  };

  const select = (s: Selection) => {
    setSelection(s);
    setEditor(s.type === 'member' ? 'members' : 'nodes');
  };

  const run = () => {
    try {
      const r = solve(model);
      setResult(r);
      setDirty(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
      setDirty(true);
    }
  };

  const addNode = () => {
    const id = Math.max(0, ...model.nodes.map(n => n.id)) + 1;
    update({
      ...model,
      nodes: [
        ...model.nodes,
        {
          id,
          x: Math.max(0, ...model.nodes.map(n => n.x)) + 2,
          y: 0,
          support: 'free',
          fx: 0,
          fy: 0,
          mz: 0
        }
      ]
    });
    setSelection({ type: 'node', id });
    setEditor('nodes');
  };

  const addMember = () => {
    if (model.nodes.length < 2) return;

    const id = Math.max(0, ...model.members.map(m => m.id)) + 1;
    const existing = model.members[0];

    update({
      ...model,
      members: [
        ...model.members,
        {
          id,
          a: model.nodes[Math.max(0, model.nodes.length - 2)].id,
          b: model.nodes[model.nodes.length - 1].id,
          E: existing?.E ?? 200,
          A: existing?.A ?? 3000,
          I: existing?.I ?? 8000,
          q: 0
        }
      ]
    });

    setSelection({ type: 'member', id });
    setEditor('members');
  };

  const remove = () => {
    if (!deleting) return;

    if (deleting.type === 'node') {
      const nodes = model.nodes.filter(n => n.id !== deleting.id);
      update({
        ...model,
        nodes,
        members: model.members.filter(m => m.a !== deleting.id && m.b !== deleting.id)
      });
      setSelection({ type: 'node', id: nodes[0]?.id ?? 0 });
    } else {
      const members = model.members.filter(m => m.id !== deleting.id);
      update({ ...model, members });
      setSelection({ type: 'member', id: members[0]?.id ?? 0 });
    }

    setDeleting(null);
  };

  const downloadCsv = () => {
    if (!visibleResult) return;

    const r = visibleResult;
    const d = model.kind === 'truss' ? 2 : 3;

    const lines = [
      ['Structura analysis', model.name],
      ['Model', model.kind],
      ['Linear elastic, 2D; forces kN; lengths m'],
      [],
      ['Node', 'x_m', 'y_m', 'support', 'Fx_kN', 'Fy_kN', 'Mz_kNm', 'ux_mm', 'uy_mm', 'theta_mrad', 'Rx_kN', 'Ry_kN', 'Rz_kNm'],
      ...model.nodes.map((n, i) => [
        n.id, n.x, n.y, n.support, n.fx, n.fy, n.mz,
        r.u[d * i] * 1000,
        r.u[d * i + 1] * 1000,
        d === 3 ? r.u[d * i + 2] * 1000 : 0,
        r.R[d * i],
        r.R[d * i + 1],
        d === 3 ? r.R[d * i + 2] : 0
      ]),
      [],
      ['Member', 'from', 'to', 'E_GPa', 'A_mm2', 'I_cm4', 'q_kN_per_m', 'L_m', 'N_kN', 'axial_stress_MPa', 'max_abs_V_kN', 'max_abs_M_kNm'],
      ...r.elements.map((e, i) => {
        const m = model.members[i];
        return [e.id, m.a, m.b, m.E, m.A, m.I, m.q, e.L, e.axial, e.stress, e.shear, e.moment];
      }),
      [],
      ['Sampled maximum displacement_mm', r.maxDisp * 1000],
      ['Free-DOF relative residual', r.relativeResidual],
      ['Sum_Fx_kN', 'Sum_Fy_kN', 'Sum_M_kNm'],
      r.balance
    ];

    const csv = lines
      .map(row => row.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(','))
      .join('\r\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'structura-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    if (!visibleResult) return;
    setBottomTab('calculations');
    setReport(true);
    window.setTimeout(() => window.print(), 120);
  };

  useEffect(() => {
    const f = () => setReport(false);
    window.addEventListener('afterprint', f);
    return () => window.removeEventListener('afterprint', f);
  }, []);

  return (
    <div className="studio">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <svg width="27" height="27" viewBox="0 0 32 32" aria-hidden="true">
              <path
                d="M4 25 16 6 28 25H4l6-9 6 9 6-9"
                fill="none"
                stroke="#8ce3c6"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div>
            <div className="brand-name">structura<span>.</span></div>
            <div className="brand-subtitle">STRUCTURAL ANALYSIS STUDIO</div>
          </div>
        </div>

        <div className="header-center">Model <span /> Analyze <span /> Understand</div>

        <div className="header-actions">
          <button className="header-link" onClick={() => setHelp(true)}>
            <BookOpen size={15} />Method & references
          </button>
          <span className="version-badge">2D · LINEAR STATIC</span>
        </div>
      </header>

      <div className="project-bar">
        <div className="project-title">
          <Network size={25} strokeWidth={1.4} />
          <div>
            <h1>{model.name}</h1>
            <p>
              Workspace
              <span style={{ margin: '0 7px', color: '#b5c0c6' }}>/</span>
              {model.kind === 'truss'
                ? 'Pin-jointed truss'
                : model.kind === 'beam'
                  ? 'Euler–Bernoulli beam'
                  : 'Rigid-jointed frame'}
            </p>
          </div>
        </div>

        <div className="project-actions">
          <button className="btn" onClick={printReport} disabled={!visibleResult}>
            <FileDown size={16} />Export report
          </button>
          <button className="btn btn-primary" onClick={run}>
            <Play size={14} fill="currentColor" />Run analysis
          </button>
        </div>
      </div>

      <div className="workspace">
        <aside className="model-panel" aria-label="Model editor">
          <div className="panel-heading">
            <h2>Model setup</h2>
            <span className="eyebrow">SI UNITS</span>
          </div>

          <section className="panel-section type-section">
            <div className="section-label">
              <span><span className="step-mark">01</span>Structure type</span>
            </div>

            <Tabs value={model.kind} onValueChange={v => changeKind(v as Kind)} className="mode-tabs">
              <TabsList aria-label="Structure type">
                <TabsTrigger value="truss"><Triangle size={14} />Truss</TabsTrigger>
                <TabsTrigger value="beam"><Ruler size={14} />Beam</TabsTrigger>
                <TabsTrigger value="frame"><Square size={14} />Frame</TabsTrigger>
              </TabsList>
            </Tabs>
          </section>

          <section className="panel-section preset-section">
            <div className="section-label">
              <span><span className="step-mark">02</span>Starting model</span>
            </div>

            <Choice
              label="Example"
              value={preset}
              onChange={v => {
                if (v !== 'custom') loadPreset(v);
              }}
              choices={[
                ...Object.entries(presets)
                  .filter(([, m]) => m.kind === model.kind)
                  .map(([key, m]) => ({ value: key, label: m.name })),
                ...(preset === 'custom' ? [{ value: 'custom', label: 'Custom model' }] : [])
              ]}
            />

            <div className="element-counts">
              <span>{model.nodes.length} nodes</span>
              <span>{model.members.length} members</span>
              <span>{model.nodes.filter(n => n.support !== 'free').length} supports</span>
            </div>
          </section>

          <Tabs
            value={editor}
            onValueChange={v => {
              setEditor(v);
              if (v === 'members') {
                setSelection({ type: 'member', id: selectedMember?.id ?? 0 });
              } else {
                setSelection({ type: 'node', id: selectedNode?.id ?? 0 });
              }
            }}
            className="editor-tabs"
          >
            <TabsList aria-label="Model inputs">
              <TabsTrigger value="nodes">Nodes</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="loads">Loads</TabsTrigger>
            </TabsList>
          </Tabs>

          <section className="panel-section editor-body" style={{ gridColumn: '1/-1' }}>
            {editor === 'members' ? (
              <>
                <div className="object-list">
                  {model.members.map(m => (
                    <button
                      className={'object-chip ' + (m.id === selectedMember?.id ? 'selected' : '')}
                      key={m.id}
                      aria-label={`Edit member ${m.id}`}
                      onClick={() => setSelection({ type: 'member', id: m.id })}
                    >
                      M{m.id}
                    </button>
                  ))}

                  <button
                    className="object-chip"
                    onClick={addMember}
                    disabled={model.nodes.length < 2 || model.members.length >= 80}
                    aria-label="Add member"
                  >
                    <Plus size={14} style={{ margin: 'auto' }} />
                  </button>
                </div>

                {selectedMember ? (
                  <>
                    <div className="selected-label">
                      Member M{selectedMember.id}
                      <button
                        className="btn btn-ghost btn-small btn-danger"
                        aria-label="Delete selected member"
                        onClick={() => setDeleting({ type: 'member', id: selectedMember.id })}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="fields-two">
                      <Choice
                        label="From node"
                        value={String(selectedMember.a)}
                        onChange={v => updateMember({ a: Number(v) })}
                        choices={model.nodes.map(n => ({ value: String(n.id), label: String(n.id) }))}
                      />
                      <Choice
                        label="To node"
                        value={String(selectedMember.b)}
                        onChange={v => updateMember({ b: Number(v) })}
                        choices={model.nodes.map(n => ({ value: String(n.id), label: String(n.id) }))}
                      />
                    </div>

                    <NumberField
                      label="Elastic modulus E"
                      unit="GPa"
                      value={selectedMember.E}
                      min={.000001}
                      onChange={E => updateMember({ E })}
                    />

                    <NumberField
                      label="Section area A"
                      unit="mm²"
                      value={selectedMember.A}
                      min={.000001}
                      onChange={A => updateMember({ A })}
                    />

                    {model.kind !== 'truss' && (
                      <>
                        <NumberField
                          label="Second moment I"
                          unit="cm⁴"
                          value={selectedMember.I}
                          min={.000001}
                          onChange={I => updateMember({ I })}
                        />
                        <NumberField
                          label="Uniform load q"
                          unit="kN/m"
                          value={selectedMember.q}
                          onChange={q => updateMember({ q })}
                        />
                        <p className="hint">
                          q acts in local y, 90° counterclockwise from the from→to axis.
                          Negative q is downward on a left-to-right beam.
                        </p>
                      </>
                    )}

                    <p className="hint">
                      Properties apply to this member. Members connect only at shared nodes.
                    </p>
                  </>
                ) : (
                  <p className="hint">Add a member and choose its end nodes.</p>
                )}
              </>
            ) : (
              <>
                <div className="object-list">
                  {model.nodes.map(n => (
                    <button
                      className={'object-chip ' + (n.id === selectedNode?.id ? 'selected' : '')}
                      key={n.id}
                      aria-label={`Edit node ${n.id}`}
                      onClick={() => setSelection({ type: 'node', id: n.id })}
                    >
                      {n.id}
                    </button>
                  ))}

                  <button
                    className="object-chip"
                    onClick={addNode}
                    disabled={model.nodes.length >= 40}
                    aria-label="Add node"
                  >
                    <Plus size={14} style={{ margin: 'auto' }} />
                  </button>
                </div>

                {selectedNode ? (
                  <>
                    <div className="selected-label">
                      {editor === 'loads' ? 'Loads at node' : 'Node'} {selectedNode.id}

                      {editor === 'nodes' && (
                        <button
                          className="btn btn-ghost btn-small btn-danger"
                          aria-label="Delete selected node"
                          onClick={() => setDeleting({ type: 'node', id: selectedNode.id })}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {editor === 'nodes' ? (
                      <>
                        <div className="fields-two">
                          <NumberField
                            label="X coordinate"
                            unit="m"
                            value={selectedNode.x}
                            onChange={x => updateNode({ x })}
                          />
                          <NumberField
                            label="Y coordinate"
                            unit="m"
                            value={selectedNode.y}
                            onChange={y => updateNode({ y })}
                          />
                        </div>

                        <Choice
                          label="Support"
                          value={selectedNode.support}
                          onChange={v => updateNode({ support: v as Support })}
                          choices={Object.entries(supportNames)
                            .filter(([s]) => model.kind !== 'truss' || s !== 'fixed')
                            .map(([value, label]) => ({ value, label }))}
                        />

                        <p className="hint">
                          Coordinates use the global axes. Supports prescribe zero displacement.
                        </p>

                        <button className="btn btn-small" onClick={() => setEditor('loads')}>
                          <ArrowDown size={14} />Edit nodal loads<ChevronRight size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <NumberField
                          label="Horizontal force Fₓ"
                          unit="kN"
                          value={selectedNode.fx}
                          onChange={fx => updateNode({ fx })}
                        />

                        <NumberField
                          label="Vertical force Fᵧ"
                          unit="kN"
                          value={selectedNode.fy}
                          onChange={fy => updateNode({ fy })}
                        />

                        {model.kind !== 'truss' && (
                          <NumberField
                            label="Moment M"
                            unit="kN·m"
                            value={selectedNode.mz}
                            onChange={mz => updateNode({ mz })}
                          />
                        )}

                        <p className="hint">
                          +x right · +y up<br />
                          +moment counterclockwise<br />
                          Use negative Fᵧ for downward loads.
                        </p>

                        {model.kind !== 'truss' && (
                          <button
                            className="btn btn-small"
                            onClick={() => {
                              setEditor('members');
                              setSelection({ type: 'member', id: selectedMember?.id ?? 0 });
                            }}
                          >
                            Edit distributed loads<ChevronRight size={13} />
                          </button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="hint">Add nodes to begin your model.</p>
                )}
              </>
            )}
          </section>

          <div className="side-bottom">
            <div className="hint-box">
              <Info size={15} style={{ marginTop: 3 }} />
              <span>Start with an example, adjust your model, then run the analysis.</span>
            </div>

            <p className="hint" style={{ marginTop: 15 }}>
              Linear elastic analysis<br />
              No self-weight unless entered as a load
            </p>
          </div>
        </aside>

        <main className="main-space">
          <div className="report-only">
            <h1>Structura · {model.name}</h1>
            <p>
              2D {model.kind} · Linear static analysis · kN, m, radians ·
              Educational and preliminary analysis
            </p>
          </div>

          <StructureCanvas
            key={model.kind}
            model={model}
            result={visibleResult}
            selection={selection}
            onSelect={select}
            dirty={dirty}
            view={view}
            setView={setView}
          />

          {error && (
            <div className="message" role="alert">
              <AlertCircle size={18} />
              <span><strong>Unable to solve.</strong> {error}</span>
            </div>
          )}

          {visibleResult?.warnings.map(w => (
            <div key={w} className="message warning" role="status">
              <Info size={17} />{w}
            </div>
          ))}

          <section className="metrics" aria-label="Analysis summary">
            <div className="metric">
              <div className="metric-top">Maximum displacement<Activity size={16} /></div>
              <div className="metric-value">
                {visibleResult ? fmt(visibleResult.maxDisp * 1000) : '—'}<small>mm</small>
              </div>
              <div className="metric-bottom">
                {model.kind === 'truss'
                  ? 'Resultant nodal displacement'
                  : 'Resultant · sampled along members'}
              </div>
            </div>

            <div className="metric">
              <div className="metric-top">
                {model.kind === 'truss' ? 'Maximum axial force' : 'Maximum bending moment'}
                <MoveUpRight size={16} />
              </div>
              <div className="metric-value">
                {visibleResult
                  ? fmt(model.kind === 'truss' ? visibleResult.maxAxial : visibleResult.maxMoment)
                  : '—'}
                <small>{model.kind === 'truss' ? 'kN' : 'kN·m'}</small>
              </div>
              <div className="metric-bottom">Largest absolute member value</div>
            </div>

            <div className="metric">
              <div className="metric-top">Equilibrium check<CircleCheck size={16} /></div>
              <div className="metric-value" style={{ fontFamily: 'Arial,sans-serif', fontSize: 25 }}>
                {visibleResult ? 'Balanced' : 'Pending'}
              </div>
              <div className="metric-bottom">
                {visibleResult
                  ? <><Check size={12} />Numerical residual &lt; 10⁻⁶</>
                  : 'Run analysis after editing'}
              </div>
            </div>
          </section>

          <section className="surface results-surface">
            <div className="results-nav">
              <Tabs value={bottomTab} onValueChange={setBottomTab} className="results-tabs">
                <TabsList aria-label="Analysis details">
                  <TabsTrigger value="results">
                    <Activity size={15} />Results
                    <span className="table-badge">{model.members.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="calculations"><Braces size={15} />Calculations</TabsTrigger>
                  <TabsTrigger value="model"><Box size={15} />Model data</TabsTrigger>
                </TabsList>
              </Tabs>

              <button
                className="btn btn-ghost btn-small"
                aria-label="Download results CSV"
                title="Download results CSV"
                disabled={!visibleResult}
                onClick={downloadCsv}
              >
                <ArrowDownToLine size={16} /><span className="csv-label">CSV</span>
              </button>
            </div>

            {dirty && (
              <div className="draft-note">
                <Info size={16} />Your model has changed. Run analysis to update the results.
              </div>
            )}

            <div className="results-content">
              {bottomTab === 'model' ? (
                <ModelTables model={model} />
              ) : visibleResult ? (
                bottomTab === 'calculations' ? (
                  <Calculations key={model.kind} model={model} result={visibleResult} />
                ) : (
                  <ResultTables model={model} result={visibleResult} />
                )
              ) : (
                <div className="empty-result">
                  <Activity size={28} style={{ margin: '0 auto 12px', color: '#9eb3ba' }} />
                  <p>
                    {error
                      ? 'Resolve the model issue above and run the analysis again.'
                      : 'Your results will appear here after analysis.'}
                  </p>
                </div>
              )}

              {report && visibleResult && (
                <div className="report-only">
                  <ModelTables model={model} />
                  <ResultTables model={model} result={visibleResult} />
                </div>
              )}
            </div>
          </section>

          <footer className="app-footer">
            <span>2D linear elastic analysis · Independently verify before design use.</span>
            <button onClick={() => setHelp(true)}>Assumptions & references ↗</button>
          </footer>
        </main>
      </div>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="reference-dialog">
          <DialogHeader>
            <DialogTitle>Method, scope & references</DialogTitle>
            <DialogDescription>Transparent analysis, from model to member forces.</DialogDescription>
          </DialogHeader>

          <h3>What Structura solves</h3>
          <p>
            Two-dimensional, linear elastic structures using the direct stiffness method.
            Trusses have pin-jointed axial members. Beams and frames use Euler–Bernoulli
            elements with axial and bending stiffness and rigid connections at shared nodes.
            Beam mode uses the same planar frame formulation.
          </p>

          <h3>Loads, units and supports</h3>
          <p>
            Enter geometry in m, forces in kN, moments in kN·m, E in GPa, A in mm², and I in cm⁴.
            Positive global forces act right/up; moments are counterclockwise. Uniform member loads
            act in local y. Split a member at a point load or an intermediate connection and apply
            the load to that node. Crossing lines do not connect automatically.
          </p>
          <p>
            Pin supports restrain x and y; rollers restrain the specified axis; fixed supports also
            restrain rotation. Support movements are zero. Every member has constant properties.
          </p>

          <h3>Analysis assumptions</h3>
          <p>
            Small displacements and rotations, elastic materials, and slender beams with negligible
            shear deformation. Self-weight must be entered explicitly. The app does not calculate
            buckling, plasticity, dynamic response, 3D effects, connection capacity, member end
            releases, or design-code compliance. It supports up to 40 nodes and 80 members.
            Maximum displacement is sampled along members. Independently verify results before design use.
          </p>

          <h3>How to read the results</h3>
          <p>
            Positive axial force means tension. Beam diagrams use positive sagging moments in local axes.
            The stress column is mean axial stress N/A; bending stress is not included. “Balanced” means
            the numerical equilibrium residual passed; it does not establish structural adequacy.
          </p>

          <h3>References</h3>
          <ul>
            <li>
              <a
                href="https://interactivetextbooks.citg.tudelft.nl/computational-modelling/structural_linear/euler_bernouilli.html"
                target="_blank"
                rel="noreferrer"
              >
                TU Delft — Euler–Bernoulli beam elements
              </a>
              : beam interpolation and stiffness.
            </li>
            <li>
              <a
                href="https://people.duke.edu/~hpgavin/cee421/frame-element.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Duke University — Frame Element Stiffness Matrices
              </a>
              : local/global transformation and frame stiffness.
            </li>
            <li>
              <a
                href="https://github.com/emhayki/Truss-Solver"
                target="_blank"
                rel="noreferrer"
              >
                emhayki / Truss-Solver
              </a>
              : the inspiration for the modeling and calculation workflow. Structura is an independent implementation.
            </li>
          </ul>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={v => {
          if (!v) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.type} {deleting?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.type === 'node'
                ? 'This also removes members connected to this node and its applied loads.'
                : 'This removes the member and its distributed load.'}{' '}
              Run analysis again after modifying the model.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
