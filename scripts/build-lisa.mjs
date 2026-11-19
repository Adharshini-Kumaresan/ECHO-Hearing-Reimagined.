import './assemble-concept-film.mjs';
// Compile standalone workers without the framework's window-only dev overlay.
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
mkdirSync('public/ai',{recursive:true});
for(const [input,output] of [['app/lisa-cpu.worker.ts','lisa-cpu.js'],['app/lisa.worker.ts','lisa-gpu.js']]){
  execFileSync(resolve('node_modules/.bin/esbuild'),[input,'--bundle','--platform=browser','--format=esm','--minify',`--outfile=public/ai/${output}`],{stdio:'inherit'});
}
