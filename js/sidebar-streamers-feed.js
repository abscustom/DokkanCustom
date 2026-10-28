/* Existing Home streamer polling, shared once across the ABS navigation shell. */
(() => {
    'use strict';
    if (window.ABSSidebarFeed) return;
    const CHANNELS = [
        { twitch:'theironcane', youtube:'ironcane', displayName:'Iron' },
        { twitch:'datruthdt', youtube:'datruthdt', displayName:'DaTruthDT' },
        { twitch:'toonrami', youtube:'ToonRami', displayName:'Toon' },
        { twitch:'slaybix', youtube:'slaybix', displayName:'Slay' },
        { twitch:'nanogenix', youtube:'Nanogenix', displayName:'Nano' },
        { youtube:'Goresh', displayName:'Goresh', youtubeOnly:true }
    ];
    let timer = null;
    let pending = null;
    let latest = CHANNELS.map((item,index)=>({...item,originalIndex:index,isLive:false,status:item.youtubeOnly?'not-applicable':'checking',avatar:null}));
    function render() {
        const slot=document.getElementById('abs-sidebar-twitch');
        if (!slot || !window.ABSSidebarTwitch) return;
        window.ABSSidebarTwitch.mount(slot);
        window.ABSSidebarTwitch.update(latest);
    }
    async function refresh() {
        if (pending) return pending;
        render();
        pending=(async()=>{
            const results=await Promise.allSettled(CHANNELS.map(async(item,originalIndex)=>{
                if(item.youtubeOnly)return {...item,originalIndex,isLive:false,status:'not-applicable',avatar:`https://unavatar.io/youtube/${item.youtube}`};
                const read=async url=>{const response=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error(`Channel status HTTP ${response.status}`);return response.text();};
                const previous=latest.find(entry=>entry.twitch===item.twitch);
                const [uptime,avatar]=await Promise.allSettled([read(`https://decapi.me/twitch/uptime/${item.twitch}`),previous?.avatar ? Promise.resolve(previous.avatar) : read(`https://decapi.me/twitch/avatar/${item.twitch}`)]);
                const text=(uptime.status==='fulfilled'?uptime.value:'').trim();
                const avatarUrl=(avatar.status==='fulfilled'?avatar.value:'').trim();
                const offline=/\boffline\b|\bnot live\b/i.test(text);
                const live=!offline && /\d.*\b(?:seconds?|minutes?|hours?|days?)\b/i.test(text) && !/error|not found|does not exist/i.test(text);
                const confirmed=offline||live;
                const recent=previous?.checkedAt && Date.now()-previous.checkedAt<600000;
                return {...item,originalIndex,isLive:confirmed?live:recent?previous.isLive:false,status:confirmed?(offline?'offline':'live'):recent?previous.status:'checking',stale:!confirmed,checkedAt:confirmed?Date.now():previous?.checkedAt,uptime:live?text:null,avatar:/^https:\/\//i.test(avatarUrl)?avatarUrl:previous?.avatar||null};
            }));
            latest=results.map((result,index)=>result.status==='fulfilled'?result.value:{...CHANNELS[index],originalIndex:index,isLive:false,status:'error',avatar:null});
            latest.sort((first,second)=>Number(second.isLive)-Number(first.isLive)||first.originalIndex-second.originalIndex);
            render();
        })().finally(()=>{pending=null;});
        return pending;
    }
    function start() {
        if(!document.getElementById('abs-sidebar-twitch')||!window.ABSSidebarTwitch)return;
        render();
        if(timer!==null)return;
        void refresh();
        timer=setInterval(refresh,120000);
    }
    function stop() { if(timer!==null)clearInterval(timer);timer=null; }
    window.ABSSidebarFeed={start,stop,refresh};
    window.addEventListener('abs-shell-ready',start);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
