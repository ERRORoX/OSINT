(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const form=$("phone-form"),input=$("phone-input"),submit=$("phone-submit"),status=$("phone-status");
  const copy=$("phone-copy"),exportBtn=$("phone-export"),empty=$("phone-empty"),result=$("phone-result");
  if(!form||!input||!submit||!status)return;
  let requestId=0,lastReport=null,sessionHistory=[];
  const setStatus=(message,state="idle")=>{status.textContent=message;status.dataset.state=state;};
  const value=(id,text)=>{const el=$(id);if(el)el.textContent=text==null||text===""?"—":String(text);};
  const flagFor=region=>{if(!region||region.length!==2||region==="001")return "🌐";return String.fromCodePoint(...region.toUpperCase().split("").map(c=>127397+c.charCodeAt(0)));};
  const showDetails=metadata=>{
    const host=$("ph-details");host.replaceChildren();
    const rows=[
      ["Международный формат",metadata.international],
      ["Национальный формат",metadata.national],
      ["Страна",metadata.country_name],
      ["Описание региона",metadata.geographic_description],
      ["Часовые пояса",(metadata.time_zones||[]).join(", ")],
      ["Расширение",metadata.extension],
      ["Значащая часть номера",metadata.national_significant_number],
      ["Источник кода страны",metadata.country_code_source],
      ["Код типа номера",metadata.number_type_code],
      ["Причина проверки",metadata.possible_reason],
      ["Статус плана нумерации",metadata.is_valid?"Номер соответствует известному диапазону":"Не подтверждён"],
      ["Источник данных","Локальная база libphonenumber"]
    ];
    rows.forEach(([label,val])=>{if(val===undefined||val===null||val===""||(Array.isArray(val)&&!val.length))return;const row=document.createElement("div"),name=document.createElement("span"),data=document.createElement("strong");row.className="ph-detail";name.textContent=label;data.textContent=Array.isArray(val)?val.join(", "):String(val);row.append(name,data);host.append(row);});
  };
  const render=report=>{
    const m=report.metadata||{};empty.style.display="none";result.classList.add("is-visible");
    value("ph-e164",m.e164);value("ph-country",m.country_name||m.region_name||m.region);value("ph-code","+"+m.country_calling_code);
    value("ph-type",m.number_type);value("ph-region",m.region);value("ph-carrier",m.carrier);
    $("ph-flag").textContent=flagFor(m.region);value("ph-valid",m.valid?"✓ Номер соответствует плану нумерации":"⚠ Не подтверждён");
    showDetails(m);
    renderPublicChecks(m);
    renderAutoSearch(report.public_search);
  };
  const renderAutoSearch=data=>{
    const host=$("ph-auto-search-result");
    if(!host)return;
    host.replaceChildren();
    if(!data){
      const note=document.createElement("span");note.textContent="Автопоиск не запускался.";host.append(note);return;
    }
    const message=document.createElement("p");message.className="ph-auto-message";message.textContent=data.message||"Проверка завершена.";host.append(message);
    if(!data.configured){
      const note=document.createElement("span");note.className="ph-auto-note";note.textContent="Поисковый API не настроен на сервере. Добавьте BRAVE_SEARCH_API_KEY или старые ключи Google CSE.";host.append(note);return;
    }
    const statuses=document.createElement("div");statuses.className="ph-auto-statuses";
    (data.services||[]).forEach(service=>{
      const item=document.createElement("div");item.className="ph-auto-status";
      const label=document.createElement("strong");label.textContent=service.name;
      const state=document.createElement("span");
      state.textContent=service.status==="found"?"Найдены публичные страницы ("+service.count+")":service.status==="no_public_results"?"Публичных результатов нет": "Ошибка проверки";
      state.dataset.state=service.status;
      item.append(label,state);statuses.append(item);
    });
    host.append(statuses);
    const results=document.createElement("div");results.className="ph-auto-results";
    (data.results||[]).forEach(entry=>{
      const card=document.createElement("article");card.className="ph-auto-result";
      const title=document.createElement("strong");title.textContent=entry.title||"Публичная страница";
      const snippet=document.createElement("p");snippet.textContent=entry.snippet||"";
      const source=document.createElement("small");source.textContent=entry.source||data.provider_label||"Публичный веб-поиск";
      const link=document.createElement("a");link.href=entry.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Открыть источник ↗";
      card.append(source,title,snippet,link);results.append(card);
    });
    if(!results.children.length){const note=document.createElement("span");note.className="ph-auto-note";note.textContent=(data.provider_label||"Поисковый провайдер")+" не вернул публичных совпадений по этим запросам.";results.append(note);}
    host.append(results);
  };
  const SOURCE_SELECTION_KEY="phone-lookup-selected-sources-v1";
  const readSavedSourceSelection=()=>{
    try{const value=JSON.parse(localStorage.getItem(SOURCE_SELECTION_KEY)||"[]");return Array.isArray(value)?value:[];}catch(_){return [];}
  };
  const saveSourceSelection=labels=>{
    try{localStorage.setItem(SOURCE_SELECTION_KEY,JSON.stringify(labels));}catch(_){}
  };
  const renderPublicChecks=metadata=>{
    const host=$("ph-public-links");
    if(!host)return;
    host.replaceChildren();
    const number=String(metadata.e164||metadata.international||"").trim();
    if(!number){const note=document.createElement("span");note.textContent="Нет нормализованного номера для поиска.";host.append(note);return;}
    const digits=number.replace(/\\D/g,"");
    const direct=document.createElement("section");
    direct.className="ph-direct-messengers";
    const directTitle=document.createElement("strong");
    directTitle.className="ph-link-heading";
    directTitle.textContent="Открыть номер в мессенджере";
    const directHint=document.createElement("span");
    directHint.className="ph-source-hint";
    directHint.textContent="Ссылки передают номер в приложение. Результат зависит от настроек приватности и наличия аккаунта.";
    const directLinks=document.createElement("div");
    directLinks.className="ph-direct-links";
    const addDirectLink=(label,url,noteText)=>{
      const item=document.createElement("div");item.className="ph-direct-item";
      const link=document.createElement("a");link.href=url;link.textContent=label;link.target="_blank";link.rel="noopener noreferrer";
      const note=document.createElement("small");note.textContent=noteText;
      item.append(link,note);directLinks.append(item);
    };
    addDirectLink("WhatsApp ↗","https://wa.me/"+digits,"Откроет чат, если номер зарегистрирован и доступен в WhatsApp.");
    addDirectLink("Telegram ↗","tg://resolve?phone="+digits,"Попытка открыть профиль по номеру; Telegram может скрыть пользователя настройками приватности.");
    addDirectLink("imo — поиск публичных упоминаний ↗","https://www.google.com/search?q="+encodeURIComponent('"'+number+'" (site:imo.im OR site:imoapp.com)'),"У imo нет подтверждённой универсальной публичной ссылки для открытия профиля по номеру.");
    direct.append(directTitle,directHint,directLinks);
    host.append(direct);
    const exact='"'+number+'"';
    const reputation=exact+' (спам OR мошенничество OR нежелательный звонок OR scam OR spam OR robocall)';
    const groups=[
      {title:"Поисковые системы и публичный веб",items:[
        ["Google · точный номер","https://www.google.com/search?q=",exact],
        ["Bing · точный номер","https://www.bing.com/search?q=",exact],
        ["DuckDuckGo · точный номер","https://duckduckgo.com/?q=",exact],
        ["Brave Search · точный номер","https://search.brave.com/search?q=",exact],
        ["Yandex · точный номер","https://yandex.com/search/?text=",exact],
        ["Google · разные форматы номера","https://www.google.com/search?q=",number+" OR "+number.replace(/[^0-9]/g,"")],
        ["Google · варианты написания","https://www.google.com/search?q=",number.replace(/^\+/,"")+" OR "+number.replace(/[^0-9]/g,"")]
      ]},
      {title:"Публичные упоминания в соцсетях",items:[
        ["Instagram","https://www.google.com/search?q=",exact+" site:instagram.com"],
        ["Facebook","https://www.google.com/search?q=",exact+" site:facebook.com"],
        ["VK","https://www.google.com/search?q=",exact+" site:vk.com"],
        ["TikTok","https://www.google.com/search?q=",exact+" site:tiktok.com"],
        ["X / Twitter","https://www.google.com/search?q=",exact+" site:x.com OR site:twitter.com"],
        ["LinkedIn","https://www.google.com/search?q=",exact+" site:linkedin.com"],
        ["Telegram · публичные страницы","https://www.google.com/search?q=",exact+" site:t.me"],
        ["WhatsApp · публичные упоминания","https://www.google.com/search?q=",exact+" (site:wa.me OR site:whatsapp.com)"],
        ["imo · публичные упоминания","https://www.google.com/search?q=",exact+" (site:imo.im OR site:imoapp.com)"],
        ["YouTube","https://www.google.com/search?q=",exact+" site:youtube.com"],
        ["Reddit","https://www.google.com/search?q=",exact+" site:reddit.com"],
        ["GitHub · публичные страницы","https://www.google.com/search?q=",exact+" site:github.com"],
        ["TikTok · Bing","https://www.bing.com/search?q=",exact+" site:tiktok.com"],
        ["VK · Yandex","https://yandex.com/search/?text=",exact+" site:vk.com"]
      ]},
      {title:"Базы жалоб и репутации звонков",items:[
        ["Google · спам и мошенничество","https://www.google.com/search?q=",reputation],
        ["Tellows · публичные отзывы","https://www.google.com/search?q=",exact+" site:tellows.com OR site:tellows.co.uk OR site:tellows.de"],
        ["WhoCallsMe · жалобы","https://www.google.com/search?q=",exact+" site:whocallsme.com"],
        ["800notes · жалобы","https://www.google.com/search?q=",exact+" site:800notes.com"],
        ["Should I Answer · отзывы","https://www.google.com/search?q=",exact+" site:shouldianswer.com"],
        ["Who Called · отзывы","https://www.google.com/search?q=",exact+" (who called OR caller reviews OR phone complaints)"],
        ["Bing · жалобы","https://www.bing.com/search?q=",reputation],
        ["DuckDuckGo · жалобы","https://duckduckgo.com/?q=",reputation]
      ]},
      {title:"Бизнес-каталоги и объявления",items:[
        ["Google · бизнес-контакты","https://www.google.com/search?q=",exact+" (контакты OR телефон OR компания OR contact OR business)"],
        ["Google Maps · публичные карточки","https://www.google.com/maps/search/",number],
        ["Yandex Maps · публичные карточки","https://yandex.com/maps/?text=",number],
        ["Публичные объявления","https://www.google.com/search?q=",exact+" (объявление OR classifieds OR marketplace OR listing)"],
        ["Публичные сайты организаций","https://www.google.com/search?q=",exact+" (site:org OR site:com OR site:net)"]
      ]},
      {title:"Публичные справочники обратного поиска",items:[
        ["Общий поиск по телефонным справочникам","https://www.google.com/search?q=",exact+" (reverse phone lookup OR phone directory OR телефонный справочник)"],
        ["Публичные страницы Truecaller","https://www.google.com/search?q=",exact+" site:truecaller.com"],
        ["Публичные страницы Sync.me","https://www.google.com/search?q=",exact+" site:sync.me"],
        ["Публичные страницы NumLookup","https://www.google.com/search?q=",exact+" site:numlookup.com"],
        ["Публичные страницы PhoneLookup","https://www.google.com/search?q=",exact+" (phone lookup OR caller ID)"]
      ]},
      {title:"Операторы и телеком-метаданные",items:[
        ["Поиск оператора и диапазона","https://www.google.com/search?q=",exact+" (carrier OR operator OR оператор OR мобильный код)"],
        ["Планы нумерации и регуляторы","https://www.google.com/search?q=",exact+" (numbering plan OR regulator OR план нумерации)"],
        ["ITU · международные планы нумерации","https://www.google.com/search?q=","site:itu.int numbering plan "+number],
        ["Национальные коды и диапазоны","https://www.google.com/search?q=",number+" country calling code numbering range"]
      ]}
    ];
    const controls=document.createElement("div");
    controls.className="ph-source-controls";
    const hint=document.createElement("span");
    hint.className="ph-source-hint";
    hint.textContent="Отметь источники, которые хочешь проверить, затем сформируй список ссылок.";
    controls.append(hint);
    const selection=document.createElement("div");
    selection.className="ph-source-selection";
    const linksHost=document.createElement("div");
    linksHost.className="ph-selected-links";
    const chosen=[];
    groups.forEach((group,groupIndex)=>{
      const section=document.createElement("section");
      section.className="ph-link-group";
      const heading=document.createElement("strong");
      heading.className="ph-link-heading";
      heading.textContent=group.title;
      section.append(heading);
      const options=document.createElement("div");
      options.className="ph-source-options";
      group.items.forEach(([label,base,query],itemIndex)=>{
        const id="ph-source-"+groupIndex+"-"+itemIndex;
        const wrapper=document.createElement("label");
        wrapper.className="ph-source-option";
        const checkbox=document.createElement("input");
        checkbox.type="checkbox";
        checkbox.value=String(chosen.length);
        checkbox.dataset.sourceIndex=String(chosen.length);
        checkbox.checked=readSavedSourceSelection().includes(label);
        checkbox.addEventListener("change",()=>{
          const selected=Array.from(selection.querySelectorAll("input:checked")).map(box=>chosen[Number(box.dataset.sourceIndex)]?.label).filter(Boolean);
          saveSourceSelection(selected);
          renderSelected();
        });
        const name=document.createElement("span");
        name.textContent=label;
        chosen.push({label,base,query});
        wrapper.append(checkbox,name);
        options.append(wrapper);
      });
      section.append(options);
      selection.append(section);
    });
    const actions=document.createElement("div");
    actions.className="ph-source-actions";
    const build=document.createElement("button");
    build.type="button";
    build.className="ph-source-build";
    build.textContent="Сформировать выбранные проверки";
    const clear=document.createElement("button");
    clear.type="button";
    clear.className="ph-source-clear";
    clear.textContent="Снять отметки";
    actions.append(build,clear);
    const renderSelected=()=>{
      linksHost.replaceChildren();
      const checked=Array.from(selection.querySelectorAll("input:checked"));
      saveSourceSelection(checked.map(box=>chosen[Number(box.dataset.sourceIndex)]?.label).filter(Boolean));
      if(!checked.length){const note=document.createElement("span");note.className="ph-source-hint";note.textContent="Источники не выбраны.";linksHost.append(note);return;}
      checked.forEach(box=>{
        const item=chosen[Number(box.dataset.sourceIndex)];
        if(!item)return;
        const link=document.createElement("a");
        link.href=item.base+encodeURIComponent(item.query);
        link.target="_blank";
        link.rel="noopener noreferrer";
        link.textContent="Открыть: "+item.label+" ↗";
        link.setAttribute("aria-label",item.label+" — поиск публичных упоминаний номера");
        linksHost.append(link);
      });
    };
    build.addEventListener("click",renderSelected);
    clear.addEventListener("click",()=>{
      selection.querySelectorAll("input").forEach(box=>box.checked=false);
      saveSourceSelection([]);
      renderSelected();
    });
    host.append(controls,selection,actions,linksHost);
    renderSelected();
  };
  const persistGraph=async metadata=>{
    const phone=metadata.e164||metadata.international||"";
    const idHash=Array.from(phone.toLowerCase()).reduce((hash,char)=>Math.imul(hash^char.charCodeAt(0),16777619)>>>0,2166136261);
    const details=[
      "Источник: Phone Number Intelligence / libphonenumber",
      "Страна: "+(metadata.country_name||metadata.region||"—"),
      "Регион: "+(metadata.region||"—"),
      "Тип: "+(metadata.number_type||"—"),
      "Оператор исходного диапазона: "+(metadata.carrier||"—"),
      "Код вызова: +"+(metadata.country_calling_code||"—"),
      "Часовые пояса: "+((metadata.time_zones||[]).join(", ")||"—"),
      "Владелец и местоположение абонента не определяются."
    ].join("\n");
    const response=await fetch("/api/graph/merge",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({nodes:[{id:"phone:"+idHash.toString(16),type:"phone",label:String(phone).slice(0,180),details}],edges:[]})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Не удалось сохранить телефонный узел.");
  };
  const renderHistory=()=>{
    const host=$("phone-history");host.replaceChildren();
    if(!sessionHistory.length){const emptyNode=document.createElement("div");emptyNode.className="ph-empty";emptyNode.style.padding="12px";emptyNode.textContent="В этой сессии проверок пока нет.";host.append(emptyNode);return;}
    sessionHistory.slice().reverse().forEach(item=>{const row=document.createElement("div"),btn=document.createElement("button"),time=document.createElement("small");row.className="ph-history-item";btn.type="button";btn.textContent=item.number;btn.addEventListener("click",()=>{input.value=item.input;render(item.report);lastReport=item.report;copy.disabled=false;exportBtn.disabled=false;setStatus("Результат восстановлен из истории текущей сессии","success");});time.textContent=item.time;row.append(btn,time);host.append(row);});
  };
  form.addEventListener("submit",async event=>{
    event.preventDefault();const phone=input.value.trim();
    if(!/^\+[0-9().\s-]{6,30}$/.test(phone)){setStatus("Введите номер в международном формате, начиная с +.","error");input.focus();return;}
    const current=++requestId;submit.disabled=true;copy.disabled=true;exportBtn.disabled=true;lastReport=null;
    setStatus("Проверка локальной базы нумерации…","loading");empty.style.display="block";result.classList.remove("is-visible");
    try{
      const response=await fetch("/api/tools/phone-lookup/run",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({phone,search_public:true})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw new Error(data.error||"Не удалось проверить номер.");
      if(current!==requestId)return;
      lastReport={metadata:data.metadata||{},output:data.output||"",input:phone,public_search:data.public_search||null};
      render(lastReport);copy.disabled=false;exportBtn.disabled=false;
      sessionHistory=sessionHistory.filter(item=>item.number!==lastReport.metadata.e164);
      sessionHistory.push({number:lastReport.metadata.e164||phone,input:phone,report:lastReport,time:new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})});
      renderHistory();setStatus("Анализ завершён · метаданные получены","success");
      try{await persistGraph(lastReport.metadata);if(current===requestId)setStatus("Анализ завершён · телефонный узел добавлен в граф","success");}
      catch(error){if(current===requestId)setStatus("Анализ завершён, но сохранение в граф не удалось: "+error.message,"error");}
    }catch(error){if(current!==requestId)return;setStatus(error.message||"Ошибка проверки.","error");empty.style.display="block";empty.textContent=error.message||"Проверка не выполнена.";}
    finally{if(current===requestId)submit.disabled=false;}
  });
  copy?.addEventListener("click",async()=>{if(!lastReport)return;const m=lastReport.metadata;const text=lastReport.output||JSON.stringify(m,null,2);try{await navigator.clipboard.writeText(text);copy.textContent="Скопировано";setTimeout(()=>copy.textContent="Копировать",1400);}catch(_){setStatus("Копирование недоступно в этом браузере.","error");}});
  exportBtn?.addEventListener("click",()=>{if(!lastReport)return;const blob=new Blob([JSON.stringify({tool:"Phone Intelligence",created_at:new Date().toISOString(),...lastReport},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="phone-intelligence-"+(lastReport.metadata.e164||"report").replace(/[^+0-9a-z-]/gi,"")+".json";document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);});
  document.querySelectorAll("[data-example]").forEach(btn=>btn.addEventListener("click",()=>{input.value=btn.dataset.example;input.focus();setStatus("Добавлен код страны. Дополните номер перед анализом.");}));
  $("phone-clear")?.addEventListener("click",()=>{requestId++;input.value="";lastReport=null;copy.disabled=true;exportBtn.disabled=true;submit.disabled=false;result.classList.remove("is-visible");empty.style.display="block";empty.textContent="После анализа здесь появятся доступные характеристики номера.";setStatus("Форма очищена");input.focus();});
  $("phone-history-clear")?.addEventListener("click",()=>{sessionHistory=[];renderHistory();setStatus("История текущей сессии очищена");});
})();