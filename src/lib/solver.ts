export type Kind = 'truss' | 'beam' | 'frame';
export type Support = 'free' | 'pin' | 'roller-y' | 'roller-x' | 'fixed';

export interface Joint {
  id: number; x: number; y: number; support: Support;
  fx: number; fy: number; mz: number;
}

export interface Member {
  id: number; a: number; b: number;
  E: number; A: number; I: number; q: number;
}

export interface Model {
  name: string; kind: Kind;
  nodes: Joint[]; members: Member[];
}

export interface ElementResult {
  id: number; L: number; c: number; s: number;
  EA: number; EI: number;
  dofs: number[];
  localK: number[][];
  T: number[][];
  globalK: number[][];
  equivalent: number[];
  localU: number[];
  endForces: number[];
  axial: number;
  stress: number;
  shear: number;
  moment: number;
  samples: { x: number; N: number; V: number; M: number; ux: number; uy: number }[];
}

export interface Solution {
  K: number[][];
  F: number[];
  u: number[];
  R: number[];
  free: number[];
  fixed: number[];
  labels: string[];
  elements: ElementResult[];
  maxDisp: number;
  maxAxial: number;
  maxMoment: number;
  maxShear: number;
  balance: number[];
  relativeResidual: number;
  warnings: string[];
}

const zeros = (n: number, m = n) =>
  Array.from({ length: n }, () => Array(m).fill(0) as number[]);

const transpose = (a: number[][]) =>
  a[0].map((_, i) => a.map(r => r[i]));

const multiply = (a: number[][], b: number[][]) =>
  a.map(r =>
    b[0].map((_, j) =>
      r.reduce((s, v, k) => s + v * b[k][j], 0)
    )
  );

export const matVec = (a: number[][], x: number[]) =>
  a.map(r => r.reduce((s, v, i) => s + v * x[i], 0));

export function restraints(s: Support, kind: Kind): boolean[] {
  return [
    s === 'pin' || s === 'fixed' || s === 'roller-x',
    s === 'pin' || s === 'fixed' || s === 'roller-y',
    s === 'fixed'
  ].slice(0, kind === 'truss' ? 2 : 3);
}

function linearSolve(A: number[][], b: number[]): number[] {
  const n = b.length;

  if (!n) return [];

  const scales = A.map((r, i) =>
    Math.sqrt(Math.abs(r[i]))
  );

  if (scales.some(s => s === 0 || !Number.isFinite(s))) {
    throw new Error(
      'The model has an unrestrained degree of freedom. Check supports and member connections.'
    );
  }

  const m = A.map((r, i) => [
    ...r.map((v, j) => v / scales[i] / scales[j]),
    b[i] / scales[i]
  ]);

  for (let k = 0; k < n; k++) {
    let pivot = k;

    for (let i = k + 1; i < n; i++) {
      if (Math.abs(m[i][k]) > Math.abs(m[pivot][k])) {
        pivot = i;
      }
    }

    if (Math.abs(m[pivot][k]) < 1e-11) {
      throw new Error(
        'The structure is unstable or too ill-conditioned to solve reliably. Add restraints or bracing, and check the geometry and stiffness values.'
      );
    }

    [m[k], m[pivot]] = [m[pivot], m[k]];

    for (let i = k + 1; i < n; i++) {
      const t = m[i][k] / m[k][k];

      m[i][k] = 0;

      for (let j = k + 1; j <= n; j++) {
        m[i][j] -= t * m[k][j];
      }
    }
  }

  const y = Array(n).fill(0);

  for (let i = n - 1; i >= 0; i--) {
    y[i] =
      (
        m[i][n] -
        m[i]
          .slice(i + 1, n)
          .reduce((s, v, j) => s + v * y[i + 1 + j], 0)
      ) / m[i][i];
  }

  return y.map((v, i) => v / scales[i]);
}

