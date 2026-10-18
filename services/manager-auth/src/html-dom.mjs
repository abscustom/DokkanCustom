import {DOMParser as InertDOMParser,Element} from 'linkedom';
import {parse,serialize,serializeOuter} from 'parse5';
const serializers=new WeakMap();
const treeAdapter={
  isElementNode:node=>node.nodeType===1,
  isTextNode:node=>node.nodeType===3,
  isCommentNode:node=>node.nodeType===8,
  isDocumentTypeNode:node=>node.nodeType===10,
  getTagName:node=>node.localName,
  getNamespaceURI:node=>node.namespaceURI,
  getChildNodes:node=>node.childNodes,
  getParentNode:node=>node.parentNode,
  getTemplateContent:node=>node.content,
  getAttrList:node=>Array.from(node.attributes,attr=>({name:attr.name,value:attr.value})),
  getTextNodeContent:node=>node.data,
  getCommentNodeContent:node=>node.data,
  getDocumentTypeNodeName:node=>node.name
};
// Linkedom's default serializer does not escape attribute ampersands like a
// browser. Use the HTML standard serializer for the DOM reads used by the linker.
for(const [property,get] of [['innerHTML',function(){return serialize(this,{treeAdapter});}],['outerHTML',function(){const html=serializeOuter(this,{treeAdapter});if(this.localName==='html')serializers.get(this.ownerDocument)?.('<!DOCTYPE html>\n'+html,this.ownerDocument);return html;}]]) {
  Object.defineProperty(Element.prototype,property,{...Object.getOwnPropertyDescriptor(Element.prototype,property),get});
}
// Match the browser's HTML5 tree construction before using the shared DOM edits.
// No scripts, resources, event handlers, or custom elements are evaluated.
export class DOMParser {
  parseFromString(html,type) {
    if (type !== 'text/html') throw new Error('Only inert HTML documents are supported');
    return new InertDOMParser().parseFromString(serialize(parse(html)),type);
  }
}
// Scope the cache to one operation. Reuse a just-serialized document for the JSON
// mirror and validation reads; invalidate its old input key after mutations.
export function createDOMContext() {
  const cache=new Map();
  const register=(html,doc)=>{for(const [key,value]of cache)if(value===doc)cache.delete(key);cache.set(html,doc);};
  return class extends DOMParser {
    parseFromString(html,type) {
      if(cache.has(html))return cache.get(html);
      const doc=super.parseFromString(html,type);serializers.set(doc,register);cache.set(html,doc);return doc;
    }
  };
}
