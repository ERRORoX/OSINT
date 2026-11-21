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
      ["Причина проверки",metadata.possible_reason],
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
      const response=await fetch("/api/tools/phone-lookup/run",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({phone})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw new Error(data.error||"Не удалось проверить номер.");
      if(current!==requestId)return;
      lastReport={metadata:data.metadata||{},output:data.output||"",input:phone};
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