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
let loadedNavigation=[];
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function loadTools(){const response=await fetch(API+"/tools",{headers:{Accept:"application/json"}});if(!response.ok)throw new Error("Не удалось загрузить список инструментов");return response.json();}
async function loadNavigation(){
 try{
  const response=await fetch(API+"/navigation",{headers:{Accept:"application/json"},cache:"no-store"});
  if(!response.ok)return [];
  const data=await response.json();
  return Array.isArray(data.modules)?data.modules:[];
 }catch(_){return [];}
}
function applyNavigationModules(items){
 const cardIdMap={"domain-workspace":"domain-tools","username-workspace":"username-tools","photo-workspace":"photo-search"};
 const categoryMap={domain:"recon",network:"recon",identity:"identity",photo:"media",education:"media",utility:"analysis",workspace:"workspace"};
 items.forEach(module=>{
  const cardId=cardIdMap[module.id]||module.id;
  const existing=HUB_CARDS.find(card=>card.id===cardId);
  if(existing){
   existing.href=module.href;
  }else{
   HUB_CARDS.push({
    id:cardId,
    href:module.href,
    title:module.name||module.id,
    desc:module.description||"Модуль OSINT Panel.",
    category:categoryMap[module.category]||"workspace",
    icon:"◈"
   });
  }
 });
}

function iconSpan(id){return TAB_ICONS[id]?'<span class="tab-icon" aria-hidden="true">'+TAB_ICONS[id]+"</span>":"";}
function renderNav(tools){
 const nav=document.getElementById("nav-tools");if(!nav)return;
 const pageById=new Map(loadedNavigation.map(item=>[item.id,item.href]));
 const groups=[
  {label:"ОБЗОР",ids:[],cards:[]},
  {label:"РАЗВЕДКА",ids:["domain-tools","ip-rdap"],cards:["domain-tools","ip-rdap"]},
  {label:"ИДЕНТИФИКАТОРЫ",ids:["username-tools","google-osint"],cards:["username-tools","google-osint"]},
  {label:"МЕДИА",ids:["photo-search","grabcam"],cards:["photo-search","grabcam"]},
  {label:"АНАЛИЗ",ids:["ai-agent"],cards:["ai-agent"]},
  {label:"РАБОЧЕЕ МЕСТО",ids:["history","settings"],cards:["history","settings"]}
 ];
 const cardById=new Map(HUB_CARDS.map(card=>[card.id,card]));
 const workspaceHrefs={
  "domain-tools":pageById.get("domain-workspace"),
  "username-tools":pageById.get("username-workspace"),
  "photo-search":pageById.get("photo-workspace")
 };
 const makeLink=(id,label,href,icon)=>'<a href="'+escapeHtml(href)+'" class="tool-link" data-tool-id="'+escapeHtml(id)+'" title="'+escapeHtml(label)+'">'+(iconSpan(id)||'<span class="tab-icon sidebar-generic-icon" aria-hidden="true">'+(icon||"◈")+'</span>')+'<span class="sidebar-link-label">'+escapeHtml(label)+'</span></a>';
 const chunks=[];
 chunks.push('<div class="sidebar-group"><div class="sidebar-group-label">ОБЗОР</div>'+makeLink("overview","Главная","/","⌂")+'</div>');
 groups.slice(1).forEach(group=>{
  const links=group.cards.map(id=>{
   const card=cardById.get(id);if(!card)return "";
   const canonical=workspaceHrefs[id]||pageById.get(id);
   return makeLink(id,card.title,canonical||card.href,card.icon);
  }).join("");
  if(links)chunks.push('<div class="sidebar-group"><div class="sidebar-group-label">'+group.label+'</div>'+links+'</div>');
 });
 const known=new Set(groups.flatMap(group=>group.ids));
 const extras=tools.filter(tool=>!known.has(tool.id)&&!["instagram-bruter","anonsms","formgrab","grabcam"].includes(tool.id));
 if(extras.length)chunks.push('<div class="sidebar-group"><div class="sidebar-group-label">ДОПОЛНИТЕЛЬНО</div>'+extras.map(tool=>makeLink(tool.id,tool.name,"/p/"+encodeURIComponent(tool.id)+"/", "◈")).join("")+'</div>');
 nav.innerHTML=chunks.join("");
 nav.querySelectorAll(".tool-link").forEach(link=>{
  const href=new URL(link.href,location.origin);
  if(href.pathname===location.pathname){link.classList.add("active");link.setAttribute("aria-current","page");}
  link.addEventListener("click",()=>{document.getElementById("app-shell")?.classList.remove("sidebar-open");document.getElementById("sidebar-toggle")?.setAttribute("aria-expanded","false");});
 });
}
function getFavorites(){try{return JSON.parse(localStorage.getItem("osint-panel-favorites")||"[]").filter(x=>typeof x==="string");}catch(_){return[];}}
function setFavorites(items){try{localStorage.setItem("osint-panel-favorites",JSON.stringify(items));}catch(_){}}
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
function updateHubStatus(tools){const toolCount=document.getElementById("metric-tools");const sectionCount=document.getElementById("metric-sections");const categoryCount=document.getElementById("metric-categories");if(toolCount)toolCount.textContent=String(tools.length);if(sectionCount)sectionCount.textContent=String(HUB_CARDS.length);if(categoryCount)categoryCount.textContent=String(new Set(HUB_CARDS.map(card=>card.category)).size);}
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
 panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:7px"><span id="update-stage">Подготовка…</span><strong id="update-percent">0%</strong></div><div style="height:7px;border-radius:99px;background:#1c2b3b;overflow:hidden"><div id="update-progress-fill" style="height:100%;width:0%;background:#28b8d8;border-radius:99px;transition:width .35s ease"></div></div><div style="display:flex;justify-content:space-between;gap:10px;margin-top:7px;color:#91a8bd"><span id="update-eta">Осталось примерно: рассчитываем…</span><span id="update-elapsed">Прошло: 0 сек.</span></div>';
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

