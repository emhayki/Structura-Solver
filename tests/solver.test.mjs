import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, clonePreset, presets } from '../src/lib/solver.ts';

function close(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)),
    `${label}: ${actual} versus ${expected}`
  );
}

test('All seven examples satisfy global equilibrium', () => {
  for (const key of Object.keys(presets)) {
    const result = solve(clonePreset(key));
    assert.ok(result.balance.every(value => Math.abs(value) < 1e-7), key);
    assert.ok(result.relativeResidual < 1e-8, key);
  }
});

test('Triangular truss reactions and member forces match joint equilibrium', () => {
  const r = solve(clonePreset('triangle'));
  close(r.R[1], 15, 'Left reaction');
  close(r.R[3], 15, 'Right reaction');
  close(r.elements[0].axial, 11.25, 'Tie force');
  close(r.elements[1].axial, -18.75, 'Diagonal compression');
});

test('Cantilever with tip force matches PL^3/(3EI) and PL^2/(2EI)', () => {
  const r = solve(clonePreset('cantilever'));
  const P = 10, L = 4, EI = 16000;

  close(r.u[4], -P * L ** 3 / (3 * EI), 'Tip displacement');
  close(r.u[5], -P * L ** 2 / (2 * EI), 'Tip rotation');
  close(r.R[1], P, 'Vertical reaction');
  close(r.R[2], P * L, 'Fixed-end reaction moment');
  close(r.maxMoment, P * L, 'Maximum moment');
});

test('Cantilever with tip moment matches ML^2/(2EI) and ML/EI', () => {
  const m = clonePreset('cantilever');
  m.nodes[1].fy = 0;
  m.nodes[1].mz = 15;

  const r = solve(m);

  close(r.u[4], 15 * 4 ** 2 / (2 * 16000), 'Tip displacement');
  close(r.u[5], 15 * 4 / 16000, 'Tip rotation');
});

test('One-element simply supported beam includes exact uniform-load deflection correction', () => {
  const m = clonePreset('cantilever');
  m.nodes[0].support = 'pin';
  m.nodes[1].support = 'roller-y';
  m.nodes[1].fy = 0;
  m.members[0].q = -5;

  const r = solve(m);

  close(r.maxDisp, 5 * 5 * 4 ** 4 / (384 * 16000), '5qL^4/(384EI)');
  close(r.maxMoment, 5 * 4 ** 2 / 8, 'qL^2/8');
  close(r.R[1], 10, 'qL/2');
});

test('Fixed-fixed uniform-load beam works with no free DOFs', () => {
  const m = clonePreset('cantilever');
  m.nodes[1].support = 'fixed';
  m.nodes[1].fy = 0;
  m.members[0].q = -5;

  const r = solve(m);

  close(r.maxDisp, 5 * 4 ** 4 / (384 * 16000), 'qL^4/(384EI)');
  close(r.R[2], 5 * 4 ** 2 / 12, 'qL^2/12');
});

test('L-frame tip displacements include beam bending, column bending and axial shortening', () => {
  const r = solve(clonePreset('sway'));
  const EI = 16000;

  close(
    r.u[7],
    -10 * (4 ** 3 / (3 * EI) + 4 ** 2 * 4 / EI + 4 / 600000),
    'Vertical displacement'
  );

  close(
    r.u[6],
    10 * 4 * 4 ** 2 / (2 * EI),
    'Horizontal displacement'
  );
});

test('Inclined axial member transforms displacements without spurious moment', () => {
  const m = clonePreset('cantilever');
  m.kind = 'frame';
  m.nodes[1].x = 3;
  m.nodes[1].y = 4;
  m.nodes[1].fx = 6;
  m.nodes[1].fy = 8;

  const r = solve(m);

  close(r.u[3], 6 * 5 / 600000, 'Global ux');
  close(r.u[4], 8 * 5 / 600000, 'Global uy');
  close(r.maxMoment, 0, 'Bending moment');
});

test('Unrestrained mechanism is rejected', () => {
  const m = clonePreset('triangle');
  m.nodes.forEach(n => n.support = 'free');

  assert.throws(() => solve(m), /unstable|unrestrained/);
});

test('Invalid stiffness is rejected', () => {
  const m = clonePreset('triangle');
  m.members[0].E = 0;

  assert.throws(() => solve(m), /positive/);
});

test('Disconnected nodes are rejected', () => {
  const m = clonePreset('triangle');

  m.nodes.push({
    id: 4,
    x: 9,
    y: 0,
    support: 'free',
    fx: 0,
    fy: 0,
    mz: 0
  });

  assert.throws(() => solve(m), /not connected/);
});