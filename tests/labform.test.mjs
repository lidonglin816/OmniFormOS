import test from 'node:test';
import assert from 'node:assert/strict';
import { seedLabForm, mean, sampleStd, calculateExperiment, addMeasurement, saveVersion, makeReport } from '../public/labform-model.js';

test('平均值与样本标准差采用确定性公式', () => { assert.equal(mean([1,2,3]), 2); assert.equal(sampleStd([1,2,3]), 1); });
test('霍尔实验完成线性拟合、误差和单位换算', () => { const s=seedLabForm(), r=calculateExperiment(s); assert.ok(Math.abs(r.slope-0.06025)<0.001); assert.ok(r.r2>0.999); assert.ok(r.slopeUncertainty>=0); assert.ok(r.hallCoefficient>0); });
test('新增测量拒绝重复磁场并立即重新计算', () => { const s=seedLabForm(); addMeasurement(s,120,[7.2,7.21,7.19]); assert.equal(s.rows.length,6); assert.throws(()=>addMeasurement(s,120,[1,2,3]),/已存在/); });
test('版本保存深拷贝数据，报告保留公式与结果', () => { const s=seedLabForm(),v=saveVersion(s,'初次测量'); s.rows[0].readings[0]=99; assert.notEqual(v.rows[0].readings[0],99); const report=makeReport(s); assert.match(report.formula,/R_H/); assert.match(report.summary,/R²/); });
