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
 const categoryLabels={recon:"РАЗВЕДКА",identity:"ИДЕНТИФИКАТОРЫ",media:"МЕДИА",analysis:"АНАЛИЗ",workspace:"РАБОЧЕЕ МЕСТО"};
 const cards=HUB_CARDS.filter(card=>{
  const matches=[card.title,card.desc,card.id,card.category,categoryLabels[card.category]||""].join(" ").toLocaleLowerCase("ru").includes(query);
  return matches&&(activeFilter==="all"|| (activeFilter==="favorites"?favorites.includes(card.id):card.category===activeFilter));
 });
 const count=document.getElementById("catalog-result-count");
 if(count)count.textContent="Показано "+cards.length+" из "+HUB_CARDS.length+" инструментов";
 const favoriteCount=document.getElementById("catalog-favorite-count");
 if(favoriteCount)favoriteCount.textContent="Избранное: "+favorites.length;
 host.innerHTML=cards.map(card=>{
  const favorite=favorites.includes(card.id);
  const category=categoryLabels[card.category]||"МОДУЛЬ";
  return '<article class="hub-card"><div class="hub-card-top"><span class="hub-card-icon" aria-hidden="true">'+escapeHtml(card.icon)+'</span><span class="hub-card-category">'+category+'</span><span class="hub-card-index">'+String(HUB_CARDS.indexOf(card)+1).padStart(2,"0")+'</span></div><h3 class="hub-card-title">'+escapeHtml(card.title)+'</h3><p class="hub-card-desc">'+escapeHtml(card.desc)+'</p><div class="hub-card-bottom"><a class="hub-card-open" href="'+escapeHtml(card.href)+'">ОТКРЫТЬ РАЗДЕЛ</a><button class="hub-fav" type="button" data-favorite="'+escapeHtml(card.id)+'" aria-label="'+(favorite?"Убрать из избранного":"Добавить в избранное")+'" title="'+(favorite?"Убрать из избранного":"Добавить в избранное")+'" aria-pressed="'+favorite+'">'+(favorite?"★":"☆")+"</button></div></article>";
 }).join("");
 const empty=document.getElementById("hub-empty");if(empty){empty.hidden=cards.length!==0;empty.textContent=activeFilter==="favorites"?"В избранном пока нет инструментов. Нажмите ☆ на карточке, чтобы добавить её сюда.":"Инструменты не найдены. Измените запрос или фильтр.";}
 host.querySelectorAll("[data-favorite]").forEach(button=>button.addEventListener("click",()=>{
  const id=button.dataset.favorite;const next=getFavorites();const updated=next.includes(id)?next.filter(x=>x!==id):[...next,id];setFavorites(updated);renderHubCards();
 }));
}
const RECENT_KEY="osint-panel-recent";
function readRecent(){
 try{
  const items=JSON.parse(localStorage.getItem(RECENT_KEY)||"[]");
  return Array.isArray(items)?items.filter(item=>item&&typeof item.title==="string"&&typeof item.path==="string"&&item.path.startsWith("/")&&!item.path.startsWith("//")).slice(0,5):[];
 }catch(_){return[];}
}
function renderActivity(){
 const host=document.getElementById("hub-activity");if(!host)return;
 const items=readRecent();
 if(!items.length){host.innerHTML='<div class="activity-empty">Здесь появятся недавно открытые разделы.</div>';return;}
 host.innerHTML=items.map(item=>{
  const age=Math.max(0,Date.now()-(Number(item.at)||Date.now()));
  const time=age<60000?"только что":age<3600000?Math.floor(age/60000)+" мин назад":new Date(Number(item.at)||Date.now()).toLocaleDateString("ru-RU",{day:"2-digit",month:"short"});
  return '<a class="activity-item" href="'+escapeHtml(item.path)+'"><span class="activity-symbol">◷</span><span class="activity-copy"><strong>'+escapeHtml(item.title)+'</strong><small>'+time+'</small></span><b>→</b></a>';
 }).join("");
}
function wireActivity(){
 renderActivity();
 document.addEventListener("click",event=>{
  const anchor=event.target.closest("a[href]");if(!anchor)return;
  let target;try{target=new URL(anchor.href,location.origin);}catch(_){return;}
  if(target.origin!==location.origin||!target.pathname.startsWith("/")||target.pathname===location.pathname||target.hash&&!target.pathname)return;
  const title=(anchor.textContent||"").replace(/\s+/g," ").trim()||target.pathname;
  try{
   const next=[{title,path:target.pathname,at:Date.now()},...readRecent().filter(item=>item.path!==target.pathname)].slice(0,5);
   localStorage.setItem(RECENT_KEY,JSON.stringify(next));
  }catch(_){}
 });
}
const WORKSPACE_KEY="osint-panel-workspace-v1";
function readSavedMaterials(){
 try{
  const value=JSON.parse(localStorage.getItem(WORKSPACE_KEY)||"[]");
  return Array.isArray(value)?value.filter(item=>item&&typeof item==="object"&&typeof item.text==="string"):[];
 }catch(_){return null;}
}
function renderSavedMaterials(){
 const list=document.getElementById("saved-materials-list");
 const count=document.getElementById("saved-materials-count");
 if(!list||!count)return;
 const items=readSavedMaterials();
 const exportButton=document.getElementById("saved-materials-export");
 const search=(document.getElementById("saved-materials-search")?.value||"").trim().toLocaleLowerCase("ru");
 if(items===null){count.textContent="Недоступно";if(exportButton)exportButton.disabled=true;list.innerHTML='<div class="saved-materials-empty">Браузер не разрешил доступ к локальному хранилищу.</div>';return;}
 count.textContent=items.length+" материалов";
 if(exportButton)exportButton.disabled=!items.length;
 if(!items.length){list.innerHTML='<div class="saved-materials-empty">Пока нет сохранённых материалов. Откройте инструмент и нажмите «В рабочую область» возле результата.</div>';return;}
 const matches=items.map((item,index)=>({item,index})).filter(({item})=>{
  if(!search)return true;
  return [item.title,item.text,item.page,item.url].join(" ").toLocaleLowerCase("ru").includes(search);
 });
 if(!matches.length){list.innerHTML='<div class="saved-materials-empty">По запросу «'+escapeHtml(search)+'» ничего не найдено. Попробуйте другое слово.</div>';return;}
 const visible=matches.slice(0,20);
 list.innerHTML=visible.map(({item,index})=>{
  const id=escapeHtml(item.id||"");
  const title=escapeHtml(item.title||"Материал без названия");
  const rawPage=String(item.url||"");
  const safePage=rawPage.startsWith("/")&&!rawPage.startsWith("//")?rawPage:"";
  const page=escapeHtml(item.page||rawPage||"");
  const source=safePage?'<a class="saved-material-source-link" href="'+escapeHtml(safePage)+'">'+page+' ↗</a>':'<span class="saved-material-source">'+page+'</span>';
  const time=escapeHtml(item.time||"");
  const preview=escapeHtml(item.text.slice(0,240));
  return '<article class="saved-material-item" data-saved-id="'+id+'" data-saved-index="'+index+'"><div class="saved-material-head"><strong>'+title+'</strong><time>'+time+'</time></div>'+source+'<p>'+preview+'</p><div class="saved-material-actions"><button type="button" data-saved-copy>Копировать</button><button type="button" data-saved-delete>Удалить</button></div></article>';
 }).join("")+(matches.length>visible.length?'<div class="saved-materials-more">Показаны '+visible.length+' из '+matches.length+' найденных материалов.</div>':search?'<div class="saved-materials-more">Найдено: '+matches.length+' из '+items.length+'.</div>':items.length>visible.length?'<div class="saved-materials-more">Показаны '+visible.length+' из '+items.length+'. Полный архив можно сохранить через «Экспорт JSON».</div>':"");
}
function wireSavedMaterials(){
 const list=document.getElementById("saved-materials-list");
 if(!list)return;
 list.addEventListener("click",async event=>{
  const card=event.target.closest("[data-saved-id]");
  if(!card)return;
  const id=card.dataset.savedId;
   const index=Number(card.dataset.savedIndex);
  if(event.target.closest("[data-saved-copy]")){
   const currentItems=readSavedMaterials()||[];
   const item=id?currentItems.find(x=>String(x.id||"")===id):currentItems[index];
   if(!item)return;
   try{await navigator.clipboard.writeText(item.text);event.target.textContent="Скопировано";}
   catch(_){event.target.textContent="Недоступно";}
  }
  if(event.target.closest("[data-saved-delete]")){
   const items=readSavedMaterials();
   if(items===null)return;
   try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify(items.filter((x,i)=>id?String(x.id||"")!==id:i!==index)));renderSavedMaterials();renderCaseProjects();}
   catch(_){event.target.textContent="Ошибка";}
  }
 });
 const exportButton=document.getElementById("saved-materials-export");
  if(exportButton)exportButton.addEventListener("click",()=>{
   const items=readSavedMaterials();if(!items||!items.length)return;
   const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),projects:readCaseProjects()||[],materials:items},null,2)],{type:"application/json"});
   const url=URL.createObjectURL(blob);const link=document.createElement("a");
   link.href=url;link.download="osint-panel-materials-"+new Date().toISOString().slice(0,10)+".json";
   document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  });
  window.addEventListener("storage",event=>{if(event.key===WORKSPACE_KEY)renderSavedMaterials();});
 renderSavedMaterials();
}
const CASE_PROJECTS_KEY="osint-panel-cases-v1";
function readCaseProjects(){
 try{const value=JSON.parse(localStorage.getItem(CASE_PROJECTS_KEY)||"[]");return Array.isArray(value)?value.filter(x=>x&&typeof x==="object"&&typeof x.id==="string"):[];}
 catch(_){return null;}
}
function writeCaseProjects(items){
 try{localStorage.setItem(CASE_PROJECTS_KEY,JSON.stringify(items.slice(0,100)));return true;}catch(_){return false;}
}
function renderCaseProjects(){
 const list=document.getElementById("case-project-list"),count=document.getElementById("case-project-count");
 if(!list||!count)return;
 const projects=readCaseProjects(),materials=readSavedMaterials()||[];
 if(projects===null){count.textContent="Недоступно";list.innerHTML='<div class="saved-materials-empty">Нет доступа к локальному хранилищу.</div>';return;}
 count.textContent=projects.length+" дел";
 if(!projects.length){list.innerHTML='<div class="saved-materials-empty">Пока нет дел. Создайте первое расследование выше.</div>';return;}
 list.innerHTML=projects.map(project=>{
  const id=escapeHtml(project.id),name=escapeHtml(project.name||"Без названия");
  const note=escapeHtml(project.note||"");
  const attached=Array.isArray(project.materialIds)?project.materialIds:[];
  const attachedItems=materials.filter(item=>attached.includes(String(item.id||"")));
  const options=materials.map(item=>'<option value="'+escapeHtml(item.id||"")+'">'+escapeHtml(item.title||"Материал без названия")+'</option>').join("");
  const materialList=attachedItems.length?'<ul class="case-attached-list">'+attachedItems.map(item=>'<li>'+escapeHtml(item.title||"Материал")+'</li>').join("")+'</ul>':'<div class="case-project-muted">Материалы пока не прикреплены.</div>';
  return '<article class="case-project-card" data-case-id="'+id+'"><div class="case-project-card-head"><div><span class="case-project-id">CASE / '+id.slice(0,8).toUpperCase()+'</span><h3>'+name+'</h3></div><button type="button" class="case-project-delete" data-case-delete>Удалить дело</button></div><label class="case-project-field"><span>Рабочие заметки</span><textarea data-case-note rows="3" maxlength="3000">'+note+'</textarea></label><div class="case-project-actions"><button type="button" class="saved-material-export" data-case-save-note>Сохранить заметку</button><span class="case-project-muted">'+attachedItems.length+' материалов</span></div><div class="case-project-attach"><label class="case-project-field"><span>Прикрепить сохранённый материал</span><select data-case-material><option value="">Выберите материал…</option>'+options+'</select></label><button type="button" class="saved-material-export" data-case-attach '+(materials.length?'':'disabled')+'>Прикрепить</button></div>'+materialList+'</article>';
 }).join("");
}
function wireCaseProjects(){
 const form=document.getElementById("case-project-form"),list=document.getElementById("case-project-list");
 if(!form||!list)return;
 form.addEventListener("submit",event=>{
  event.preventDefault();
  const name=document.getElementById("case-project-name").value.trim();
  const note=document.getElementById("case-project-note").value.trim();
  if(!name)return;
  const projects=readCaseProjects();if(projects===null)return;
  const id=window.crypto&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2,9);
  if(!writeCaseProjects([{id,name,note,materialIds:[],createdAt:new Date().toISOString()},...projects])){alert("Не удалось создать дело: локальное хранилище недоступно или заполнено.");return;}
  form.reset();renderCaseProjects();
 });
 list.addEventListener("click",event=>{
  const card=event.target.closest("[data-case-id]");if(!card)return;
  const id=card.dataset.caseId,projects=readCaseProjects();if(projects===null)return;
  const project=projects.find(item=>item.id===id);if(!project)return;
  if(event.target.closest("[data-case-delete]")){
   if(!confirm("Удалить это дело? Сохранённые материалы останутся в общем архиве."))return;
   writeCaseProjects(projects.filter(item=>item.id!==id));renderCaseProjects();return;
  }
  if(event.target.closest("[data-case-save-note]")){
   project.note=card.querySelector("[data-case-note]").value;
   if(writeCaseProjects(projects)){event.target.textContent="Сохранено ✓";setTimeout(()=>{if(event.target.isConnected)event.target.textContent="Сохранить заметку";},1400);}
   return;
  }
  if(event.target.closest("[data-case-attach]")){
   const selected=card.querySelector("[data-case-material]").value;if(!selected)return;
   project.materialIds=Array.isArray(project.materialIds)?project.materialIds:[];
   if(!project.materialIds.includes(selected))project.materialIds.push(selected);
   if(writeCaseProjects(projects))renderCaseProjects();
  }
 });
 window.addEventListener("storage",event=>{if(event.key===CASE_PROJECTS_KEY||event.key===WORKSPACE_KEY)renderCaseProjects();});
 renderCaseProjects();
}
function wireShowAllTools(){
 const link=document.getElementById("show-all-tools");if(!link)return;
 link.addEventListener("click",()=>{
  activeFilter="all";
  const search=document.getElementById("hub-search");if(search)search.value="";
  document.querySelectorAll("[data-hub-filter]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.hubFilter==="all")));
  renderHubCards();
 });
}
function wireFilters(){
 document.querySelectorAll("[data-hub-filter]").forEach(button=>button.addEventListener("click",()=>{
  activeFilter=button.dataset.hubFilter;
  document.querySelectorAll("[data-hub-filter]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
  renderHubCards();
 }));
}
function updateHubStatus(tools,backendAvailable=true){
 const toolCount=document.getElementById("metric-tools");
 const sectionCount=document.getElementById("metric-sections");
 const categoryCount=document.getElementById("metric-categories");
 const railTools=document.getElementById("rail-tools");
 const railModules=document.getElementById("rail-modules");
 const backend=document.getElementById("backend-state");
 const state=document.getElementById("system-state");
 const stateLabel=document.getElementById("system-state-label");
 const foot=document.getElementById("system-foot-label");
 if(toolCount)toolCount.textContent=String(tools.length);
 if(sectionCount)sectionCount.textContent=String(HUB_CARDS.length);
 if(categoryCount)categoryCount.textContent=String(new Set(HUB_CARDS.map(card=>card.category)).size);
 if(railTools)railTools.textContent=String(tools.length);
 if(railModules)railModules.textContent=loadedNavigation.length?String(loadedNavigation.length):"Нет данных";
 if(backend)backend.textContent=backendAvailable?"Работает":"Недоступен";
 if(state)state.textContent=backendAvailable?"OK":"OFF";
 if(stateLabel)stateLabel.textContent=backendAvailable?"Онлайн":"Нет связи";
 if(foot)foot.textContent=backendAvailable?"Сервер отвечает · каталог загружен":"Сервер недоступен · показан локальный каталог";
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
 panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:7px"><span id="update-stage">Подготовка…</span><strong id="update-percent">0%</strong></div><div style="height:7px;border-radius:99px;background:#1c2b3b;overflow:hidden"><div id="update-progress-fill" style="height:100%;width:0%;background:#28b8d8;border-radius:99px;transition:width .35s ease"></div></div><div style="display:flex;justify-content:space-between;gap:10px;margin-top:7px;color:#91a8bd"><span id="update-eta">Осталось примерно: рассчитываем…</span><span id="update-elapsed">Прошло: 0 сек.</span></div>';
 status.insertAdjacentElement("afterend",panel);
 const stage=panel.querySelector("#update-stage");
 const percent=panel.querySelector("#update-percent");
 const fill=panel.querySelector("#update-progress-fill");
 const eta=panel.querySelector("#update-eta");
 let pollHandle=null;
 let finished=false;
 const stopPolling=()=>{if(pollHandle){clearInterval(pollHandle);pollHandle=null;}};
 const showError=message=>{finished=true;stopPolling();panel.style.display="none";panel.hidden=true;status.textContent=message;button.disabled=false;};
 button.addEventListener("click",async()=>{
  if(button.disabled)return;
  button.disabled=true;status.textContent="Проверка обновлений…";
  try{
   const checkResponse=await fetch("/api/system/update",{method:"GET",cache:"no-store",headers:{Accept:"application/json"}});
   const check=await checkResponse.json();
   if(!checkResponse.ok)throw new Error(check.error||"Не удалось проверить обновления");
   if(!check.available){status.textContent="Установлена последняя версия.";button.disabled=false;return;}
   status.textContent="Доступно обновление ("+check.commits_behind+" коммитов). Запускаю установку…";
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
     latestProgress=Math.max(latestProgress,Math.min(100,Number(job.progress)||0));
     stage.textContent=job.stage||"Обновление…";
     percent.textContent=latestProgress+"%";
     fill.style.width=latestProgress+"%";
     const elapsed=(Date.now()-startedAt)/1000;
     if(latestProgress>=100)eta.textContent="Время выполнения: "+formatEta(elapsed);
     else if(latestProgress>0)eta.textContent="Осталось примерно: "+formatEta(elapsed*(100-latestProgress)/latestProgress);
     else eta.textContent="Осталось примерно: рассчитываем…";
     if(job.state==="error"){showError(job.error||"Ошибка обновления");return;}
     if(job.state==="completed"){
      finished=true;stopPolling();status.textContent="Обновлено. Сервер автоматически перезапускается…";
      eta.textContent="Готово · время выполнения: "+formatEta(elapsed);
      button.disabled=true;
      return;
     }
    }catch(error){showError(error.message||"Не удалось получить состояние обновления");}
   };
   await poll();
   if(!finished)pollHandle=setInterval(poll,1000);
  }catch(error){showError(error.message||"Ошибка обновления");}
 });
}