function wireSidebar(){
 const shell=document.getElementById("app-shell");
 const openButton=document.getElementById("sidebar-toggle");
 const collapseButton=document.getElementById("sidebar-collapse");
 const backdrop=document.getElementById("sidebar-backdrop");
 if(!shell||!openButton||!collapseButton)return;
 let collapsed=false;
 try{collapsed=localStorage.getItem("osint-sidebar-collapsed")==="1";}catch(_){}
 shell.classList.toggle("sidebar-collapsed",collapsed);
 collapseButton.setAttribute("aria-pressed",String(collapsed));
 collapseButton.textContent=collapsed?"›":"‹";
 const closeMobile=()=>{shell.classList.remove("sidebar-open");openButton.setAttribute("aria-expanded","false");};
 openButton.addEventListener("click",()=>{
  const open=shell.classList.toggle("sidebar-open");
  openButton.setAttribute("aria-expanded",String(open));
 });
 collapseButton.addEventListener("click",()=>{
  collapsed=!shell.classList.contains("sidebar-collapsed");
  shell.classList.toggle("sidebar-collapsed",collapsed);
  collapseButton.setAttribute("aria-pressed",String(collapsed));
  collapseButton.textContent=collapsed?"›":"‹";
  try{localStorage.setItem("osint-sidebar-collapsed",collapsed?"1":"0");}catch(_){}
 });
 backdrop?.addEventListener("click",closeMobile);
 document.addEventListener("keydown",event=>{if(event.key==="Escape")closeMobile();});
 window.addEventListener("resize",()=>{if(window.innerWidth>760)closeMobile();});
}
function wireHeader(){
 const menuSettings=document.querySelector("#user-menu .app-header-user-menu-item[data-tool-id]");if(menuSettings)menuSettings.setAttribute("href","/p/settings/");
 const btn=document.getElementById("btn-user-menu"),menu=document.getElementById("user-menu");
 if(btn&&menu){btn.addEventListener("click",()=>{const open=btn.getAttribute("aria-expanded")==="true";btn.setAttribute("aria-expanded",String(!open));menu.hidden=open;});document.addEventListener("click",event=>{if(!btn.contains(event.target)&&!menu.contains(event.target)){btn.setAttribute("aria-expanded","false");menu.hidden=true;}});}
}
async function init(){
 const results=await Promise.all([loadTools(),loadNavigation()]);
 loadedTools=results[0];
 loadedNavigation=results[1];
 applyNavigationModules(loadedNavigation);
 renderNav(loadedTools);
 renderHubCards();
 updateHubStatus(loadedTools);
 document.getElementById("hub-search")?.addEventListener("input",renderHubCards);
 wireFilters();
 wireHeader();
 wireSidebar();
 wireUpdater();
}
init().catch(error=>{const message=error?.message||"Нет связи с сервером";const main=document.getElementById("main-content");if(main)main.insertAdjacentHTML("afterbegin",'<div class="init-error" role="alert"><strong>Ошибка загрузки:</strong> '+escapeHtml(message)+'<p>Проверьте сервер и обновите страницу.</p></div>');});
