const fs=require('node:fs/promises');
const path=require('node:path');
const validKey=key=>typeof key==='string'&&/^piano-pulse-auth(?:-(?:code-verifier|flows-code-verifier|user|flow-[A-Za-z0-9_-]{8,64}-code-verifier))?$/.test(key);
function createAuthVault({file,safeStorage}){
  let queue=Promise.resolve(),values=null;const memory=new Map();
  function run(task){const next=queue.then(task);queue=next.catch(()=>{});return next;}
  async function load(){if(values)return;try{const data=JSON.parse(await fs.readFile(file,'utf8'));values=Object.fromEntries(Object.entries(data).filter(([key,value])=>validKey(key)&&typeof value==='string'&&value.length<=180000));}catch{values={};}}
  async function save(){await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.tmp';await fs.writeFile(temporary,JSON.stringify(values),{mode:0o600});await fs.rename(temporary,file);}
  function check(key,value){if(!validKey(key)||value!==undefined&&(typeof value!=='string'||Buffer.byteLength(value)>128000))throw Error('認証保存データが正しくありません。');}
  return {
    getItem(key){check(key);return run(async()=>{if(memory.has(key))return memory.get(key);await load();if(!values[key])return null;if(!await safeStorage.isAsyncEncryptionAvailable())throw Error('安全な認証保存を利用できません。');const {result,shouldReEncrypt}=await safeStorage.decryptStringAsync(Buffer.from(values[key],'base64'));if(shouldReEncrypt){values[key]=(await safeStorage.encryptStringAsync(result)).toString('base64');await save();}return result;});},
    setItem(key,value){check(key,value);return run(async()=>{await load();if(!Object.hasOwn(values,key)&&!memory.has(key)&&Object.keys(values).length+memory.size>=32)throw Error('認証保存の上限です。ログインをやり直してください。');if(!await safeStorage.isAsyncEncryptionAvailable()){memory.set(key,value);return;}values[key]=(await safeStorage.encryptStringAsync(value)).toString('base64');await save();memory.delete(key);});},
    removeItem(key){check(key);return run(async()=>{memory.delete(key);await load();if(Object.hasOwn(values,key)){delete values[key];await save();}});}
  };
}
module.exports={createAuthVault,validKey};
