import { build } from 'esbuild';
await build({entryPoints:['src/table-import-browser.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'public/vendor/tablemind-import.js',minify:true,legalComments:'none'});
console.log('TableMind browser import bundle built.');
