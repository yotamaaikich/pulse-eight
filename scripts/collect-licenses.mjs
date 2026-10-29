import fs from 'node:fs/promises';
import path from 'node:path';
export async function collectLicenses(metafile,destination){
  const packages=new Map(),visited=new Set();
  for(const input of Object.keys(metafile.inputs)){
    if(!input.replaceAll('\\','/').includes('node_modules/'))continue;
    let dir=path.dirname(path.resolve(input));
    while(dir!==path.dirname(dir)){
      if(visited.has(dir))break;
      let pkg;try{pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;dir=path.dirname(dir);continue;}
      const names=(await fs.readdir(dir)).filter(name=>/^(licen[sc]e|copyright|notice|copying)/i.test(name)),texts=[];
      for(const name of names){const file=path.join(dir,name);if((await fs.stat(file)).isFile())texts.push(name+'\n'+await fs.readFile(file,'utf8'));}
      if(!texts.length)throw Error('Missing third-party license: '+pkg.name);
      packages.set(pkg.name,{...pkg,texts});visited.add(dir);break;
    }
  }
  const text='PIANO PULSE · bundled browser libraries\n\n'+[...packages.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(pkg=>pkg.name+' '+pkg.version+'\n'+'='.repeat(60)+'\n'+pkg.texts.join('\n\n')).join('\n\n');
  await fs.writeFile(destination,text);return packages.size;
}
