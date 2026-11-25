import { renderCards, highlightActiveCard } from './cards.js?v=figma-sync-16';
import {
  initMap, flyToMonk, showPopup, closePopup, setActiveMarker, selectMobileCard, hasMobilePopup, showAllMonks
} from './map.js?v=figma-sync-39';
import { i18n, getRouteFromLocation, buildLocalizedPath } from './i18n.js?v=figma-sync-13';
import { initAnalytics, trackEvent } from './analytics.js?v=analytics-4';

const INTRO_TITLE = 'The origins of the spread of Christianity';
const INTRO_SECTIONS_FALLBACK = [
  {
    heading: 'What this map is about',
    paragraphs: [
      'In the 6th century, thirteen Syrian (Assyrian) fathers, led by Ioane of Zedazeni, came to Georgia and founded some of the earliest monasteries in the country.'
    ]
  }
];

let allMonksData = [];
let selectionRevision = 0;
let activeMonkId = null;

function syncRouteAndMeta(monkId = activeMonkId) {
  const siteTitle = i18n.t('app.title', '13 Assyrian fathers in Georgia');
  const monk = monkId ? allMonksData.find((m) => m.id === monkId) : null;
  if (monk) {
    const monkName = i18n.t(`monks.${monk.id}.name`, monk.name);
    const monastery = i18n.t(`monks.${monk.id}.monastery`, monk.monastery);
    document.title = `${monkName} — ${monastery} | ${siteTitle}`;
  } else {
    document.title = siteTitle;
  }

  if (window.location.protocol !== 'file:') {
    const targetPath = buildLocalizedPath(i18n.currentLang, monk ? monk.id : null);
    const nextUrl = targetPath + window.location.search + window.location.hash;
    if (window.location.pathname + window.location.search + window.location.hash !== nextUrl) {
      try {
        window.history.replaceState(null, '', nextUrl);
      } catch {
        // Ignore history restrictions
      }
    }
  }
}

function trackMonkSelection(monkId, source) {
  if (!monkId) return;
  trackEvent('monk_select', { monk_id: monkId, source });
}

