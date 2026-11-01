import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),files=[],seen=new Set();
async function visit(name){
  if(seen.has(name))return;seen.add(name);
  const file=path.resolve(root,name);if(path.relative(root,file).startsWith('..'))throw Error('Dependency escaped source root');
  let content=await fs.readFile(file,'utf8');const dependencies=[];
  content=content.replace(/(\bfrom\s*['"])(\.[^'"]+)(['"])/g,(_all,start,spec,end)=>{const clean=spec.split('?')[0];dependencies.push(path.posix.normalize(path.posix.join(path.posix.dirname(name),clean)));return start+clean+end;});
  files.push({name,content});for(const dependency of dependencies)await visit(dependency);
}
await visit('cloud/index.ts');
if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(files));
console.log(JSON.stringify({entrypoint:'cloud/index.ts',files:files.map(f=>f.name)}));
