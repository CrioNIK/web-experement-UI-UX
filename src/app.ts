import { newState, propose, proposedProject, apply, undoLast, diff, validateProject, type State, type Proposal, type Field, type ModuleKind } from './model.js';
import { LocalStore } from './storage.js';
import { evidence } from './evidence.js';
import { escapeHTML as esc, icon, announce, downloadJSON, transition } from './ui.js';
import { renderModule } from './modules.js';
import { renderReview } from './review.js';
import './composer.js';
import './lab.js';
let state: State = newState();
let proposal: Proposal | null = null;
let selected: Field[] = [];
let modules: ModuleKind[] = ['roadmap', 'budget', 'brief'];
let busy = false;
let ready = false;
let persistent = true;
let focus = false;
let pinned = false;
const store = new LocalStore();
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `<a class="skip-link" href="#main">Перейти к содержимому</a><aside class="sidebar"><a class="brand" href="#workspace" aria-label="HORIZON — рабочая среда"><span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span><strong>HORIZON<span>Интерфейсы после меню</span></strong></a><nav aria-label="Основная навигация"><a href="#workspace" data-nav="workspace">${icon('grid')}<span>Рабочая среда</span><span class="nav-number">01</span></a><a href="#evidence" data-nav="evidence">${icon('book')}<span>На чём основано</span><span class="nav-number">02</span></a><a href="#lab" data-nav="lab">${icon('flask')}<span>Проверить самому</span><span class="nav-number">03</span></a></nav><div class="sidebar-project"><span>УЧЕБНЫЙ ПРОЕКТ</span><div class="project-sign">ПС</div><strong>Первый свет</strong><p>Цифровая антология<br>Никаких реальных обязательств</p></div><div class="sidebar-bottom"><div class="local-status"><i></i><strong id="storage-label">Открываем локальные данные…</strong></div><p id="connection-label">Без аккаунта. Без внешнего AI.</p><a href="https://github.com/CrioNIK/web-experement-UI-UX" target="_blank" rel="noopener noreferrer">Открытый код ${icon('external', 14)}</a></div></aside><div class="app-body"><header class="topbar"><span class="breadcrumb">Эксперимент <span>/</span> <strong id="page-name">Рабочая среда</strong></span><div class="topbar-actions"><button class="command-button" id="command" aria-label="Открыть команды"><span>Команды</span> <kbd>Ctrl K</kbd></button><button class="icon-button" id="focus" aria-label="Режим фокуса" aria-pressed="false" title="Режим фокуса">${icon('focus')}</button><button class="button export-top" id="export">${icon('download', 16)}<span>Экспорт</span></button></div></header><main id="main" tabindex="-1"><div id="storage-warning" class="notice error" hidden></div><div id="notice" class="notice" role="status" aria-live="polite" hidden></div><div id="workspace-view"><div class="workspace-intro"><div><h1>Меньше интерфейса.<br><em>Больше намерения.</em></h1><p>Не ищите нужный экран. Опишите результат —<br class="desktop-break"> и соберите инструменты вокруг своей задачи.</p></div><div class="horizon-date"><strong>2030<span>—</span>2035</strong><p>Сценарий, не предсказание</p></div></div><intent-composer></intent-composer><div class="workspace-heading"><div><span class="small-dot"></span><h2 id="space-title">Пространство проекта</h2><span id="draft-tag" class="draft-tag">Сохранённое состояние</span></div><div class="view-controls"><button type="button" class="text-button" id="pin" aria-pressed="false">${icon('focus', 14)} Закрепить состав</button><button type="button" class="text-button" data-manual>${icon('sliders', 14)} Вручную</button></div></div><div class="workspace-grid"><div><div id="modules" class="modules"></div><div id="context-note" class="context-note"><span>ПОЧЕМУ ТАК</span><p>Постоянная навигация и знакомые элементы управления. Адаптация происходит только по вашей команде.</p><button type="button" class="text-button" data-source="generative">Основание ${icon('external', 14)}</button></div></div><aside id="review" class="review" aria-label="Проверка изменений"></aside></div><div id="mobile-review-bar" class="mobile-review-bar" hidden><span id="mobile-review-count"></span><button type="button" class="button dark" id="jump-review">Проверить ${icon('arrow')}</button></div><div class="principles-strip"><div><span>01</span><strong>Намерение → инструменты</strong><p>Не бесконечная переписка</p></div><div><span>02</span><strong>Предложение ≠ действие</strong><p>Решение остаётся у вас</p></div><div><span>03</span><strong>Ваши данные — рядом</strong><p>Работа без обязательного облака</p></div></div></div><section id="evidence-view" hidden></section><section id="lab-view" hidden><experiment-lab></experiment-lab></section><footer class="footer"><span>HORIZON / OPEN INTERFACE LAB</span><span>Основания проверены 15.09.2026 · v0.1</span></footer></main></div><dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-top"><h2 id="dialog-title"></h2><button type="button" class="icon-button" id="close-dialog" aria-label="Закрыть диалог">${icon('close')}</button></div><div id="dialog-body"></div></dialog><input id="import-file" type="file" accept="application/json,.json" hidden>`;
const modal = document.querySelector<HTMLDialogElement>('#dialog')!;
const fieldList = (): Field[] => proposal?.changes.map(c => c.field) ?? [];
function render(): void {
  const project = proposal ? proposedProject(state, proposal, selected) : state.project;
  document.querySelector('#modules')!.innerHTML = modules.map(k => renderModule(k, project)).join('');
  document.querySelector('#modules')!.classList.toggle('single-module', modules.length === 1);
  document.querySelector('#review')!.innerHTML = renderReview(state, proposal, selected, busy);
  document.querySelector('#draft-tag')!.textContent = proposal ? 'Предпросмотр · ещё не применено' : 'Текущий проект';
  document.querySelector('#space-title')!.textContent = proposal?.intent === 'budget' ? 'Расходы и ограничения' : proposal?.intent === 'focus' ? 'Только план' : 'Пространство проекта';
  document.querySelector('#context-note p')!.textContent = proposal?.reason ?? 'Постоянная навигация и знакомые элементы управления. Адаптация происходит только по вашей команде.';
  document.querySelector('#storage-label')!.textContent = !ready ? 'Открываем локальные данные…' : persistent ? 'Данные в этом браузере' : 'Только память · нужен экспорт';
  document.querySelector('#compose-submit')!.toggleAttribute('disabled', !ready || busy);
  document.querySelector<HTMLElement>('#mobile-review-bar')!.hidden = !proposal || !selected.length;
  document.querySelector('#mobile-review-count')!.textContent = `Изменений: ${selected.length} · ещё не применены`;
  document.querySelector('#review')!.setAttribute('tabindex', '-1');
}
function prepare(text: string): void {
  if (!ready || busy) return;
  try {
    const next = propose(state, text);
    proposal = next; selected = next.changes.map(c => c.field);
    if (!pinned) modules = next.modules;
    transition(render);
    announce(next.changes.length ? 'Предложение готово. Проверьте изменения; данные ещё не изменены.' : 'Состав инструментов обновлён. Данные не изменены.');
  } catch (error) { announce((error as Error).message, true); }
}
async function persist(next: State): Promise<void> {
  if (busy || !ready) return;
  const restoreReviewFocus = document.querySelector('#review')!.contains(document.activeElement);
  busy = true; render();
  try {
    if (persistent) await store.save(next, state.revision);
    state = next; proposal = null; selected = []; render();
    announce(persistent ? 'Изменения сохранены в этом браузере. Последнее действие можно отменить.' : 'Изменения только в памяти. Экспортируйте проект перед закрытием.', !persistent);
  } catch (error) { announce((error as Error).message, true); }
  finally { busy = false; render(); if (restoreReviewFocus) document.querySelector<HTMLElement>('#review')!.focus({ preventScroll: true }); }
}
function openDialog(title: string, html: string): void {
  document.querySelector('#dialog-title')!.textContent = title;
  document.querySelector('#dialog-body')!.innerHTML = html;
  if (!modal.open) modal.showModal();
}
function showEvidence(id?: string): void {
  const item = evidence.find(e => e.id === id);
  if (!item) { location.hash = 'evidence'; return; }
  openDialog(item.title, `<div class="source-meta">${esc(item.organization)} · ${esc(item.date)}</div><h3>Что подтверждено</h3><p>${esc(item.fact)}</p><h3>Наш вывод о будущем</h3><p>${esc(item.inference)}</p><h3>Граница уверенности</h3><p>${esc(item.limit)}</p><h3>В этом прототипе</h3><p>${esc(item.implementation)}</p><a class="button dark" href="${item.url}" target="_blank" rel="noopener noreferrer">Открыть первоисточник ${icon('external', 16)}</a>`);
}
function openManual(): void {
  if (!ready || busy) return;
  const p = proposal ? proposedProject(state, proposal, selected) : state.project;
  openDialog('Обычные инструменты. Полный контроль.', `<p>Командная строка необязательна. Изменения попадут в тот же предварительный просмотр.</p><form id="manual-form"><label>Название проекта<input name="title" value="${esc(p.title)}" maxlength="120" required></label><div class="form-grid"><label>Бюджет, ₴<input type="number" name="budget" min="10000" max="500000" step="1" value="${p.budget}" required></label><label>Срок, недель<input type="number" name="weeks" min="2" max="12" step="1" value="${p.weeks}" required></label></div><label>Этап<select name="stage"><option value="idea" ${p.stage === 'idea' ? 'selected' : ''}>Идея</option><option value="planned" ${p.stage === 'planned' ? 'selected' : ''}>План готов</option></select></label><fieldset><legend>Показывать модули</legend>${(['roadmap','budget','brief'] as ModuleKind[]).map(k => `<label class="check-label"><input type="checkbox" name="module" value="${k}" ${modules.includes(k) ? 'checked' : ''}>${k === 'roadmap' ? 'План' : k === 'budget' ? 'Бюджет' : 'Ограничения'}</label>`).join('')}</fieldset><p id="manual-error" role="status" class="inline-error"></p><button class="button dark" type="submit">Проверить изменения ${icon('arrow')}</button></form>`);
  document.querySelector('#manual-form')!.addEventListener('submit', e => {
    e.preventDefault(); const data = new FormData(e.target as HTMLFormElement);
    const target = { ...structuredClone(p), title: String(data.get('title')).trim(), budget: Number(data.get('budget')), weeks: Number(data.get('weeks')), stage: data.get('stage') as 'idea' | 'planned' };
    try {
      const requested = data.getAll('module') as ModuleKind[];
      if (!requested.length) throw new Error('Оставьте хотя бы один модуль.');
      const changes = diff(state.project, target);
      proposal = { baseRevision: state.revision, intent: 'launch', prompt: 'Ручное управление', reason: 'Модули и параметры выбраны вами вручную. Автоматическая адаптация не требуется.', modules: requested, changes };
      modules = requested; selected = fieldList(); modal.close(); render(); announce('Ручные изменения готовы к проверке.');
    } catch (err) { document.querySelector('#manual-error')!.textContent = (err as Error).message; }
  });
}
function openCommands(): void {
  openDialog('Что сделать?', `<div class="command-list"><button type="button" data-command="launch">${icon('plus')} Подготовить запуск <span>4 недели / 60 000 ₴</span></button><button type="button" data-command="manual">${icon('sliders')} Изменить вручную</button><button type="button" data-command="evidence">${icon('book')} Открыть исследования</button><button type="button" data-command="import">${icon('upload')} Импортировать проект из JSON</button><button type="button" data-command="export">${icon('download')} Экспортировать проект</button></div><p class="muted">Esc — закрыть. Ctrl / ⌘ K — открыть. Ctrl / ⌘ Enter — выполнить запрос.</p>`);
}
function route(): void {
  const page = ['workspace','evidence','lab'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'workspace';
  for (const name of ['workspace','evidence','lab']) document.querySelector<HTMLElement>(`#${name}-view`)!.hidden = name !== page;
  document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach(a => { if (a.dataset.nav === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.querySelector('#page-name')!.textContent = page === 'workspace' ? 'Рабочая среда' : page === 'evidence' ? 'На чём основано' : 'Проверить самому';
}
function renderEvidence(): void {
  document.querySelector('#evidence-view')!.innerHTML = `<div class="page-intro"><h1>Не эстетика будущего.<br><em>Следы настоящего.</em></h1><p>Ни один источник не знает интерфейс 2035 года. Здесь факты отделены от нашего прогноза — и от ограничений прототипа.</p></div><div class="evidence-summary"><span><i class="small-dot"></i> ${evidence.length} первичных источников</span><span>Проверено 15 сентября 2026</span><span>Без выдуманных вероятностей</span></div><div class="evidence-list">${evidence.map((e, i) => `<article class="evidence-row"><div class="evidence-number">0${i + 1}</div><div><div class="source-meta">${esc(e.organization)} / ${esc(e.date)} <span>${e.status}</span></div><h2>${esc(e.title)}</h2><p>${esc(e.fact)}</p><details><summary>Прогноз, ограничения и реализация</summary><p><strong>Наш вывод:</strong> ${esc(e.inference)}</p><p><strong>Ограничение:</strong> ${esc(e.limit)}</p><p><strong>В прототипе:</strong> ${esc(e.implementation)}</p></details></div><a class="icon-button" aria-label="Первоисточник: ${esc(e.title)}" href="${e.url}" target="_blank" rel="noopener noreferrer">${icon('external')}</a></article>`).join('')}</div><div class="study-notes"><h2>Чего мы не утверждаем</h2><p>Что сайты исчезнут. Что весь интерфейс станет голосовым или трёхмерным. Что конкретная палитра, шрифт или эффект будут «стандартом 2035». Что демонстрация на правилах обладает интеллектом. Эти заявления не следуют из приведённых источников.</p><p>WCAG 3 остаётся рабочим черновиком: <a href="https://www.w3.org/WAI/news/2026-03-03/wcag3/" target="_blank" rel="noopener noreferrer">обновление W3C от 03.03.2026</a>. Для реализации ориентируемся на WCAG 2.2, не заявляя сертификацию.</p></div>`;
}
root.addEventListener('intent-submit', e => prepare((e as CustomEvent<string>).detail));
root.addEventListener('change', e => {
  const input = e.target as HTMLInputElement;
  if (input.matches('[data-change]')) { const field = input.dataset.change as Field; selected = input.checked ? [...new Set([...selected, field])] : selected.filter(k => k !== field); render(); document.querySelector<HTMLInputElement>(`[data-change="${field}"]`)?.focus(); }
});
root.addEventListener('click', e => {
  const button = (e.target as Element).closest<HTMLElement>('button'); if (!button) return;
  if (button.hasAttribute('data-manual')) openManual();
  if (button.dataset.source) showEvidence(button.dataset.source);
  if (button.id === 'close-dialog') modal.close();
  if (button.id === 'command') openCommands();
  if (button.id === 'jump-review') { document.querySelector('#review')!.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); document.querySelector<HTMLElement>('#review')!.focus({ preventScroll: true }); }
  if (button.id === 'export') { downloadJSON(state.project, 'horizon-project.json'); announce('Экспортировано применённое состояние. Неприменённый черновик не включён.'); }
  if (button.id === 'pin') { pinned = !pinned; button.setAttribute('aria-pressed', String(pinned)); button.innerHTML = `${icon('focus', 14)} ${pinned ? 'Состав закреплён' : 'Закрепить состав'}`; announce(pinned ? 'Запросы больше не меняют состав модулей.' : 'Запросы снова могут менять состав модулей.'); }
  if (button.id === 'focus') { focus = !focus; document.body.classList.toggle('focus-mode', focus); button.setAttribute('aria-pressed', String(focus)); }
  if (button.id === 'dismiss') { proposal = null; selected = []; render(); announce('Предложение отклонено. Данные не изменены.'); }
  if (button.id === 'apply' && proposal && !busy) { try { void persist(apply(state, proposal, selected)); } catch (err) { announce((err as Error).message, true); } }
  if (button.id === 'undo' && !busy) { try { void persist(undoLast(state)); } catch (err) { announce((err as Error).message, true); } }
  if (button.dataset.task !== undefined && ready && !busy) {
    const index = Number(button.dataset.task);
    const target = proposal ? proposedProject(state, proposal, selected) : structuredClone(state.project);
    if (Number.isInteger(index) && index >= 0 && index < 4) { target.done[index] = !target.done[index]; proposal = { baseRevision: state.revision, intent: 'focus', prompt: 'Готовность задачи', reason: 'Готовность этапа изменена вами. Подтвердите изменение справа.', modules, changes: diff(state.project, target) }; selected = fieldList(); render(); document.querySelector<HTMLButtonElement>(`[data-task="${index}"]`)?.focus(); announce('Изменение готовности добавлено в предварительный просмотр.'); }
  }
  if (button.dataset.command) {
    const command = button.dataset.command; modal.close();
    if (command === 'launch') { location.hash = 'workspace'; prepare('Подготовь запуск за 4 недели, бюджет до 60 000 ₴.'); }
    if (command === 'manual') openManual();
    if (command === 'evidence') location.hash = 'evidence';
    if (command === 'import') document.querySelector<HTMLInputElement>('#import-file')!.click();
    if (command === 'export') { downloadJSON(state.project, 'horizon-project.json'); announce('Экспортировано применённое состояние, без черновика.'); }
  }
});
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (modal.open) modal.close(); else openCommands(); } });
document.querySelector<HTMLInputElement>('#import-file')!.addEventListener('change', async e => {
  const input = e.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file || !ready || busy) return;
  try {
    if (file.size > 256000) throw new Error('Файл слишком большой. Лимит — 256 КБ.');
    const value: unknown = JSON.parse(await file.text());
    if (!validateProject(value)) throw new Error('Некорректный JSON проекта. Ожидается экспорт HORIZON.');
    proposal = { baseRevision: state.revision, intent: 'launch', prompt: 'Импорт файла', reason: 'Файл прочитан только на устройстве. Проверьте отличия перед применением.', modules, changes: diff(state.project, value) };
    selected = fieldList(); location.hash = 'workspace'; render(); announce('Файл прочитан локально. Импорт не применён: сначала проверьте изменения.');
  } catch (err) { announce((err as Error).message, true); }
});
window.addEventListener('hashchange', () => { route(); document.querySelector<HTMLElement>('#main')!.focus(); });
const updateNetwork = (): void => { document.querySelector('#connection-label')!.textContent = navigator.onLine ? 'Без аккаунта. Без внешнего AI.' : 'Браузер сообщает: офлайн. Работайте дальше.'; };
window.addEventListener('online', updateNetwork); window.addEventListener('offline', updateNetwork);
renderEvidence(); route(); render(); updateNetwork();
try { state = await store.open(); } catch (error) { persistent = false; const warning = document.querySelector<HTMLElement>('#storage-warning')!; warning.textContent = `Локальное хранилище недоступно: ${(error as Error).message} Изменения остаются только в памяти. Экспортируйте их перед закрытием.`; warning.hidden = false; }
ready = true; render();
// Static-host shell cache. The standalone HTML works without a service worker.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && document.documentElement.dataset.standalone !== 'true') {
  void navigator.serviceWorker.register('./sw.js').catch(() => announce('Автономный кэш недоступен. Скачайте standalone HTML для работы без сети.'));
}