function openMonkModal(monk, index, direction = 0) {
  const modal = document.getElementById('monk-detail-modal');
  if (!modal || !monk) return;

  modal.classList.remove('is-intro');
  const detailOverlay = document.getElementById('detail-overlay');
  detailOverlay?.classList.remove('hidden');
  document.body.classList.add('monk-modal-open');
  const modalContent = modal.querySelector('.modal-content');
  const prevScrollTop = modalContent ? modalContent.scrollTop : 0;
  if (direction && window.matchMedia('(max-width: 760px)').matches) {
    document.querySelectorAll('.modal-transition-outgoing').forEach((el) => el.remove());
    const outgoingCard = modal.cloneNode(true);
    outgoingCard.removeAttribute('id');
    outgoingCard.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    outgoingCard.classList.remove('hidden', 'slide-from-next', 'slide-from-previous', 'sheet-enter');
    outgoingCard.classList.add('modal-transition-outgoing');
    outgoingCard.setAttribute('aria-hidden', 'true');
    outgoingCard.inert = true;
    outgoingCard.querySelector('.modal-content')?.classList.remove('slide-from-next', 'slide-from-previous');
    outgoingCard.querySelectorAll('.modal-close, .modal-footer').forEach((element) => {
      element.remove();
    });
    outgoingCard.classList.add(direction > 0 ? 'slide-to-previous' : 'slide-to-next');
    outgoingCard.addEventListener('animationend', () => outgoingCard.remove(), { once: true });
    (detailOverlay || document.body).appendChild(outgoingCard);
    const outgoingContent = outgoingCard.querySelector('.modal-content');
    if (outgoingContent) outgoingContent.scrollTop = prevScrollTop;
    window.setTimeout(() => outgoingCard.remove(), 420);

    const animationClass = direction > 0 ? 'slide-from-next' : 'slide-from-previous';
    modal.classList.remove('slide-from-next', 'slide-from-previous', 'sheet-enter');
    void modal.offsetWidth;
    modal.classList.add(animationClass);
    modal.addEventListener('animationend', (event) => {
      if (event.target === modal) modal.classList.remove(animationClass);
    }, { once: true });
  }
  if (modalContent) modalContent.scrollTop = 0;
  document.getElementById('modal-monk-index').innerText = index;
  const modalNameEl = document.getElementById('modal-monk-name');
  if (modalNameEl) {
    modalNameEl.setAttribute('data-i18n', `monks.${monk.id}.name`);
    modalNameEl.textContent = i18n.t(`monks.${monk.id}.name`, monk.name);
  }
  const icon = document.getElementById('modal-monk-icon');
  const iconFrame = document.getElementById('modal-icon-frame');
  iconFrame?.classList.remove('is-missing');
  icon.onload = () => iconFrame?.classList.remove('is-missing');
  icon.onerror = () => iconFrame?.classList.add('is-missing');
  icon.src = monk.iconUrl || `./images/icons/${monk.id}.webp`;
  ['modal-monk-gmaps', 'modal-monk-gmaps-desktop'].forEach((id) => {
    const gmapsLink = document.getElementById(id);
    if (!gmapsLink) return;
    gmapsLink.href = monk.gmapsUrl || '#';
    gmapsLink.hidden = !monk.gmapsUrl;
  });

  const descContainer = document.getElementById('modal-monk-desc');
  if (Array.isArray(monk.detailSections)) {
    descContainer.replaceChildren(...monk.detailSections.map(({ heading, paragraphs }, sectionIdx) => {
      const section = document.createElement('section');
      if (sectionIdx > 0) {
        const title = document.createElement('h3');
        const sectionKey = sectionIdx === 1 ? 'sections.monastery' : '';
        if (sectionKey) {
          title.setAttribute('data-i18n', sectionKey);
        }
        title.textContent = sectionKey ? i18n.t(sectionKey, heading) : heading;
        section.appendChild(title);
      }
      paragraphs.forEach((text, pIdx) => {
        const paragraph = document.createElement('p');
        const pKey = `monks.${monk.id}.sections.${sectionIdx}.${pIdx}`;
        paragraph.setAttribute('data-i18n', pKey);
        paragraph.textContent = i18n.t(pKey, text);
        section.appendChild(paragraph);
      });
      return section;
    }));
  } else {
    const notable = monk.notable ? monk.notable.trim() : '';
    const martyrdom = monk.martyrdom ? monk.martyrdom.trim() : '';
    const paragraphs = [
      notable,
      martyrdom ? `<strong>Repose:</strong> ${martyrdom}` : ''
    ].filter(Boolean);

    descContainer.innerHTML = paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('');
  }
  modal.classList.remove('hidden');
}

function openIntroModal() {
  const modal = document.getElementById('monk-detail-modal');
  if (!modal) return;

  const detailOverlay = document.getElementById('detail-overlay');
  modal.classList.add('is-intro');
  detailOverlay?.classList.remove('hidden');
  document.body.classList.add('monk-modal-open');
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) modalContent.scrollTop = 0;
  const modalNameEl = document.getElementById('modal-monk-name');
  if (modalNameEl) {
    modalNameEl.setAttribute('data-i18n', 'intro.title');
    modalNameEl.textContent = i18n.t('intro.title', INTRO_TITLE);
  }
  const introSections = i18n.getValue('intro.sections');
  const sections = Array.isArray(introSections) && introSections.length ? introSections : INTRO_SECTIONS_FALLBACK;
  document.getElementById('modal-monk-desc').replaceChildren(...sections.map((sec, sIdx) => {
    const section = document.createElement('section');
    if (sec.heading) {
      const title = document.createElement('h3');
      title.setAttribute('data-i18n', `intro.sections.${sIdx}.heading`);
      title.textContent = sec.heading;
      section.appendChild(title);
    }
    if (Array.isArray(sec.paragraphs)) {
      sec.paragraphs.forEach((text, pIdx) => {
        const paragraph = document.createElement('p');
        paragraph.setAttribute('data-i18n', `intro.sections.${sIdx}.paragraphs.${pIdx}`);
        paragraph.textContent = text;
        section.appendChild(paragraph);
      });
    }
    if (Array.isArray(sec.bullets) && sec.bullets.length) {
      const list = document.createElement('ul');
      sec.bullets.forEach((item, bIdx) => {
        const li = document.createElement('li');
        if (item.lead) {
          const strong = document.createElement('strong');
          strong.setAttribute('data-i18n', `intro.sections.${sIdx}.bullets.${bIdx}.lead`);
          strong.textContent = item.lead;
          li.appendChild(strong);
          li.appendChild(document.createTextNode(' '));
        }
        const span = document.createElement('span');
        span.setAttribute('data-i18n', `intro.sections.${sIdx}.bullets.${bIdx}.text`);
        span.textContent = item.text || '';
        li.appendChild(span);
        list.appendChild(li);
      });
      section.appendChild(list);
    }
    return section;
  }));
  modal.classList.remove('hidden');
}

