import { icon } from './ui.js';
export class IntentComposer extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = `<form class="composer" aria-label="Сборка рабочего пространства"><label for="intent">Какой результат вам нужен?</label><textarea id="intent" name="intent" rows="2" maxlength="500" spellcheck="false">Подготовь запуск антологии «Первый свет» за 4 недели, бюджет до 60 000 ₴.</textarea><div class="composer-bottom"><span class="engine-note"><i></i> Локальные правила · без LLM</span><button type="submit" class="button dark" id="compose-submit">Собрать пространство ${icon('arrow')}</button></div></form><div class="examples" aria-label="Примеры задач"><span>Попробуйте</span><button type="button" data-example="launch">Запуск за 4 недели</button><button type="button" data-example="budget">Разобрать бюджет</button><button type="button" data-example="focus">Только важное</button></div>`;
    this.querySelector('form')!.addEventListener('submit', e => { e.preventDefault(); this.submit(); });
    this.querySelector('textarea')!.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); this.submit(); } });
    this.querySelectorAll<HTMLButtonElement>('[data-example]').forEach(button => button.addEventListener('click', () => {
      const kind = button.dataset.example;
      this.querySelector('textarea')!.value = kind === 'budget' ? 'Разбери бюджет до 60 000 ₴.' : kind === 'focus' ? 'Фокус: покажи только план.' : 'Подготовь запуск антологии «Первый свет» за 4 недели, бюджет до 60 000 ₴.';
      this.submit();
    }));
  }
  private submit(): void { this.dispatchEvent(new CustomEvent('intent-submit', { bubbles: true, detail: this.querySelector('textarea')!.value })); }
}
customElements.define('intent-composer', IntentComposer);
