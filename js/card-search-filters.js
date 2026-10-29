/* Additional catalog filters. Display text is searchable evidence, never game logic. */
(() => {
    const selected = { awakening:'all', class:'all', mechanics:new Set(), links:new Set() };
    const metadata = new Map();
    const mechanics = {
        Revive:/reviv|revival/i, 'Additional Attack':/additional.*attack/i,
        Absorption:/absorb/i, 'Damage Reduction':/damage reduction|reduces damage received/i,
        Evasion:/evad|dodg/i, Guard:/guard/i, Counter:/counter/i,
        'Critical Hit':/critical hit/i, Healing:/recover.*HP|restores.*HP/i,
        Domain:/domain|dokkan field/i, Standby:/standby/i, Transformation:/transform/i
    };
    const matches = card => {
        const awakening = card.isSeza ? 'seza' : card.isEza ? 'eza' : 'none';
        if(selected.awakening!=='all' && selected.awakening!==awakening)return false;
        if(selected.class!=='all' && selected.class!==String(card.cardClass||'').toLowerCase())return false;
        const data=metadata.get(String(card.id));
        if(selected.mechanics.size && ![...selected.mechanics].some(key=>mechanics[key].test(data?.text||'')))return false;
        if(selected.links.size && ![...selected.links].some(name=>data?.links.includes(name)))return false;
        return true;
    };
    const refresh=()=>window.filterCards?.();
    function mount(host) {
        if(host.querySelector('[data-extra-card-filters]'))return;
        const root=document.createElement('div');root.dataset.extraCardFilters='true';root.className='extra-card-filters';host.append(root);
        const select=(key,label,values)=>{
            const group=document.createElement('label');group.textContent=label;
            const input=document.createElement('select');input.setAttribute('aria-label',label);input.dataset.filterKey=key;
            for(const [value,name] of values){const option=new Option(name,value);input.append(option);}
            input.addEventListener('change',()=>{selected[key]=input.value;refresh();});group.append(input);root.append(group);
        };
        select('awakening','EZA Status',[['all','All'],['none','None'],['eza','EZA'],['seza','Super EZA']]);
        select('class','Class',[['all','All'],['super','Super'],['extreme','Extreme']]);
        const searchable=(key,title,names)=>{
            const section=document.createElement('details');section.className='cards-filter-dropdown';const label=document.createElement('summary');label.textContent=title;
            const input=document.createElement('input');input.type='search';input.placeholder='Search '+title.toLowerCase();input.setAttribute('aria-label',input.placeholder);
            const list=document.createElement('div');list.className='extra-filter-options';
            names.forEach(name=>{const button=document.createElement('button');button.type='button';button.textContent=name;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{selected[key].has(name)?selected[key].delete(name):selected[key].add(name);button.setAttribute('aria-pressed',String(selected[key].has(name)));refresh();});list.append(button);});
            input.addEventListener('input',()=>list.childNodes.forEach(node=>node.hidden=!node.textContent.toLowerCase().includes(input.value.toLowerCase())));
            section.append(label,input,list);root.append(section);
            return section;
        };
        const mechanicSection=searchable('mechanics','Mechanics',Object.keys(mechanics));
        mechanicSection.querySelectorAll('button').forEach(button=>button.disabled=true);
        // Move the live checkbox so the existing KO index, filtering and reset remain authoritative.
        const koInput=document.getElementById('koScreenFilter');
        if(koInput) {
            const option=koInput.closest('label');option.className='mechanic-ko-option';
            option.replaceChildren(koInput,document.createTextNode('KO Screen'));
            mechanicSection.querySelector('.extra-filter-options').append(option);
        }
        const status=document.createElement('p');status.role='status';status.textContent='Loading mechanics and link skills…';root.append(status);
        const base=new URL('../',document.currentScript?.src || new URL('js/card-search-filters.js',document.baseURI));
        const read=async name=>{const r=await fetch(new URL('json/'+name+'.json',base));if(!r.ok)throw Error(name);return Object.values(await r.json());};
        Promise.all([read('cards'),read('passive_skills'),read('active_skills'),read('link_skills')]).then(async ([cards,passives,actives,links])=>{
            const pm=new Map(passives.map(p=>[p.id,p])),am=new Map(actives.map(a=>[a.id,a])),lm=new Map(links.map(l=>[l.id,l.name]));
            for(const card of cards) metadata.set(String(card.id),{text:JSON.stringify([pm.get(card.pass_id),am.get(card.active_id),card.standby_id?'standby':'',card.field_id?'domain':'']),links:(card.links||[]).map(id=>lm.get(id)).filter(Boolean)});
            const linkNames=new Set(links.map(l=>l.name));
            if(window.CardContent?.enabled()) {
                let catalogFailed=false;
                const custom=await window.CardContent.listCards().catch(()=>{catalogFailed=true;return [];});
                const results=await Promise.allSettled(custom.map(c=>window.CardContent.getCard(c.id)));
                for(const result of results)if(result.status==='fulfilled'){
                    const c=result.value,containers=c.payload?.containers||{};
                    const doc=new DOMParser().parseFromString(String(containers.links||''),'text/html');
                    const names=[...doc.querySelectorAll('a, [data-link-name]')].map(n=>n.dataset.linkName||n.textContent.trim()).filter(Boolean);
                    names.forEach(n=>linkNames.add(n));
                    const text=new DOMParser().parseFromString([...Object.entries(containers).filter(([k])=>/passive|active|standby|domain/i.test(k)).map(([,v])=>v),...(c.payload?.activeBlocksHTML||[])].join(' '),'text/html').body.textContent;
                    metadata.set(String(c.id),{text,links:names});
                }
                if(catalogFailed||results.some(r=>r.status==='rejected'))status.textContent='Some custom-card details could not load. Reload to retry.';
                else status.remove();
            } else status.remove();
            mechanicSection.querySelectorAll('button').forEach(button=>button.disabled=false);
            searchable('links','Link skills',[...linkNames].sort());refresh();
        }).catch(()=>{status.textContent='Could not load mechanics and link skills. Reload to retry.';});
    }
    function reset() {
        selected.awakening='all';selected.class='all';selected.mechanics.clear();selected.links.clear();
        document.querySelectorAll('[data-extra-card-filters] select').forEach(n=>n.value='all');
        document.querySelectorAll('[data-extra-card-filters] input').forEach(n=>{n.value='';n.dispatchEvent(new Event('input'));});
        document.querySelectorAll('[data-extra-card-filters] button').forEach(n=>n.setAttribute('aria-pressed','false'));
    }
    window.CardSearchFilters={matches,mount,reset};
})();