function handleSelectIntro() {
  const modal = document.getElementById('monk-detail-modal');
  if (modal && !modal.classList.contains('hidden') && modal.classList.contains('is-intro')) {
    closeDetailModal();
    highlightActiveCard(null);
    return;
  }
  selectionRevision += 1;
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  if (!isMobile) {
    activeMonkId = null;
    closePopup({ notify: false });
    setActiveMarker(null);
  } else if (!activeMonkId && allMonksData[0]?.id) {
    activeMonkId = allMonksData[0].id;
  }
  document.body.classList.remove('map-only-view');
  updateMapViewButton();
  highlightActiveCard('intro', { scroll: !isMobile });
  setMobileListOpen(false);
  openIntroModal();
  trackEvent('edition_open');
  if (!isMobile) {
    void showAllMonks().catch((error) => console.error('Failed to fit map to all monasteries', error));
  }
}

function openMonkDetails(monkId) {
  const index = allMonksData.findIndex((monk) => monk.id === monkId);
  if (index < 0) throw new Error(`Unknown monk requested for details: ${monkId}`);

  const monk = allMonksData[index];
  syncActiveMonkOnMobile(monkId, { syncMiniCarousel: true });
  openMonkModal(monk, index + 1);
  trackEvent('monk_detail_open', { monk_id: monk.id });
}

export function closeMonkModal() {
  activeMonkId = null;
  closePopup();
  closeDetailModal();
  highlightActiveCard(null);
  syncRouteAndMeta(null);
}

function closeDetailModal({ syncMap = true } = {}) {
  const modal = document.getElementById('monk-detail-modal');
  const wasOpen = modal && !modal.classList.contains('hidden');
  const wasIntro = modal?.classList.contains('is-intro');
  if (modal) {
    modal.classList.add('hidden');
  }
  if (wasIntro) {
    highlightActiveCard(null);
  }
  document.getElementById('detail-overlay')?.classList.add('hidden');
  document.body.classList.remove('monk-modal-open');
  if (syncMap && wasOpen && window.matchMedia('(max-width: 760px)').matches && activeMonkId) {
    syncActiveMonkOnMobile(activeMonkId, { syncMiniCarousel: true, flyMap: true });
  }
}

function setMobileListOpen(isOpen) {
  if (isOpen) {
    document.body.classList.remove('map-only-view');
    updateMapViewButton();
    i18n.closeMenu();
  }
  document.body.classList.toggle('mobile-list-open', isOpen);
  const toggle = document.getElementById('mobile-list-toggle');
  const labelKey = isOpen ? 'header.closeList' : 'header.openList';
  const fallbackLabel = isOpen ? 'Close monastery list' : 'Open monastery list';
  toggle?.setAttribute('aria-expanded', String(isOpen));
  toggle?.setAttribute('data-i18n-aria-label', labelKey);
  toggle?.setAttribute('aria-label', i18n.t(labelKey, fallbackLabel));
}

function updateMapViewButton() {
  const button = document.getElementById('reset-btn');
  const isMapOnlyView = document.body.classList.contains('map-only-view');
  if (button) {
    const key = isMapOnlyView ? 'header.viewList' : 'header.viewMap';
    const fallback = isMapOnlyView ? 'View list' : 'View map';
    button.setAttribute('data-i18n', key);
    button.textContent = i18n.t(key, fallback);
    button.setAttribute('aria-pressed', String(isMapOnlyView));
  }
  const mobileOverlay = document.getElementById('mobile-card-overlay');
  if (mobileOverlay) {
    mobileOverlay.inert = isMapOnlyView;
    mobileOverlay.setAttribute('aria-hidden', String(isMapOnlyView));
  }
}

function ensureMobileCarousel(monk, index) {
  if (hasMobilePopup()) {
    selectMobileCard(index);
    return;
  }
  showPopup(
    monk,
    () => {
      closeDetailModal();
      highlightActiveCard(null);
    },
    (selectedMonkId) => openMonkDetails(selectedMonkId || monk.id),
    index + 1,
    (targetIndex) => {
      const nextMonk = allMonksData[targetIndex];
      if (!nextMonk) return;
      syncActiveMonkOnMobile(nextMonk.id, { syncMiniCarousel: false, flyMap: true });
      trackMonkSelection(nextMonk.id, 'prev_next');
    },
    allMonksData
  );
}