function wireHeader(){
 const menuSettings=document.querySelector("#user-menu .app-header-user-menu-item[data-tool-id]");if(menuSettings)menuSettings.setAttribute("href","/p/settings/");
 const btn=document.getElementById("btn-user-menu"),menu=document.getElementById("user-menu");
 if(btn&&menu){btn.addEventListener("click",()=>{const open=btn.getAttribute("aria-expanded")==="true";btn.setAttribute("aria-expanded",String(!open));menu.hidden=open;});document.addEventListener("click",event=>{if(!btn.contains(event.target)&&!menu.contains(event.target)){btn.setAttribute("aria-expanded","false");menu.hidden=true;}});}
}
function showInitNotice(message){
 const main=document.getElementById("main-content");
 if(!main)return;
 let notice=main.querySelector(".init-error");
 if(!notice){notice=document.createElement("div");notice.className="init-error";notice.setAttribute("role","alert");main.insertBefore(notice,main.firstChild);}
 notice.textContent=message;
}

// Interactive relationship graph — homepage only. Demo entities are fictional examples.
const GRAPH_STORAGE_KEY="osint-panel-graph-data-v1";
const GRAPH_TYPES=["person","domain","ip","email","organization"];
const GRAPH_TYPE_LABELS={person:"Человек",domain:"Домен",ip:"IP-адрес",email:"Email",organization:"Организация"};
const GRAPH_DEMO={
 nodes:[
  {id:"p1",type:"person",label:"Демо-объект 01",details:"Вымышленная сущность для демонстрации интерфейса.",x:365,y:190},
  {id:"d1",type:"domain",label:"example.test",details:"Зарезервированный тестовый домен.",x:175,y:85},
  {id:"i1",type:"ip",label:"192.0.2.10",details:"Тестовый IP-адрес из документационного диапазона.",x:565,y:80},
  {id:"e1",type:"email",label:"analyst@example.test",details:"Демонстрационный адрес электронной почты.",x:150,y:305},
  {id:"o1",type:"organization",label:"Demo Org",details:"Вымышленная организация.",x:570,y:305},
  {id:"i2",type:"ip",label:"198.51.100.24",details:"Тестовый IP-адрес из документационного диапазона.",x:365,y:365}
 ],
 edges:[
  {source:"p1",target:"d1",label:"упоминается рядом"},
  {source:"d1",target:"i1",label:"пример DNS-связи"},
  {source:"p1",target:"e1",label:"пример контакта"},
  {source:"p1",target:"o1",label:"пример связи"},
  {source:"o1",target:"i2",label:"пример инфраструктуры"},
  {source:"d1",target:"e1",label:"демо-связь"}
 ]
};
let graphData=GRAPH_DEMO,graphScale=1,graphPan={x:0,y:0},graphSelected=null,graphDrag=null;
function graphReadLocal(){try{const value=JSON.parse(localStorage.getItem(GRAPH_STORAGE_KEY)||"null");return value&&Array.isArray(value.nodes)&&Array.isArray(value.edges)?value:null;}catch{return null;}}
function graphValidate(value){
 if(!value||!Array.isArray(value.nodes)||!Array.isArray(value.edges))throw new Error("Ожидаются массивы nodes и edges.");
 if(value.nodes.length>250||value.edges.length>500)throw new Error("Лимит: 250 узлов и 500 связей.");
 const ids=new Set();
 const nodes=value.nodes.map((node,index)=>{
  if(!node||typeof node!=="object")throw new Error("Некорректный узел №"+(index+1)+".");
  const id=String(node.id||"").trim(),type=String(node.type||"").toLowerCase(),label=String(node.label||"").trim();
  if(!id||id.length>80||ids.has(id))throw new Error("У каждого узла должен быть уникальный id (до 80 символов).");
  if(!GRAPH_TYPES.includes(type))throw new Error("Неизвестный тип узла: "+type);
  if(!label||label.length>180)throw new Error("Название узла обязательно (до 180 символов).");
  ids.add(id);
  return {id,type,label,details:String(node.details||"").slice(0,1200),x:Number.isFinite(Number(node.x))?Math.max(30,Math.min(730,Number(node.x))):100+(index%4)*180,y:Number.isFinite(Number(node.y))?Math.max(35,Math.min(390,Number(node.y))):80+Math.floor(index/4)*120};
 });
 const edges=value.edges.map((edge,index)=>{
  if(!edge||!ids.has(String(edge.source))||!ids.has(String(edge.target)))throw new Error("Связь №"+(index+1)+" ссылается на неизвестный узел.");
  return {source:String(edge.source),target:String(edge.target),label:String(edge.label||"Связь").slice(0,100)};
 });
 return {nodes,edges};
}
function graphSvg(tag,attrs,parent){const el=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs||{}).forEach(([key,value])=>el.setAttribute(key,String(value)));if(parent)parent.appendChild(el);return el;}
function graphApplyTransform(){const viewport=document.getElementById("graph-viewport");if(viewport)viewport.setAttribute("transform","translate("+graphPan.x+" "+graphPan.y+") scale("+graphScale+")");const reset=document.getElementById("graph-zoom-reset");if(reset)reset.textContent=Math.round(graphScale*100)+"%";}
function graphVisibleNodes(){const enabled=new Set([...document.querySelectorAll("[data-graph-filter]:checked")].map(input=>input.dataset.graphFilter));return graphData.nodes.filter(node=>enabled.has(node.type));}
function graphRender(){
 const svg=document.getElementById("investigation-graph"),nodesLayer=document.getElementById("graph-nodes"),edgesLayer=document.getElementById("graph-edges");if(!svg||!nodesLayer||!edgesLayer)return;
 nodesLayer.replaceChildren();edgesLayer.replaceChildren();
 const visible=graphVisibleNodes(),visibleIds=new Set(visible.map(node=>node.id));
 graphData.edges.forEach(edge=>{if(!visibleIds.has(edge.source)||!visibleIds.has(edge.target))return;const a=graphData.nodes.find(node=>node.id===edge.source),b=graphData.nodes.find(node=>node.id===edge.target);if(!a||!b)return;
  graphSvg("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:"graph-edge-line"},edgesLayer);
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;const label=graphSvg("text",{x:mx,y:my-7,class:"graph-edge-label","text-anchor":"middle"},edgesLayer);label.textContent=edge.label;
 });
 visible.forEach(node=>{
  const group=graphSvg("g",{class:"graph-node"+(graphSelected===node.id?" is-selected":""),transform:"translate("+node.x+" "+node.y+")",tabindex:"0",role:"button","aria-label":GRAPH_TYPE_LABELS[node.type]+": "+node.label,"data-node-id":node.id},nodesLayer);
  graphSvg("circle",{r:node.type==="person"?24:19,class:"graph-node-halo"},group);
  graphSvg("circle",{r:node.type==="person"?17:13,class:"graph-node-core type-"+node.type},group);
  const short=GRAPH_TYPE_LABELS[node.type].toUpperCase();const type=graphSvg("text",{x:0,y:35,class:"graph-node-type","text-anchor":"middle"},group);type.textContent=short;
  const label=graphSvg("text",{x:0,y:49,class:"graph-node-label","text-anchor":"middle"},group);label.textContent=node.label.length>23?node.label.slice(0,21)+"…":node.label;
  group.addEventListener("click",()=>graphSelect(node.id));
  group.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();graphSelect(node.id);}});
  group.addEventListener("pointerdown",event=>{if(event.button!==0)return;event.preventDefault();graphDrag={kind:"node",id:node.id,x:event.clientX,y:event.clientY};svg.setPointerCapture(event.pointerId);});
 });
 const empty=document.getElementById("graph-empty-state");if(empty)empty.hidden=visible.length>0;
 const summary=document.getElementById("graph-summary");if(summary)summary.textContent=visible.length+" узлов · "+graphData.edges.filter(edge=>visibleIds.has(edge.source)&&visibleIds.has(edge.target)).length+" связей";
 graphApplyTransform();
}
function graphSelect(id){
 graphSelected=id;const node=graphData.nodes.find(item=>item.id===id),panel=document.getElementById("graph-node-details");if(!panel||!node)return;
 panel.replaceChildren();const type=document.createElement("span");type.className="graph-detail-type";type.textContent=GRAPH_TYPE_LABELS[node.type].toUpperCase();const title=document.createElement("strong");title.textContent=node.label;const description=document.createElement("p");description.textContent=node.details||"Дополнительное описание не указано.";const related=document.createElement("small");const edges=graphData.edges.filter(edge=>edge.source===id||edge.target===id);related.textContent="Связей: "+edges.length;panel.append(type,title,description,related);graphRender();
}
function graphResetView(){graphScale=1;graphPan={x:0,y:0};graphApplyTransform();}
function graphWire(){
 const svg=document.getElementById("investigation-graph");if(!svg)return;
 const mode=document.getElementById("graph-dataset-mode"),badge=document.getElementById("graph-data-mode"),input=document.getElementById("graph-json-input"),status=document.getElementById("graph-import-status");
 const local=graphReadLocal();
 const setMode=value=>{const stored=graphReadLocal();if(value==="local"&&!stored){graphData={nodes:[],edges:[]};if(status)status.textContent="Локальный граф ещё не импортирован.";if(badge)badge.textContent="НЕТ ДАННЫХ";}else{graphData=value==="demo"?GRAPH_DEMO:stored;if(badge)badge.textContent=value==="demo"?"ДЕМО-ДАННЫЕ":"ЛОКАЛЬНЫЕ ДАННЫЕ";}graphSelected=null;graphResetView();graphRender();};
 if(mode){mode.value=local?"local":"demo";mode.addEventListener("change",()=>setMode(mode.value));}
 document.querySelectorAll("[data-graph-filter]").forEach(control=>control.addEventListener("change",graphRender));
 document.getElementById("graph-zoom-in")?.addEventListener("click",()=>{graphScale=Math.min(2.5,graphScale*1.2);graphApplyTransform();});
 document.getElementById("graph-zoom-out")?.addEventListener("click",()=>{graphScale=Math.max(.45,graphScale/1.2);graphApplyTransform();});
 document.getElementById("graph-zoom-reset")?.addEventListener("click",graphResetView);
 document.getElementById("graph-fit")?.addEventListener("click",graphResetView);
 svg.addEventListener("wheel",event=>{event.preventDefault();graphScale=Math.max(.45,Math.min(2.5,graphScale*(event.deltaY<0?1.1:.9)));graphApplyTransform();},{passive:false});
 svg.addEventListener("pointerdown",event=>{if(event.target===svg||event.target.id==="graph-viewport"||event.target.id==="graph-edges"){graphDrag={kind:"pan",x:event.clientX,y:event.clientY};svg.setPointerCapture(event.pointerId);}});
 svg.addEventListener("pointermove",event=>{if(!graphDrag)return;const dx=(event.clientX-graphDrag.x)/graphScale,dy=(event.clientY-graphDrag.y)/graphScale;graphDrag.x=event.clientX;graphDrag.y=event.clientY;if(graphDrag.kind==="pan"){graphPan.x+=dx;graphPan.y+=dy;graphApplyTransform();}else{const node=graphData.nodes.find(item=>item.id===graphDrag.id);if(node){node.x=Math.max(25,Math.min(735,node.x+dx));node.y=Math.max(25,Math.min(395,node.y+dy));graphRender();}}});
 const stop=()=>{graphDrag=null;};svg.addEventListener("pointerup",stop);svg.addEventListener("pointercancel",stop);svg.addEventListener("lostpointercapture",stop);
 document.getElementById("graph-import-button")?.addEventListener("click",()=>{
  try{const parsed=graphValidate(JSON.parse(input?.value||""));localStorage.setItem(GRAPH_STORAGE_KEY,JSON.stringify(parsed));if(mode){mode.value="local";}setMode("local");if(status)status.textContent="Импортировано: "+parsed.nodes.length+" узлов, "+parsed.edges.length+" связей. Сохранено локально.";}
  catch(error){if(status)status.textContent="Ошибка: "+(error.message||"неверный JSON");}
 });
 document.getElementById("graph-export-button")?.addEventListener("click",()=>{
  const data=mode?.value==="demo"?GRAPH_DEMO:(graphReadLocal()||{nodes:[],edges:[]});const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="osint-relationship-graph.json";link.click();URL.revokeObjectURL(url);if(status)status.textContent="JSON подготовлен для экспорта.";
 });
 document.getElementById("graph-clear-button")?.addEventListener("click",()=>{localStorage.removeItem(GRAPH_STORAGE_KEY);if(mode){mode.value="local";}setMode("local");if(status)status.textContent="Локальный граф очищен.";});
 if(input&&!input.value)input.value=JSON.stringify({nodes:[{id:"n1",type:"domain",label:"example.org",details:"Описание объекта"}],edges:[]},null,2);
 setMode(mode?.value||"demo");
}

