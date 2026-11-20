(() => {
  const form=document.getElementById("iprdap-form");
  const input=document.getElementById("ip-address");
  const result=document.getElementById("ip-result");
  const button=document.getElementById("ip-submit");
  if(!form||!input||!result||!button)return;
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const ip=input.value.trim();
    if(!ip){result.textContent="Введите IP-адрес.";return;}
    button.disabled=true;result.textContent="Запрос RDAP…";
    try{
      const response=await fetch("/api/tools/ip-rdap/run",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({ip})});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.error||"Ошибка запроса.");
      result.textContent=data.output||"Пустой ответ.";
    }catch(error){result.textContent=error.message||"Не удалось выполнить запрос.";}
    finally{button.disabled=false;}
  });
})();