export function validateModel(model: Model) {
  if (!['truss', 'beam', 'frame'].includes(model.kind)) {
    throw new Error('Choose a truss, beam, or frame model.');
  }

  if (model.nodes.length < 2 || model.nodes.length > 40) {
    throw new Error('Use between 2 and 40 nodes.');
  }

  if (model.members.length < 1 || model.members.length > 80) {
    throw new Error('Use between 1 and 80 members.');
  }

  if (
    new Set(model.nodes.map(n => n.id)).size !== model.nodes.length ||
    new Set(model.members.map(m => m.id)).size !== model.members.length
  ) {
    throw new Error('Node and member IDs must be unique.');
  }

  for (const n of model.nodes) {
    if (
      !Number.isInteger(n.id) ||
      ![n.x, n.y, n.fx, n.fy, n.mz].every(Number.isFinite)
    ) {
      throw new Error(
        'All node coordinates and loads must be finite numbers.'
      );
    }

    if (
      !['free', 'pin', 'roller-y', 'roller-x', 'fixed']
        .includes(n.support)
    ) {
      throw new Error('Unknown support type.');
    }

    if (model.kind === 'truss' && n.mz !== 0) {
      throw new Error(
        'Truss joints cannot carry nodal moments. Use a frame model.'
      );
    }

    if (!model.members.some(m => m.a === n.id || m.b === n.id)) {
      throw new Error(
        `Node ${n.id} is not connected to a member.`
      );
    }
  }

  const edges = new Set<string>();

  for (const m of model.members) {
    if (
      ![m.E, m.A, m.I, m.q].every(Number.isFinite) ||
      m.E <= 0 ||
      m.A <= 0 ||
      (model.kind !== 'truss' && m.I <= 0)
    ) {
      throw new Error(
        `Member ${m.id}: E, A, and (for beams/frames) I must be positive.`
      );
    }

    const a = model.nodes.find(n => n.id === m.a);
    const b = model.nodes.find(n => n.id === m.b);

    if (!a || !b) {
      throw new Error(
        `Member ${m.id} references a missing node.`
      );
    }

    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) {
      throw new Error(
        `Member ${m.id} has zero or negligible length.`
      );
    }

    const key = [m.a, m.b]
      .sort((a, b) => a - b)
      .join(':');

    if (edges.has(key)) {
      throw new Error(
        'Two members connect the same pair of nodes. Use one member with the combined section.'
      );
    }

    edges.add(key);

    if (model.kind === 'truss' && m.q !== 0) {
      throw new Error(
        'Apply truss loads at nodes; distributed loads require beam or frame elements.'
      );
    }
  }
}

