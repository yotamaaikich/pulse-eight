export function desktopAuthStorage(vault,legacy=globalThis.localStorage){
  return {
    async getItem(key){const saved=await vault.getItem(key);if(saved!==null){legacy?.removeItem(key);return saved;}const old=legacy?.getItem(key)??null;if(old!==null){await vault.setItem(key,old);legacy.removeItem(key);}return old;},
    async setItem(key,value){await vault.setItem(key,value);legacy?.removeItem(key);},
    async removeItem(key){await vault.removeItem(key);legacy?.removeItem(key);}
  };
}
