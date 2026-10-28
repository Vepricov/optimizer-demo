'use strict';
// All business parameters below are illustrative planning assumptions, not
// measured reductions in labels. Evidence scores retain their own protocols.
globalThis.PFN_DATA = (() => {
  const sources = {
    active: {url:'https://arxiv.org/html/2603.27385v1', title:'Active In-Context Learning · таблица VI', detail:'100 меток, партии по 10, 10 повторов. ROC-AUC macro one-vs-rest. Из этого сравнения взят результат CatBoost. Значения для представленных здесь моделей заданы как иллюстративные примеры. Метки раскрываются из готового датасета; стоимость разметки не измерялась.'},
    wine: {url:'https://tabularfoundationmodels.com/regression', title:'Christoph Molnar · Wine Quality', detail:'Авторский пример: один сплит, 25% тестовых данных, random_state=1. CatBoost: поиск по 40 конфигурациям. MAE — средняя абсолютная ошибка оценки качества. Разброс по сплитам не опубликован.'},
    engineering: {url:'https://lazy-tfm.readthedocs.io/en/latest/tutorials/choosing_a_model.html', title:'lazy-tfm · инженерные задачи', detail:'Один случайный сплит 90/10. Concrete: 927 примеров контекста, 103 тестовых. Yacht: 277 и 31. CRPS оценивает прогноз распределения; меньше — лучше. Здесь сравниваются PFN между собой, а не с обучением модели с нуля.'},
    graph: {url:'https://arxiv.org/html/2509.21489v4', title:'GraphPFN · GraphLand · таблица 1', detail:'Случайное разбиение 10/10/80%, 10 повторов. Для бинарных задач — Average Precision × 100. LightGBM + NFA уже использует признаки соседей. Стоимость разметки и экономия эксперимента не измерялись.'},
    categories: {url:'https://arxiv.org/html/2509.21489v4', title:'GraphPFN · категории товаров · таблица 8', detail:'H&M: 21 категория, граф совместных покупок. Accuracy × 100. Для GraphPFN используется ECOC. ICL уступает Graph Transformer; результат с дообучением показан отдельно.'}
  };
  const icons = {
    steel:'<path d="M5 8h22v17H5zM10 8v17M17 8l-3 7 6 3-4 7"/>',
    wine:'<path d="M10 4h12l2 9a8 8 0 0 1-16 0zM16 21v7M10 28h12M9 12h14"/>',
    concrete:'<path d="M4 11l12-7 12 7v13l-12 6-12-6zM4 11l12 7 12-7M16 18v12M10 8l12 7"/>',
    yacht:'<path d="M16 3v19H5L16 3zM19 8l8 14h-8M4 25h24l-4 4H8z"/>',
    catalog:'<path d="M4 5h10v10H4zM19 5h9v10h-9zM4 20h10v9H4zM19 20h9v9h-9z"/>',
    moderation:'<path d="M16 3l11 5v8c0 7-11 13-11 13S5 23 5 16V8zM11 16l4 4 7-9"/>',
    reviews:'<path d="M4 5h24v17H13l-7 6v-6H4zM9 11h14M9 16h9"/>',
    crowd:'<circle cx="16" cy="10" r="4"/><path d="M9 27v-4a7 7 0 0 1 14 0v4M5 8a4 4 0 0 0 0 8M27 8a4 4 0 0 1 0 8M3 26v-3a6 6 0 0 1 4-6M29 26v-3a6 6 0 0 0-4-6"/>'
  };
  const observed=(name,score,sd,source,extra={})=>({name,score,sd,source,status:'benchmark',...extra});
  const estimate=(name,score,source)=>({name,score,sd:null,source,status:'estimate'});
  const graphs = {
    catalog: {
      title:'Совместные покупки товаров',relation:'Связь — товары покупали вместе',
      nodes:[
        {x:45,y:45,label:'Пальто',known:true},{x:124,y:37,label:'Куртка',known:true},
        {x:83,y:116,label:'Новый товар',target:true},{x:182,y:101,label:'Шарф'},
        {x:268,y:50,label:'Сумка'},{x:270,y:145,label:'Ремень'},{x:185,y:163,label:'Перчатки'}
      ],edges:[[0,1],[0,2],[1,2],[1,3],[2,3],[3,4],[3,5],[3,6],[4,5],[5,6]]
    },
    moderation: {
      title:'Подписки и связи авторов',relation:'Стрелка — подписка на автора',directed:true,
      nodes:[
        {x:160,y:89,label:'Новый автор',target:true},{x:47,y:44,label:'Автор А',known:true},
        {x:47,y:137,label:'Автор Б',known:true},{x:263,y:40,label:'Автор В'},
        {x:263,y:139,label:'Автор Г'},{x:158,y:24,label:'Автор Д'},{x:161,y:161,label:'Автор Е'}
      ],edges:[[1,0],[2,0],[5,0],[0,3],[0,4],[0,6],[1,5],[2,6]]
    },
    reviews: {
      title:'Авторы и организации',relation:'Связь — автор оставил отзыв об организации',
      nodes:[
        {x:63,y:32,label:'Автор А',known:true},{x:63,y:90,label:'Новый автор',target:true},
        {x:63,y:151,label:'Автор Б',known:true},{x:248,y:32,label:'Кафе',kind:'place'},
        {x:248,y:90,label:'Магазин',kind:'place'},{x:248,y:151,label:'Отель',kind:'place'}
      ],edges:[[0,3],[0,4],[1,3],[1,4],[1,5],[2,4],[2,5]]
    },
    crowd: {
      title:'Исполнители и общие задания',relation:'Связь — исполнитель выполнил задание',
      nodes:[
        {x:48,y:42,label:'Исполнитель А',known:true},{x:160,y:42,label:'Новый',target:true},
        {x:272,y:42,label:'Исполнитель Б',known:true},{x:40,y:145,label:'Задание 1',kind:'task'},
        {x:120,y:145,label:'Задание 2',kind:'task'},{x:200,y:145,label:'Задание 3',kind:'task'},
        {x:280,y:145,label:'Задание 4',kind:'task'}
      ],edges:[[0,3],[0,4],[1,3],[1,4],[1,5],[2,5],[2,6]]
    }
  };
  const cases = [
    {id:'steel',name:'Дефекты стали',tag:'Контроль качества',type:'table',title:'Находим дефекты на производстве',
      description:'Определяем тип дефекта по табличным признакам, дополняющим изображение: марке и толщине стали, геометрии и яркости дефекта. Эксперт проверяет опорные ответы для новой линии или продукции.',scale:'Новые линии, материалы или типы продукции',unit:'проверок дефектов',expert:'Инженер по качеству',predict:'Дефект: царапина',
      columns:['Площадь, пикс.','Толщина стали, мм','Ответ эксперта'],rows:[['128','1,2','Царапина'],['340','2,0','Пятно'],['86','1,0','Царапина']],query:['114','1,2'],
      metric:{name:'ROC-AUC ↑',unit:'',digits:3,lower:false,baseName:'CatBoost + отбор примеров',base:.884,note:'100 размеченных примеров · среднее по 10 повторам'},
      models:[estimate('TabICLv2',.905,'active'),estimate('Kumo Tabular',.910,'active')],
      experiment:'На новой линии инженер размечает {labels} дефектов. PFN и классический ML сравниваем на отдельной партии: проверяем тип дефекта и долю пропущенного брака.',
      econ:{baseLabels:1000,pfnLabels:150,minutes:3,expertRate:2000,testCost:0,experts:1,waitDays:0,commonDays:2,commonCost:45000,baseSetupHours:60,pfnSetupHours:12,engineerRate:3000}},
    {id:'wine',name:'Качество вина',tag:'Экспертная оценка',type:'table',title:'Оцениваем качество новой партии',
      description:'По составу и физико-химическим показателям прогнозируем сенсорную оценку. Опорные ответы дают дегустаторы.',scale:'Новые линейки, урожаи и производственные площадки',unit:'экспертных оценок',expert:'Дегустационная комиссия',predict:'Оценка качества: 6,4',
      columns:['Алкоголь, %','Кислотность pH','Оценка эксперта'],rows:[['10,5','3,2','6'],['12,0','3,4','7'],['9,5','3,1','5']],query:['11,2','3,3'],
      metric:{name:'Ошибка оценки MAE ↓',digits:3,lower:true,baseName:'CatBoost с подбором параметров',base:.435,note:'Один опубликованный сплит · ошибка в баллах качества'},
      models:[observed('TabICLv2',.388,null,'wine'),estimate('Kumo Tabular',.380,'wine')],
      experiment:'Комиссия оценивает {labels} образцов нового урожая. На отдельной слепой дегустации сравниваем прогнозы PFN и классического ML с оценками комиссии по средней ошибке в баллах.',
      econ:{baseLabels:500,pfnLabels:125,minutes:12,expertRate:3000,testCost:500,experts:2,waitDays:0,commonDays:3,commonCost:90000,baseSetupHours:48,pfnSetupHours:20,engineerRate:3000}},
    {id:'concrete',name:'Прочность бетона',tag:'Дорогие испытания',type:'table',title:'Выбираем перспективные составы бетона',
      description:'По рецептуре и возрасту прогнозируем прочность. Проверенные ответы получаем испытанием образцов.',scale:'Новые рецептуры и источники сырья',unit:'испытаний образцов',expert:'Инженер лаборатории',predict:'Прочность: 42 МПа',
      columns:['Цемент, кг/м³','Возраст, дней','Прочность, МПа'],rows:[['300','28','38'],['350','28','45'],['280','14','26']],query:['325','28'],
      metric:{name:'Ошибка распределения CRPS ↓',digits:3,lower:true,baseName:'TabICLv2',base:1.230,note:'Сравнение PFN · 927 примеров контекста, 103 тестовых'},
      models:[observed('Kumo Tabular',1.171,null,'engineering'),observed('TabICLv2',1.230,null,'engineering')],
      experiment:'Испытываем {labels} составов после 28 дней выдержки и передаём результаты PFN. Для новых рецептур сравниваем прогноз прочности с отдельными контрольными испытаниями и классическим ML.',
      econ:{baseLabels:80,pfnLabels:30,minutes:30,expertRate:2500,testCost:15000,experts:2,waitDays:28,commonDays:3,commonCost:100000,baseSetupHours:60,pfnSetupHours:18,engineerRate:3000}},
    {id:'yacht',name:'Корпус яхты',tag:'Инженерные испытания',type:'table',title:'Сравниваем варианты корпуса до испытаний',
      description:'По геометрии и скорости прогнозируем сопротивление корпуса. Исходные ответы требуют физических измерений.',scale:'Новые семейства корпусов и режимы движения',unit:'физических измерений',expert:'Инженер-гидродинамик',predict:'Сопротивление: 3,8',
      columns:['Длина / ширина','Число Фруда','Сопротивление'],rows:[['3,1','0,25','1,8'],['3,4','0,35','5,2'],['3,2','0,30','3,1']],query:['3,3','0,32'],
      metric:{name:'Ошибка распределения CRPS ↓',digits:3,lower:true,baseName:'TabICLv2',base:.277,note:'Сравнение PFN · 277 примеров контекста, 31 тестовый'},
      models:[observed('Kumo Tabular',.171,null,'engineering'),observed('TabICLv2',.277,null,'engineering')],
      experiment:'Измеряем сопротивление для {labels} сочетаний геометрии корпуса и скорости. На новых вариантах проверяем ошибку прогноза PFN и классического ML по отдельным измерениям в бассейне.',
      econ:{baseLabels:60,pfnLabels:12,minutes:90,expertRate:4000,testCost:30000,experts:2,waitDays:5,commonDays:3,commonCost:60000,baseSetupHours:48,pfnSetupHours:10,engineerRate:3500}},
    {id:'catalog',name:'Каталог товаров',tag:'Граф покупок',type:'graph',title:'Наводим порядок в каталоге товаров',
      description:'По признакам товара и совместным покупкам определяем категорию. Эксперт задаёт категории опорным товарам.',scale:'Новые разделы и товарные линейки с историей покупок',unit:'категорий товаров',expert:'Контент-менеджер каталога',predict:'Категория: верхняя одежда',
      columns:['Материал','Признак','Категория'],rows:[['Шерсть','Длинный рукав','Верхняя одежда'],['Хлопок','Короткий рукав','Футболки'],['Деним','Длинные','Брюки']],query:['Шерсть','Длинный рукав'],
      metric:{name:'Верные категории, % ↑',digits:2,lower:false,baseName:'Graph Transformer',base:69.27,note:'H&M · 21 категория · граф совместных покупок'},
      models:[observed('GraphPFN + дообучение',78.67,.20,'categories',{finetune:true}),observed('GraphPFN · ICL',55.25,.75,'categories')],
      graph:graphs.catalog,
      experiment:'Эксперт задаёт категории для {labels} товаров нового раздела. С учётом графа совместных покупок сравниваем долю верных категорий PFN и обычной модели на других товарах.',
      econ:{baseLabels:2000,pfnLabels:600,minutes:2,expertRate:1500,testCost:0,experts:2,waitDays:0,commonDays:5,commonCost:180000,baseSetupHours:90,pfnSetupHours:36,engineerRate:3000}},
    {id:'moderation',name:'Модерация',tag:'Граф авторов',type:'graph',title:'Помогаем модераторам находить контент',
      description:'По признакам и связям авторов выявляем тех, кто создаёт explicit-контент. Опорные ответы дают модераторы.',scale:'Новые сообщества, правила и сегменты платформы',unit:'проверок авторов',expert:'Модератор',predict:'Автор: на проверку',
      columns:['Публикации','Связи','Ответ модератора'],rows:[['18','12','На проверку'],['42','9','Обычный'],['11','15','На проверку']],query:['16','13'],
      metric:{name:'Качество отбора AP, % ↑',digits:2,lower:false,baseName:'LightGBM + признаки соседей',base:46.13,note:'artnet-exp · AP — качество ранжирования авторов'},
      models:[observed('GraphPFN · ICL',51.79,.11,'graph'),observed('GraphPFN + дообучение',53.49,.81,'graph',{finetune:true})],
      graph:graphs.moderation,
      experiment:'Модераторы проверяют {labels} авторов нового сообщества. На другой группе авторов сравниваем PFN и обычную модель: сколько нарушений находим при одинаковом числе ручных проверок.',
      econ:{baseLabels:3000,pfnLabels:600,minutes:4,expertRate:1500,testCost:0,experts:2,waitDays:0,commonDays:4,commonCost:220000,baseSetupHours:60,pfnSetupHours:24,engineerRate:3000}},
    {id:'reviews',name:'Поддельные отзывы',tag:'Граф авторов',type:'graph',title:'Выявляем авторов поддельных отзывов',
      description:'Учитываем поведение авторов и общие организации в их отзывах. Специалист проверяет подозрительные аккаунты.',scale:'Новые города, категории организаций и сегменты',unit:'проверок аккаунтов',expert:'Специалист по доверию',predict:'Аккаунт: на проверку',
      columns:['Отзывы','Общие места','Ответ специалиста'],rows:[['28','17','На проверку'],['12','2','Обычный'],['35','21','На проверку']],query:['24','16'],
      metric:{name:'Качество отбора AP, % ↑',digits:2,lower:false,baseName:'LightGBM + признаки соседей',base:78.53,note:'city-reviews · AP — качество ранжирования авторов'},
      models:[observed('GraphPFN · ICL',80.25,.05,'graph'),observed('GraphPFN + дообучение',80.90,.03,'graph',{finetune:true})],
      graph:graphs.reviews,
      experiment:'Специалист проверяет {labels} аккаунтов в новом городе. На отдельных авторах сравниваем PFN и обычную модель по качеству очереди проверок и числу ошибочно отмеченных аккаунтов.',
      econ:{baseLabels:2000,pfnLabels:200,minutes:6,expertRate:2000,testCost:0,experts:2,waitDays:0,commonDays:4,commonCost:100000,baseSetupHours:72,pfnSetupHours:12,engineerRate:3000}},
    {id:'crowd',name:'Краудсорсинг',tag:'Граф исполнителей',type:'graph',title:'Ускоряем контроль качества исполнителей',
      description:'По статистике работы и общим заданиям определяем подозрительных исполнителей. Метка в бенчмарке — блокировка в проекте.',scale:'Новые проекты и виды заданий',unit:'проверок исполнителей',expert:'Специалист по качеству',predict:'Исполнитель: на проверку',
      columns:['Задания','Принято, %','Ответ специалиста'],rows:[['120','62','На проверку'],['240','97','Обычный'],['90','58','На проверку']],query:['110','64'],
      metric:{name:'Качество отбора AP, % ↑',digits:2,lower:false,baseName:'LightGBM + признаки соседей',base:56.34,note:'tolokers-2 · AP — качество ранжирования исполнителей'},
      models:[observed('GraphPFN · ICL',61.29,.12,'graph'),observed('GraphPFN + дообучение',62.80,.39,'graph',{finetune:true})],
      graph:graphs.crowd,
      experiment:'Специалист оценивает {labels} исполнителей нового проекта. На других исполнителях проверяем PFN и обычную модель: долю выявленных нарушений и ошибочных отправок на проверку.',
      econ:{baseLabels:1500,pfnLabels:500,minutes:8,expertRate:1800,testCost:0,experts:2,waitDays:0,commonDays:4,commonCost:100000,baseSetupHours:60,pfnSetupHours:18,engineerRate:3000}}
  ];
  return {sources,icons,cases};
})();
