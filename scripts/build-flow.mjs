import { build } from 'esbuild';
await build({ entryPoints: ['src/flow-canvas.jsx'], outfile: 'public/vendor/flow-canvas.js', bundle: true, format: 'esm', minify: true, sourcemap: false, define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'eof' });
console.log('FlowForm React Flow assets built.');
await build({ entryPoints: ['src/adapt-logic-map.jsx'], outfile: 'public/vendor/adapt-logic-map.js', bundle: true, format: 'esm', minify: true, define: { 'process.env.NODE_ENV': '"production"' } });
await build({stdin:{contents:"export {default} from 'qrcode';",resolveDir:process.cwd()},outfile:'public/vendor/adapt-qrcode.js',bundle:true,format:'esm',minify:true});
