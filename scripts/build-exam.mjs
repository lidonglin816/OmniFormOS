import { build } from 'esbuild';
import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('public/vendor/exam',{recursive:true});
await build({stdin:{contents:"export * as echarts from 'echarts'; export {default as katex} from 'katex';",resolveDir:process.cwd()},bundle:true,format:'esm',minify:true,outfile:'public/vendor/exam/tools.js'});
await copyFile('node_modules/katex/dist/katex.min.css','public/vendor/exam/katex.css');
await cp('node_modules/katex/dist/fonts','public/vendor/exam/fonts',{recursive:true});