export function solve(model: Model): Solution {
  validateModel(model);

  const truss = model.kind === 'truss';
  const d = truss ? 2 : 3;
  const nd = model.nodes.length * d;

  const K = zeros(nd);
  const F = Array(nd).fill(0);
  const fixed: number[] = [];
  const free: number[] = [];

  const labels = model.nodes.flatMap(n =>
    (truss ? ['x', 'y'] : ['x', 'y', 'θ'])
      .map(a => `${n.id}${a}`)
  );

  model.nodes.forEach((n, i) => {
    [n.fx, n.fy, n.mz]
      .slice(0, d)
      .forEach((v, j) => F[i * d + j] = v);

    restraints(n.support, model.kind)
      .forEach((v, j) =>
        (v ? fixed : free).push(i * d + j)
      );
  });

  const elements: ElementResult[] = model.members.map(m => {
    const ai = model.nodes.findIndex(n => n.id === m.a);
    const bi = model.nodes.findIndex(n => n.id === m.b);

    const a = model.nodes[ai];
    const b = model.nodes[bi];

    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const c = (b.x - a.x) / L;
    const s = (b.y - a.y) / L;

    const EA = m.E * m.A;
    const EI = m.E * m.I * .01;

    const localK = truss
      ? [
          [EA / L, -EA / L],
          [-EA / L, EA / L]
        ]
      : zeros(6);

    if (!truss) {
      const x = EA / L;
      const y = 12 * EI / L ** 3;
      const z = 6 * EI / L ** 2;
      const w = 4 * EI / L;
      const v = 2 * EI / L;

      const rows = [
        [x, 0, 0, -x, 0, 0],
        [0, y, z, 0, -y, z],
        [0, z, w, 0, -z, v],
        [-x, 0, 0, x, 0, 0],
        [0, -y, -z, 0, y, -z],
        [0, z, v, 0, -z, w]
      ];

      rows.forEach((r, i) => localK[i] = r);
    }

    const T = truss
      ? [
          [c, s, 0, 0],
          [0, 0, c, s]
        ]
      : [
          [c, s, 0, 0, 0, 0],
          [-s, c, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, c, s, 0],
          [0, 0, 0, -s, c, 0],
          [0, 0, 0, 0, 0, 1]
        ];

    const globalK = multiply(
      transpose(T),
      multiply(localK, T)
    );

    const equivalent = truss
      ? [0, 0]
      : [
          0,
          m.q * L / 2,
          m.q * L * L / 12,
          0,
          m.q * L / 2,
          -m.q * L * L / 12
        ];

    const globalF = matVec(
      transpose(T),
      equivalent
    );

    const dofs = [
      ...Array.from({ length: d }, (_, i) => ai * d + i),
      ...Array.from({ length: d }, (_, i) => bi * d + i)
    ];

    dofs.forEach((gi, i) => {
      F[gi] += globalF[i];

      dofs.forEach((gj, j) => {
        K[gi][gj] += globalK[i][j];
      });
    });

    return {
      id: m.id,
      L,
      c,
      s,
      EA,
      EI,
      dofs,
      localK,
      T,
      globalK,
      equivalent,
      localU: [],
      endForces: [],
      axial: 0,
      stress: 0,
      shear: 0,
      moment: 0,
      samples: []
    };
  });

  const uf = linearSolve(
    free.map(i => free.map(j => K[i][j])),
    free.map(i => F[i])
  );

  const u = Array(nd).fill(0);

  free.forEach((i, j) => u[i] = uf[j]);

  const R = matVec(K, u)
    .map((v, i) => v - F[i]);

  let maxDisp = 0;
  let maxMoment = 0;
  let maxShear = 0;
  let maxAxial = 0;

  elements.forEach((e, i) => {
    const m = model.members[i];
    const { L, c, s } = e;

    e.localU = matVec(
      e.T,
      e.dofs.map(j => u[j])
    );

    e.endForces = matVec(
      e.localK,
      e.localU
    ).map((v, j) => v - e.equivalent[j]);

    e.axial = e.endForces[truss ? 1 : 3];
    e.stress = e.axial * 1000 / m.A;

    maxAxial = Math.max(
      maxAxial,
      Math.abs(e.axial)
    );

    const ld = e.localU;
    const p = e.endForces;

    const points = Array.from(
      { length: 81 },
      (_, j) => L * j / 80
    );

    if (!truss && m.q !== 0) {
      const x = -p[1] / m.q;

      if (x > 0 && x < L) {
        points.push(x);
      }
    }

    e.samples = points
      .sort((a, b) => a - b)
      .map(x => {
        const t = x / L;

        let ux = 0;
        let uy = 0;
        let V = 0;
        let M = 0;

        if (truss) {
          const gu = e.dofs.map(j => u[j]);

          ux = (1 - t) * gu[0] + t * gu[2];
          uy = (1 - t) * gu[1] + t * gu[3];
        } else {
          const axial =
            (1 - t) * ld[0] +
            t * ld[3];

          const v =
            (1 - 3 * t * t + 2 * t ** 3) * ld[1] +
            L * (t - 2 * t * t + t ** 3) * ld[2] +
            (3 * t * t - 2 * t ** 3) * ld[4] +
            L * (-t * t + t ** 3) * ld[5] +
            m.q * x * x * (L - x) ** 2 / (24 * e.EI);

          ux = c * axial - s * v;
          uy = s * axial + c * v;

          V = p[1] + m.q * x;
          M = -p[2] + p[1] * x + m.q * x * x / 2;
        }

        maxDisp = Math.max(
          maxDisp,
          Math.hypot(ux, uy)
        );

        e.moment = Math.max(
          e.moment,
          Math.abs(M)
        );

        e.shear = Math.max(
          e.shear,
          Math.abs(V)
        );

        return {
          x,
          N: e.axial,
          V,
          M,
          ux,
          uy
        };
      });

    maxMoment = Math.max(
      maxMoment,
      e.moment
    );

    maxShear = Math.max(
      maxShear,
      e.shear
    );
  });

  const balance = [0, 0, 0];

  model.nodes.forEach((n, i) => {
    const x = F[d * i] + R[d * i];
    const y = F[d * i + 1] + R[d * i + 1];

    balance[0] += x;
    balance[1] += y;

    balance[2] +=
      n.x * y -
      n.y * x +
      (truss ? 0 : F[d * i + 2] + R[d * i + 2]);
  });

  const relativeResidual =
    Math.max(
      0,
      ...free.map(i => Math.abs(R[i]))
    ) /
    Math.max(
      1,
      ...F.map(Math.abs)
    );

  if (
    !u.every(Number.isFinite) ||
    relativeResidual > 1e-6
  ) {
    throw new Error(
      'The numerical solution did not meet the equilibrium tolerance. Check geometry and stiffness values.'
    );
  }

  const span = Math.max(
    ...elements.map(e => e.L)
  );

  const warnings: string[] = [];

  if (maxDisp / span > .02) {
    warnings.push(
      'Displacements are large relative to member length. The small-displacement assumption may be unsuitable.'
    );
  }

  if (!F.some(v => Math.abs(v) > 1e-12)) {
    warnings.push(
      'No external loads are applied. All calculated results are zero.'
    );
  }

  return {
    K,
    F,
    u,
    R,
    free,
    fixed,
    labels,
    elements,
    maxDisp,
    maxAxial,
    maxMoment,
    maxShear,
    balance,
    relativeResidual,
    warnings
  };
}

