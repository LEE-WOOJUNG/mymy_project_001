/* 여행 기록 - 앱 스크립트 */
/* ========== 저장소 ========== */
const KEY = 'travelLog.v1';
let state = load();
function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY));
    if(s && Array.isArray(s.trips)) return s;
  }catch(e){}
  return {trips:[], currentTripId:null, tab:'schedule', selDate:null, expFilter:'all'};
}
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }
  catch(e){ toast('저장 실패: 브라우저 저장공간을 확인하세요'); }
}

/* ========== 유틸 ========== */
const uid = () => Math.random().toString(36).slice(2,8) + Date.now().toString(36);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const ds = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const pd = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); };
const addDays = (s,n) => { const d = pd(s); d.setDate(d.getDate()+n); return ds(d); };
const WD = ['일','월','화','수','목','금','토'];
const todayStr = () => ds(new Date());
function rangeDates(a,b){
  const out = []; if(!a || !b || a > b) return out;
  for(let s = a; s <= b && out.length < 400; s = addDays(s,1)) out.push(s);
  return out;
}
function fmtDate(s, withYear){
  if(!s) return '';
  const d = pd(s);
  return `${withYear ? d.getFullYear()+'. ' : ''}${d.getMonth()+1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
}
function fmtDT(v){
  if(!v) return '';
  const [dPart,t] = v.split('T'); const d = pd(dPart);
  return `${d.getMonth()+1}.${d.getDate()} (${WD[d.getDay()]}) ${t||''}`;
}
const money = n => Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:2});
function toast(msg){
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 1800);
}
const curTrip = () => state.trips.find(t => t.id === state.currentTripId);
function dday(t){
  if(!t.start) return '';
  const today = todayStr();
  if(today < t.start){ const n = Math.round((pd(t.start)-pd(today))/864e5); return `D-${n}`; }
  if(t.end && today > t.end) return '다녀옴';
  return `여행 중 · Day ${Math.round((pd(today)-pd(t.start))/864e5)+1}`;
}

/* ========== 모달 ========== */
const modal = document.getElementById('modal');
const modalForm = document.getElementById('modalForm');
function openModal(title, html, onSave, okText='저장'){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalOk').textContent = okText;
  modalForm.onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(modalForm));
    if(onSave(data, modalForm) === false) return;
    closeModal(); render();
  };
  modal.showModal();
  const first = modalForm.querySelector('#modalBody input, #modalBody select, #modalBody textarea');
  if(first) first.focus();
}
function closeModal(){ modal.close(); }
// 브라우저 기본 confirm 대신 앱 안의 확인창 사용 (일부 환경에서 confirm이 막혀 삭제가 안 되는 문제 방지)
function ask(msg, onYes, okText='삭제'){
  openModal('확인', `<p style="white-space:pre-wrap;margin:0">${esc(msg)}</p>`, () => { onYes(); }, okText);
  document.getElementById('modalOk').focus();
}
// 한글 입력(IME) 조합 중 Enter는 무시
const enter = (e, fn) => { if(e.key === 'Enter' && !e.isComposing && e.keyCode !== 229){ e.preventDefault(); fn(); } };

/* ========== 렌더 ========== */
function render(){
  const t = curTrip();
  if(!t){ state.currentTripId = null; renderHome(); }
  else renderTrip(t);
  save();
}
function go(tripId){ state.currentTripId = tripId; state.selDate = null; render(); window.scrollTo(0,0); }
function setTab(tab){ state.tab = tab; render(); }

/* ---------- 홈 ---------- */
const TRIP_DECO = ['✈️','🧳','🌴','🗺️','⛰️','🏖️','🌸','🗼','🎒','🌙'];
function renderHome(){
  // 날짜순(오래된 → 최근)으로 나열
  const trips = [...state.trips].sort((a,b) => (a.start||'').localeCompare(b.start||''));
  const today = todayStr();
  const upcoming = trips.filter(t => t.end >= today).length;
  const hour = new Date().getHours();
  const hello = hour < 11 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '포근한 저녁이에요';
  const slides = trips.map((t, i) => {
    const h = tripHue(t);
    const doneN = t.prep.filter(it => isDone(t,it)).length, pct = t.prep.length ? Math.round(doneN / t.prep.length * 100) : 0;
    return `
    <div class="slide" data-i="${i}">
      <article class="tcard" tabindex="0" aria-label="${esc(t.name)}" onclick="slideClick(${i},'${t.id}')" onkeydown="if(event.key==='Enter')go('${t.id}')">
        <div class="tcover" style="--h:${h}">
          <div class="sun"></div>
          <div class="deco">${TRIP_DECO[(i + h) % TRIP_DECO.length]}</div>
          <div class="top">
            ${dday(t) ? `<span class="dday">${dday(t)}</span>` : ''}
            <div class="acts">
              <button class="icon-btn" title="여행 정보 수정" aria-label="여행 정보 수정" onclick="event.stopPropagation();tripModal('${t.id}')">✎</button>
              <button class="icon-btn" title="여행 삭제" aria-label="여행 삭제" onclick="event.stopPropagation();delTrip('${t.id}')">🗑</button>
            </div>
          </div>
          <span class="dest-pill">📍 ${esc(t.dest || '목적지 미정')}</span>
        </div>
        <div class="tbody">
          <div class="name">${esc(t.name)}</div>
          <div class="dates">${t.start ? `${fmtDate(t.start,true)} ~ ${fmtDate(t.end)} · ${rangeDates(t.start,t.end).length}일` : '날짜 미정'}</div>
          <div class="stats">
            <span class="badge gray">👥 ${t.people.length}명</span>
            <span class="badge gray">✈ 항공 ${t.flights.length}</span>
            <span class="badge gray">💰 지출 ${t.expenses.length}건</span>
          </div>
          <div class="foot">
            <span class="small muted" style="white-space:nowrap">준비 ${pct}%</span>
            <div class="mini-prog"><div style="width:${pct}%"></div></div>
            <button class="open-btn" tabindex="-1" onclick="event.stopPropagation();go('${t.id}')">열기 →</button>
          </div>
        </div>
      </article>
    </div>`;
  }).join('');
  const total = trips.length + 1;
  document.getElementById('app').innerHTML = `
    <div class="home-top">
      <div>
        <div class="eyebrow">Travel Journal</div>
        <h1>${hello} ☀️</h1>
        <p>${trips.length ? `지금까지 ${trips.length}번의 여행 · 다가오는 여행 ${upcoming}개` : '첫 여행을 등록하고 일정, 항공권, 경비, 준비물을 한곳에서 관리해 보세요'}</p>
      </div>
      <div class="spacer"></div>
      <div class="home-tools">
        <button class="ghost" onclick="exportData()">백업 내보내기</button>
        <button class="ghost" onclick="document.getElementById('importFile').click()">백업 불러오기</button>
        <button class="btn primary" onclick="tripModal()">+ 새 여행</button>
      </div>
    </div>
    <section class="carousel" aria-roledescription="carousel" aria-label="내 여행">
      <button class="car-nav prev" aria-label="이전 여행" onclick="carGo(carIdx-1)">‹</button>
      <div class="car-track" id="carTrack" tabindex="0" onkeydown="if(event.key==='ArrowLeft'){event.preventDefault();carGo(carIdx-1)}else if(event.key==='ArrowRight'){event.preventDefault();carGo(carIdx+1)}">
        ${slides}
        <div class="slide" data-i="${trips.length}">
          <div class="add-card" role="button" tabindex="0" onclick="slideClick(${trips.length})" onkeydown="if(event.key==='Enter')tripModal()">
            <div class="plus">+</div>
            <b>새 여행 떠나기</b>
            <span class="small">여행을 등록하고 기록을 시작해요</span>
          </div>
        </div>
      </div>
      <button class="car-nav next" aria-label="다음 여행" onclick="carGo(carIdx+1)">›</button>
      <div class="dots">${Array.from({length: total}, (_, i) => `<button class="dot" aria-label="${i < trips.length ? esc(trips[i].name) : '새 여행'}" onclick="carGo(${i})"></button>`).join('')}</div>
    </section>
    <div class="home-note">옆으로 넘기거나 ‹ › 버튼으로 여행을 둘러보세요 · 모든 기록은 이 브라우저에 자동 저장돼요</div>
  `;
  // 처음엔 마지막으로 본 여행, 없으면 가장 가까운 다가오는 여행
  let start = trips.findIndex(t => t.id === state.homeTripId);
  if(start < 0) start = trips.findIndex(t => t.end >= today);
  if(start < 0) start = Math.max(0, trips.length - 1);
  initCarousel(start);
}

/* ---------- 캐러셀 ---------- */
let carIdx = 0;
function carSlides(){ return [...document.querySelectorAll('#carTrack .slide')]; }
function carGo(i, instant){
  const track = document.getElementById('carTrack'), slides = carSlides();
  if(!track || !slides.length) return;
  i = Math.max(0, Math.min(slides.length - 1, i));
  const s = slides[i];
  track.scrollTo({left: s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2, behavior: instant ? 'instant' : 'smooth'});
  carMark(i);
}
function carMark(i){
  carIdx = i;
  carSlides().forEach((s, k) => s.classList.toggle('active', k === i));
  document.querySelectorAll('.dots .dot').forEach((d, k) => { d.classList.toggle('on', k === i); d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
  const n = carSlides().length;
  const p = document.querySelector('.car-nav.prev'), x = document.querySelector('.car-nav.next');
  if(p) p.disabled = i <= 0; if(x) x.disabled = i >= n - 1;
  const trip = [...state.trips].sort((a,b) => (a.start||'').localeCompare(b.start||''))[i];
  if(trip) state.homeTripId = trip.id;
}
function slideClick(i, id){
  if(i !== carIdx){ carGo(i); return; }   // 옆 카드를 누르면 먼저 가운데로
  if(id) go(id); else tripModal();
}
function initCarousel(start){
  const track = document.getElementById('carTrack');
  if(!track) return;
  let raf = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0, bestD = Infinity;
      carSlides().forEach((s, k) => { const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid); if(d < bestD){ bestD = d; best = k; } });
      if(best !== carIdx) carMark(best);
    });
  }, {passive:true});
  requestAnimationFrame(() => carGo(start, true));
  carMark(start);
}

// 여행마다 고유한 커버 색상
// 포근한 파스텔 톤 안에서만 고름 (피치, 살구, 버터, 세이지, 하늘, 로즈)
const COZY_HUES = [18, 30, 42, 140, 195, 345, 8, 24, 160];
function tripHue(t){ let h = 0; for(const c of (t.dest || t.name) + t.id) h = (h * 31 + c.charCodeAt(0)) % 9973; return COZY_HUES[h % COZY_HUES.length]; }
const DEFAULT_PREP = [
  ['서류','여권 (유효기간 6개월 이상)'],['서류','항공권 e-티켓'],['서류','여행자 보험'],
  ['예약','숙소 예약 확인'],['금융','환전 / 해외결제 카드'],['전자기기','유심 / eSIM'],
  ['전자기기','충전기 · 보조배터리 · 멀티어댑터'],['상비약','상비약'],['세면도구','세면도구'],['의류','옷 · 잠옷 · 속옷']
];
/* ---------- 통화 ---------- */
const COMMON_CURS = [['KRW','원'],['EUR','유로'],['USD','달러'],['JPY','엔'],['GBP','파운드'],['CNY','위안'],['TWD','대만달러'],['HKD','홍콩달러'],['THB','바트'],['VND','동'],['SGD','싱가포르달러'],['AUD','호주달러'],['CHF','스위스프랑']];
const parseCurs = s => [...new Set(String(s || '').split(/[,\s/]+/).map(x => x.toUpperCase().replace(/[^A-Z0-9가-힣$€¥£₩]/g, '').slice(0, 8)).filter(Boolean))];
// 여행에서 쓰는 통화 목록 (예전 데이터는 기본 통화 하나로 시작)
function tripCurs(t){
  if(!Array.isArray(t.currencies) || !t.currencies.length) t.currencies = parseCurs(t.currency || 'KRW');
  return t.currencies;
}
function syncCurPicks(){
  const inp = document.getElementById('curInput'); if(!inp) return;
  const list = parseCurs(inp.value);
  document.querySelectorAll('.cur-pick').forEach(b => b.classList.toggle('on', list.includes(b.dataset.c)));
}
function toggleCurInput(c){
  const inp = document.getElementById('curInput');
  let list = parseCurs(inp.value);
  list = list.includes(c) ? list.filter(x => x !== c) : [...list, c];
  inp.value = list.join(', '); syncCurPicks();
}
document.addEventListener('input', e => { if(e.target.id === 'curInput') syncCurPicks(); });
function curOptions(t, selected){
  const list = [...new Set([...tripCurs(t), ...(selected ? [selected] : [])])];
  return list.map(c => `<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}${(COMMON_CURS.find(x => x[0]===c) || [])[1] ? ' · ' + COMMON_CURS.find(x => x[0]===c)[1] : ''}</option>`).join('');
}

function tripModal(id){
  const t = id ? state.trips.find(x => x.id === id) : null;
  setTimeout(syncCurPicks);
  openModal(t ? '여행 정보 수정' : '새 여행 등록', `
    <label class="f">여행 이름 *<input type="text" name="name" required value="${esc(t?.name)}" placeholder="예) 2026 겨울 도쿄 여행"></label>
    <label class="f">목적지<input type="text" name="dest" value="${esc(t?.dest)}" placeholder="예) 일본 도쿄"></label>
    <div class="grid2">
      <label class="f">출발일 *<input type="date" name="start" required value="${esc(t?.start)}"></label>
      <label class="f">도착일 *<input type="date" name="end" required value="${esc(t?.end)}"></label>
    </div>
    <div class="grid2">
      <label class="f">${t ? '인원은 준비물 탭에서 수정' : '함께 가는 사람 (쉼표로 구분)'}
        <input type="text" name="people" ${t ? 'disabled' : ''} value="${esc(t ? t.people.join(', ') : '나')}" placeholder="나, 엄마, 동생"></label>
      <label class="f">사용 통화 (쉼표로 구분)<input type="text" name="currency" id="curInput" value="${esc(t ? tripCurs(t).join(', ') : 'KRW')}" placeholder="EUR, KRW"></label>
    </div>
    <div class="cur-picks">
      ${COMMON_CURS.map(([c,n]) => `<button type="button" class="cur-pick" data-c="${c}" onclick="toggleCurInput('${c}')">${c} <span>${n}</span></button>`).join('')}
    </div>
    <div class="muted small" style="margin-top:6px">맨 앞의 통화가 기본 통화예요. 경비를 기록할 때 여기서 고른 통화 중에서 선택할 수 있어요.</div>
  `, d => {
    if(d.end < d.start){ toast('도착일이 출발일보다 빠를 수 없어요'); return false; }
    const curs = parseCurs(d.currency);
    if(!curs.length){ toast('통화를 1개 이상 입력해 주세요'); return false; }
    if(t){ Object.assign(t, {name:d.name.trim(), dest:d.dest.trim(), start:d.start, end:d.end, currency:curs[0], currencies:curs}); }
    else{
      let people = [...new Set((d.people||'').split(',').map(s=>s.trim()).filter(Boolean))];
      if(!people.length) people = ['나'];
      state.trips.push({
        id:uid(), name:d.name.trim(), dest:d.dest.trim(), start:d.start, end:d.end, currency:curs[0], currencies:curs,
        people, stays:{}, schedules:{}, flights:[], expenses:[], cash:[],
        prep: DEFAULT_PREP.map(([cat,text]) => ({id:uid(), cat, text, checks:{}})),
        created: Date.now()
      });
      toast('여행이 등록되었어요');
    }
  });
}
function delTrip(id){
  const t = state.trips.find(x => x.id === id);
  ask(`'${t.name}' 여행과 모든 기록을 삭제할까요?\n삭제 후에는 되돌릴 수 없어요.`, () => {
    state.trips = state.trips.filter(x => x.id !== id);
  });
}

/* ---------- 여행 상세 ---------- */
const TABS = [['schedule','📅 일정'],['flight','✈️ 항공권'],['expense','💰 경비'],['prep','✅ 준비']];
function renderTrip(t){
  if(!TABS.some(x => x[0] === state.tab)) state.tab = 'schedule';
  const body = {schedule:renderSchedule, prep:renderPrep, flight:renderFlights, expense:renderExpenses}[state.tab](t);
  document.getElementById('app').innerHTML = `
    <div class="trip-head">
      <button class="back" title="여행 목록" onclick="go(null)">←</button>
      <div>
        <h1 style="font-size:23px">${esc(t.name)}</h1>
        <div class="meta">${esc(t.dest)}${t.dest ? ' · ' : ''}${fmtDate(t.start,true)} ~ ${fmtDate(t.end)} · ${rangeDates(t.start,t.end).length}일</div>
      </div>
      <div class="spacer"></div>
      ${dday(t) ? `<span class="badge">${dday(t)}</span>` : ''}
      <button class="icon-btn" title="여행 정보 수정" onclick="tripModal('${t.id}')">✎</button>
    </div>
    <div class="tabs">${TABS.map(([k,l]) => `<button class="tab ${state.tab===k?'on':''}" onclick="setTab('${k}')">${l}</button>`).join('')}</div>
    ${body}
  `;
}

/* ---------- 1. 일정 (캘린더 + 숙소 + 타임라인) ---------- */
function renderSchedule(t){
  const dates = rangeDates(t.start, t.end);
  if(!dates.length) return `<div class="empty panel">여행 날짜를 먼저 설정해 주세요.</div>`;
  if(!dates.includes(state.selDate)) state.selDate = dates.includes(todayStr()) ? todayStr() : dates[0];
  const sel = state.selDate, today = todayStr();

  // 출발 월 ~ 도착 월 캘린더
  let months = '';
  const s = pd(t.start), e = pd(t.end);
  for(let y = s.getFullYear(), m = s.getMonth(); y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth()); m === 11 ? (y++, m = 0) : m++){
    const first = new Date(y,m,1), last = new Date(y,m+1,0).getDate();
    let cells = WD.map((w,i) => `<div class="wd ${i===0?'sun':''}">${w}</div>`).join('');
    for(let i = 0; i < first.getDay(); i++) cells += '<div></div>';
    for(let d = 1; d <= last; d++){
      const k = ds(new Date(y,m,d)); const inT = k >= t.start && k <= t.end;
      const stay = t.stays[k]; const n = (t.schedules[k]||[]).length;
      cells += `<button class="cell ${inT?'in':''} ${k===sel?'sel':''} ${k===today?'today':''}" ${inT ? `onclick="selectDate('${k}')"` : 'disabled'}>
        <span class="dn">${d}</span>
        ${inT && stay ? `<span class="stay">🏨 ${esc(stay.name)}</span>` : ''}
        ${inT && n ? `<span class="cnt">• 일정 ${n}</span>` : ''}
      </button>`;
    }
    months += `<div class="month"><div class="month-title">${y}년 ${m+1}월</div><div class="cal">${cells}</div></div>`;
  }

  const dayN = dates.indexOf(sel) + 1;
  const stay = t.stays[sel];
  const items = [...(t.schedules[sel]||[])].sort((a,b) => (a.time||'99').localeCompare(b.time||'99'));
  return `
    <div class="sched">
      <div class="panel">${months}
        <div class="muted small">날짜를 누르면 오른쪽에서 숙소와 일정을 기록할 수 있어요.</div>
      </div>
      <div class="panel">
        <div class="row">
          <span class="badge">Day ${dayN}</span>
          <h2 style="margin:0">${fmtDate(sel)}</h2>
          <div class="spacer"></div>
          <button class="icon-btn" title="이전 날" ${dayN<=1?'disabled':''} onclick="selectDate('${addDays(sel,-1)}')">◀</button>
          <button class="icon-btn" title="다음 날" ${dayN>=dates.length?'disabled':''} onclick="selectDate('${addDays(sel,1)}')">▶</button>
        </div>
        <div class="stay-box">
          ${stay ? `
            <div class="row"><b>🏨 ${esc(stay.name)}</b><div class="spacer"></div>
              <button class="icon-btn" onclick="stayModal()">✎</button>
              <button class="icon-btn del" onclick="delStay()">🗑</button></div>
            ${stay.addr ? `<div class="small">📍 ${esc(stay.addr)}</div>` : ''}
            ${stay.memo ? `<div class="small muted">${esc(stay.memo)}</div>` : ''}`
          : `<div class="row"><span class="muted">이 날 숙소가 아직 없어요</span><div class="spacer"></div>
              <button class="btn sm" onclick="stayModal()">+ 숙소 입력</button></div>`}
        </div>
        <div class="row"><h3>타임라인</h3><div class="spacer"></div><button class="btn sm primary" onclick="schedModal()">+ 일정 추가</button></div>
        <div class="timeline">
          ${items.length ? items.map(it => `
            <div class="tl-item">
              <div class="tl-time">${esc(it.time || '--:--')}${it.endTime ? `<span class="end">~ ${esc(it.endTime)}</span>` : ''}</div>
              <div class="tl-dot"></div>
              <div class="tl-body"><b>${esc(it.title)}</b>
                ${it.place ? `<div class="small">📍 ${esc(it.place)}</div>` : ''}
                ${it.memo ? `<div class="memo">${esc(it.memo)}</div>` : ''}</div>
              <div><button class="icon-btn" onclick="schedModal('${it.id}')">✎</button><button class="icon-btn del" onclick="delSched('${it.id}')">🗑</button></div>
            </div>`).join('')
          : `<div class="muted small" style="padding:20px 0;text-align:center">등록된 일정이 없어요</div>`}
        </div>
      </div>
    </div>`;
}
function selectDate(d){ state.selDate = d; render(); }
function stayModal(){
  const t = curTrip(), sel = state.selDate, s = t.stays[sel] || {};
  openModal('숙소 입력', `
    <label class="f">숙소 이름 *<input type="text" name="name" required value="${esc(s.name)}" placeholder="예) 신주쿠 OO 호텔"></label>
    <label class="f">주소 / 위치<input type="text" name="addr" value="${esc(s.addr)}"></label>
    <div class="grid2">
      <label class="f">체크인<input type="date" name="cin" value="${sel}" min="${t.start}" max="${t.end}"></label>
      <label class="f">체크아웃<input type="date" name="cout" value="${addDays(sel,1)}" min="${t.start}"></label>
    </div>
    <label class="f">메모 (예약번호, 체크인 시간 등)<textarea name="memo">${esc(s.memo)}</textarea></label>
    <div class="muted small">체크인 ~ 체크아웃 전날까지 모든 날짜에 숙소가 입력돼요.</div>
  `, d => {
    const last = d.cout > d.cin ? addDays(d.cout,-1) : d.cin;
    const info = {name:d.name.trim(), addr:d.addr.trim(), memo:d.memo.trim()};
    rangeDates(d.cin, last).filter(x => x <= t.end).forEach(x => t.stays[x] = {...info});
  });
}
function delStay(){
  const t = curTrip();
  ask('이 날의 숙소 정보를 삭제할까요?', () => { delete t.stays[state.selDate]; });
}
function schedModal(id){
  const t = curTrip(), list = t.schedules[state.selDate] ||= [];
  const it = id ? list.find(x => x.id === id) : {};
  openModal(id ? '일정 수정' : `${fmtDate(state.selDate)} 일정 추가`, `
    <div class="grid2">
      <label class="f">시작 시간<input type="time" name="time" value="${esc(it.time)}"></label>
      <label class="f">종료 시간<input type="time" name="endTime" value="${esc(it.endTime)}"></label>
    </div>
    <label class="f">일정 *<input type="text" name="title" required value="${esc(it.title)}" placeholder="예) 시부야 스카이 전망대"></label>
    <label class="f">장소<input type="text" name="place" value="${esc(it.place)}"></label>
    <label class="f">메모<textarea name="memo">${esc(it.memo)}</textarea></label>
  `, d => {
    const v = {time:d.time, endTime:d.endTime, title:d.title.trim(), place:d.place.trim(), memo:d.memo.trim()};
    if(id) Object.assign(it, v); else list.push({id:uid(), ...v});
  });
}
function delSched(id){
  const t = curTrip();
  ask('이 일정을 삭제할까요?', () => {
    t.schedules[state.selDate] = t.schedules[state.selDate].filter(x => x.id !== id);
  });
}

/* ---------- 2. 준비물 / 메모 ---------- */
const PREP_CATS = ['서류','예약','금융','전자기기','의류','세면도구','상비약','기타'];
const isDone = (t,it) => t.people.length > 0 && t.people.every(p => it.checks[p]);
// 여행별 분류 목록 (없으면 기본값 + 기존 항목의 분류로 생성)
function prepCats(t){
  if(!Array.isArray(t.prepCats)) t.prepCats = [...new Set([...PREP_CATS, ...t.prep.map(i => i.cat).filter(Boolean)])];
  return t.prepCats;
}
function renderPrep(t){
  const total = t.prep.length, done = t.prep.filter(it => isDone(t,it)).length;
  const pct = total ? Math.round(done/total*100) : 0;
  const cats = [...prepCats(t), ...new Set(t.prep.map(i => i.cat).filter(c => !prepCats(t).includes(c)))];
  if(!prepCats(t).includes(state.lastCat)) state.lastCat = prepCats(t)[0];
  let rows = '';
  cats.forEach((c, ci) => {
    const list = t.prep.filter(i => i.cat === c);
    if(!list.length) return;
    rows += `<tr class="cat"><td colspan="${t.people.length+4}">${esc(c)}</td></tr>`;
    rows += list.map(it => `
      <tr class="${isDone(t,it)?'done':''}" data-id="${it.id}" data-cat="${ci}">
        <td class="grip-cell">${list.length > 1 ? `<button type="button" class="drag-handle" title="꾹 눌러서 끌어 옮기기" aria-label="${esc(it.text)} 순서 옮기기 (방향키로도 이동)" onkeydown="handleKey(event,'${it.id}')"><svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/><circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/></g></svg></button>` : ''}</td>
        <td class="item" title="클릭하면 전원 체크/해제" onclick="toggleAll('${it.id}')">${esc(it.text)}</td>
        ${t.people.map((p,i) => `<td><input type="checkbox" aria-label="${esc(p)}" ${it.checks[p]?'checked':''} onchange="togglePrep('${it.id}',${i})"></td>`).join('')}
        <td class="memo-cell"><input type="text" class="memo-in" value="${esc(it.memo)}" placeholder="메모" onchange="setPrepMemo('${it.id}',this.value)" onkeydown="enter(event,()=>this.blur())"></td>
        <td class="acts"><button class="icon-btn" onclick="prepModal('${it.id}')">✎</button><button class="icon-btn del" onclick="delPrep('${it.id}')">🗑</button></td>
      </tr>`).join('');
  });
  return `
    <div class="panel" style="margin-bottom:14px">
      <div class="row" style="margin-bottom:10px"><h3>👥 인원</h3><span class="muted small">사람마다 체크 칸이 생겨요</span></div>
      <div class="people">
        ${t.people.map((p,i) => `<span class="chip" data-i="${esc([...p][0] || '')}">${esc(p)}<button title="삭제" onclick="delPerson(${i})">✕</button></span>`).join('')}
        <input type="text" id="newPerson" placeholder="이름 추가" style="width:130px" onkeydown="enter(event,addPerson)">
        <button class="btn sm" onclick="addPerson()">추가</button>
      </div>
      <div class="row" style="margin:18px 0 10px"><h3>🏷️ 분류</h3><span class="muted small">이름을 누르면 수정, ✕를 누르면 삭제돼요</span></div>
      <div class="people">
        ${prepCats(t).map((c,i) => `<span class="chip tag"><span class="tag-name" title="이름 수정" onclick="catModal(${i})">${esc(c)}</span><span class="tag-n">${t.prep.filter(x => x.cat === c).length}</span><button title="삭제" onclick="delCat(${i})">✕</button></span>`).join('')}
        <input type="text" id="newCatName" placeholder="분류 추가" style="width:130px" onkeydown="enter(event,addCat)">
        <button class="btn sm" onclick="addCat()">추가</button>
      </div>
    </div>
    <div class="panel">
      <div class="row" style="margin-bottom:8px"><h3>준비 사항</h3><div class="spacer"></div><b>${done} / ${total}</b><span class="muted small">완료 (${pct}%)</span></div>
      <div class="progress" style="margin-bottom:14px"><div style="width:${pct}%"></div></div>
      <div class="row" style="margin-bottom:6px">
        <select id="newCat" style="width:auto" onchange="state.lastCat=this.value">${prepCats(t).map(c => `<option ${c===state.lastCat?'selected':''}>${esc(c)}</option>`).join('')}</select>
        <input type="text" id="newPrep" placeholder="준비할 것 입력 후 Enter" style="flex:1;min-width:160px" onkeydown="enter(event,addPrep)">
        <button class="btn primary sm" onclick="addPrep()">추가</button>
      </div>
      <div class="table-wrap">
        <table class="prep">
          <thead><tr><th class="grip-cell"></th><th>항목</th>${t.people.map(p => `<th>${esc(p)}</th>`).join('')}<th style="text-align:left">메모</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="${t.people.length+4}" class="muted" style="padding:24px">준비 사항을 추가해 보세요</td></tr>`}</tbody>
        </table>
      </div>
      <div class="muted small" style="margin-top:8px">항목 이름을 누르면 전원 한 번에 체크/해제돼요. 모두 체크되면 완료로 표시됩니다.<br>왼쪽 ⠿ 아이콘을 꾹 누른 채 끌면 같은 분류 안에서 순서를 바꿀 수 있어요.</div>
    </div>`;
}
function addPerson(){
  const t = curTrip(), inp = document.getElementById('newPerson'), v = inp.value.trim();
  if(!v){ inp.focus(); return; }
  if(t.people.includes(v)){ toast('이미 있는 이름이에요'); return; }
  t.people.push(v); render();
  toast(`'${v}'님을 추가했어요`);
  document.getElementById('newPerson').focus();
}
function delPerson(i){
  const t = curTrip();
  if(t.people.length <= 1){ toast('최소 1명은 있어야 해요'); return; }
  const p = t.people[i];
  ask(`'${p}'님을 삭제할까요?\n이 사람의 체크 기록도 함께 지워져요.`, () => {
    t.people = t.people.filter(x => x !== p);
    t.prep.forEach(it => delete it.checks[p]);
    t.expenses.forEach(e => { if(e.payer === p) e.payer = t.people[0]; });
  });
}
function addPrep(){
  const t = curTrip(), inp = document.getElementById('newPrep'), v = inp.value.trim();
  if(!v) return;
  const cat = document.getElementById('newCat').value;
  t.prep.push({id:uid(), cat, text:v, checks:{}});
  render();
  document.getElementById('newCat').value = cat;
  document.getElementById('newPrep').focus();
}
function addCat(){
  const t = curTrip(), inp = document.getElementById('newCatName'), v = inp.value.trim();
  if(!v){ inp.focus(); return; }
  if(prepCats(t).includes(v)){ toast('이미 있는 분류예요'); return; }
  prepCats(t).push(v); state.lastCat = v; render();
  toast(`'${v}' 분류를 추가했어요`);
  document.getElementById('newCatName').focus();
}
function catModal(i){
  const t = curTrip(), old = prepCats(t)[i];
  openModal('분류 이름 수정', `<label class="f">분류 이름 *<input type="text" name="name" required value="${esc(old)}"></label>`, d => {
    const v = d.name.trim();
    if(!v) return false;
    if(v !== old && prepCats(t).includes(v)){ toast('이미 있는 분류예요'); return false; }
    prepCats(t)[i] = v;
    t.prep.forEach(it => { if(it.cat === old) it.cat = v; });
    if(state.lastCat === old) state.lastCat = v;
  });
}
function delCat(i){
  const t = curTrip(), cats = prepCats(t), c = cats[i];
  if(cats.length <= 1){ toast('분류는 최소 1개 있어야 해요'); return; }
  const n = t.prep.filter(it => it.cat === c).length;
  const to = cats.find(x => x !== c);
  ask(`'${c}' 분류를 삭제할까요?` + (n ? `\n이 분류의 항목 ${n}개는 '${to}' 분류로 옮겨져요.` : ''), () => {
    t.prepCats = cats.filter(x => x !== c);
    t.prep.forEach(it => { if(it.cat === c) it.cat = to; });
  });
}
// 같은 분류 안에서 바로 위/아래 항목과 자리 바꾸기
function movePrep(id, dir){
  const t = curTrip(), i = t.prep.findIndex(x => x.id === id);
  if(i < 0) return;
  const cat = t.prep[i].cat;
  let j = i + dir;
  while(j >= 0 && j < t.prep.length && t.prep[j].cat !== cat) j += dir;
  if(j < 0 || j >= t.prep.length) return;
  [t.prep[i], t.prep[j]] = [t.prep[j], t.prep[i]];
  render();
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if(row){ row.classList.add('moved'); row.querySelector('.drag-handle')?.focus(); }
}
// 키보드: 손잡이에 초점을 두고 ↑/↓
function handleKey(e, id){
  if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){ e.preventDefault(); movePrep(id, e.key === 'ArrowUp' ? -1 : 1); }
}

