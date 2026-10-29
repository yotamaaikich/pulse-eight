import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {SONGS} from '../engine.mjs';
import {build} from 'esbuild';
const root=new URL('../',import.meta.url);
await fs.mkdir(new URL('vendor/',root),{recursive:true});
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:fileURLToPath(root)},outfile:fileURLToPath(new URL('vendor/supabase.mjs',root)),bundle:true,format:'esm',platform:'browser',target:'chrome120',minify:true,legalComments:'eof'});
await fs.writeFile(new URL('desktop/catalog.json',root),JSON.stringify(SONGS.map(({id,title,duration})=>({id,title,duration}))));
console.log('Bundled auth library and song catalog.');
