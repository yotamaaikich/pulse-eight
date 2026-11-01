import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let checked=0;const problems=[];
async function scan(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){if(entry.isDirectory()){if(entry.name==='node_modules'||entry.name==='.git'||entry.name.startsWith('dist'))continue;await scan(path.join(directory,entry.name));continue;}
  if(!/\.(?:m?js|cjs|ts|json|sql|md|ya?ml|html|css)$/.test(entry.name))continue;
  const file=path.join(directory,entry.name),source=await fs.readFile(file,'utf8');checked++;
  for(const pattern of [/sb_secret_[A-Za-z0-9_-]{20,}/,/GOCSPX-[A-Za-z0-9_-]{20,}/,/ghp_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{40,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/])if(pattern.test(source))problems.push(path.relative(root,file)+': credential pattern');
  for(const token of source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)??[])try{if(JSON.parse(Buffer.from(token.split('.')[1],'base64url')).role==='service_role')problems.push(path.relative(root,file)+': privileged token');}catch{}
}}
await scan(root);assert.deepEqual(problems,[],'Credentials must not be packaged or committed');
for(const name of ['index.html','privacy.html','desktop/settings.html']){const source=await fs.readFile(path.join(root,name),'utf8');assert.match(source,/http-equiv="Content-Security-Policy"/);assert.ok(!/script-src[^";]*'unsafe-(?:inline|eval)'/.test(source));}
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
assert.equal(pkg.build.electronFuses.runAsNode,false);assert.equal(pkg.build.electronFuses.enableEmbeddedAsarIntegrityValidation,true);assert.equal(pkg.build.electronFuses.onlyLoadAppFromAsar,true);
console.log(JSON.stringify({credentialScanFiles:checked,csp:'passed',fuseConfiguration:'passed'}));
if(process.argv[2]){
  const {getCurrentFuseWire,FuseV1Options}=await import('@electron/fuses');const fuses=await getCurrentFuseWire(path.resolve(process.argv[2]));const FuseState={DISABLE:48,ENABLE:49};
  for(const key of ['RunAsNode','EnableNodeOptionsEnvironmentVariable','EnableNodeCliInspectArguments','GrantFileProtocolExtraPrivileges'])assert.equal(fuses[FuseV1Options[key]],FuseState.DISABLE,key);
  for(const key of ['EnableCookieEncryption','EnableEmbeddedAsarIntegrityValidation','OnlyLoadAppFromAsar'])assert.equal(fuses[FuseV1Options[key]],FuseState.ENABLE,key);
  console.log(JSON.stringify({packagedFuses:'passed'}));
}
