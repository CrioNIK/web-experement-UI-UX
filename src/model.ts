/** All mutations pass through this small, deterministic domain model. No generated code. */
export type Intent = 'launch' | 'budget' | 'focus';
export type ModuleKind = 'roadmap' | 'budget' | 'brief';
export interface Project { title: string; budget: number; weeks: number; stage: 'idea' | 'planned'; done: boolean[] }
export type Field = 'title' | 'budget' | 'weeks' | 'stage' | 'done';
export interface Change { field: Field; before: Project[Field]; after: Project[Field]; label: string }
export interface Proposal { baseRevision: number; intent: Intent; prompt: string; reason: string; modules: ModuleKind[]; changes: Change[] }
export interface Audit { id: string; at: string; kind: 'apply' | 'undo' | 'import'; summary: string }
export interface State { version: 1; revision: number; project: Project; history: Audit[]; undo: Project[] }
export const INITIAL: Project = { title: 'Первый свет', budget: 45000, weeks: 6, stage: 'idea', done: [false, false, false, false] };
export const labels: Record<Field, string> = { title: 'Название', budget: 'Бюджет', weeks: 'Срок, недель', stage: 'Этап', done: 'Готовность задач' };
export const newState = (): State => ({ version: 1, revision: 0, project: structuredClone(INITIAL), history: [], undo: [] });
export const money = (n: number): string => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₴';
export const fieldText = (value: Project[Field]): string => Array.isArray(value) ? `${value.filter(Boolean).length} из 4` : value === 'idea' ? 'Идея' : value === 'planned' ? 'План готов' : String(value);
export function validateProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  if (Object.keys(p).sort().join(',') !== 'budget,done,stage,title,weeks') return false;
  return typeof p.title === 'string' && p.title.trim().length > 0 && p.title.length <= 120 &&
    Number.isInteger(p.budget) && Number(p.budget) >= 10000 && Number(p.budget) <= 500000 &&
    Number.isInteger(p.weeks) && Number(p.weeks) >= 2 && Number(p.weeks) <= 12 &&
    (p.stage === 'idea' || p.stage === 'planned') && Array.isArray(p.done) && p.done.length === 4 && p.done.every(x => typeof x === 'boolean');
}
export function validateState(value: unknown): value is State {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return Object.keys(s).sort().join(',') === 'history,project,revision,undo,version' && s.version === 1 && Number.isSafeInteger(s.revision) && Number(s.revision) >= 0 && validateProject(s.project) &&
    Array.isArray(s.undo) && s.undo.length <= 20 && s.undo.every(validateProject) &&
    Array.isArray(s.history) && s.history.length <= 40 && s.history.every((h: unknown) => {
      if (!h || typeof h !== 'object') return false;
      const a = h as Record<string, unknown>;
      return Object.keys(a).sort().join(',') === 'at,id,kind,summary' && typeof a.id === 'string' && a.id.length <= 100 && typeof a.at === 'string' && Number.isFinite(Date.parse(a.at)) && ['apply','undo','import'].includes(String(a.kind)) && typeof a.summary === 'string' && a.summary.length <= 500;
    });
}
export function diff(from: Project, to: Project): Change[] {
  if (!validateProject(to)) throw new Error('Некорректный проект: бюджет 10 000–500 000, срок 2–12 недель.');
  return (Object.keys(labels) as Field[]).filter(k => JSON.stringify(from[k]) !== JSON.stringify(to[k])).map(field => ({ field, before: structuredClone(from[field]), after: structuredClone(to[field]), label: labels[field] }));
}
export function propose(state: State, text: string, explicit?: Intent): Proposal {
  const prompt = text.trim();
  if (prompt.length > 500) throw new Error('Сократите запрос до 500 символов.');
  const lower = prompt.toLocaleLowerCase('ru');
  const intent = explicit ?? (/бюджет|расход|budget|cost/.test(lower) && !/запуск|выпус|launch|план/.test(lower) ? 'budget' : /фокус|сосред|focus/.test(lower) ? 'focus' : /запуск|выпус|план|launch|release/.test(lower) ? 'launch' : undefined);
  if (!intent) throw new Error('Не удалось определить задачу. Доступны запуск, бюджет и фокус. Выберите пример ниже — это ограниченный движок правил, не LLM.');
  const target = structuredClone(state.project);
  const budgetMatch = lower.match(/(?:бюджет\s*(?:до|:)?\s*|до\s+|budget\s*)([\d\s\u00a0]+)(?:₴|грн|uah|руб|$|[,.;])/u);
  if (budgetMatch?.[1]) target.budget = Number(budgetMatch[1].replace(/\s/g, ''));
  if (/руб|доллар|\$|евро|€/.test(lower)) throw new Error('В этом эксперименте поддерживаются только гривны (₴). Конвертация валют не выполняется.');
  const weekMatch = lower.match(/(\d+)\s*(?:недел|weeks?)/u);
  if (weekMatch?.[1]) target.weeks = Number(weekMatch[1]);
  const titleMatch = prompt.match(/[«“"]([^»”"]{1,120})[»”"]/u);
  if (titleMatch?.[1]) target.title = titleMatch[1].trim();
  if (intent === 'launch') target.stage = 'planned';
  const modules: ModuleKind[] = intent === 'budget' ? ['budget', 'brief'] : intent === 'focus' ? ['roadmap'] : ['roadmap', 'budget', 'brief'];
  return { baseRevision: state.revision, intent, prompt, modules, reason: intent === 'budget' ? 'Запрос о расходах: показываем бюджет и ограничения. План не исчез — он доступен вручную.' : intent === 'focus' ? 'Фокус включён по вашей команде. Оставляем план; скрытые модули можно вернуть.' : 'Задача запуска: рядом нужны этапы, бюджет и ограничения. Навигация остаётся на месте.', changes: diff(state.project, target) };
}
export function proposedProject(state: State, proposal: Proposal, selected: Field[]): Project {
  if (proposal.baseRevision !== state.revision) throw new Error('Проект изменился. Соберите предложение заново.');
  if (proposal.changes.some(c => !Object.hasOwn(labels, c.field))) throw new Error('Неизвестное действие отклонено.');
  const target = structuredClone(state.project);
  for (const change of proposal.changes) if (selected.includes(change.field)) Object.assign(target, { [change.field]: structuredClone(change.after) });
  if (!validateProject(target)) throw new Error('Предложение не прошло проверку.');
  return target;
}
// Local audit IDs are labels, not security tokens; also work on file:// and opaque origins.
function record(state: State, project: Project, kind: Audit['kind'], summary: string, undo: Project[]): State {
  return { version: 1, revision: state.revision + 1, project, undo: undo.slice(-20), history: [...state.history, { id: `${Date.now().toString(36)}-${state.revision + 1}`, at: new Date().toISOString(), kind, summary }].slice(-40) };
}
export function apply(state: State, proposal: Proposal, selected: Field[]): State {
  const project = proposedProject(state, proposal, selected);
  const changes = diff(state.project, project);
  if (!changes.length) throw new Error('Нет выбранных изменений.');
  return record(state, project, 'apply', changes.map(c => c.label).join(' · '), [...state.undo, structuredClone(state.project)]);
}
export function undoLast(state: State): State {
  const before = state.undo.at(-1);
  if (!before) throw new Error('Пока нечего отменять.');
  return record(state, structuredClone(before), 'undo', 'Предыдущее изменение отменено', state.undo.slice(0, -1));
}
export function importProject(state: State, value: unknown): State {
  if (!validateProject(value)) throw new Error('Файл не содержит допустимый проект HORIZON.');
  return record(state, structuredClone(value), 'import', 'Импортирован локальный проект', [...state.undo, structuredClone(state.project)]);
}
