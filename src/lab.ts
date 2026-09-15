import { escapeHTML as esc, icon, downloadJSON } from './ui.js';
import { newState, propose, proposedProject } from './model.js';
interface Trial { mode: 'manual' | 'intent'; seconds: number; activations: number; errors: number }
/** A transparent single-person pilot. Not a randomized efficacy study or a model benchmark. */
export class ExperimentLab extends HTMLElement {
  private results: Trial[] = [];
  private mode: Trial['mode'] = Math.random() < .5 ? 'manual' : 'intent';
  private started = 0; private activations = 0; private errors = 0; private prepared = false;
  connectedCallback(): void {
    this.render();
    this.addEventListener('input', () => { this.prepared = false; const review = this.querySelector<HTMLElement>('#lab-review'); if (review) review.hidden = true; });
    this.addEventListener('click', e => {
      const button = (e.target as Element).closest<HTMLButtonElement>('button');
      if (!button) return;
      if (this.started) this.activations++;
      if (button.dataset.lab === 'start') { this.started = performance.now(); this.activations = 0; this.errors = 0; this.prepared = false; this.render(); this.querySelector<HTMLInputElement>('input,textarea')?.focus(); }
      if (button.dataset.lab === 'prepare') this.prepare();
      if (button.dataset.lab === 'confirm') this.finish();
      if (button.dataset.lab === 'export') downloadJSON({ disclaimer: 'Single-person pilot, not a UX efficacy study. Rule engine, not a real LLM.', results: this.results }, 'horizon-experiment.json');
      if (button.dataset.lab === 'restart') { this.results = []; this.started = 0; this.mode = Math.random() < .5 ? 'manual' : 'intent'; this.render(); }
    });
  }
  private prepare(): void {
    const budget = this.querySelector<HTMLInputElement>('#lab-budget')?.value;
    const weeks = this.querySelector<HTMLInputElement>('#lab-weeks')?.value;
    const prompt = this.querySelector<HTMLTextAreaElement>('#lab-prompt')?.value ?? '';
    let valid = this.mode === 'manual' && Number(budget) === 60000 && Number(weeks) === 4;
    if (this.mode === 'intent') {
      try { const state = newState(); const proposal = propose(state, prompt); const target = proposedProject(state, proposal, proposal.changes.map(c => c.field)); valid = target.budget === 60000 && target.weeks === 4; } catch { valid = false; }
    }
    if (!valid) { this.errors++; this.querySelector<HTMLElement>('#lab-feedback')!.textContent = 'Проверьте условия: 60 000 ₴ и 4 недели. Ошибка учтена.'; return; }
    this.prepared = true; this.querySelector<HTMLElement>('#lab-review')!.hidden = false;
    this.querySelector<HTMLButtonElement>('[data-lab="confirm"]')!.focus();
  }
  private finish(): void {
    if (!this.started || !this.prepared) return;
    this.results.push({ mode: this.mode, seconds: Math.round((performance.now() - this.started) / 100) / 10, activations: this.activations, errors: this.errors });
    this.started = 0; this.mode = this.mode === 'manual' ? 'intent' : 'manual'; this.render();
  }
  private render(): void {
    this.innerHTML = `<div class="page-intro"><h1>Не верьте будущему.<br><em>Проверьте действие.</em></h1><p>Одна задача, два способа. Сравните на себе — без выдуманных процентов эффективности.</p></div><section class="study-panel"><div class="module-heading"><span class="module-index">МИКРОЭКСПЕРИМЕНТ</span><span>${Math.min(this.results.length + 1, 2)} / 2</span></div>${this.results.length < 2 ? `<h2>${this.mode === 'manual' ? 'Обычные элементы управления' : 'Намерение → проверка'}</h2><p>Задача: установить бюджет <strong>60 000 ₴</strong> и срок <strong>4 недели</strong>, затем подтвердить изменения.</p>${!this.started ? `<button class="button dark" data-lab="start">Начать измерение ${icon('arrow')}</button>` : `<p class="timing-note">${icon('clock', 16)} Измерение началось. Время включает ввод и проверку.</p>${this.mode === 'manual' ? '<div class="form-grid"><label>Бюджет, ₴<input id="lab-budget" type="number" value="45000" min="10000" max="500000"></label><label>Срок, недель<input id="lab-weeks" type="number" value="6" min="2" max="12"></label></div>' : '<label class="lab-prompt-label">Опишите изменение<textarea id="lab-prompt" rows="2" maxlength="500" placeholder="Укажите бюджет и срок"></textarea></label>'}<button class="button dark" data-lab="prepare">Проверить изменения ${icon('arrow')}</button><p id="lab-feedback" class="inline-error" role="status"></p><div id="lab-review" class="lab-review" hidden><p>Бюджет: 45 000 → <strong>60 000 ₴</strong><br>Срок: 6 → <strong>4 недели</strong></p><button class="button lime" data-lab="confirm">Подтвердить</button></div>`}` : '<h2>Ваши наблюдения, не закон UX.</h2><p>Разница может зависеть от порядка, скорости набора и знакомства с задачей. Повторите с другими людьми и заданиями.</p>'}${this.results.length ? `<div class="results-table"><table><caption class="sr-only">Результаты локального эксперимента</caption><thead><tr><th scope="col">Способ</th><th scope="col">Секунды</th><th scope="col">Активации</th><th scope="col">Ошибки</th></tr></thead><tbody>${this.results.map(r => `<tr><th scope="row">${r.mode === 'manual' ? 'Ручной' : 'Намерение'}</th><td>${esc(r.seconds)}</td><td>${r.activations}</td><td>${r.errors}</td></tr>`).join('')}</tbody></table></div>` : ''}${this.results.length === 2 ? `<div class="button-row"><button class="button dark" data-lab="export">${icon('download')} Экспорт результатов</button><button class="button" data-lab="restart">Повторить</button></div>` : ''}</section><div class="study-notes"><h2>Что именно измеряется</h2><p>Первый способ выбирается случайно. Участник один; задачи повторяются. Активации — нажатия кнопок после старта, не символы и не вся когнитивная нагрузка. Результаты живут только в этой вкладке до перезагрузки.</p><p>Движок правил не моделирует задержку, стоимость или ошибки LLM. Этот тест показывает механику интерфейса, а не доказывает превосходство AI. Предпочтение, доверие, доступность и ошибки проверяются отдельно.</p></div>`;
  }
}
customElements.define('experiment-lab', ExperimentLab);
