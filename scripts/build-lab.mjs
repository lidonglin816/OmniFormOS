import {build} from 'esbuild';
await build({stdin:{contents:"import Plotly from 'plotly.js-basic-dist-min'; export default Plotly;",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'public/vendor/lab-plotly.js',minify:true,legalComments:'none'});
console.log('LabForm lazy Plotly scientific chart bundle built.');
