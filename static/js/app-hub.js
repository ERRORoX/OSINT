/**
 * OSINT Panel 4.2 home workspace.
 * Keeps navigation/API integration while adding searchable categories and local favorites.
 */
const API="/api";
const TAB_ICONS={
 "domain-tools":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
 "username-tools":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
 "ai-agent":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5a3 3 0 1 0-6 0 4 4 0 0 0-2 6 4 4 0 0 0 1 6 4 4 0 1 0 7 1z"/><path d="M12 5a3 3 0 1 1 6 0 4 4 0 0 1 2 6 4 4 0 0 1-1 6 4 4 0 1 1-7 1z"/></svg>',
 "photo-search":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12" r="3"/><path d="m7 5 2-2h6l2 2"/></svg>',
 history:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19 13.5a7 7 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2.6-1.5L13.5 2h-4L9 5a7 7 0 0 0-2.6 1.5L4 5.5 2 9l2 1.5a7 7 0 0 0 0 3L2 15l2 3.5 2.4-1A7 7 0 0 0 9 19l.5 3h4l.5-3a7 7 0 0 0 2.6-1.5l2.4 1 2-3.5z"/></svg>'
};
const DOMAIN_TOOLS_IDS=["theharvester","domain-search","shodan","subfinder","dnsx"];
const USERNAME_TOOLS_IDS=["sherlock","maigret","social-analyzer","blackbird"];
const TAB_ONLY_TOOL_IDS=["photo-search"];
const HUB_CARDS=[
 {id:"domain-tools",href:"/domain/",title:"Анализ доменов",desc:"WHOIS, DNS, поддомены и открытая инфраструктура.",category:"recon",icon:"◎"},
 {id:"ip-rdap",href:"/p/ip-rdap/",title:"IP / RDAP",desc:"Пассивная информация о публичном IP: сеть, организация-владелец, страна и даты регистрации.",category:"recon",icon:"⌁"},
 {id:"username-tools",href:"/username/",title:"Поиск username",desc:"Проверка публичных профилей по имени пользователя.",category:"recon",icon:"＠"},
 {id:"google-osint",href:"/p/google-osint/",title:"Email OSINT",desc:"Публичные сигналы и проверка доступных источников по email.",category:"identity",icon:"✉"},
 {id:"photo-search",href:"/photo/",title:"Фото OSINT",desc:"Проверка метаданных EXIF, хешей и доступных сведений об изображении.",category:"media",icon:"▧"},
 {id:"grabcam",href:"/p/grabcam/",title:"GrabCam",desc:"Демонстрация получения снимка только после явного разрешения пользователя.",category:"media",icon:"◉"},
 {id:"ai-agent",href:"/p/ai-agent/",title:"ИИ-помощник",desc:"Помощь в планировании и анализе результатов OSINT.",category:"analysis",icon:"✳"},
 {id:"history",href:"/p/history/",title:"История операций",desc:"Просмотр прошлых запусков и сохранённых результатов.",category:"workspace",icon:"◷"},
 {id:"settings",href:"/p/settings/",title:"Настройки и API",desc:"Локальная конфигурация подключённых сервисов.",category:"workspace",icon:"⚙"}
];
let activeFilter="all";
let loadedTools=[];
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function loadTools(){const response=await fetch(API+"/tools",{headers:{Accept:"application/json"}});if(!response.ok)throw new Error("Не удалось загрузить список инструментов");return response.json();}
function iconSpan(id){return TAB_ICONS[id]?'<span class="tab-icon" aria-hidden="true">'+TAB_ICONS[id]+"</span>":"";}
function renderNav(tools){
 const nav=document.getElementById("nav-tools");if(!nav)return;
 const rest=tools.filter(t=>!DOMAIN_TOOLS_IDS.includes(t.id)&&!USERNAME_TOOLS_IDS.includes(t.id)&&!TAB_ONLY_TOOL_IDS.includes(t.id)&&!["instagram-bruter","grabcam","formgrab"].includes(t.id));
 const mk=(id,label,href)=>'<a href="'+(href||("/p/"+encodeURIComponent(id)+"/"))+'" class="tool-link" data-tool-id="'+escapeHtml(id)+'">'+iconSpan(id)+escapeHtml(label)+"</a>";
 nav.innerHTML=mk("domain-tools","Домены","/domain/")+mk("username-tools","Username","/username/")+mk("photo-search","Фото","/photo/")+mk("grabcam","GrabCam","/p/grabcam/")+mk("ai-agent","ИИ")+mk("history","История")+rest.map(t=>mk(t.id,t.name)).join("");
}
function getFavorites(){try{return JSON.parse(localStorage.getItem("osint-panel-favorites")||"[]").filter(x=>typeof x==="string");}catch(_){return[];}}
function setFavorites(items){try{localStorage.setItem("osint-panel-favorites",JSON.stringify(items));}catch(_){}const metric=document.getElementById("metric-favorites");if(metric)metric.textContent=String(items.length);}
function renderHubCards(){
 const host=document.getElementById("hub-cards");if(!host)return;
 const query=(document.getElementById("hub-search")?.value||"").trim().toLocaleLowerCase("ru");
 const favorites=getFavorites();
 const cards=HUB_CARDS.filter(card=>{
  const matches=[card.title,card.desc,card.id,card.category].join(" ").toLocaleLowerCase("ru").includes(query);
  return matches&&(activeFilter==="all"|| (activeFilter==="favorites"?favorites.includes(card.id):card.category===activeFilter));
 });
 host.innerHTML=cards.map((card,index)=>'<article class="hub-card"><div class="hub-card-top"><span class="hub-card-icon" aria-hidden="true">'+card.icon+'</span><span class="hub-card-index">'+String(HUB_CARDS.indexOf(card)+1).padStart(2,"0")+'</span></div><h3 class="hub-card-title">'+escapeHtml(card.title)+'</h3><p class="hub-card-desc">'+escapeHtml(card.desc)+'</p><div class="hub-card-bottom"><a class="hub-card-open" href="'+escapeHtml(card.href)+'">ОТКРЫТЬ РАЗДЕЛ ↗</a><button class="hub-fav" type="button" data-favorite="'+escapeHtml(card.id)+'" aria-label="Добавить в избранное" aria-pressed="'+favorites.includes(card.id)+'">'+(favorites.includes(card.id)?"★":"☆")+"</button></div></article>").join("");
 const empty=document.getElementById("hub-empty");if(empty)empty.hidden=cards.length!==0;
 host.querySelectorAll("[data-favorite]").forEach(button=>button.addEventListener("click",()=>{
  const id=button.dataset.favorite;const next=getFavorites();const updated=next.includes(id)?next.filter(x=>x!==id):[...next,id];setFavorites(updated);renderHubCards();
 }));
}
function wireFilters(){
 document.querySelectorAll("[data-hub-filter]").forEach(button=>button.addEventListener("click",()=>{
  activeFilter=button.dataset.hubFilter;
  document.querySelectorAll("[data-hub-filter]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
  renderHubCards();
 }));
}
function updateHubStatus(tools){
 const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
 const count=tools.length, sections=HUB_CARDS.length;
 set("hub-tool-count",sections+" разделов · "+count+" инструментов");
 ["metric-tools","system-tool-count"].forEach(id=>set(id,String(count)));
 ["metric-sections","system-section-count"].forEach(id=>set(id,String(sections)));
 set("metric-favorites",String(getFavorites().length));
 set("system-state","OK");set("system-state-label","Онлайн");
 set("backend-state","Доступен");
 const backend=document.getElementById("backend-state");if(backend)backend.classList.add("is-online");
 set("system-foot-label","Список модулей успешно загружен");
}
function formatEta(seconds){
 const safe=Math.max(0,Math.ceil(seconds));
 const minutes=Math.floor(safe/60);
 const rest=safe%60;
 return minutes>0?minutes+" мин "+String(rest).padStart(2,"0")+" сек":rest+" сек";
}
function wireUpdater(){
 const button=document.getElementById("btn-check-updates");
 const status=document.getElementById("update-status");
 if(!button||!status)return;
 const panel=document.createElement("div");
 panel.id="update-progress-panel";
 panel.hidden=true;
 panel.style.cssText="display:none;min-width:220px;max-width:360px;padding:10px 12px;margin-top:8px;border:1px solid #26394d;border-radius:10px;background:#0a1420;color:#dce8f4;font-size:12px";
 panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:7px"><span id="update-stage">Подготовка…</span><strong id="update-percent">0%</strong></div><div style="height:7px;border-radius:99px;background:#1c2b3b;overflow:hidden"><div id="update-progress-fill" style="height:100%;width:0%;background:#28b8d8;border-radius:99px;transition:width .35s ease"></div></div><div id="update-eta" style="margin-top:7px;color:#91a8bd">Осталось примерно: рассчитываем…</div>';
 status.insertAdjacentElement("afterend",panel);
 const stage=panel.querySelector("#update-stage");
 const percent=panel.querySelector("#update-percent");
 const fill=panel.querySelector("#update-progress-fill");
 const eta=panel.querySelector("#update-eta");
 let pollHandle=null;
 const stopPolling=()=>{if(pollHandle){clearInterval(pollHandle);pollHandle=null;}};
 const showError=message=>{stopPolling();panel.style.display="none";panel.hidden=true;status.textContent=message;button.disabled=false;};
 button.addEventListener("click",async()=>{
  if(button.disabled)return;
  button.disabled=true;status.textContent="Проверка обновлений…";
  try{
   const checkResponse=await fetch("/api/system/update",{method:"GET",cache:"no-store",headers:{Accept:"application/json"}});
   const check=await checkResponse.json();
   if(!checkResponse.ok)throw new Error(check.error||"Не удалось проверить обновления");
   if(!check.available){status.textContent="Установлена последняя версия.";button.disabled=false;return;}
   const promptText="Доступно обновление ("+check.commits_behind+" коммитов) из тестового канала 4.2. Установить? Перед обновлением будет создана резервная ветка.";
   if(!window.confirm(promptText)){status.textContent="Обновление отложено.";button.disabled=false;return;}
   panel.hidden=false;panel.style.display="block";status.textContent="Обновление выполняется…";
   const startedAt=Date.now();
   let latestProgress=0;
   const installResponse=await fetch("/api/system/update",{method:"POST",cache:"no-store",headers:{"Accept":"application/json","X-Requested-With":"OSINT-Panel"}});
   const started=await installResponse.json();
   if(!installResponse.ok)throw new Error(started.error||"Не удалось запустить обновление");
   const jobId=started.job_id;
   if(!jobId)throw new Error("Сервер не вернул идентификатор обновления");
   const poll=async()=>{
    try{
     const response=await fetch("/api/system/update/status?job_id="+encodeURIComponent(jobId),{cache:"no-store",headers:{Accept:"application/json"}});
     const job=await response.json();
     if(!response.ok)throw new Error(job.error||"Не удалось получить состояние обновления");
     latestProgress=Math.max(latestProgress,Number(job.progress)||0);
     stage.textContent=job.stage||"Обновление…";
     percent.textContent=latestProgress+"%";
     fill.style.width=latestProgress+"%";
     const elapsed=(Date.now()-startedAt)/1000;
     if(latestProgress>=100)eta.textContent="Время выполнения: "+formatEta(elapsed);
     else if(latestProgress>0)eta.textContent="Осталось примерно: "+formatEta(elapsed*(100-latestProgress)/latestProgress);
     else eta.textContent="Осталось примерно: рассчитываем…";
     if(job.state==="error"){showError(job.error||"Ошибка обновления");return;}
     if(job.state==="completed"){
      stopPolling();status.textContent="Обновлено. Сервер автоматически перезапускается…";
      eta.textContent="Готово · время выполнения: "+formatEta(elapsed);
      button.disabled=true;
      return;
     }
    }catch(error){showError(error.message||"Не удалось получить состояние обновления");}
   };
   await poll();
   if(button.disabled===false)return;
   if(panel.style.display==="block"&&latestProgress<100)pollHandle=setInterval(poll,1000);
  }catch(error){showError(error.message||"Ошибка обновления");}
 });
}

function wireHeader(){
 const menuSettings=document.querySelector("#user-menu .app-header-user-menu-item[data-tool-id]");
 if(menuSettings)menuSettings.setAttribute("href","/p/settings/");
}
function renderActivity(){
 const host=document.getElementById("hub-activity");if(!host)return;
 let items=[];try{items=JSON.parse(localStorage.getItem("osint-panel-recent")||"[]");}catch(_){}
 if(!items.length){host.innerHTML='<div class="activity-empty">Пока нет открытых разделов. Запущенные вами модули появятся здесь.</div>';return;}
 host.innerHTML=items.slice(0,5).map(item=>'<a class="activity-item" href="'+escapeHtml(item.href)+'"><span class="activity-symbol">↗</span><span class="activity-copy"><strong>'+escapeHtml(item.title)+'</strong><small>'+escapeHtml(item.when)+'</small></span></a>').join("");
}
function wireActivity(){
 const host=document.getElementById("hub-cards");if(!host)return;
 host.addEventListener("click",event=>{
  const link=event.target.closest(".hub-card-open");if(!link)return;
  const card=link.closest(".hub-card");if(!card)return;
  const title=card.querySelector(".hub-card-title")?.textContent||"Раздел";
  const href=link.getAttribute("href")||"/";
  let items=[];try{items=JSON.parse(localStorage.getItem("osint-panel-recent")||"[]");}catch(_){}
  items=[{title,href,when:"Только что"},...items.filter(item=>item.href!==href)].slice(0,5);
  try{localStorage.setItem("osint-panel-recent",JSON.stringify(items));}catch(_){}
 });
 renderActivity();
}
function wireSearchShortcut(){
 document.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
   event.preventDefault();const input=document.getElementById("hub-search");input?.focus();input?.select();
  }
 });
}
function wireFooterClock(){
 const el=document.getElementById("footer-clock");if(!el)return;
 const update=()=>{el.textContent=new Intl.DateTimeFormat("ru-RU",{hour:"2-digit",minute:"2-digit"}).format(new Date());};
 update();setInterval(update,30000);
}
async function init(){loadedTools=await loadTools();renderNav(loadedTools);renderHubCards();updateHubStatus(loadedTools);document.getElementById("hub-search")?.addEventListener("input",renderHubCards);wireFilters();wireHeader();wireUpdater();wireActivity();wireSearchShortcut();wireFooterClock();}
init().catch(error=>{const message=error?.message||"Нет связи с сервером";const main=document.getElementById("main-content");if(main)main.insertAdjacentHTML("afterbegin",'<div class="init-error" role="alert"><strong>Ошибка загрузки:</strong> '+escapeHtml(message)+'<p>Проверьте сервер и обновите страницу.</p></div>');});
