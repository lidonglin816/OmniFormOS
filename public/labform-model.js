const id = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

export function seedLabForm() {
  const state = {
    activeTab: 'data',
    project: { name: '霍尔效应实验', code: 'PHY-HALL-026', researcher: '本地体验用户', currentMa: 10, thicknessMm: 0.5, temperatureC: 25 },
    rows: [
      { id: id(), fieldMt: 20, readings: [1.18, 1.21, 1.20] },
      { id: id(), fieldMt: 40, readings: [2.39, 2.42, 2.40] },
      { id: id(), fieldMt: 60, readings: [3.61, 3.58, 3.60] },
      { id: id(), fieldMt: 80, readings: [4.82, 4.79, 4.81] },
      { id: id(), fieldMt: 100, readings: [6.01, 6.04, 6.02] }
    ],
    versions: [], result: null, notes: '保持电流恒定，逐级增加磁感应强度，每组重复测量 3 次。'
  };
  state.result = calculateExperiment(state);
  return state;
}

export const mean = values => values.reduce((n, v) => n + Number(v), 0) / values.length;
export function sampleStd(values) { if (values.length < 2) return 0; const m = mean(values); return Math.sqrt(values.reduce((n, v) => n + (Number(v) - m) ** 2, 0) / (values.length - 1)); }

export function calculateExperiment(state) {
  if (!state.rows.length) throw new Error('至少需要一组实验数据');
  const points = state.rows.map(row => {
    const x = Number(row.fieldMt), readings = row.readings.map(Number);
    if (!Number.isFinite(x) || readings.some(v => !Number.isFinite(v))) throw new Error('磁场和电压必须是有效数字');
    return { id: row.id, x, y: mean(readings), std: sampleStd(readings) };
  }).sort((a, b) => a.x - b.x);
  const xMean = mean(points.map(p => p.x)), yMean = mean(points.map(p => p.y));
  const sxx = points.reduce((n, p) => n + (p.x - xMean) ** 2, 0);
  if (!sxx) throw new Error('磁场值不能全部相同');
  const slope = points.reduce((n, p) => n + (p.x - xMean) * (p.y - yMean), 0) / sxx;
  const intercept = yMean - slope * xMean;
  const residuals = points.map(p => p.y - (slope * p.x + intercept));
  const ssRes = residuals.reduce((n, v) => n + v ** 2, 0), ssTot = points.reduce((n, p) => n + (p.y - yMean) ** 2, 0);
  const r2 = ssTot ? 1 - ssRes / ssTot : 1;
  const slopeUncertainty = points.length > 2 ? Math.sqrt((ssRes / (points.length - 2)) / sxx) : 0;
  const currentA = Number(state.project.currentMa) / 1000, thicknessM = Number(state.project.thicknessMm) / 1000;
  if (!(currentA > 0) || !(thicknessM > 0)) throw new Error('电流与样品厚度必须大于零');
  const hallCoefficient = slope * thicknessM / currentA;
  return { points, slope, intercept, r2, slopeUncertainty, hallCoefficient, calculatedAt: new Date().toISOString() };
}

export function saveVersion(state, label = '') {
  const result = calculateExperiment(state);
  const version = { id: id(), number: state.versions.length + 1, label: label.trim() || `数据版本 ${state.versions.length + 1}`, at: new Date().toISOString(), project: structuredClone(state.project), rows: structuredClone(state.rows), result: structuredClone(result) };
  state.result = result; state.versions.unshift(version); return version;
}

export function addMeasurement(state, fieldMt, readings) {
  const row = { id: id(), fieldMt: Number(fieldMt), readings: readings.map(Number) };
  if (!Number.isFinite(row.fieldMt) || row.readings.length !== 3 || row.readings.some(v => !Number.isFinite(v))) throw new Error('请填写磁场和 3 次有效电压读数');
  if (state.rows.some(r => Number(r.fieldMt) === row.fieldMt)) throw new Error('该磁场值已存在');
  state.rows.push(row); state.result = calculateExperiment(state); return row;
}

export function makeReport(state) {
  const r = state.result || calculateExperiment(state);
  return { title: `${state.project.name}报告`, project: state.project, summary: `在 ${state.project.temperatureC} °C 下测得霍尔电压与磁感应强度呈线性关系，拟合 R²=${r.r2.toFixed(5)}。`, formula: 'V_H = R_H × I × B / d', result: `斜率 ${r.slope.toFixed(5)} V/T，霍尔系数 ${r.hallCoefficient.toExponential(4)} m³/C。`, uncertainty: `斜率标准不确定度 ${r.slopeUncertainty.toExponential(3)} V/T。`, rows: r.points.length, generatedAt: new Date().toISOString() };
}

