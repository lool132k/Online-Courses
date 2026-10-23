'use strict';
const courses=[
{
  id:'python',title:'Python для начинающих',category:'Программирование',level:'Начальный',author:'Команда курса',cover:'Py',color:'#eeeaff',ink:'#6750a4',description:'Познакомься с языком Python: от переменных до небольших программ.',lessons:[['Первое знакомство','Python — язык программирования. Программа состоит из инструкций. Например, print("Привет!") выводит сообщение. Попробуй запустить эту строку в своём интерпретаторе.'],['Переменные и типы','Переменная связывает имя со значением: name = "Мир". Числа, строки и логические значения помогают хранить данные. Придумай имена переменных для своего профиля.'],['Условия','Конструкция if позволяет выбрать действие по условию. Сравни два числа и выведи большее. На следующем этапе проекта здесь появится серверный тест.']]
}
,
{
  id:'design',title:'UX/UI дизайн с нуля',category:'Дизайн',level:'Начальный',author:'Команда курса',cover:'Aa',color:'#ffedf2',ink:'#ba6787',description:'Научись превращать задачу пользователя в понятный интерфейс.',lessons:[['Задача пользователя','Начни с вопроса: чего человек хочет достичь? Запиши одну задачу, которую решает твой экран.'],['Иерархия','Размер, отступы и контраст помогают выделить главное. Найди основной заголовок и действие в своём макете.'],['Проверка макета','Попроси другого человека найти курс в макете. Наблюдай, где возникает затруднение.']]
}
,
{
  id:'marketing',title:'Основы digital-маркетинга',category:'Маркетинг',level:'Начальный',author:'Команда курса',cover:'↗',color:'#e9f8ef',ink:'#408966',description:'Разберись, как аудитория находит продукт и принимает решение.',lessons:[['Аудитория','Опиши, кому помогает продукт и какую задачу решает.'],['Каналы','Подбери каналы, где твоя аудитория ищет решение.'],['Метрики','Определи полезное действие и способ его измерить.']]
}
,
{
  id:'data',title:'Анализ данных на Python',category:'Аналитика',level:'Средний',author:'Команда курса',cover:'01',color:'#fff6dc',ink:'#b49139',description:'Исследуй таблицы, находи закономерности и формулируй выводы.',lessons:[['Данные','Проверь названия колонок, единицы измерения и пропуски.'],['Исследование','Посчитай основные показатели и проверь необычные значения.'],['Вывод','Сформулируй вывод, который прямо следует из данных, и укажи ограничения.']]
}
];
const $=s=>document.querySelector(s);
let state={
}
;
let storageOK=true;
try{
  const raw=JSON.parse(localStorage.getItem('names-courses-v1')||'{}');
  for(const c of courses){
    const v=raw?.[c.id];
    if(v&&typeof v.active==='boolean'&&Number.isInteger(v.done)&&v.done>=0&&v.done<=c.lessons.length)state[c.id]=v;
  }
}
catch{
  state={
  }
  ;
}
function save(){
  try{
    localStorage.setItem('names-courses-v1',JSON.stringify(state));
  }
  catch{
    storageOK=false;
  }
  updateCount();
}
function updateCount(){
  $('#count').textContent=Object.values(state).filter(x=>x.active).length;
}
function render(){
  const q=$('#search').value.trim().toLocaleLowerCase('ru');
  const cat=$('#category').value;
  const level=$('#level').value;
  const rows=courses.filter(c=>c.title.toLocaleLowerCase('ru').includes(q)&&(!cat||c.category===cat)&&(!level||c.level===level));
  $('#results').textContent=`Найдено курсов: ${rows.length}`;
  $('#courses').replaceChildren();
  for(const c of rows){
    const el=document.createElement('article');
    el.className='card';
    el.innerHTML=`<div class="cover" style="background:${c.color};color:${c.ink}">${c.cover}</div><div class="card-body"><span class="tag">${c.category}</span><h3>${c.title}</h3><p>${c.author}</p><p>${c.level} · ${c.lessons.length} урока</p><div class="card-bottom"><strong>Бесплатно</strong><button type="button">О курсе ↗</button></div></div>`;
    el.querySelector('button').addEventListener('click',()=>openCourse(c.id));
    $('#courses').append(el);
  }
  if(!rows.length){
    const p=document.createElement('p');
    p.className='empty';
    p.textContent='Курсы не найдены. Попробуй другое название или сбрось фильтры.';
    $('#courses').append(p);
  }
}
let current;
function openCourse(id){
  current=courses.find(c=>c.id===id);
  refreshDetail();
  if(!$('#detail').open)$('#detail').showModal();
}
function refreshDetail(){
  const c=current,s=state[c.id];
  $('#dialog-title').textContent=c.title;
  $('#dialog-category').textContent=c.category;
  $('#dialog-description').textContent=c.description;
  $('#dialog-meta').textContent=`${c.level} · бесплатно · демонстрационный курс`;
  $('#program').replaceChildren();
  c.lessons.forEach((l,i)=>{
    const li=document.createElement('li');
    li.textContent=l[0]+(s&&i<s.done?' — пройден':'');
    $('#program').append(li);
  }
  );
  const active=!!s?.active;
  $('#learning').hidden=!active;
  $('#enroll').hidden=active;
  $('#enroll').textContent=s?'Продолжить с сохранённым прогрессом':'Начать демообучение';
  $('#unsubscribe').hidden=!active;
  if(active){
    const done=s.done;
    $('#lesson-title').textContent=done<c.lessons.length?`Урок ${done+1}. ${c.lessons[done][0]}`:'Курс завершён';
    $('#lesson-text').textContent=done<c.lessons.length?c.lessons[done][1]:'Все демонстрационные уроки пройдены. Результат сохранён в этом браузере.';
    $('#progress').textContent=`Прогресс: ${Math.round(done/c.lessons.length*100)}% · ${done} из ${c.lessons.length}`+(storageOK?'':' · Хранилище недоступно, прогресс сохранён только до закрытия страницы.');
    $('#complete').disabled=done===c.lessons.length;
  }
}
$('#enroll').addEventListener('click',()=>{
  state[current.id]={
    active:true,done:state[current.id]?.done||0
  }
  ;
  save();
  refreshDetail();
}
);
$('#complete').addEventListener('click',()=>{
  const s=state[current.id];
  if(s?.active&&s.done<current.lessons.length){
    s.done++;
    save();
    refreshDetail();
  }
}
);
$('#unsubscribe').addEventListener('click',()=>{
  state[current.id].active=false;
  save();
  refreshDetail();
}
);
$('#close').addEventListener('click',()=>$('#detail').close());
$('#filters').addEventListener('submit',e=>e.preventDefault());
for(const id of ['search','category','level'])$('#'+id).addEventListener('input',render);
function message(title){
  $('#message-title').textContent=title;
  $('#message-body').replaceChildren();
  $('#message').showModal();
}
$('#teacher').addEventListener('click',()=>{
  message('Кабинет преподавателя — следующий этап');
  const p=document.createElement('p');
  p.textContent='В готовой системе подтверждённый пользователь отправит заявку преподавателя. Администратор проверит её и откроет создание курсов. В этой версии доступен каталог и демонстрация обучения.';
  $('#message-body').append(p);
}
);
$('#message-close').addEventListener('click',()=>$('#message').close());
$('#cabinet').addEventListener('click',()=>{
  message('Мои демонстрационные курсы');
  const rows=courses.filter(c=>state[c.id]?.active);
  if(!rows.length){
    const p=document.createElement('p');
    p.textContent='Ты ещё не начал курс. Открой каталог и выбери интересующее направление.';
    $('#message-body').append(p);
  }
  else{
    const ul=document.createElement('ul');
    ul.className='saved-list';
    for(const c of rows){
      const li=document.createElement('li'),b=document.createElement('button');
      b.textContent=`${c.title} · ${Math.round(state[c.id].done/c.lessons.length*100)}%`;
      b.addEventListener('click',()=>{
        $('#message').close();
        openCourse(c.id);
      }
      );
      li.append(b);
      ul.append(li);
    }
    $('#message-body').append(ul);
  }
}
);
updateCount();
render();
