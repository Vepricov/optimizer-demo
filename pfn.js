'use strict';

// Economics are independent planning assumptions, never inferred from AUC/AP.
globalThis.PFN_CALCULATE = (econ, launches = 1, finetune = false) => {
  const calculate = (labels, setupHours) => {
    const expertHours = labels * econ.minutes / 60;
    const expertCost = expertHours * econ.expertRate + labels * econ.testCost;
    const setupCost = setupHours * econ.engineerRate;
    const days = econ.commonDays + econ.waitDays + Math.ceil(expertHours / (econ.experts * 6)) + Math.ceil(setupHours / 6);
    return {labels, expertHours, expertCost, setupHours, setupCost, commonCost:econ.commonCost, total:econ.commonCost + expertCost + setupCost, days};
  };
  const base = calculate(econ.baseLabels, econ.baseSetupHours);
  const pfn = calculate(econ.pfnLabels, econ.pfnSetupHours + (finetune ? 18 : 0));
  return {base,pfn,saving:(base.total-pfn.total)*launches,expertSaving:(base.expertHours-pfn.expertHours)*launches,percent:(base.total-pfn.total)/Math.max(1,base.total)*100};
};

(() => {
  const {cases,sources,icons} = globalThis.PFN_DATA;
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number = (value,digits=0) => new Intl.NumberFormat('ru-RU',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
  const compact = value => {
    const absolute = Math.abs(value);
    if(absolute>=1e6) return `${number(value/1e6,absolute<1e7?2:1)} млн ₽`;
    if(absolute>=1e3) return `${number(value/1e3,absolute<1e5?1:0)} тыс. ₽`;
    return `${number(value)} ₽`;
  };
  const rubles = value => `${number(value)} ₽`;
  const score = (c,model) => `${number(model.score,c.metric.digits)}${model.sd==null?'':` ± ${number(model.sd,c.metric.digits)}`}`;
  const svg = id => `<svg viewBox="0 0 32 32" aria-hidden="true">${icons[id]}</svg>`;
  const fromHash = cases.find(c=>`#${c.id}`===location.hash);
  const state = {id:fromHash?.id||cases[0].id,model:0,launches:10,filter:'all',view:fromHash?'business':'explain',revealed:false,overrides:{}};
  const current = () => cases.find(c=>c.id===state.id);
  const model = () => current().models[state.model];
  const economics = () => state.overrides[state.id] || current().econ;
  const calculate = () => globalThis.PFN_CALCULATE(economics(),state.launches,!!model().finetune);
  const pair = (before,after,suffix='') => `<span class="before">${number(before)}</span><span class="arrow">→</span><span class="after">${number(after)}</span>${suffix?`<span class="suffix">${suffix}</span>`:''}`;
  let drag = false;
  let fitFrame = 0;
  let fitting = false;

  function fitScreen(){
    fitFrame = 0;
    if(fitting || drag) return;
    fitting = true;
    const shell = document.querySelector('.shell');
    globalThis.PFN_LAYOUT.fit(shell);
    requestAnimationFrame(()=>{fitting=false;});
  }
  function queueFit(){if(!fitFrame&&!fitting&&!drag) fitFrame=requestAnimationFrame(fitScreen);}

  function renderCases(){
    const visible=cases.filter(c=>state.filter==='all'||c.type===state.filter);
    $('cases').classList.toggle('filtered',state.filter!=='all');
    $('cases').style.setProperty('--case-count',visible.length);
    $('cases').innerHTML=visible.map(c=>`<button type="button" class="case-button${c.id===state.id?' active':''}" data-case="${c.id}" aria-pressed="${c.id===state.id}">${svg(c.id)}<strong>${esc(c.name)}</strong><small>${esc(c.tag)}</small></button>`).join('');
    document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===state.filter)));
  }

  function renderEconomics(){
    const c=current(), e=economics(), r=calculate();
    $('launch-count').textContent=state.launches;
    $('launches').value=state.launches;
    const range=$('launches'), min=Number(range.min), max=Number(range.max);
    range.style.setProperty('--fill',`${(state.launches-min)/(max-min)*100}%`);
    range.setAttribute('aria-valuetext',`${state.launches} ${plural(state.launches,'эксперимент','эксперимента','экспериментов')} в год`);
    document.querySelectorAll('[data-launches]').forEach(button=>{
      const value=Number(button.dataset.launches);
      button.style.setProperty('--position',`${(value-min)/(max-min)*100}%`);
      button.setAttribute('aria-label',`${value} ${plural(value,'эксперимент','эксперимента','экспериментов')} в год`);
      button.setAttribute('aria-pressed',String(value===state.launches));
    });
    $('scale-note').textContent=c.scale;
    $('experiment-description').textContent=c.experiment.replace('{labels}',number(e.pfnLabels));
    $('saving').textContent=compact(r.saving);
    $('saving-note').textContent=`${r.percent>=0?'На '+number(r.percent)+'% меньше бюджета':'Дополнительные затраты'} · ${state.launches} ${plural(state.launches,'эксперимент','эксперимента','экспериментов')}`;
    $('expert-saving').textContent=number(r.expertSaving);
    $('pilot-time').innerHTML=pair(r.base.days,r.pfn.days,'дн.');
    const speed=r.base.days/r.pfn.days;
    $('pilot-note').textContent=r.base.days===r.pfn.days?'По заданным условиям срок не изменился':speed>1?`Эксперимент в ${number(speed,1)} раза быстрее`:'По заданным условиям срок увеличился';
    $('examples-label').textContent=c.id==='concrete'||c.id==='yacht'?'Измерения / эксперимент':'Проверенные примеры / эксперимент';
    $('example-count').innerHTML=pair(e.baseLabels,e.pfnLabels);
    $('example-note').textContent=e.baseLabels===e.pfnLabels?'Столько же':e.baseLabels>e.pfnLabels?`${number(e.baseLabels/e.pfnLabels,1)}× меньше`:`${number(e.pfnLabels/e.baseLabels,1)}× больше`;
    const maxCost=Math.max(r.base.total,r.pfn.total,1);
    $('cost-comparison').innerHTML=[['Классический ML',r.base,''],['PFN-подход',r.pfn,'pfn']].map(([label,row,cls])=>`<div class="comparison-row ${cls}"><div class="bar-label"><span>${label}</span><strong>${rubles(row.total)}</strong></div><div class="bar-track" role="img" aria-label="${label}: подготовка данных ${rubles(row.commonCost)}, экспертиза и испытания ${rubles(row.expertCost)}, настройка ${rubles(row.setupCost)}">${[['common',row.commonCost],['expert',row.expertCost],['setup',row.setupCost]].map(([segment,value])=>`<span class="bar-segment ${segment}-segment" style="width:${value/maxCost*100}%" title="${rubles(value)}"></span>`).join('')}</div></div>`).join('');
    const maxDays=Math.max(r.base.days,r.pfn.days,1);
    $('time-comparison').innerHTML=[['Классический ML',r.base,''],['PFN-подход',r.pfn,'pfn']].map(([label,row,cls])=>`<div class="time-row ${cls}"><span>${label}</span><div class="bar-track"><i class="time-fill" style="width:${row.days/maxDays*100}%"></i></div><strong>${row.days}</strong></div>`).join('');
    $('budget-note').textContent=c.id==='concrete'?`Выдержка ${e.waitDays} дней заложена в оба маршрута. Сокращаем число испытаний и настройку, сохраняя физический цикл.`:c.id==='yacht'?'Экономия включает подготовку измерений и работу инженера. Физические измерения остаются нужны для проверки новых решений.':model().finetune?'Выбран вариант с дообучением: добавлены 18 часов инженера. Сбор и подготовка исходных данных учтены в обоих маршрутах.':'Сбор и подготовка данных учтены в обоих маршрутах.';
  }

  function plural(n,one,few,many){return n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;}

  function graphExample(c,{revealed=state.revealed,variant='business'}={}){
    const {nodes,edges,title,relation,directed}=c.graph;
    const marker=`arrow-${variant}-${c.id}`;
    const lines=edges.map(([a,b])=>{
      const from=nodes[a],to=nodes[b],dx=to.x-from.x,dy=to.y-from.y;
      const inset=directed?(to.target?23:17)/Math.hypot(dx,dy):0;
      return `<line class="edge${from.target||to.target?' context':''}" x1="${from.x}" y1="${from.y}" x2="${to.x-dx*inset}" y2="${to.y-dy*inset}"${directed?` marker-end="url(#${marker})"`:''}></line>`;
    }).join('');
    const shapes=nodes.map(node=>{
      const {x,y,label,kind,known,target}=node;
      const cls=`node${known?' known':''}${target?` target${revealed?' revealed':''}`:''}`;
      const description=`<title>${esc(label)}${known?' · ответ эксперта известен':''}</title>`;
      const shape=kind==='place'?`<rect class="${cls} place" x="${x-18}" y="${y-12}" width="36" height="24" rx="4">${description}</rect>`:kind==='task'?`<path class="${cls} task-node" d="M${x} ${y-14}l14 14-14 14-14-14z">${description}</path>`:`<circle class="${cls}" cx="${x}" cy="${y}" r="${target?19:12}">${description}</circle>`;
      return `${shape}${target?`<text class="${revealed?'revealed-text':''}" x="${x}" y="${y+5}">${revealed?'✓':'?'}</text>`:''}<text class="node-label" x="${x}" y="${y+(target?33:27)}">${esc(label)}</text>`;
    }).join('');
    return `<div class="graph-example graph-${c.id}"><div><svg class="network" viewBox="0 0 320 198" role="img" aria-label="${esc(title)}. ${esc(relation)}. Выделен новый объект для прогноза.">${directed?`<defs><marker id="${marker}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--orange)"/></marker></defs>`:''}${lines}${shapes}</svg><div class="graph-key"><span><i></i>Ответы эксперта</span><span><i class="query-dot"></i>Новый объект</span></div><p class="graph-relation">${esc(relation)}</p></div><div class="graph-context"><span class="label">Признаки нового объекта</span><strong>${esc(c.columns[0])}: ${esc(c.query[0])}<br>${esc(c.columns[1])}: ${esc(c.query[1])}</strong><span class="label">${esc(title)}</span><div class="graph-answer" role="status">${revealed?`<span class="answer">${esc(c.predict)}</span>`:'Прогноз: ?'}</div></div></div>`;
  }

  function tableExample(c,revealed){
    return `<table class="sample-table"><caption class="sr-only">Опорные данные для модели и новый объект</caption><thead><tr>${c.columns.map(label=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${c.rows.map(row=>`<tr class="known">${row.map(value=>`<td>${esc(value)}</td>`).join('')}</tr>`).join('')}<tr class="query">${c.query.map(value=>`<td>${esc(value)}</td>`).join('')}<td role="status">${revealed?`<span class="answer">${esc(c.predict.split(': ').slice(1).join(': '))}</span>`:'?'}</td></tr></tbody></table><p class="table-note"><i></i>Проверенные ответы <span class="separator">/</span><i class="query-dot"></i>${revealed?'Прогноз PFN':'Новый объект'}</p>`;
  }

  function renderIntro(){
    const reductions=cases.map(c=>c.econ.baseLabels/c.econ.pfnLabels);
    $('intro-reduction').textContent=`≈${number(Math.min(...reductions))}–${number(Math.max(...reductions))}×`;
    const example=cases.find(c=>c.id==='steel');
    $('intro-label-example').textContent=`Например, дефекты стали: ${number(example.econ.baseLabels)} → ${number(example.econ.pfnLabels)} примеров`;
    $('intro-table').innerHTML=tableExample(cases.find(c=>c.id==='concrete'),true);
    $('intro-graph').innerHTML=graphExample(cases.find(c=>c.id==='reviews'),{revealed:true,variant:'intro'});
  }

  function renderExample(){
    const c=current();
    if(c.type==='graph') $('example').innerHTML=graphExample(c);
    else $('example').innerHTML=tableExample(c,state.revealed);
    $('example-explanation').textContent=state.revealed?'Показан ответ для нового объекта. Качество эксперимента проверяют на отдельных данных.':c.type==='graph'?'Эксперт проверил несколько объектов. Связи дают модели дополнительный контекст.':`${c.expert} проверяет ответы. Модель переносит закономерности на новые объекты.`;
    $('predict').innerHTML=state.revealed?'Сначала <span>↺</span>':'Показать прогноз <span>→</span>';
    $('predict').setAttribute('aria-pressed',String(state.revealed));
  }

  function renderEvidence(){
    const c=current(), m=model(), estimated=m.status==='estimate';
    $('evidence-label').textContent='Сравнение моделей';
    $('evidence-text').innerHTML=`${esc(c.metric.name)}: ${esc(c.metric.baseName)} ${number(c.metric.base,c.metric.digits)} → <strong>${esc(m.name)} ${number(m.score,c.metric.digits)}</strong>`;
    $('evidence-note').textContent=estimated?'Методика и происхождение данных — в «Источниках и условиях».':c.metric.note;
  }

  function renderCase(){
    const c=current();
    renderCases();
    $('task-icon').innerHTML=svg(c.id);
    $('task-title').textContent=c.title;
    $('task-type').textContent=c.type==='graph'?'ГРАФ':'ТАБЛИЦА';
    $('task-description').textContent=c.description;
    $('model').innerHTML=c.models.map((m,index)=>`<option value="${index}">${esc(m.name)}</option>`).join('');
    $('model').value=state.model;
    renderModel();
    queueFit();
  }

  function renderModel(){
    $('model-mode').textContent=model().finetune?'Контекст + дообучение на своей задаче':'Контекст из примеров · без дообучения весов';
    renderEconomics();renderExample();renderEvidence();queueFit();
  }

  const fields=[
    ['baseLabels','Примеры: классический ML',1,1000000,1],['pfnLabels','Примеры: PFN',1,1000000,1],['minutes','Минут эксперта на пример',0,1440,.5],
    ['expertRate','Стоимость часа эксперта, ₽',0,1000000,50],['testCost','Расходы на испытание / пример, ₽',0,10000000,100],['experts','Экспертов параллельно',1,1000,1],
    ['baseSetupHours','Настройка классического ML, ч',0,10000,1],['pfnSetupHours','Настройка PFN до дообучения, ч',0,10000,1],['engineerRate','Стоимость часа ML-инженера, ₽',0,1000000,50],
    ['commonCost','Общий бюджет подготовки данных, ₽',0,100000000,1000],['commonDays','Подготовка данных, дней',0,3650,1],['waitDays','Ожидание / физический цикл, дней',0,3650,1]
  ];

  function openDetails(section='sources'){
    const c=current(), e=economics(), m=model();
    $('details-title').textContent=c.name;
    const scoreRows=[{name:c.metric.baseName,score:c.metric.base,sd:null,status:'baseline'},...c.models];
    const sourceKeys=[...new Set(c.models.map(item=>item.source))];
    const primarySources=sourceKeys.map(key=>`<div><a href="${sources[key].url}" target="_blank" rel="noopener noreferrer">${esc(sources[key].title)} ↗</a><p>${esc(sources[key].detail)}</p></div>`).join('');
    $('details-content').innerHTML=`<section class="details-section" id="detail-evidence"><h3>Сравнение подходов · ${esc(c.metric.name)}</h3><table class="evidence-table"><thead><tr><th scope="col">Подход</th><th scope="col">Результат</th><th scope="col">Основание</th></tr></thead><tbody>${scoreRows.map(item=>`<tr class="${item===m?'selected':''}"><td>${esc(item.name)}</td><td class="${item.status==='estimate'?'estimated-value':''}">${score(c,item)}</td><td><span class="badge ${item.status==='estimate'?'estimate':'benchmark'}">${item.status==='estimate'?'Пример':'Бенчмарк'}</span></td></tr>`).join('')}</tbody></table><div class="source-list">${primarySources}</div></section><section class="details-section" id="detail-assumptions"><h3>Условия бизнес-сценария</h3><p>Измените число примеров, стоимость экспертизы и время настройки — бюджет и сроки эксперимента пересчитаются. Опубликованные метрики качества остаются прежними.</p><form id="assumptions-form" class="assumptions-form">${fields.map(([key,label,min,max,step])=>`<label>${label}<input name="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${e[key]}" required inputmode="decimal"></label>`).join('')}<div id="form-message" class="form-message" role="status"></div><div class="form-actions"><button class="predict-button" type="submit">Применить условия</button><button class="quiet" type="button" id="reset-assumptions">Сбросить сценарий</button></div></form><details><summary>Как считаются бюджет и сроки</summary><p class="formula">Экспертные часы = примеры × минуты / 60.<br>Экспертиза и испытания = часы × ставка + примеры × расходы на испытание.<br>Бюджет = подготовка данных + экспертиза и испытания + часы настройки × ставка инженера.<br>Срок = подготовка + физический цикл + ⌈экспертные часы / (эксперты × 6 ч/день)⌉ + ⌈настройка / 6 ч/день⌉.<br>Для режима с дообучением к настройке PFN добавляются 18 часов. Этапы идут последовательно; сроки указаны в днях проекта.<br>Годовая экономия = разница бюджетов × независимые новые эксперименты за год.</p><p>В этот расчёт не включены вычислительная инфраструктура, лицензии и сопровождение после эксперимента. Данные, признаки, граф связей и процедура проверки должны быть доступны. Экономия на новых метках требует отдельной проверки кривой качества и не следует из приведённых бенчмарков.</p></details></section><section class="details-section"><h3>Другие источники стенда</h3><div class="source-list">${Object.entries(sources).filter(([key])=>!sourceKeys.includes(key)).map(([,source])=>`<div><a href="${source.url}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a><p>${esc(source.detail)}</p></div>`).join('')}</div></section>`;
    $('assumptions-form').addEventListener('submit',event=>{
      event.preventDefault();
      const form=event.currentTarget;
      if(!form.reportValidity()) return;
      const next={};
      for(const [key,,min,max] of fields){
        const value=Number(form.elements.namedItem(key).value);
        if(!Number.isFinite(value)||value<min||value>max){$('form-message').textContent='Проверьте значения: они должны быть числами в указанном диапазоне.';return;}
        next[key]=value;
      }
      state.overrides[state.id]=next;
      renderEconomics();
      $('details').close();
      queueFit();
    });
    $('reset-assumptions').addEventListener('click',()=>{
      delete state.overrides[state.id];renderEconomics();openDetails('assumptions');
    });
    if(!$('details').open) $('details').showModal();
    if(section==='assumptions') requestAnimationFrame(()=>document.getElementById('detail-assumptions').scrollIntoView({block:'start'}));
    else $('details').scrollTop=0;
  }

  function selectCase(id,writeHash=true){
    if(!cases.some(c=>c.id===id)) return;
    state.id=id;state.model=0;state.revealed=false;
    if(writeHash){try{history.replaceState(null,'',`#${id}`);}catch{/* Local file viewers may disallow history writes. */}}
    renderCase();
  }
  function setView(view){
    state.view=view;
    $('business-view').hidden=view!=='business';$('explain-view').hidden=view!=='explain';
    document.querySelectorAll('[data-view]').forEach(button=>{const active=button.dataset.view===view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    queueFit();
  }

  $('cases').addEventListener('click',event=>{const button=event.target.closest('[data-case]');if(button) selectCase(button.dataset.case);});
  $('cases').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const buttons=[...$('cases').querySelectorAll('button')];
    const index=buttons.indexOf(event.target);
    if(index<0) return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    const id=buttons[next].dataset.case;selectCase(id);$('cases').querySelector(`[data-case="${id}"]`).focus();
  });
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    state.filter=button.dataset.filter;
    if(state.filter!=='all'&&current().type!==state.filter) selectCase(cases.find(c=>c.type===state.filter).id);
    else{renderCases();queueFit();}
  }));
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
  $('back-to-business').addEventListener('click',()=>setView('business'));
  $('model').addEventListener('change',()=>{state.model=Number($('model').value);state.revealed=false;renderModel();});
  $('launches').addEventListener('input',()=>{state.launches=Number($('launches').value);renderEconomics();});
  $('launches').addEventListener('pointerdown',()=>{drag=true;});
  window.addEventListener('pointerup',()=>{if(drag){drag=false;queueFit();}});
  window.addEventListener('pointercancel',()=>{drag=false;queueFit();});
  $('launches').addEventListener('change',queueFit);
  document.querySelectorAll('[data-launches]').forEach(button=>button.addEventListener('click',()=>{state.launches=Number(button.dataset.launches);renderEconomics();queueFit();}));
  $('predict').addEventListener('click',()=>{state.revealed=!state.revealed;renderExample();queueFit();});
  $('sources').addEventListener('click',()=>openDetails());
  $('evidence-open').addEventListener('click',()=>openDetails());
  $('assumptions-open').addEventListener('click',()=>openDetails('assumptions'));
  $('details-close').addEventListener('click',()=>$('details').close());
  $('details').addEventListener('click',event=>{if(event.target===$('details')){const box=$('details').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom) $('details').close();}});
  function setTheme(light){document.body.classList.toggle('light',light);$('theme').textContent=light?'Тёмная тема':'Светлая тема';$('theme').setAttribute('aria-pressed',String(light));queueFit();}
  try{setTheme(localStorage.getItem('pfn-theme')==='light');}catch{setTheme(false);}
  $('theme').addEventListener('click',()=>{const light=!document.body.classList.contains('light');setTheme(light);try{localStorage.setItem('pfn-theme',light?'light':'dark');}catch{/* Storage is optional in file:// mode. */}});
  window.addEventListener('resize',queueFit);
  window.addEventListener('hashchange',()=>{const c=cases.find(item=>`#${item.id}`===location.hash);if(c){if(state.filter!=='all'&&c.type!==state.filter) state.filter='all';selectCase(c.id,false);}});
  document.querySelectorAll('.logos img').forEach(img=>img.addEventListener('load',queueFit));
  renderIntro();
  renderCase();
  setView(state.view);
})();
