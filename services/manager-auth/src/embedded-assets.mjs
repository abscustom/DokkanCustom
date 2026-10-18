import { random } from './security.mjs';
// Treat large data URLs as opaque strings during DOM/JSON edits. Restore their
// original bytes before Git serialization. This does not rewrite stored assets.
export function assetMask() {
  const prefix=`https://abscustom.github.io/__manager_opaque_${random(16)}_`;
  const byValue=new Map(), byMarker=new Map();
  const mask=text=>String(text).replace(/data:(?:image|audio|video)\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=_-]{512,}/g,value=>{
    if (!byValue.has(value)) { const marker=prefix+byValue.size;byValue.set(value,marker);byMarker.set(marker,value); }
    return byValue.get(value);
  });
  const restore=text=>String(text).replace(new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[0-9]+','g'),value=>byMarker.get(value)||value);
  const card=value=>Object.fromEntries(Object.entries(value).map(([key,item])=>[key,typeof item==='string'?mask(item):item]));
  return {mask,restore,card};
}