/* 손잡이를 꾹 눌러 끌어서 순서 바꾸기 (마우스·터치 공통) */
let drag = null;
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('.drag-handle');
  if(!h || e.button > 0) return;
  e.preventDefault();
  const row = h.closest('tr');
  drag = {row, h, id:row.dataset.id, cat:row.dataset.cat, pid:e.pointerId, active:false, y:e.clientY};
  try{ h.setPointerCapture(e.pointerId); }catch(err){}
  row.classList.add('pressing');
  drag.timer = setTimeout(() => {
    if(!drag) return;
    drag.active = true;
    row.classList.remove('pressing'); row.classList.add('dragging');
    document.body.classList.add('is-dragging');
    if(navigator.vibrate) try{ navigator.vibrate(15); }catch(err){}
  }, e.pointerType === 'mouse' ? 150 : 350);
});
document.addEventListener('pointermove', e => {
  if(!drag || e.pointerId !== drag.pid) return;
  drag.y = e.clientY;
  if(!drag.active) return;
  e.preventDefault();
  const others = [...document.querySelectorAll(`table.prep tr[data-cat="${drag.cat}"]`)].filter(r => r !== drag.row);
  if(!others.length) return;
  const before = others.find(r => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
  if(before){ if(drag.row.nextElementSibling !== before) before.before(drag.row); }
  else{ const last = others[others.length - 1]; if(last.nextElementSibling !== drag.row) last.after(drag.row); }
  const m = 70;
  if(e.clientY < m) window.scrollBy(0, -12); else if(e.clientY > innerHeight - m) window.scrollBy(0, 12);
}, {passive:false});
function endDrag(e){
  if(!drag || (e && e.pointerId !== drag.pid)) return;
  clearTimeout(drag.timer);
  const {row, active, cat, id} = drag;
  row.classList.remove('pressing','dragging');
  document.body.classList.remove('is-dragging');
  drag = null;
  if(!active) return;
  const t = curTrip();
  const ids = [...document.querySelectorAll(`table.prep tr[data-cat="${cat}"]`)].map(r => r.dataset.id);
  const catName = t.prep.find(x => x.id === id)?.cat;
  const slots = t.prep.map((p, i) => p.cat === catName ? i : -1).filter(i => i >= 0);
  const byId = Object.fromEntries(t.prep.map(p => [p.id, p]));
  if(ids.length !== slots.length) { render(); return; }
  ids.forEach((pid, k) => t.prep[slots[k]] = byId[pid]);
  render();
  document.querySelector(`tr[data-id="${id}"]`)?.classList.add('moved');
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
function setPrepMemo(id, v){
  const it = curTrip().prep.find(x => x.id === id);
  if(it){ it.memo = v.trim(); save(); }
}
function togglePrep(id,i){
  const t = curTrip(), it = t.prep.find(x => x.id === id), p = t.people[i];
  it.checks[p] = !it.checks[p]; render();
}
function toggleAll(id){
  const t = curTrip(), it = t.prep.find(x => x.id === id), v = !isDone(t,it);
  t.people.forEach(p => it.checks[p] = v); render();
}
function prepModal(id){
  const t = curTrip(), it = t.prep.find(x => x.id === id);
  openModal('준비 사항 수정', `
    <label class="f">분류<select name="cat">${[...new Set([...prepCats(t), it.cat])].map(c => `<option ${c===it.cat?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
    <label class="f">항목 *<input type="text" name="text" required value="${esc(it.text)}"></label>
    <label class="f">메모<textarea name="memo">${esc(it.memo)}</textarea></label>
  `, d => { it.cat = d.cat; it.text = d.text.trim(); it.memo = d.memo.trim(); });
}
function delPrep(id){
  const t = curTrip();
  ask('이 항목을 삭제할까요?', () => { t.prep = t.prep.filter(x => x.id !== id); });
}

/* ---------- 3. 항공권 ---------- */
const FL_LABELS = ['가는 편','오는 편','현지 이동','기타'];
function minsBetween(a,b){
  if(!a || !b) return null;
  const m = (new Date(b) - new Date(a)) / 60000;
  return isNaN(m) ? null : m;
}
const fmtMins = m => `${Math.floor(m/60)}시간 ${m%60 ? (m%60)+'분' : ''}`.trim();
function renderFlights(t){
  const list = [...t.flights].sort((a,b) => (a.segs[0]?.dep||'').localeCompare(b.segs[0]?.dep||''));
  return `
    <div class="row" style="margin-bottom:14px"><h2 style="margin:0">항공권</h2><div class="spacer"></div>
      <button class="btn primary" onclick="flightModal()">+ 항공권 등록</button></div>
    ${list.length ? list.map(f => {
      const segs = f.segs;
      const route = [segs[0]?.from, ...segs.map(s => s.to)].filter(Boolean).map(esc).join(' → ');
      return `<div class="panel flight">
        <div class="flight-head">
          <span class="badge">${esc(f.label)}</span>
          <b>${route}</b>
          ${segs.length > 1 ? `<span class="badge gray">경유 ${segs.length-1}회</span>` : '<span class="badge gray">직항</span>'}
          <div class="spacer"></div>
          ${f.ref ? `<span class="small muted">예약번호 <b style="color:var(--text)">${esc(f.ref)}</b></span>` : ''}
          <button class="icon-btn" onclick="flightModal('${f.id}')">✎</button>
          <button class="icon-btn del" onclick="delFlight('${f.id}')">🗑</button>
        </div>
        ${segs.map((s,i) => {
          let lay = '';
          if(i > 0){
            const m = minsBetween(segs[i-1].arr, s.dep);
            lay = `<div class="layover">⏱ ${esc(s.from || segs[i-1].to)} 경유 대기${m != null && m >= 0 ? ' · ' + fmtMins(m) : ''}</div>`;
          }
          return `${lay}<div class="seg">
            <div><div class="ap">${esc(s.from || '???')}</div><div class="t"><b>${fmtDT(s.dep)}</b></div>${s.fromT ? `<div class="small muted">터미널 ${esc(s.fromT)}</div>` : ''}</div>
            <div class="mid">${esc(s.airline)} ${esc(s.no)}<div class="line"></div>${s.seat ? '좌석 '+esc(s.seat) : ''}${s.seat && s.bag ? ' · ' : ''}${s.bag ? '수하물 '+esc(s.bag) : ''}</div>
            <div class="right"><div class="ap">${esc(s.to || '???')}</div><div class="t"><b>${fmtDT(s.arr)}</b></div>${s.toT ? `<div class="small muted">터미널 ${esc(s.toT)}</div>` : ''}</div>
          </div>`;
        }).join('')}
        ${f.memo ? `<div class="small muted" style="margin-top:10px;white-space:pre-wrap">📝 ${esc(f.memo)}</div>` : ''}
      </div>`;
    }).join('') : `<div class="empty panel"><div style="font-size:36px">🎫</div><p>등록된 항공권이 없어요.<br>경유 항공편은 구간을 여러 개 추가하면 돼요.</p></div>`}
    <div class="muted small">시간은 모두 현지 시각 기준으로 입력하세요.</div>`;
}
function segFieldset(s={}, n){
  return `<fieldset class="segf"><legend>구간 <span class="segno">${n}</span> <button type="button" class="icon-btn del" onclick="removeSeg(this)" title="구간 삭제">✕</button></legend>
    <div class="grid2">
      <label class="f">항공사<input type="text" data-k="airline" value="${esc(s.airline)}" placeholder="대한항공"></label>
      <label class="f">편명<input type="text" data-k="no" value="${esc(s.no)}" placeholder="KE703"></label>
    </div>
    <div class="grid3">
      <label class="f">출발지<input type="text" data-k="from" value="${esc(s.from)}" placeholder="ICN"></label>
      <label class="f">출발 터미널<input type="text" data-k="fromT" value="${esc(s.fromT)}" placeholder="T2"></label>
      <label class="f">출발 일시<input type="datetime-local" data-k="dep" value="${esc(s.dep)}"></label>
    </div>
    <div class="grid3">
      <label class="f">도착지<input type="text" data-k="to" value="${esc(s.to)}" placeholder="NRT"></label>
      <label class="f">도착 터미널<input type="text" data-k="toT" value="${esc(s.toT)}"></label>
      <label class="f">도착 일시<input type="datetime-local" data-k="arr" value="${esc(s.arr)}"></label>
    </div>
    <div class="grid2">
      <label class="f">좌석<input type="text" data-k="seat" value="${esc(s.seat)}" placeholder="32A"></label>
      <label class="f">수하물<input type="text" data-k="bag" value="${esc(s.bag)}" placeholder="23kg x 1"></label>
    </div>
  </fieldset>`;
}
function addSeg(){
  const box = document.getElementById('segs');
  const prev = [...box.querySelectorAll('fieldset')].pop();
  const prevTo = prev ? prev.querySelector('[data-k=to]').value : '';
  box.insertAdjacentHTML('beforeend', segFieldset({from:prevTo}, box.children.length+1));
}
function removeSeg(btn){
  const box = document.getElementById('segs');
  if(box.children.length <= 1){ toast('최소 1개 구간이 필요해요'); return; }
  btn.closest('fieldset').remove();
  [...box.querySelectorAll('.segno')].forEach((el,i) => el.textContent = i+1);
}
function flightModal(id){
  const t = curTrip(), f = id ? t.flights.find(x => x.id === id) : {label: t.flights.length ? '오는 편' : '가는 편', segs:[{}]};
  openModal(id ? '항공권 수정' : '항공권 등록', `
    <div class="grid2">
      <label class="f">구분<select name="label">${FL_LABELS.map(l => `<option ${l===f.label?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="f">예약번호<input type="text" name="ref" value="${esc(f.ref)}" placeholder="ABC123"></label>
    </div>
    <div id="segs">${f.segs.map((s,i) => segFieldset(s,i+1)).join('')}</div>
    <button type="button" class="btn sm" onclick="addSeg()" style="margin-bottom:12px">+ 경유 구간 추가</button>
    <label class="f">메모<textarea name="memo" placeholder="온라인 체크인, 라운지, 마일리지 등">${esc(f.memo)}</textarea></label>
  `, (d, form) => {
    const segs = [...form.querySelectorAll('#segs fieldset')].map(fs => {
      const s = {}; fs.querySelectorAll('[data-k]').forEach(inp => {
        let v = inp.value.trim();
        if(['from','to'].includes(inp.dataset.k)) v = v.toUpperCase();
        s[inp.dataset.k] = v;
      });
      return s;
    });
    const v = {label:d.label, ref:d.ref.trim(), memo:d.memo.trim(), segs};
    if(id) Object.assign(f, v); else t.flights.push({id:uid(), ...v});
  });
}
function delFlight(id){
  const t = curTrip();
  ask('이 항공권을 삭제할까요?', () => { t.flights = t.flights.filter(x => x.id !== id); });
}

/* ---------- 4. 경비 (카드 / 현금) ---------- */
const EXP_CATS = {'식비':'🍜','교통':'🚕','숙박':'🏨','쇼핑':'🛍️','관광':'🎟️','카페·간식':'☕','기타':'📌'};
function renderExpenses(t){
  const ex = t.expenses;
  // 통화 구분: 여행에 등록한 통화 + 기록에 쓰인 통화
  const allCurs = [...new Set([...tripCurs(t), ...ex.map(e => e.cur), ...t.cash.map(c => c.cur)])].filter(Boolean);
  if(state.expCur !== 'all' && !allCurs.includes(state.expCur)) state.expCur = allCurs.length > 1 ? 'all' : allCurs[0];
  const selCur = state.expCur;
  const shownCurs = selCur === 'all' ? allCurs : [selCur];
  const multi = allCurs.length > 1;
  const sumBy = (cur, fn) => ex.filter(e => e.cur === cur && (!fn || fn(e))).reduce((a,e) => a + Number(e.amount), 0);
  const curName = c => (COMMON_CURS.find(x => x[0] === c) || [])[1] || '';
  const summary = shownCurs.map(cur => {
    const total = sumBy(cur), card = sumBy(cur, e => e.method === 'card'), cash = sumBy(cur, e => e.method === 'cash');
    const wallet = t.cash.filter(c => c.cur === cur).reduce((a,c) => a + Number(c.amount), 0);
    return `
      ${multi ? `<div class="cur-head"><span class="cur-code">${esc(cur)}</span><span class="muted small">${esc(curName(cur))}</span></div>` : ''}
      <div class="sum-grid">
        <div class="sum"><div class="k">총 지출</div><div class="v">${money(total)}</div><div class="k">${esc(cur)}</div></div>
        <div class="sum card"><div class="k">💳 카드</div><div class="v">${money(card)}</div><div class="k">${total ? Math.round(card/total*100) : 0}%</div></div>
        <div class="sum cash"><div class="k">💵 현금</div><div class="v">${money(cash)}</div><div class="k">${total ? Math.round(cash/total*100) : 0}%</div></div>
        <div class="sum"><div class="k">현금 잔액</div><div class="v" style="color:${wallet-cash<0?'var(--warn)':'inherit'}">${wallet ? money(wallet - cash) : '-'}</div><div class="k">${wallet ? `환전 ${money(wallet)}` : '환전 현금 미등록'}</div></div>
      </div>`;
  }).join('');

  // 통화별 분석 (분류 / 카드 / 결제자) — 통화끼리는 합산하지 않음
  const analysis = cur => {
    const byCat = Object.keys(EXP_CATS).map(c => [c, sumBy(cur, e => e.cat === c)]).filter(x => x[1] > 0).sort((a,b) => b[1]-a[1]);
    if(!byCat.length) return '';
    const maxCat = Math.max(1, ...byCat.map(x => x[1]));
    const byPayer = t.people.map(p => [p, sumBy(cur, e => e.payer === p)]).filter(x => x[1] > 0);
    const byCard = [...new Set(ex.filter(e => e.cur === cur && e.method==='card' && e.card).map(e => e.card))].map(c => [c, sumBy(cur, e => e.method==='card' && e.card===c)]);
    return `<div class="panel" style="margin-bottom:14px">
      <div class="row" style="margin-bottom:6px"><h3>분류별 지출</h3><span class="badge gray">${esc(cur)}</span></div>
      ${byCat.map(([c,v]) => `<div class="bar-row"><span>${EXP_CATS[c]} ${c}</span><div class="bar"><div style="width:${v/maxCat*100}%"></div></div><span>${money(v)}</span></div>`).join('')}
      ${byCard.length ? `<div class="sub-h">카드별 사용</div>${byCard.map(([c,v]) => `<div class="row small" style="padding:3px 0"><span>💳 ${esc(c)}</span><div class="spacer"></div><b>${money(v)}</b></div>`).join('')}` : ''}
      ${byPayer.length > 1 ? `<div class="sub-h">결제자별</div>${byPayer.map(([p,v]) => `<div class="row small" style="padding:3px 0"><span>${esc(p)}</span><div class="spacer"></div><b>${money(v)}</b></div>`).join('')}` : ''}
    </div>`;
  };
  const analyses = shownCurs.map(analysis).join('');

  const f = state.expFilter || 'all';
  const shown = ex.filter(e => (f === 'all' || e.method === f) && shownCurs.includes(e.cur)).sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
  const days = [...new Set(shown.map(e => e.date))];
  const cashShown = t.cash.filter(c => shownCurs.includes(c.cur));

  return `
    <div class="row" style="margin-bottom:14px"><h2 style="margin:0">경비</h2><div class="spacer"></div>
      <button class="btn" onclick="cashModal()">+ 환전 현금</button>
      <button class="btn primary" onclick="expModal()">+ 지출 기록</button></div>
    ${multi ? `<div class="row" style="margin-bottom:14px"><span class="muted small" style="font-weight:700">통화</span>
      <div class="seg-ctl">${['all', ...allCurs].map(c => `<button class="${selCur===c?'on':''}" onclick="state.expCur='${esc(c)}';render()">${c==='all' ? '전체' : esc(c)}</button>`).join('')}</div>
      <span class="muted small">통화별로 따로 합계를 내요</span></div>` : ''}
    ${summary}
    <div class="exp-cols">
      <div>
        ${analyses || `<div class="panel" style="margin-bottom:14px"><h3 style="margin-bottom:8px">분류별 지출</h3><div class="muted small">아직 지출이 없어요</div></div>`}
        <div class="panel">
          <h3 style="margin-bottom:8px">💵 환전 현금</h3>
          ${cashShown.length ? cashShown.map(c => `<div class="row small" style="padding:3px 0"><span>${esc(c.date ? fmtDate(c.date) : '')} ${esc(c.memo)}</span><div class="spacer"></div><b>${money(c.amount)} ${esc(c.cur)}</b><button class="icon-btn del" onclick="delCash('${c.id}')">🗑</button></div>`).join('') : '<div class="muted small">환전한 현금을 등록하면 남은 현금을 계산해 드려요</div>'}
        </div>
      </div>
      <div class="panel">
        <div class="row"><h3>지출 내역</h3><div class="spacer"></div>
          <div class="seg-ctl">${[['all','전체'],['card','카드'],['cash','현금']].map(([k,l]) => `<button class="${f===k?'on':''}" onclick="state.expFilter='${k}';render()">${l}</button>`).join('')}</div></div>
        ${days.length ? days.map(day => {
          const list = shown.filter(e => e.date === day);
          const daySum = {}; list.forEach(e => daySum[e.cur] = (daySum[e.cur]||0) + Number(e.amount));
          return `<div class="exp-day"><span>${day ? fmtDate(day) : '날짜 없음'}</span><span>${Object.entries(daySum).map(([c,v]) => money(v)+' '+esc(c)).join(' · ')}</span></div>
            ${list.map(e => `<div class="exp">
              <div class="ic">${EXP_CATS[e.cat] || '📌'}</div>
              <div class="info"><div>${esc(e.title)}</div>
                <div class="row small" style="gap:4px">
                  <span class="badge ${e.method}">${e.method==='card' ? '💳 '+esc(e.card||'카드') : '💵 현금'}</span>
                  ${t.people.length > 1 && e.payer ? `<span class="muted">${esc(e.payer)}</span>` : ''}
                  ${e.time ? `<span class="muted">${esc(e.time)}</span>` : ''}
                </div></div>
              <div class="amt">${money(e.amount)} <span class="small muted">${esc(e.cur)}</span></div>
              <div><button class="icon-btn" onclick="expModal('${e.id}')">✎</button><button class="icon-btn del" onclick="delExp('${e.id}')">🗑</button></div>
            </div>`).join('')}`;
        }).join('') : `<div class="muted small" style="padding:24px 0;text-align:center">기록된 지출이 없어요</div>`}
      </div>
    </div>`;
}
function expModal(id){
  const t = curTrip();
  const today = todayStr();
  const defDate = today >= t.start && today <= t.end ? today : (state.selDate || t.start);
  const last = t.expenses[t.expenses.length-1];
  const e = id ? t.expenses.find(x => x.id === id)
    : {date:defDate, cur:(state.expCur && tripCurs(t).includes(state.expCur)) ? state.expCur : (tripCurs(t).includes(last?.cur) ? last.cur : tripCurs(t)[0]), method:last?.method || 'card', card:last?.card || '', payer:t.people[0], cat:'식비'};
  const cards = [...new Set(t.expenses.map(x => x.card).filter(Boolean))];
  openModal(id ? '지출 수정' : '지출 기록', `
    <div class="grid2">
      <label class="f">날짜<input type="date" name="date" value="${esc(e.date)}"></label>
      <label class="f">시간<input type="time" name="time" value="${esc(e.time)}"></label>
    </div>
    <label class="f">내용 *<input type="text" name="title" required value="${esc(e.title)}" placeholder="예) 점심 라멘"></label>
    <div class="grid2">
      <label class="f">금액 *<input type="number" name="amount" required step="any" min="0" inputmode="decimal" value="${esc(e.amount)}"></label>
      <label class="f">통화<select name="cur">${curOptions(t, e.cur)}</select></label>
    </div>
    <label class="f">분류<select name="cat">${Object.entries(EXP_CATS).map(([c,i]) => `<option value="${c}" ${c===e.cat?'selected':''}>${i} ${c}</option>`).join('')}</select></label>
    <div class="grid2">
      <label class="f">결제 수단<select name="method" onchange="document.getElementById('cardField').style.display=this.value==='card'?'':'none'">
        <option value="card" ${e.method==='card'?'selected':''}>💳 카드</option>
        <option value="cash" ${e.method==='cash'?'selected':''}>💵 현금</option></select></label>
      <label class="f">결제자<select name="payer">${t.people.map(p => `<option ${p===e.payer?'selected':''}>${esc(p)}</option>`).join('')}</select></label>
    </div>
    <label class="f" id="cardField" style="${e.method==='card'?'':'display:none'}">카드 이름<input type="text" name="card" value="${esc(e.card)}" list="cardList" placeholder="예) 트래블월렛, 신한카드">
      <datalist id="cardList">${cards.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <label class="f">메모<input type="text" name="memo" value="${esc(e.memo)}"></label>
  `, d => {
    const v = {date:d.date, time:d.time, title:d.title.trim(), amount:Number(d.amount), cur:d.cur || tripCurs(t)[0],
      cat:d.cat, method:d.method, card:d.method==='card' ? d.card.trim() : '', payer:d.payer, memo:d.memo.trim()};
    if(id) Object.assign(e, v); else { t.expenses.push({id:uid(), ...v}); toast('지출이 기록되었어요'); }
  });
}
function delExp(id){
  const t = curTrip();
  ask('이 지출 기록을 삭제할까요?', () => { t.expenses = t.expenses.filter(x => x.id !== id); });
}
function cashModal(){
  const t = curTrip();
  openModal('환전 현금 등록', `
    <div class="grid2">
      <label class="f">금액 *<input type="number" name="amount" required step="any" min="0" inputmode="decimal"></label>
      <label class="f">통화<select name="cur">${curOptions(t, (state.expCur && tripCurs(t).includes(state.expCur)) ? state.expCur : tripCurs(t)[0])}</select></label>
    </div>
    <div class="grid2">
      <label class="f">날짜<input type="date" name="date" value="${todayStr()}"></label>
      <label class="f">메모<input type="text" name="memo" placeholder="예) 공항 환전소"></label>
    </div>
  `, d => { t.cash.push({id:uid(), amount:Number(d.amount), cur:d.cur || tripCurs(t)[0], date:d.date, memo:d.memo.trim()}); });
}
function delCash(id){
  const t = curTrip();
  ask('이 환전 기록을 삭제할까요?', () => { t.cash = t.cash.filter(x => x.id !== id); });
}

/* ========== 백업 ========== */
function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `여행기록_백업_${todayStr()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
document.getElementById('importFile').addEventListener('change', async e => {
  const file = e.target.files[0]; if(!file) return;
  try{
    const data = JSON.parse(await file.text());
    if(!Array.isArray(data.trips)) throw 0;
    ask(`백업에서 ${data.trips.length}개 여행을 불러올까요?\n현재 기록은 백업 내용으로 바뀝니다.`, () => { state = data; toast('불러오기 완료'); }, '불러오기');
  }catch(err){ toast('올바른 백업 파일이 아니에요'); }
  finally{ e.target.value = ''; }
});

// 다른 탭에서 수정했을 때 동기화
window.addEventListener('storage', e => { if(e.key === KEY){ state = load(); render(); } });

render();