const node = (
  id: number,
  x: number,
  y: number,
  support: Support = 'free',
  fy = 0,
  fx = 0
): Joint => ({
  id,
  x,
  y,
  support,
  fy,
  fx,
  mz: 0
});

const member = (
  id: number,
  a: number,
  b: number,
  q = 0
): Member => ({
  id,
  a,
  b,
  E: 200,
  A: 3000,
  I: 8000,
  q
});

export const presets: Record<string, Model> = {
  warren: {
    name: 'Warren roof truss',
    kind: 'truss',

    nodes: [
      node(1, 0, 0, 'pin'),
      node(2, 4, 0),
      node(3, 8, 0),
      node(4, 12, 0, 'roller-y'),
      node(5, 2, 3, 'free', -20),
      node(6, 6, 3, 'free', -30),
      node(7, 10, 3, 'free', -20)
    ],

    members: [
      [1, 2],
      [2, 3],
      [3, 4],
      [5, 6],
      [6, 7],
      [1, 5],
      [5, 2],
      [2, 6],
      [6, 3],
      [3, 7],
      [7, 4]
    ].map(([a, b], i) =>
      member(i + 1, a, b)
    )
  },

  triangle: {
    name: 'Triangular truss',
    kind: 'truss',

    nodes: [
      node(1, 0, 0, 'pin'),
      node(2, 6, 0, 'roller-y'),
      node(3, 3, 4, 'free', -30)
    ],

    members: [
      member(1, 1, 2),
      member(2, 1, 3),
      member(3, 3, 2)
    ]
  },

  simple: {
    name: 'Simply supported beam',
    kind: 'beam',

    nodes: [
      node(1, 0, 0, 'pin'),
      node(2, 3, 0, 'free', -20),
      node(3, 6, 0, 'roller-y')
    ],

    members: [
      member(1, 1, 2, -5),
      member(2, 2, 3, -5)
    ]
  },

  cantilever: {
    name: 'Cantilever beam',
    kind: 'beam',

    nodes: [
      node(1, 0, 0, 'fixed'),
      node(2, 4, 0, 'free', -10)
    ],

    members: [
      member(1, 1, 2)
    ]
  },

  continuous: {
    name: 'Two-span continuous beam',
    kind: 'beam',

    nodes: [
      node(1, 0, 0, 'pin'),
      node(2, 4, 0, 'roller-y'),
      node(3, 8, 0, 'roller-y')
    ],

    members: [
      member(1, 1, 2, -10),
      member(2, 2, 3, -10)
    ]
  },

  portal: {
    name: 'Portal frame',
    kind: 'frame',

    nodes: [
      node(1, 0, 0, 'fixed'),
      node(2, 0, 4, 'free', 0, 15),
      node(3, 6, 4, 'free', -20),
      node(4, 6, 0, 'fixed')
    ],

    members: [
      member(1, 1, 2),
      member(2, 2, 3, -5),
      member(3, 4, 3)
    ]
  },

  sway: {
    name: 'Cantilever frame',
    kind: 'frame',

    nodes: [
      node(1, 0, 0, 'fixed'),
      node(2, 0, 4),
      node(3, 4, 4, 'free', -10)
    ],

    members: [
      member(1, 1, 2),
      member(2, 2, 3)
    ]
  }
};

export const clonePreset = (key: string): Model =>
  JSON.parse(JSON.stringify(presets[key]));

export const fmt = (v: number, d = 3) =>
  Math.abs(v) < 1e-9
    ? '0'
    : Math.abs(v) >= 1e7 || Math.abs(v) < .0001
      ? v.toExponential(3)
      : v.toLocaleString(
          'en-US',
          { maximumFractionDigits: d }
        );