function syncActiveMonkOnMobile(monkId, {
  syncMiniCarousel = true,
  syncDetailCarousel = false,
  flyMap = false,
  modalDirection = 0
} = {}) {
  const index = allMonksData.findIndex((monk) => monk.id === monkId);
  if (index < 0) throw new Error(`Unknown monk requested for mobile sync: ${monkId}`);

  const monk = allMonksData[index];
  activeMonkId = monkId;
  syncRouteAndMeta(monkId);
  document.body.classList.remove('map-only-view');
  updateMapViewButton();
  setActiveMarker(monk);
  highlightActiveCard(monkId, { scroll: false });
  if (syncMiniCarousel) ensureMobileCarousel(monk, index);
  if (syncDetailCarousel) openMonkModal(monk, index + 1, modalDirection);
  if (flyMap) {
    void flyToMonk(monk, { duration: 450 }).catch((error) => {
      console.error(`Failed to navigate to ${monk.name}`, error);
    });
  }
}

export function handleSelectMonk(monkId, {
  fromSwipe = false,
  keepModalOpen = false,
  modalDirection = 0,
  source = fromSwipe ? 'prev_next' : 'list'
} = {}) {
  const monk = allMonksData.find(m => m.id === monkId);
  if (!monk) return;

  const revision = ++selectionRevision;
  const originalIndex = allMonksData.findIndex(m => m.id === monk.id) + 1;
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  activeMonkId = monk.id;
  syncRouteAndMeta(monk.id);
  trackMonkSelection(monk.id, source);

  document.body.classList.remove('map-only-view');
  updateMapViewButton();
  if (!isMobile) closePopup({ notify: !keepModalOpen });
  if (!keepModalOpen) closeDetailModal({ syncMap: false });
  highlightActiveCard(monk.id, { scroll: !fromSwipe && !keepModalOpen });
  setMobileListOpen(false);

  if (isMobile && !keepModalOpen && hasMobilePopup()) {
    syncActiveMonkOnMobile(monk.id, { syncMiniCarousel: !fromSwipe, flyMap: true });
    return;
  }

  if (keepModalOpen && isMobile) {
    syncActiveMonkOnMobile(monk.id, {
      syncMiniCarousel: true,
      syncDetailCarousel: true,
      modalDirection
    });
    return;
  }

  if (!isMobile || keepModalOpen) openMonkModal(monk, originalIndex, modalDirection);

  void flyToMonk(monk, fromSwipe ? { duration: 450 } : undefined)
    .then(() => {
      if (revision !== selectionRevision) return;
      let popupSelectionRevision = revision;
      showPopup(
        monk,
        () => {
          closeDetailModal();
          highlightActiveCard(null);
        },
        (selectedMonkId) => openMonkDetails(selectedMonkId || monk.id),
        originalIndex,
        (targetIndex) => {
          if (!isMobile && popupSelectionRevision !== selectionRevision) return;
          const nextMonk = allMonksData[targetIndex];
          if (!nextMonk) return;
          if (isMobile) {
            syncActiveMonkOnMobile(nextMonk.id, { syncMiniCarousel: false, flyMap: true });
            trackMonkSelection(nextMonk.id, 'prev_next');
          } else {
            handleSelectMonk(nextMonk.id, { fromSwipe: true, source: 'prev_next' });
            popupSelectionRevision = selectionRevision;
          }
        },
        allMonksData
      );
    })
    .catch((error) => {
      console.error(`Failed to navigate to ${monk.name}`, error);
    });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  await i18n.init();

  const status = document.getElementById('app-status');
  const statusMessage = document.getElementById('app-status-message');
  const retryButton = document.getElementById('app-status-retry');
  const monkList = document.getElementById('monks-list');
  retryButton?.addEventListener('click', () => window.location.reload());

  try {
    const response = await fetch('./data/monks.json', { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load monastery data: ${response.status} ${response.statusText}`);
    }

    allMonksData = await response.json();
    if (!Array.isArray(allMonksData)) {
      throw new Error('Monastery data must be an array');
    }
  } catch (error) {
    console.error('Unable to load monastery data', error);
    if (monkList) {
      monkList.replaceChildren();
      monkList.setAttribute('aria-busy', 'false');
    }
    document.getElementById('mobile-card-overlay')?.replaceChildren();
    if (status && statusMessage) {
      status.classList.add('is-error');
      status.setAttribute('role', 'alert');
      status.setAttribute('aria-live', 'assertive');
      statusMessage.setAttribute('data-i18n', 'status.error');
      statusMessage.textContent = i18n.t('status.error', 'Monastery locations could not be loaded. Check your connection and retry.');
      retryButton?.removeAttribute('hidden');
    }
    return;
  }

  status?.classList.add('hidden');

  initMap(allMonksData, handleSelectMonk);

  if (!window.matchMedia('(max-width: 760px)').matches) {
    const skeletonOverlay = document.getElementById('mobile-card-overlay');
    skeletonOverlay?.replaceChildren();
    if (skeletonOverlay) skeletonOverlay.hidden = true;
  }

  const searchInput = document.getElementById('search-input');
  const counter = document.getElementById('counter');
  let searchTrackTimer = null;
  let lastTrackedSearch = '';
  const scheduleSearchTrack = (query, resultsCount) => {
    clearTimeout(searchTrackTimer);
    if (query.length < 2) {
      lastTrackedSearch = '';
      return;
    }
    searchTrackTimer = window.setTimeout(() => {
      if (query === lastTrackedSearch) return;
      lastTrackedSearch = query;
      trackEvent('search_use', { results_count: resultsCount });
    }, 800);
  };
  const renderFilteredCards = () => {
    const query = searchInput?.value.trim().toLocaleLowerCase() ?? '';
    const filteredMonks = allMonksData.filter((monk) =>
      [
        monk.name,
        monk.monastery,
        monk.region,
        monk.georgianName,
        i18n.t(`monks.${monk.id}.name`),
        i18n.t(`monks.${monk.id}.monastery`),
        i18n.t(`monks.${monk.id}.region`)
      ].some((value) => value?.toLocaleLowerCase().includes(query))
    );
    scheduleSearchTrack(query, filteredMonks.length);

    if (!filteredMonks.length) {
      renderCards(filteredMonks, allMonksData, handleSelectMonk, {
        title: 'No monasteries found',
        message: 'Try another monk, monastery, or region.',
        actionLabel: 'Clear search',
        onAction: () => {
          if (searchInput) searchInput.value = '';
          renderFilteredCards();
        }
      });
      if (counter) counter.textContent = '0 monasteries';
      return;
    }

    renderCards(filteredMonks, allMonksData, handleSelectMonk);
    if (!activeMonkId && !document.getElementById('monk-detail-modal')?.classList.contains('hidden')
      && document.getElementById('monk-detail-modal')?.classList.contains('is-intro')) {
      highlightActiveCard('intro', { scroll: false });
    } else if (activeMonkId) {
      highlightActiveCard(activeMonkId, { scroll: false });
    }
    if (counter) counter.textContent = `${filteredMonks.length} Monasteries`;
  };

  if (searchInput) {
    searchInput.addEventListener('input', renderFilteredCards);
  }
  document.getElementById('card-intro')?.addEventListener('click', handleSelectIntro);
  document.getElementById('search-clear')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    renderFilteredCards();
    searchInput?.focus();
  });

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    setMobileListOpen(false);
    const isMapOnly = document.body.classList.toggle('map-only-view');
    updateMapViewButton();
    trackEvent('view_mode_toggle', { target_view: isMapOnly ? 'map' : 'list' });
    if (isMapOnly) {
      void showAllMonks().catch((error) => console.error('Failed to fit map to all monasteries', error));
    } else {
      const activeMonk = activeMonkId ? allMonksData.find((monk) => monk.id === activeMonkId) : null;
      if (activeMonk) {
        void flyToMonk(activeMonk).catch((error) => console.error(`Failed to navigate to ${activeMonk.name}`, error));
      } else {
        void showAllMonks().catch((error) => console.error('Failed to fit map to all monasteries', error));
      }
    }
  });
  document.getElementById('mobile-list-toggle')?.addEventListener('click', () => {
    const isOpen = !document.body.classList.contains('mobile-list-open');
    setMobileListOpen(isOpen);
    trackEvent('view_mode_toggle', { target_view: isOpen ? 'list' : 'map' });
  });
  ['modal-monk-gmaps-desktop', 'modal-monk-gmaps'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (!activeMonkId) return;
      trackEvent('open_google_maps', {
        monk_id: activeMonkId,
        surface: 'detail'
      });
    });
  });

  renderFilteredCards();
  monkList?.classList.add('is-revealing');
  window.setTimeout(() => monkList?.classList.remove('is-revealing'), 400);
  monkList?.setAttribute('aria-busy', 'false');
  i18n.onChange(() => {
    renderFilteredCards();
    syncRouteAndMeta(activeMonkId);
  });

  const { monkId: initialMonkId } = getRouteFromLocation();
  const initialMonk = initialMonkId ? allMonksData.find((monk) => monk.id === initialMonkId) : null;

  if (initialMonk) {
    handleSelectMonk(initialMonk.id, {
      source: 'direct_url',
      keepModalOpen: window.matchMedia('(max-width: 760px)').matches
    });
  } else {
    syncRouteAndMeta(null);
    if (window.matchMedia('(max-width: 760px)').matches && allMonksData[0]?.coordinates) {
      activeMonkId = allMonksData[0].id;
      setActiveMarker(allMonksData[0]);
      showPopup(
        allMonksData[0],
        () => {
          closeDetailModal();
          highlightActiveCard(null);
        },
        (selectedMonkId) => openMonkDetails(selectedMonkId),
        1,
        (targetIndex) => {
          const selectedMonk = allMonksData[targetIndex];
          if (selectedMonk) handleSelectMonk(selectedMonk.id, { fromSwipe: true, source: 'prev_next' });
        },
        allMonksData
      );
      flyToMonk(allMonksData[0]);
    }
  }

  // Кнопка закрытия модального окна
  const closeBtn = document.getElementById('close-modal-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDetailModal);
  }
  const selectAdjacentMonk = (offset) => {
    const isIntro = document.getElementById('monk-detail-modal')?.classList.contains('is-intro');
    if (isIntro) return;
    const currentIndex = allMonksData.findIndex((monk) => monk.id === activeMonkId);
    if (currentIndex < 0 || !allMonksData.length) return;
    const nextIndex = (currentIndex + offset + allMonksData.length) % allMonksData.length;
    const modal = document.getElementById('monk-detail-modal');
    const keepModalOpen = window.matchMedia('(max-width: 760px)').matches
      && modal
      && !modal.classList.contains('hidden');
    if (keepModalOpen) {
      syncActiveMonkOnMobile(allMonksData[nextIndex].id, {
        syncMiniCarousel: false,
        syncDetailCarousel: true,
        modalDirection: offset
      });
      trackMonkSelection(allMonksData[nextIndex].id, 'prev_next');
    } else {
      handleSelectMonk(allMonksData[nextIndex].id, { source: 'prev_next' });
    }
  };
  document.getElementById('detail-prev')?.addEventListener('click', () => selectAdjacentMonk(-1));
  document.getElementById('detail-next')?.addEventListener('click', () => selectAdjacentMonk(1));
  const modal = document.getElementById('monk-detail-modal');
  const modalContent = modal?.querySelector('.modal-content');
  let modalSwipeStart = null;
  modalContent?.addEventListener('pointerdown', (event) => {
    if (!window.matchMedia('(max-width: 760px)').matches
      || event.pointerType !== 'touch'
      || event.button !== 0
      || event.target.closest('button, a')) return;
    modalSwipeStart = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  modalContent?.addEventListener('pointerup', (event) => {
    if (!modalSwipeStart || event.pointerType !== 'touch') return;
    const deltaX = event.clientX - modalSwipeStart.x;
    const deltaY = event.clientY - modalSwipeStart.y;
    modalSwipeStart = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    selectAdjacentMonk(deltaX < 0 ? 1 : -1);
  }, { passive: true });
  modalContent?.addEventListener('pointercancel', () => {
    modalSwipeStart = null;
  }, { passive: true });
  document.addEventListener('keydown', (event) => {
    const modal = document.getElementById('monk-detail-modal');
    const isModalOpen = modal && !modal.classList.contains('hidden');
    if (event.key === 'Escape' && (isModalOpen || activeMonkId)) {
      event.preventDefault();
      activeMonkId = null;
      setActiveMarker(null);
      closeMonkModal();
      return;
    }
    if (!isModalOpen || modal.classList.contains('is-intro')) return;
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectAdjacentMonk(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectAdjacentMonk(1);
    }
  });

  initAnalytics();
});
