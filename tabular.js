'use strict';
// Muon: pinned author logs in data.js. ALSO: arXiv:2508.16734v2,
// Table 1, MLP-PLR, means ± SD over 15 runs. Each gain is measured
// against its own AdamW. Business transfers below are demo assumptions.
const TB_ALSO_SOURCE='https://arxiv.org/pdf/2508.16734#page=9';
const TB_MUON_SOURCE='https://arxiv.org/abs/2604.15297';
function tbRegisterSources(data){
 if(!data.sources.some(s=>s.url===TB_ALSO_SOURCE))data.sources.push({name:'ALSO — Adaptive Loss Scaling Optimizer',domain:'Табличные данные · результат лаборатории',url:TB_ALSO_SOURCE,status:'Опубликованные измерения',detail:'arXiv:2508.16734v2, Table 1. MLP-PLR, 15 повторов. Ecom Offers, Churn Modelling, California Housing, Weather. Выигрыш каждого метода переносится относительно собственного AdamW. Деньги — сценарная оценка для указанного сегмента бизнеса; параметры и формулы описаны в README проекта.'});
}
const TB_CASES={
 ecom:{name:'Предложения',subtitle:'Больше покупок',dataset:'tabred/ecom-offers',title:'Персональные предложения',also:[.5810,.5976,.0039,.0020],
  description:'По данным о клиенте и предложении модель оценивает вероятность покупки. Сервис выбирает товары для персональной рассылки и витрины.',
  business:'Более релевантные предложения повышают конверсию. Считаем выручку сервиса с покупок по этим предложениям.',
  scope:'Выручка предложений',scopeNote:'Покупки из персональных предложений',
  icon:'<path d="M4 5h3l3 14h12l3-10H8M11 24h.01M21 24h.01"/>',
  // +0.01 AUC -> +0.10 percentage points of conversion.
  economics:{frequency:4,base:3,check:5000,share:10,bridge:.1}},
 churn:{name:'Удержание',subtitle:'Больше сохранённых подписок',dataset:'churn',title:'Удержание клиентов',also:[.8616,.8666,.0015,.0027],
  description:'По профилю и поведению клиента модель оценивает риск ухода. Сервис заранее предлагает помощь или персональное условие подписки.',
  business:'При том же охвате кампании находим больше клиентов с риском ухода. Считаем месячную выручку сохранённых подписок.',
  scope:'Выручка от удержания',scopeNote:'Только подписки, сохранённые кампанией',
  icon:'<circle cx="12" cy="10" r="4"/><path d="M4 25v-3a8 8 0 0 1 16 0M22 8h6m-3-3v6"/>',
  // +0.01 AUC -> +5 pp precision at fixed campaign coverage.
  // Initial precision 15% at 20% coverage implies recall 60% at 5% churn.
  economics:{churn:5,check:1500,budget:20,precision:15,success:25,bridge:5}},
 housing:{name:'Недвижимость',subtitle:'Больше сделок',dataset:'california',title:'Оценка стоимости жилья',also:[.4602,.4495,.0042,.0046],
  description:'Модель прогнозирует стоимость жилья по характеристикам района. Используем такой прогноз как основу оценки объекта в риелторском сервисе.',
  business:'Более точная оценка помогает согласовать цену и довести обращение до сделки. Считаем комиссионную выручку сервиса.',
  scope:'Комиссионная выручка',scopeNote:'Сделки из обращений за оценкой жилья',
  icon:'<path d="M3 15 16 4l13 11M7 13v15h18V13M12 28v-9h8v9"/>',
  // Each 1% reduction in RMSE -> 4% relative lift in closing conversion.
  economics:{frequency:.02,base:2,check:150000,bridge:4}},
 weather:{name:'Погодный сервис',subtitle:'Больше платных подписок',dataset:'tabred/weather',title:'Платные прогнозы погоды',also:[1.5208,1.4928,.0037,.0042],
  description:'Модель прогнозирует погоду по метеоданным. На её основе сервис предлагает пользователям подробный прогноз по подписке.',
  business:'Более полезный прогноз повышает конверсию в платную версию. Считаем месячную выручку платных подписок.',
  scope:'Выручка подписок',scopeNote:'Платная версия погодного сервиса',
  icon:'<path d="M9 23H7a5 5 0 0 1 0-10 7 7 0 0 1 14-2 6 6 0 1 1 3 12H9M11 27v2M18 27v2M25 27v2M4 5l2 2M15 2v3"/>',
  // Each 1% reduction in RMSE -> 4% relative lift in paid conversion.
  economics:{frequency:1,base:2,check:500,bridge:4}}
};
const tbState={scenario:'ecom',position:6,method:'also'};
const tbMoney=v=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',notation:'compact',maximumFractionDigits:2}).format(v);
const tbCount=v=>new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:Math.abs(v)<100?2:1}).format(v);
const tbSignedMoney=v=>(v<0?'−':v>0?'+':'')+tbMoney(Math.abs(v));
const tbBound=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
function tbMeasurements(scenario){
 const c=TB_CASES[scenario],row=D.tabular.find(r=>r.id===c.dataset),a=row.methods.adamw,m=row.methods.muon;
 const gain=(base,value)=>row.lower?(base-value)/base:value-base;
 return {row,methods:[
  {id:'adamw',name:'AdamW',color:'var(--lane-adam)',gain:0,base:a.mean,score:a.mean,sd:a.sd,n:a.n,source:a.source},
  {id:'muon',name:'Muon',color:'var(--muon)',gain:gain(a.mean,m.mean),base:a.mean,score:m.mean,sd:m.sd,n:m.n,source:m.source},
  {id:'also',name:'ALSO',color:'var(--also)',gain:gain(c.also[0],c.also[1]),base:c.also[0],score:c.also[1],sd:c.also[3],n:15,source:TB_ALSO_SOURCE}
 ]};
}
// Revenue always covers the named segment with the SAME scope for all methods.
// Audience scales volumes, not measured model quality.
function tbProject(scenario,users,p,measurement){
 const gain=measurement.gain;
 let baseEvents,events,rateBefore,rateAfter,unitRevenue,opportunities;
 if(scenario==='churn'){
  opportunities=users*p.budget/100;
  const atRisk=users*p.churn/100;
  // Bound true positives BEFORE applying retention success: recall <= 100%.
  const maximumPrecision=opportunities?Math.min(1,atRisk/opportunities):0;
  rateBefore=tbBound(p.precision/100,0,maximumPrecision);
  rateAfter=tbBound(rateBefore+gain*p.bridge,0,maximumPrecision);
  baseEvents=opportunities*rateBefore*p.success/100;
  events=opportunities*rateAfter*p.success/100;
  unitRevenue=p.check;
 }else{
  opportunities=users*p.frequency;
  rateBefore=p.base/100;
  rateAfter=tbBound(scenario==='ecom'?rateBefore+gain*p.bridge:rateBefore*(1+gain*p.bridge),0,1);
  baseEvents=opportunities*rateBefore;
  events=opportunities*rateAfter;
  unitRevenue=p.check*(scenario==='ecom'?p.share/100:1);
 }
 const baseRevenue=baseEvents*unitRevenue,revenue=events*unitRevenue;
 return {...measurement,users,opportunities,events,baseEvents,rateBefore,rateAfter,baseRevenue,revenue,unitRevenue,
  delta:revenue-baseRevenue,deltaEvents:events-baseEvents};
}
function tbCurrent(){
 const scenario=tbState.scenario,{row,methods}=tbMeasurements(scenario),c=TB_CASES[scenario],p=c.economics,users=10**tbState.position;
 return {scenario,c,p,users,row,results:methods.map(m=>tbProject(scenario,users,p,m))};
}
// Inverse-RMSE index: 100 is AdamW; less error means a HIGHER index.
// This is not accuracy or the fraction of correct predictions.
function tbQuality(r,row){return row.lower?fmt(100*r.base/r.score,1):signed(r.gain*100,3)+' п.п.';}
function renderTabularBusiness(){
 const {scenario,c}=tbCurrent();$('controls').innerHTML='';
 $('result').innerHTML=`<div class="tb" id="tb-slide">
 <div class="tb-head"><div><div class="eyebrow">Результаты исследований · табличные данные</div><h2>Точнее прогнозы. <em>Выше выручка.</em></h2><p>Меняем оптимизатор обучения. Улучшаем решения сервиса на той же аудитории.</p></div>
 <div class="tb-research"><a href="${TB_MUON_SOURCE}" target="_blank" rel="noopener noreferrer"><b>Muon ↗</b><span>Бенчмарк оптимизаторов</span></a><a href="${TB_ALSO_SOURCE}" target="_blank" rel="noopener noreferrer"><b>ALSO ↗</b><span>Наш метод: адаптивные веса данных</span></a></div></div>
 <div class="tb-cases" role="group" aria-label="Бизнес-сценарий">${Object.entries(TB_CASES).map(([id,x])=>`<button class="tb-case ${id===scenario?'active':''}" data-tb-case="${id}" aria-pressed="${id===scenario}"><svg viewBox="0 0 32 32" aria-hidden="true">${x.icon}</svg><span><b>${x.name}</b><small>${x.subtitle}</small></span></button>`).join('')}</div>
 <section class="tb-task" aria-label="Описание задачи"><div><span class="tb-label">Что предсказывает модель</span><p>${esc(c.description)}</p></div><div><span class="tb-label">Как это влияет на бизнес</span><p>${esc(c.business)}</p></div></section>
 <section class="tb-audience" aria-label="Масштаб сервиса"><div><label class="tb-label" for="tb-users">Пользователи сервиса в месяц</label><output class="tb-users" id="tb-users-value" for="tb-users"></output></div><div class="tb-range"><input id="tb-users" type="range" min="4" max="8" step=".01" value="${tbState.position}" aria-label="Число пользователей сервиса в месяц"><div class="tb-ticks">${[[4,'10 тыс.'],[5,'100 тыс.'],[6,'1 млн'],[7,'10 млн'],[8,'100 млн']].map(([n,label])=>`<button data-tb-size="${n}">${label}</button>`).join('')}</div></div><div class="tb-baseline"><span class="tb-label">${esc(c.scope)} с AdamW / мес.</span><strong id="tb-base-revenue"></strong><small>${esc(c.scopeNote)}</small></div></section>
 <div class="tb-kpi-top"><span id="tb-selected-label"></span><div class="tb-methods" role="group" aria-label="Метод для подробного расчёта">${['muon','also'].map(id=>`<button data-tb-method="${id}" aria-pressed="false">${id==='muon'?'Muon':'ALSO'}</button>`).join('')}</div></div>
 <div class="tb-kpis" aria-live="polite" aria-atomic="true">${[['Прирост выручки / месяц','tb-gain','tb-gain-note'],['','tb-events','tb-events-note'],['','tb-rate','tb-rate-note'],['','tb-quality','tb-quality-note']].map(([title,id,note])=>`<div class="tb-kpi"><span class="tb-label" id="${id}-label">${title}</span><strong id="${id}"></strong><small id="${note}"></small></div>`).join('')}</div>
 <div class="tb-panels"><section class="tb-panel"><div class="tb-panel-head"><h3>${esc(c.scope)} по методам</h3><span>Прирост к AdamW / месяц</span></div><div id="tb-revenue"></div><p class="tb-panel-note">${esc(c.scopeNote)}. Пунктир — уровень AdamW.</p></section>
 <section class="tb-panel"><div class="tb-panel-head"><h3>Как качество превращается в деньги</h3><span>${esc(c.title)}</span></div><div class="tb-chain" id="tb-chain"></div><div class="tb-equation" id="tb-equation"></div><p class="tb-panel-note" id="tb-mechanism"></p></section></div>
 <p class="tb-footnote"><span>Прирост выручки — относительно AdamW в указанном сегменте. Результаты качества — из исследований.</span><span>Аудитория меняет выручку, качество модели остаётся тем же.</span></p></div>`;
 document.querySelectorAll('[data-tb-case]').forEach(b=>b.addEventListener('click',()=>{tbState.scenario=b.dataset.tbCase;renderTabularBusiness();}));
 document.querySelectorAll('[data-tb-size]').forEach(b=>b.addEventListener('click',()=>{tbState.position=Number(b.dataset.tbSize);$('tb-users').value=tbState.position;drawTabularBusiness();}));
 $('tb-users').addEventListener('input',e=>{tbState.position=Number(e.target.value);drawTabularBusiness();});
 document.querySelectorAll('.tb-methods [data-tb-method]').forEach(b=>b.addEventListener('click',()=>{tbState.method=b.dataset.tbMethod;drawTabularBusiness();}));
 drawTabularBusiness();
}
function drawTabularBusiness(){
 if(!$('tb-slide'))return;
 const {scenario,c,p,users,row,results}=tbCurrent(),r=results.find(x=>x.id===tbState.method),a=results[0];
 $('tb-slide').style.setProperty('--method-color',r.color);
 $('tb-users-value').textContent=tbCount(users);$('tb-users').setAttribute('aria-valuetext',fmt(users,0)+' пользователей в месяц');
 $('tb-base-revenue').textContent=tbMoney(a.revenue);$('tb-selected-label').textContent=`${c.title} · эффект ${r.name} относительно AdamW`;
 document.querySelectorAll('.tb-methods button').forEach(b=>{b.classList.toggle('active',b.dataset.tbMethod===r.id);b.setAttribute('aria-pressed',String(b.dataset.tbMethod===r.id));});
 const put=(id,text,negative=false)=>{$(id).textContent=text;$(id).classList.toggle('negative',negative);};
 const revenueGain=x=>x.baseRevenue?signed(x.delta/x.baseRevenue*100,2)+'%':'0%';
 put('tb-gain',revenueGain(r),r.delta<0);put('tb-gain-note',`(${tbSignedMoney(r.delta)}) к выручке сегмента`);
 const eventLabels={ecom:'Дополнительные покупки',churn:'Дополнительно удержаны',housing:'Дополнительные сделки',weather:'Дополнительные подписки'};
 put('tb-events-label',eventLabels[scenario]);put('tb-events',(r.deltaEvents<0?'−':r.deltaEvents>0?'+':'')+tbCount(Math.abs(r.deltaEvents)),r.deltaEvents<0);
 put('tb-events-note','в месяц · при той же аудитории');
 const rateLabels={ecom:'Конверсия в покупку',churn:'Точность отбора для удержания',housing:'Конверсия оценки в сделку',weather:'Конверсия в платную версию'};
 put('tb-rate-label',rateLabels[scenario]);put('tb-rate',fmt(r.rateBefore*100,2)+' → '+fmt(r.rateAfter*100,2)+'%');
 put('tb-rate-note',scenario==='churn'?'Доля уходящих среди выбранных':'AdamW → '+r.name);
 put('tb-quality-label',row.lower?'Индекс качества прогноза ↑':'Качество модели ↑');
 put('tb-quality',tbQuality(r,row),r.gain<0);
 put('tb-quality-note',row.lower?'AdamW = 100 · больше — лучше':'ROC-AUC · разница со своим AdamW');
 $('tb-quality').title=row.lower?'Индекс = 100 × RMSE своего AdamW / RMSE метода. Меньшая ошибка даёт больший индекс.':'Абсолютная прибавка ROC-AUC относительно AdamW в собственном эксперименте.';
 const maxRevenue=Math.max(...results.map(x=>x.revenue))*1.08,basePct=maxRevenue?100*a.revenue/maxRevenue:0;
 $('tb-revenue').innerHTML=results.map(x=>`<div class="tb-revenue-row" style="--row-color:${x.color}"><button ${x.id==='adamw'?'disabled':''} data-tb-method="${x.id}" aria-pressed="${x.id===r.id}">${x.name}</button><div class="tb-bar"><div class="tb-bar-fill" style="width:${maxRevenue?100*x.revenue/maxRevenue:0}%"></div><i class="tb-base-line" style="left:${basePct}%"></i></div><div class="tb-revenue-number">${x.id==='adamw'?tbMoney(x.revenue):revenueGain(x)}<small class="${x.delta<0?'negative':''}">${x.id==='adamw'?'базовая выручка':`(${tbSignedMoney(x.delta)})`}</small></div></div>`).join('');
 document.querySelectorAll('#tb-revenue [data-tb-method]:not([disabled])').forEach(b=>b.addEventListener('click',()=>{tbState.method=b.dataset.tbMethod;drawTabularBusiness();}));
 const chain=scenario==='ecom'?[[tbCount(r.opportunities),'предложений / месяц'],[tbCount(r.events),'покупок / месяц'],[tbMoney(r.unitRevenue),'выручка сервиса / покупка']]:scenario==='churn'?[[tbCount(r.opportunities),'клиентов в кампании'],[tbCount(r.events),'сохранённых подписок'],[tbMoney(p.check),'выручка / подписка в месяц']]:scenario==='housing'?[[tbCount(r.opportunities),'обращений за оценкой'],[tbCount(r.events),'сделок / месяц'],[tbMoney(r.unitRevenue),'комиссия / сделка']]:[[tbCount(users),'пользователей сервиса'],[tbCount(r.events),'платных подписок'],[tbMoney(r.unitRevenue),'выручка / подписка в месяц']];
 $('tb-chain').innerHTML=chain.map(([v,label])=>`<div><strong>${v}</strong><span>${label}</span></div>`).join('');
 const eventName={ecom:'покупки',churn:'сохранённые подписки',housing:'сделки',weather:'платные подписки'};
 $('tb-equation').innerHTML=`Выручка = <b>${eventName[scenario]} × ${tbMoney(r.unitRevenue)}</b>`;
 const mechanism={ecom:`${fmt(p.frequency,0)} предложения на пользователя · чек ${tbMoney(p.check)} · доля сервиса ${fmt(p.share,0)}%.`,
  churn:`Охват кампании — ${fmt(p.budget,0)}% аудитории. Удерживаем ${fmt(p.success,0)}% найденных клиентов с риском ухода.`,
  housing:`За оценкой обращаются ${fmt(p.frequency*100,0)}% пользователей. Считаем комиссию только с закрытых сделок.`,
  weather:`Месячная подписка — ${tbMoney(p.check)}. Более точный прогноз повышает ценность платной версии.`};
 put('tb-mechanism',mechanism[scenario]);
}
