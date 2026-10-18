import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DOMParser} from '../src/html-dom.mjs';
import '../../../js/manager-card-transforms.js';
const transform=globalThis.createManagerCardTransforms({DOMParser});

test('shared server transforms match previously recorded browser HTML/JSON byte for byte',()=>{
  const previous=JSON.parse(fs.readFileSync(new URL('../../../docs/abs-refresh/reports/manager-linker-evidence/manager-selection-clarity-regression.json',import.meta.url),'utf8'))[0].writes[0].files;
  const cards=[],files=new Map();
  for(const slug of ['alpha','beta','gamma']){
    const name=slug[0].toUpperCase()+slug.slice(1),url=`https://abscustom.github.io/Custom%20Cards/${slug}/`;
    const data={inputs:{nameInput:name,descInput:'Isolated test fixture'},currentType:'phy',currentRarity:'TUR',formsData:[{name,link:url}],unrelated:{preserve:true},containers:{links:'GAMEPLAY LINKS UNCHANGED'}};
    const html=`<!DOCTYPE html><html><head><title>${name}</title></head><body><script id="card-data" type="application/json">${JSON.stringify(data)}</script><div id="card-link-container">GAMEPLAY LINKS UNCHANGED</div></body></html>`;
    const card=transform.parseCard(slug,html,`Custom Cards/${slug}`);cards.push(card);files.set(slug,{html,json:JSON.stringify(data)});
  }
  for(const target of cards.slice(1)){
    const a=files.get('alpha'),b=files.get(target.slug),source=cards[0];
    a.html=transform.updateLinkedHtml(a.html,source,target,true,false);b.html=transform.updateLinkedHtml(b.html,target,source,true,false);
    a.json=transform.updateLinkedJson(a.json,a.html,target,true,source);b.json=transform.updateLinkedJson(b.json,b.html,source,true,target);
  }
  for(const [slug,file]of files){assert.equal(file.html,previous[`Custom Cards/${slug}/index.html`]);assert.equal(file.json,previous[`Custom Cards/${slug}/card.json`]);}
});

test('legacy rendered forms retain self, placeholder adoption, adopted href restore and unrelated markup',()=>{
  const source={slug:'alpha',name:'Alpha',repoPath:'Custom Cards/alpha',url:'https://abscustom.github.io/Custom%20Cards/alpha/',thumb:'https://abscustom.github.io/alpha.png',type:'phy',frame:'frame.png',rarity:'rarity.png',typeIcon:'type.png'};
  const target={...source,slug:'beta',name:'Beta',repoPath:'Custom Cards/beta',url:'https://abscustom.github.io/Custom%20Cards/beta/',thumb:'https://abscustom.github.io/beta.png'};
  const row=(card,href)=>`<div class="dokkan-card"><a class="form-link" href="${href}"><img class="form-image" src="${card.thumb}"></a><span class="form-name">${card.name}</span></div>`;
  const html=`<!doctype html><html><head><title>Alpha</title></head><body><div id="forms-card-wrapper"><div id="forms-container">${row(source,source.url)}${row(target,'https://abscustom.github.io/old/')}</div></div><div id="unrelated">KEEP THIS</div></body></html>`;
  const saved=transform.updateLinkedHtml(html,source,target,true);
  const doc=new DOMParser().parseFromString(saved,'text/html');
  assert.equal(doc.querySelectorAll('.dokkan-card').length,2);assert.equal(doc.querySelectorAll('[data-admin-linked-slug="beta"]').length,1);
  assert.equal(doc.querySelector('.form-link').getAttribute('href'),source.url);
  const restored=new DOMParser().parseFromString(transform.updateLinkedHtml(saved,source,target,false),'text/html');
  assert.equal(restored.querySelectorAll('.form-link')[1].getAttribute('href'),'https://abscustom.github.io/old/');assert.equal(restored.querySelector('#unrelated').textContent,'KEEP THIS');
});
