import {mkdir,writeFile} from 'node:fs/promises';
import {createFillableDocPDF} from '../src/doc-fillable-pdf.mjs';
import {makeDocument,segmentsFromText,confirmAll} from '../public/docmorph-model.js';
const d=makeDocument('校园竞赛报名表 - 功能验收样例','text',segmentsFromText('项目名称（必填）：____\n负责人（必填）：____\n联系电话（必填，11位）：____\n团队人数（数字，1~5）：____\n指导教师（必填）：____\n所属学院（单选）：信息学院 / 工程学院\n报名说明（多行）：____\n确认信息（勾选）：已核对'));
confirmAll(d);await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/DocMorph-校园竞赛可填写表单.pdf',await createFillableDocPDF(d));console.log('PDF fields:',d.fields.length);
