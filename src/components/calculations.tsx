'use client';

import { useState } from 'react';
import { Model, Solution, fmt } from '@/lib/solver';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableCell,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from '@/components/ui/select';
import { BookOpen } from 'lucide-react';

export function ResultTables({
  model,
  result
}: {
  model: Model;
  result: Solution;
}) {
  const d = model.kind === 'truss' ? 2 : 3;

  return (
    <>
      <section className="table-section">
        <div className="results-subhead">
          <h3>Member forces</h3>
          <p>Positive axial force = tension · negative = compression</p>
        </div>

        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Nodes</TableHead>
              <TableHead>Length (m)</TableHead>
              <TableHead>Axial (kN)</TableHead>
              <TableHead>σ axial (MPa)</TableHead>
              {d === 3 && (
                <>
                  <TableHead>Max |V| (kN)</TableHead>
                  <TableHead>Max |M| (kN·m)</TableHead>
                </>
              )}
              <TableHead>State</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {result.elements.map((e, i) => (
              <TableRow key={e.id}>
                <TableCell>M{e.id}</TableCell>
                <TableCell>
                  {model.members[i].a} → {model.members[i].b}
                </TableCell>
                <TableCell>{fmt(e.L)}</TableCell>
                <TableCell className={e.axial >= 0 ? 'positive' : 'negative'}>
                  {fmt(e.axial)}
                </TableCell>
                <TableCell>{fmt(e.stress)}</TableCell>

                {d === 3 && (
                  <>
                    <TableCell>{fmt(e.shear)}</TableCell>
                    <TableCell>{fmt(e.moment)}</TableCell>
                  </>
                )}

                <TableCell>
                  <span
                    className={
                      'force-state ' +
                      (
                        Math.abs(e.axial) < 1e-7
                          ? 'zero'
                          : e.axial < 0
                            ? 'compression'
                            : ''
                      )
                    }
                  >
                    {Math.abs(e.axial) < 1e-7
                      ? 'Zero axial'
                      : e.axial < 0
                        ? 'Compression'
                        : 'Tension'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="table-section">
        <div className="results-subhead">
          <h3>Nodal displacements</h3>
          <p>Global x right · y up · counterclockwise rotation positive</p>
        </div>

        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>Node</TableHead>
              <TableHead>uₓ (mm)</TableHead>
              <TableHead>uᵧ (mm)</TableHead>
              {d === 3 && <TableHead>θ (mrad)</TableHead>}
              <TableHead>|u| (mm)</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {model.nodes.map((n, i) => (
              <TableRow key={n.id}>
                <TableCell>{n.id}</TableCell>
                <TableCell>{fmt(result.u[i * d] * 1000, 5)}</TableCell>
                <TableCell>{fmt(result.u[i * d + 1] * 1000, 5)}</TableCell>
                {d === 3 && (
                  <TableCell>{fmt(result.u[i * d + 2] * 1000, 5)}</TableCell>
                )}
                <TableCell>
                  {fmt(
                    Math.hypot(
                      result.u[i * d],
                      result.u[i * d + 1]
                    ) * 1000,
                    5
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="table-section">
        <div className="results-subhead">
          <h3>Support reactions</h3>
          <p>R = Ku − F</p>
        </div>

        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>Node</TableHead>
              <TableHead>Support</TableHead>
              <TableHead>Rₓ (kN)</TableHead>
              <TableHead>Rᵧ (kN)</TableHead>
              {d === 3 && <TableHead>Mᵣ (kN·m)</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {model.nodes.map((n, i) =>
              n.support === 'free' ? null : (
                <TableRow key={n.id}>
                  <TableCell>{n.id}</TableCell>
                  <TableCell>{n.support}</TableCell>
                  <TableCell>{fmt(result.R[i * d])}</TableCell>
                  <TableCell>{fmt(result.R[i * d + 1])}</TableCell>
                  {d === 3 && (
                    <TableCell>{fmt(result.R[i * d + 2])}</TableCell>
                  )}
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </section>

      {d === 3 && (
        <section className="table-section">
          <div className="results-subhead">
            <h3>Local member end actions</h3>
            <p>Actions on the member, in local axes; moments counterclockwise positive</p>
          </div>

          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                {[
                  'Nᵢ (kN)',
                  'Vᵢ (kN)',
                  'Mᵢ (kN·m)',
                  'Nⱼ (kN)',
                  'Vⱼ (kN)',
                  'Mⱼ (kN·m)'
                ].map(s => (
                  <TableHead key={s}>{s}</TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {result.elements.map(e => (
                <TableRow key={e.id}>
                  <TableCell>M{e.id}</TableCell>
                  {e.endForces.map((f, j) => (
                    <TableCell key={j}>{fmt(f)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </>
  );
}

function Matrix({
  data,
  labels,
  caption
}: {
  data: number[][];
  labels?: string[];
  caption: string;
}) {
  return (
    <div className="matrix">
      <table>
        <caption>{caption}</caption>

        <thead>
          <tr>
            <th></th>
            {data[0]?.map((_, i) => (
              <th key={i}>{labels?.[i] ?? i + 1}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((r, i) => (
            <tr key={i}>
              <th>{labels?.[i] ?? i + 1}</th>
              {r.map((v, j) => (
                <td key={j} className={Math.abs(v) < 1e-8 ? 'zero' : ''}>
                  {fmt(v, 4)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Step({
  n,
  title,
  children
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="calc-step">
      <span className="calc-number">{n.toString().padStart(2, '0')}</span>
      <h4>{title}</h4>
      {children}
    </section>
  );
}

export function Calculations({
  model,
  result
}: {
  model: Model;
  result: Solution;
}) {
  const [selected, setSelected] = useState(String(model.members[0]?.id));

  const e =
    result.elements.find(x => String(x.id) === selected) ??
    result.elements[0];

  const m = model.members.find(x => x.id === e.id)!;
  const a = model.nodes.find(x => x.id === m.a)!;
  const b = model.nodes.find(x => x.id === m.b)!;

  const truss = model.kind === 'truss';

  const localLabels = truss
    ? ['uᵢ', 'uⱼ']
    : ['uᵢ', 'vᵢ', 'θᵢ', 'uⱼ', 'vⱼ', 'θⱼ'];

  return (
    <>
      <div className="notebook-intro">
        <div>
          <h3>Every result, explained.</h3>
          <p>
            Direct stiffness method · linear elastic · {result.K.length} degrees of freedom
          </p>
        </div>

        <label className="field no-print">
          <span>Worked member</span>

          <Select value={String(e.id)} onValueChange={setSelected}>
            <SelectTrigger aria-label="Worked member">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {model.members.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>
                  M{m.id} · Node {m.a} → {m.b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <Step n={1} title="Geometry and consistent units">
        <p>
          Member M{m.id} joins nodes {a.id} ({fmt(a.x)}, {fmt(a.y)}) and {b.id} ({fmt(b.x)}, {fmt(b.y)}).
          Internal calculations use kN, m, and radians.
        </p>

        <div className="equation">
          L = √[({fmt(b.x)} − {fmt(a.x)})² + ({fmt(b.y)} − {fmt(a.y)})²] = <b>{fmt(e.L, 6)} m</b>
          <br />
          c = Δx/L = {fmt(e.c, 6)} &nbsp; · &nbsp; s = Δy/L = {fmt(e.s, 6)}
          <br />
          E = {fmt(m.E)} GPa = {fmt(m.E * 1e6)} kN/m²
          <br />
          A = {fmt(m.A)} mm² = {fmt(m.A * 1e-6, 8)} m²
          <br />
          {!truss && (
            <>
              I = {fmt(m.I)} cm⁴ = {fmt(m.I * 1e-8, 9)} m⁴
              <br />
            </>
          )}
          EA = {fmt(e.EA)} kN
          {!truss && <> &nbsp; · &nbsp; EI = {fmt(e.EI)} kN·m²</>}
        </div>
      </Step>

      <Step n={2} title="Form the element stiffness matrix">
        <p>
          {truss
            ? 'The axial element uses kₗ = (EA/L) [[1, −1], [−1, 1]].'
            : 'The Euler–Bernoulli element combines axial stiffness EA/L with bending terms 12EI/L³, 6EI/L², 4EI/L, and 2EI/L.'}
          {' '}Local displacement order: {localLabels.join(', ')}.
        </p>

        <Matrix
          data={e.localK}
          labels={localLabels}
          caption={`Local stiffness kₗ for M${m.id}. Translational DOFs in m; rotational DOFs in radians. Rows give kN or kN·m.`}
        />

        <details className="calc-details">
          <summary>Coordinate transformation and global element stiffness</summary>

          <p>
            uₗ = T uₑ, and kₑ = Tᵀ kₗ T. The local x axis runs from node {m.a} to {m.b};
            local y is 90° counterclockwise from local x.
          </p>

          <Matrix
            data={e.T}
            caption="Transformation matrix T (dimensionless)"
          />

          <div style={{ height: 12 }} />

          <Matrix
            data={e.globalK}
            labels={e.dofs.map(i => result.labels[i])}
            caption="Global element stiffness kₑ = Tᵀ kₗ T"
          />
        </details>
      </Step>

      <Step n={3} title="Assemble global stiffness and loads">
        <p>
          Each element contributes its transformed stiffness to the rows and columns of its connected nodes:
          K = Σ Aₑᵀ kₑ Aₑ. Nodal forces and equivalent distributed loads are added to F.
        </p>

        {!truss && (
          <div className="equation">
            q = {fmt(m.q)} kN/m along local +y
            <br />
            fₗ = [0, qL/2, qL²/12, 0, qL/2, −qL²/12]ᵀ
            <br />
            fₗ = [{e.equivalent.map(x => fmt(x, 5)).join(', ')}]ᵀ
            <br />
            Fₑ = Tᵀ fₗ
          </div>
        )}

        <details className="calc-details">
          <summary>Full assembled K · {result.K.length} × {result.K.length}</summary>

          <Matrix
            data={result.K}
            labels={result.labels}
            caption="Global stiffness before supports. Translation rows/columns use kN and m; rotation rows/columns use kN·m and radians."
          />
        </details>

        <div className="equation">
          DOF order: [{result.labels.join(', ')}]
          <br />
          F = [{result.F.map(x => fmt(x, 5)).join(', ')}]ᵀ
        </div>
      </Step>

      <Step n={4} title="Apply supports and solve displacements">
        <p>
          All restrained displacements are zero. Free degrees of freedom are solved using a diagonally scaled
          system with partial pivoting.
        </p>

        <div className="equation">
          Restrained: {result.fixed.map(i => result.labels[i]).join(', ') || 'none'}
          <br />
          Free: {result.free.map(i => result.labels[i]).join(', ') || 'none'}
          <br />
          K𝒻𝒻 u𝒻 = F𝒻 &nbsp; (uᵣ = 0)
          <br />
          u𝒻 = [{result.free.map(i => fmt(result.u[i], 8)).join(', ')}]ᵀ
        </div>

        <p>
          Translations above are in metres; rotations are in radians.
          The results tables convert them to mm and mrad.
        </p>

        <details className="calc-details">
          <summary>Reduced stiffness matrix K𝒻𝒻</summary>

          {result.free.length ? (
            <Matrix
              data={result.free.map(i => result.free.map(j => result.K[i][j]))}
              labels={result.free.map(i => result.labels[i])}
              caption="Reduced stiffness after removal of restrained rows and columns"
            />
          ) : (
            <p>All DOFs are restrained; no reduced solve is needed.</p>
          )}
        </details>
      </Step>

      <Step n={5} title="Recover member forces and deflections">
        <div className="equation">
          uₗ = T uₑ = [{e.localU.map(x => fmt(x, 8)).join(', ')}]ᵀ
          <br />
          pₗ = kₗ uₗ − fₗ = [{e.endForces.map(x => fmt(x, 5)).join(', ')}]ᵀ
          <br />
          N = {fmt(e.axial, 5)} kN &nbsp; (
          {Math.abs(e.axial) < 1e-7
            ? 'zero'
            : e.axial > 0
              ? 'tension'
              : 'compression'}
          )
          <br />
          σ axial = N/A = {fmt(e.axial)} × 1000 / {fmt(m.A)} = <b>{fmt(e.stress, 5)} MPa</b>
        </div>

        {truss ? (
          <p>Displacements are interpolated linearly along each axial member.</p>
        ) : (
          <>
            <div className="equation">
              For 0 ≤ x ≤ {fmt(e.L)} m, measured from node {m.a}:
              <br />
              V(x) = Vᵢ + qx = {fmt(e.endForces[1], 5)} + ({fmt(m.q)})x
              <br />
              M(x) = −Mᵢ + Vᵢx + qx²/2
              <br />
              M(x) = {fmt(-e.endForces[2], 5)} + ({fmt(e.endForces[1], 5)})x + ({fmt(m.q / 2)})x²
              <br />
              Max |V| = {fmt(e.shear, 5)} kN · Max |M| = {fmt(e.moment, 5)} kN·m
            </div>

            <p>
              For t = x/L, transverse displacement is v = (1−3t²+2t³)vᵢ + L(t−2t²+t³)θᵢ +
              (3t²−2t³)vⱼ + L(−t²+t³)θⱼ + qx²(L−x)²/(24EI). This includes the uniform-load correction.
              Axial displacement is linear. The displayed maximum displacement is sampled at 81 stations per member;
              moment extrema also include V = 0.
            </p>

            <p>
              Positive bending moment is sagging in local axes. Positive diagrams are drawn on the local −y side.
              End actions and internal section moments have different signs at the start of a member.
            </p>
          </>
        )}
      </Step>

      <Step n={6} title="Reactions and equilibrium check">
        <div className="equation">
          R = Ku − F
          <br />
          Relative free-DOF residual = {result.relativeResidual.toExponential(3)}
          <br />
          Acceptance tolerance = 1 × 10⁻⁶
        </div>

        <div className="check-row">
          {result.balance.map((v, i) => (
            <span className="check-pill" key={i}>
              Σ{['Fₓ', 'Fᵧ', 'M₀'][i]} = {fmt(v, 7)} {i === 2 ? 'kN·m' : 'kN'}
            </span>
          ))}
        </div>

        <p>
          Equilibrium checks numerical consistency; it is not a strength, buckling, or design-code check.
        </p>
      </Step>

      <section className="calc-step">
        <BookOpen
          size={22}
          style={{
            position: 'absolute',
            left: 0,
            top: 3,
            color: '#419785'
          }}
        />

        <h4>Method references</h4>

        <p>
          <a
            href="https://interactivetextbooks.citg.tudelft.nl/computational-modelling/structural_linear/euler_bernouilli.html"
            target="_blank"
            rel="noreferrer"
          >
            TU Delft — Euler–Bernoulli beam elements ↗
          </a>
          <br />

          <a
            href="https://people.duke.edu/~hpgavin/cee421/frame-element.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Duke University — Frame element stiffness matrices ↗
          </a>
          <br />

          <a
            href="https://github.com/emhayki/Truss-Solver"
            target="_blank"
            rel="noreferrer"
          >
            emhayki / Truss-Solver — reference project ↗
          </a>
        </p>
      </section>
    </>
  );
}

export function ModelTables({
  model
}: {
  model: Model;
}) {
  return (
    <>
      <section className="table-section">
        <div className="results-subhead">
          <h3>Nodes, supports & applied loads</h3>
          <p>Positive: x right, y up, moments counterclockwise</p>
        </div>

        <Table className="data-table">
          <TableHeader>
            <TableRow>
              {[
                'Node',
                'x (m)',
                'y (m)',
                'Support',
                'Fₓ (kN)',
                'Fᵧ (kN)',
                ...(model.kind !== 'truss' ? ['M (kN·m)'] : [])
              ].map(s => (
                <TableHead key={s}>{s}</TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {model.nodes.map(n => (
              <TableRow key={n.id}>
                {[
                  n.id,
                  fmt(n.x),
                  fmt(n.y),
                  n.support,
                  fmt(n.fx),
                  fmt(n.fy),
                  ...(model.kind !== 'truss' ? [fmt(n.mz)] : [])
                ].map((x, i) => (
                  <TableCell key={i}>{x}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="table-section">
        <div className="results-subhead">
          <h3>Member properties</h3>
          <p>q acts in local y · values are per member</p>
        </div>

        <Table className="data-table">
          <TableHeader>
            <TableRow>
              {[
                'Member',
                'From',
                'To',
                'E (GPa)',
                'A (mm²)',
                ...(model.kind !== 'truss' ? ['I (cm⁴)', 'q (kN/m)'] : [])
              ].map(s => (
                <TableHead key={s}>{s}</TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {model.members.map(m => (
              <TableRow key={m.id}>
                {[
                  `M${m.id}`,
                  m.a,
                  m.b,
                  fmt(m.E),
                  fmt(m.A),
                  ...(model.kind !== 'truss' ? [fmt(m.I), fmt(m.q)] : [])
                ].map((x, i) => (
                  <TableCell key={i}>{x}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
