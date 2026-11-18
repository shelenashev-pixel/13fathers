import { i18n } from './i18n.js?v=figma-sync-10';

let onCardClickCallback = null;

export function renderCards(monks, allMonks, onSelect, emptyState = null) {
  onCardClickCallback = onSelect;

  const container = document.getElementById('monks-list') || 
                    document.getElementById('cards-container') || 
                    document.querySelector('.overflow-y-auto');

  if (!container) return;
  container.innerHTML = '';

  if (!monks.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const title = i18n.t('empty.title', emptyState?.title || 'No monasteries found');
    const message = i18n.t('empty.message', emptyState?.message || 'Try another name or region.');
    const actionLabel = i18n.t('empty.clear', emptyState?.actionLabel || 'Clear search');
    empty.innerHTML = `
      <div class="empty-state-card">
        <h3 data-i18n="empty.title">${title}</h3>
        <p data-i18n="empty.message">${message}</p>
        ${emptyState?.onAction ? `<button type="button" class="empty-state-action" data-i18n="empty.clear">${actionLabel}</button>` : ''}
      </div>
    `;
    const actionButton = empty.querySelector('.empty-state-action');
    actionButton?.addEventListener('click', () => emptyState.onAction?.());
    container.appendChild(empty);
    return;
  }

  monks.forEach((monk) => {
    const originalIndex = allMonks.findIndex(m => m.id === monk.id) + 1;
    const monkName = i18n.t(`monks.${monk.id}.name`, monk.name);
    const monkMonastery = i18n.t(`monks.${monk.id}.monastery`, monk.monastery);

    const card = document.createElement('div');
    card.id = `card-${monk.id}`;
    card.className = 'monk-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.innerHTML = `
      <span class="card-number">${originalIndex}</span>
      <span class="card-icon-frame">
        <img
          src="${monk.iconUrl || `./images/icons/${monk.id}.jpg`}"
          alt=""
          width="48"
          height="48"
          loading="lazy"
          decoding="async"
          onerror="this.remove()"
        />
      </span>
      <span class="card-copy">
        <h3 data-i18n="monks.${monk.id}.name">${monkName}</h3>
        <p data-i18n="monks.${monk.id}.monastery">${monkMonastery}</p>
      </span>
    `;

    card.addEventListener('click', () => {
      if (onCardClickCallback) {
        onCardClickCallback(monk.id);
      }
    });
    card.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && onCardClickCallback) {
        event.preventDefault();
        onCardClickCallback(monk.id);
      }
    });

    container.appendChild(card);
  });
}

export function highlightActiveCard(id, { scroll = true } = {}) {
  document.querySelectorAll('.monk-card, .panel-intro').forEach((card) => {
    card.removeAttribute('aria-current');
    card.classList.remove('is-active');
  });

  if (!id) return;

  const activeCard = document.getElementById(`card-${id}`);
  if (activeCard) {
    activeCard.setAttribute('aria-current', 'true');
    activeCard.classList.add('is-active');
    if (scroll) activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
