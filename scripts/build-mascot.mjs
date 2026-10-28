import {build} from 'esbuild';
await build({entryPoints:['src/hero-mascot.jsx'],outfile:'public/vendor/hero-mascot.js',bundle:true,format:'esm',minify:true,sourcemap:false,define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
console.log('Lazy homepage mascot bundle built.');