async function init(){
 // Keep the header and updater usable if a catalogue endpoint is temporarily unavailable.
 wireHeader();
 wireUpdater();
 document.getElementById("hub-search")?.addEventListener("input",renderHubCards);
 document.getElementById("saved-materials-search")?.addEventListener("input",renderSavedMaterials);
 wireFilters();
 wireActivity();
 wireShowAllTools();
 wireSavedMaterials();
 wireCaseProjects();
 const [toolsResult,navigationResult]=await Promise.allSettled([loadTools(),loadNavigation()]);
 const toolsAvailable=toolsResult.status==="fulfilled"&&Array.isArray(toolsResult.value);
 loadedTools=toolsAvailable?toolsResult.value:[];
 loadedNavigation=navigationResult.status==="fulfilled"&&Array.isArray(navigationResult.value)?navigationResult.value:[];
 applyNavigationModules(loadedNavigation);
 renderNav(loadedTools);
 renderHubCards();
 updateHubStatus(loadedTools,toolsAvailable);
 if(!toolsAvailable)showInitNotice("Не удалось загрузить данные сервера. Локальный каталог остаётся доступен; проверьте подключение и попробуйте обновить страницу.");
}
init().catch(error=>showInitNotice("Ошибка главной страницы: "+(error?.message||"неизвестная ошибка")));
