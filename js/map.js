import { i18n } from './i18n.js?v=figma-sync-13';
import { trackEvent } from './analytics.js?v=analytics-4';

let mapInstance = null;
let isMapLoaded = false;
let cameraRevision = 0;
let markersMap = {};
let currentActivePopup = null;
let currentMobileCardOverlay = null;
let currentMobileCardOnClose = null;
let currentMobileCardCleanup = null;
let currentMobileCardSelect = null;
const loadedImages = new Set();

function preloadMonasteryImage(monk) {
  const src = monk?.imageUrl || (monk?.id ? `./images/monasteries/${monk.id}.webp` : '');
  if (!src || loadedImages.has(src)) return;
  const preload = new Image();
  preload.onload = () => {
    loadedImages.add(src);
    preload.decode?.().catch(() => {});
  };
  preload.src = src;
}

export function initMap(monks, onMarkerClick) {
  isMapLoaded = false;
  mapInstance = new maplibregl.Map({
    container: 'map',
    style: './data/map-style.json',
    center: [44.8, 41.9],
    zoom: 7.5,
    maxTileCacheSize: 200,
    fadeDuration: 100,
    refreshExpiredTiles: false,
    attributionControl: false
  });

  mapInstance.addControl(new maplibregl.NavigationControl(), 'bottom-right');
  mapInstance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  let attributionUserToggled = false;
  const collapseAttribution = () => {
    if (attributionUserToggled) return;
    const attribution = mapInstance.getContainer().querySelector('.maplibregl-ctrl-attrib');
    if (attribution?.classList.contains('maplibregl-compact')) {
      attribution.classList.remove('maplibregl-compact-show');
      attribution.removeAttribute('open');
    }
  };
  const attribEl = mapInstance.getContainer().querySelector('.maplibregl-ctrl-attrib-button');
  attribEl?.addEventListener('click', () => { attributionUserToggled = true; });
  collapseAttribution();
  mapInstance.on('styledata', collapseAttribution);
  mapInstance.once('load', () => {
    isMapLoaded = true;
    collapseAttribution();
  });

  monks.forEach((monk) => {
    if (!monk.coordinates) return;

    const el = document.createElement('div');
    el.className = 'map-pin-wrap';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-pressed', 'false');
    const markerIcon = document.createElement('span');
    markerIcon.className = 'map-pin';
    markerIcon.innerHTML = '<i class="icon icon-cross" aria-hidden="true"></i>';
    el.appendChild(markerIcon);

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(monk.coordinates)
      .addTo(mapInstance);
    marker.getElement().setAttribute('aria-label', `Show ${monk.name} on map`);

    const selectMarker = (event) => {
      event.stopPropagation();
      onMarkerClick?.(monk.id, { source: 'map_pin' });
    };
    marker.getElement().addEventListener('click', selectMarker);
    marker.getElement().addEventListener('pointerenter', () => preloadMonasteryImage(monk), { once: true });
    marker.getElement().addEventListener('focus', () => preloadMonasteryImage(monk), { once: true });
    marker.getElement().addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectMarker(event);
    });

    markersMap[monk.id] = { marker, monk };
  });

  if (window.innerWidth > 760) {
    void showAllMonks({ duration: 0 });
  }

  return mapInstance;
}

// Part of the viewport not covered by the list/detail panels or the header (desktop only).
function getFreeMapInsets() {
  if (window.innerWidth <= 760) return { top: 0, left: 0 };
  const mapOnly = document.body.classList.contains('map-only-view');
  const header = document.querySelector('.app-header')?.getBoundingClientRect();
  const panel = document.querySelector('.monks-panel');
  const overlay = document.getElementById('detail-overlay');
  const panelRight = panel ? panel.offsetLeft + panel.offsetWidth : 0;
  const detailRight = overlay && !overlay.classList.contains('hidden')
    ? overlay.offsetLeft + overlay.offsetWidth
    : 0;
  const left = mapOnly ? 0 : Math.max(panelRight, detailRight);
  return { top: header?.bottom ?? 0, left };
}

function whenMapReady(callback) {
  if (!mapInstance) return;
  if (isMapLoaded || mapInstance.isStyleLoaded()) {
    callback();
  } else {
    mapInstance.once('load', callback);
  }
}

export function showAllMonks({ duration = 900 } = {}) {
  if (!mapInstance) return Promise.resolve();

  const revision = ++cameraRevision;
  mapInstance.stop();
  mapInstance.resize();
  const bounds = new maplibregl.LngLatBounds();
  Object.values(markersMap).forEach(({ monk }) => bounds.extend(monk.coordinates));
  if (bounds.isEmpty()) return Promise.resolve();

  const isMobile = window.innerWidth <= 760;
  const { top, left } = getFreeMapInsets();
  const padding = isMobile
    ? { top: 150, right: 32, bottom: 40, left: 32 }
    : { top: top + 56, right: 110, bottom: 56, left: left + 88 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return new Promise((resolve) => {
    const startFit = () => {
      if (revision !== cameraRevision) {
        resolve();
        return;
      }
      mapInstance.stop();
      mapInstance.resize();
      mapInstance.once('moveend', resolve);
      mapInstance.fitBounds(bounds, {
        padding, maxZoom: 7.7, essential: !reducedMotion, duration: reducedMotion ? 0 : duration
      });
      if (!mapInstance.isMoving()) {
        mapInstance.off('moveend', resolve);
        resolve();
      }
    };
    whenMapReady(startFit);
  });
}

export function flyToMonk(monk, { duration } = {}) {
  if (!mapInstance || !monk || !monk.coordinates) return Promise.resolve();

  const revision = ++cameraRevision;
  preloadMonasteryImage(monk);
  mapInstance.stop();
  mapInstance.resize();
  setActiveMarker(monk);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { top, left } = getFreeMapInsets();
  let offset = [left / 2, top / 2 + 138];
  if (window.innerWidth <= 760) {
    if (document.body.classList.contains('map-only-view')) {
      offset = [0, 0];
    } else {
      const resetRect = document.getElementById('reset-btn')?.getBoundingClientRect();
      const cardRect = document.querySelector('.mobile-monk-card')?.getBoundingClientRect();
      const topEdge = resetRect && resetRect.height > 0 ? resetRect.bottom : 140;
      const bottomEdge = cardRect && cardRect.height > 0 ? cardRect.top : window.innerHeight - 248;
      const mapCenterY = mapInstance.getContainer().getBoundingClientRect().height / 2;
      offset = [0, Math.round((topEdge + bottomEdge) / 2 - mapCenterY)];
    }
  }
  // Centre the pin + place card group (card above the pin) in the free map area.
  const cameraOptions = {
    center: monk.coordinates,
    offset,
    zoom: 11,
    essential: !prefersReducedMotion,
    duration: prefersReducedMotion ? 0 : duration ?? 850
  };

  return new Promise((resolve) => {
    const startFlight = () => {
      if (revision !== cameraRevision) {
        resolve();
        return;
      }
      mapInstance.stop();
      mapInstance.resize();
      const finishFlight = () => resolve();
      mapInstance.once('moveend', finishFlight);
      mapInstance.flyTo(cameraOptions);
      currentActivePopup?.setLngLat(monk.coordinates);
      if (!mapInstance.isMoving()) {
        mapInstance.off('moveend', finishFlight);
        resolve();
      }
    };

    whenMapReady(startFlight);
  });
}

export function setActiveMarker(monk) {
  Object.values(markersMap).forEach(({ marker, monk: markerMonk }) => {
    const markerIcon = marker.getElement().querySelector('.map-pin');
    const isActive = markerMonk.id === monk?.id;
    marker.getElement().classList.toggle('is-active', isActive);
    if (markerIcon) {
      markerIcon.classList.toggle('is-active', isActive);
    }
    marker.getElement().setAttribute('aria-pressed', String(isActive));
  });
}

// Отображение всплывающей карточки над монастырем
export function showPopup(monk, onClose, onRead, index, onSwipe, monks = [monk]) {
  if (!mapInstance || !monk || !monk.coordinates) return;

  closePopup({ notify: false });

  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  const popupContent = document.createElement('div');
  let activeIndex = -1;
  popupContent.className = isMobile ? 'mobile-monk-carousel' : 'place-card-wrap';

  if (isMobile) {
    popupContent.setAttribute('role', 'group');
    popupContent.setAttribute('aria-label', 'Swipe to browse monasteries');
    activeIndex = monks.findIndex((item) => item.id === monk.id);
    popupContent.innerHTML = monks.map((item, itemIndex) => `
      <article class="mobile-monk-card" data-monk-index="${itemIndex}" aria-current="${item.id === monk.id}">
        <div class="mobile-card-image">
          <img src="${item.imageUrl || `./images/monasteries/${item.id}.webp`}" alt="${i18n.t(`monks.${item.id}.monastery`, item.monastery)}" width="296" height="132" style="object-position: ${item.imagePosition || '50% 35%'}" loading="${Math.abs(itemIndex - activeIndex) <= 1 ? 'eager' : 'lazy'}" decoding="async" />
          <span class="mobile-card-number">${itemIndex + 1}</span>
          ${item.gmapsUrl ? `
            <a class="mobile-card-location" href="${item.gmapsUrl}" target="_blank" rel="noopener noreferrer" data-monk-id="${item.id}" aria-label="Open ${item.monastery} in Google Maps">
              <i class="icon icon-map-pin" aria-hidden="true"></i>
            </a>
          ` : ''}
        </div>
        <div class="mobile-card-content">
          <h2 class="mobile-card-name" data-i18n="monks.${item.id}.monastery">${i18n.t(`monks.${item.id}.monastery`, item.monastery)}</h2>
          <p class="mobile-card-monastery" data-i18n="monks.${item.id}.region">${i18n.t(`monks.${item.id}.region`, item.region || '')}</p>
          <div class="mobile-card-actions">
            <button class="mobile-card-read" type="button" data-action="read" data-monk-id="${item.id}" data-i18n="card.readMore">${i18n.t('card.readMore', 'Read more')}</button>
          </div>
        </div>
      </article>
    `).join('');
    popupContent.dataset.activeIndex = String(activeIndex);
    popupContent.querySelectorAll('.mobile-card-image > img').forEach((img) => {
      const markLoaded = () => img.classList.add('is-loaded');
      img.addEventListener('load', markLoaded, { once: true });
      img.addEventListener('error', () => {
        img.style.display = 'none';
      }, { once: true });
      if (img.complete && img.naturalWidth > 0) {
        markLoaded();
      }
    });
  } else {
    const imgSrc = monk.imageUrl || `./images/monasteries/${monk.id}.webp`;
    const isCached = loadedImages.has(imgSrc);
    popupContent.style.touchAction = 'pan-y';
    popupContent.innerHTML = `
      <article class="place-card">
        <div class="place-card-image">
          <img
            class="${isCached ? 'is-loaded' : ''}"
            src="${imgSrc}"
            alt="${i18n.t(`monks.${monk.id}.monastery`, monk.monastery)}"
            width="296"
            height="132"
            style="object-position: ${monk.imagePosition || '50% 35%'}"
            decoding="sync"
            onerror="this.style.display='none'"
          />
        </div>
        <div class="place-card-body">
          <div class="place-card-text">
            <h4 class="place-card-title" data-i18n="monks.${monk.id}.monastery">${i18n.t(`monks.${monk.id}.monastery`, monk.monastery)}</h4>
            <span class="place-card-region" data-i18n="monks.${monk.id}.region">${i18n.t(`monks.${monk.id}.region`, monk.region || '')}</span>
          </div>
          ${monk.gmapsUrl ? `
            <a
              class="monk-popup-gmaps"
              href="${monk.gmapsUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span data-i18n="card.openMaps">${i18n.t('card.openMaps', 'Open in Google Maps')}</span>
              <i class="icon icon-map-pin" aria-hidden="true"></i>
            </a>
          ` : ''}
        </div>
      </article>
    `;
    const placeImg = popupContent.querySelector('.place-card-image > img');
    if (placeImg && !isCached) {
      const markLoaded = () => {
        loadedImages.add(imgSrc);
        placeImg.classList.add('is-loaded');
      };
      if (placeImg.complete && placeImg.naturalWidth > 0) {
        markLoaded();
      } else {
        placeImg.addEventListener('load', markLoaded, { once: true });
      }
    }
    popupContent.querySelector('.monk-popup-gmaps')?.addEventListener('click', () => {
      trackEvent('open_google_maps', {
        monk_id: monk.id,
        surface: 'popup'
      });
    });
  }

  const popup = isMobile
    ? null
    : new maplibregl.Popup({
      offset: 28,
      anchor: 'bottom',
      closeButton: true,
      closeOnClick: false,
      className: 'custom-monk-popup'
    })
      .setLngLat(monk.coordinates)
      .setDOMContent(popupContent);

  let scrollTimer;
  if (isMobile) {
    let isMobileOverlayActive = true;
    let isProgrammaticScroll = true;
    let programmaticScrollTimer;
    let programmaticScrollRevision = 0;
    const selectCard = (targetIndex) => {
      if (targetIndex === activeIndex || targetIndex < 0 || targetIndex >= monks.length) return;
      activeIndex = targetIndex;
      popupContent.dataset.activeIndex = String(targetIndex);
      popupContent.querySelectorAll('.mobile-monk-card').forEach((card, cardIndex) => {
        card.setAttribute('aria-current', String(cardIndex === targetIndex));
      });
      onSwipe?.(targetIndex);
    };
    const centerCard = (targetIndex) => {
      const card = popupContent.querySelector(`[data-monk-index="${targetIndex}"]`);
      if (!card) return;
      const carouselRect = popupContent.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const targetScrollLeft = popupContent.scrollLeft + cardRect.left - carouselRect.left
        - (popupContent.clientWidth - cardRect.width) / 2;

      isProgrammaticScroll = true;
      clearTimeout(programmaticScrollTimer);
      popupContent.scrollLeft = targetScrollLeft;
      const currentScroll = ++programmaticScrollRevision;
      const carouselCenter = popupContent.getBoundingClientRect().left + popupContent.clientWidth / 2;
      const cardCenter = card.getBoundingClientRect().left + card.offsetWidth / 2;
      if (Math.abs(cardCenter - carouselCenter) < 1) {
        isProgrammaticScroll = false;
      } else {
        programmaticScrollTimer = setTimeout(() => {
          if (currentScroll === programmaticScrollRevision) isProgrammaticScroll = false;
        }, 150);
      }
    };
    const selectCenteredCard = () => {
      const cards = [...popupContent.querySelectorAll('.mobile-monk-card')];
      if (!cards.length) return;
      const carouselCenter = popupContent.getBoundingClientRect().left + popupContent.clientWidth / 2;
      const target = cards.reduce((closest, card) => {
        const cardCenter = card.getBoundingClientRect().left + card.offsetWidth / 2;
        const closestCenter = closest.getBoundingClientRect().left + closest.offsetWidth / 2;
        return Math.abs(cardCenter - carouselCenter) < Math.abs(closestCenter - carouselCenter)
          ? card
          : closest;
      }, cards[0]);
      let targetIndex = Number(target?.dataset.monkIndex);
      if (!Number.isInteger(targetIndex)) return;
      if (Math.abs(targetIndex - activeIndex) > 1) {
        targetIndex = activeIndex + Math.sign(targetIndex - activeIndex);
        centerCard(targetIndex);
      }
      selectCard(targetIndex);
    };
    const centerActiveCard = () => {
      centerCard(activeIndex);
    };
    const selectMobileCard = (targetIndex) => {
      if (targetIndex < 0 || targetIndex >= monks.length) return;
      const didChange = targetIndex !== activeIndex;
      if (didChange) {
        activeIndex = targetIndex;
        popupContent.dataset.activeIndex = String(targetIndex);
        popupContent.querySelectorAll('.mobile-monk-card').forEach((card, cardIndex) => {
          card.setAttribute('aria-current', String(cardIndex === targetIndex));
        });
      }
      centerCard(targetIndex);
      if (didChange) {
        const targetCard = popupContent.querySelector(`[data-monk-index="${targetIndex}"]`);
        if (targetCard) {
          targetCard.classList.remove('is-switching');
          void targetCard.offsetWidth;
          targetCard.classList.add('is-switching');
          targetCard.addEventListener('animationend', () => {
            targetCard.classList.remove('is-switching');
          }, { once: true });
        }
      }
    };
    const settleUserScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (!isMobileOverlayActive || isProgrammaticScroll) return;
        selectCenteredCard();
      }, 150);
    };

    popupContent.querySelectorAll('.mobile-card-read').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const monkId = event.currentTarget.dataset.monkId;
        const targetIndex = monks.findIndex((item) => item.id === monkId);
        const targetMonk = monks[targetIndex];
        if (!targetMonk) throw new Error(`Unknown monk on mobile card: ${monkId}`);
        onRead?.(monkId, targetIndex, targetMonk);
      });
    });
    popupContent.querySelectorAll('.mobile-card-location').forEach((link) => {
      link.addEventListener('click', (event) => {
        const monkId = event.currentTarget.dataset.monkId;
        if (!monkId) return;
        trackEvent('open_google_maps', {
          monk_id: monkId,
          surface: 'mini_card'
        });
      });
    });
    popupContent.addEventListener('scroll', () => {
      if (!isMobileOverlayActive) return;
      if (isProgrammaticScroll) {
        const activeCard = popupContent.querySelector(`[data-monk-index="${activeIndex}"]`);
        if (activeCard) {
          const carouselRect = popupContent.getBoundingClientRect();
          const cardRect = activeCard.getBoundingClientRect();
          const centered = Math.abs(
            cardRect.left + cardRect.width / 2 - (carouselRect.left + popupContent.clientWidth / 2)
          ) < 1;
          if (centered) {
            clearTimeout(programmaticScrollTimer);
            isProgrammaticScroll = false;
          }
        }
        return;
      }
      settleUserScroll();
    }, { passive: true });
    popupContent.addEventListener('scrollend', () => {
      if (!isMobileOverlayActive) return;
      clearTimeout(scrollTimer);
      if (isProgrammaticScroll) {
        clearTimeout(programmaticScrollTimer);
        isProgrammaticScroll = false;
        return;
      }
      selectCenteredCard();
    }, { passive: true });
    const mobileOverlay = document.getElementById('mobile-card-overlay');
    if (!mobileOverlay) throw new Error('Missing #mobile-card-overlay');
    popupContent.classList.add('is-entering');
    popupContent.addEventListener('animationend', () => {
      popupContent.classList.remove('is-entering');
    }, { once: true });
    mobileOverlay.replaceChildren(popupContent);
    mobileOverlay.hidden = false;
    currentMobileCardOverlay = mobileOverlay;
    currentMobileCardOnClose = onClose;
    currentMobileCardSelect = selectMobileCard;
    currentMobileCardCleanup = () => {
      isMobileOverlayActive = false;
      clearTimeout(scrollTimer);
      clearTimeout(programmaticScrollTimer);
      if (currentMobileCardSelect === selectMobileCard) currentMobileCardSelect = null;
    };
    requestAnimationFrame(centerActiveCard);
  } else {
    let swipeStart = null;
    popupContent.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1 || event.target.closest('a, button')) return;
      const touch = event.touches[0];
      swipeStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    popupContent.addEventListener('touchend', (event) => {
      if (!swipeStart) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;
      swipeStart = null;

      if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
      onSwipe?.(index - 1 + (deltaX < 0 ? 1 : -1));
    }, { passive: true });
    popupContent.addEventListener('touchcancel', () => {
      swipeStart = null;
    }, { passive: true });
  }

  if (popup) {
    currentActivePopup = popup;
    popup.on('close', () => {
      if (currentActivePopup !== popup) return;
      clearTimeout(scrollTimer);
      currentActivePopup = null;
      onClose?.();
    });
    popup.addTo(mapInstance);
  }
}

export function selectMobileCard(index) {
  currentMobileCardSelect?.(index);
}

export function hasMobilePopup() {
  return Boolean(currentMobileCardSelect);
}

export function closePopup({ notify = true } = {}) {
  const popup = currentActivePopup;
  currentActivePopup = null;
  popup?.remove();

  const mobileOverlay = currentMobileCardOverlay;
  const onClose = currentMobileCardOnClose;
  const cleanup = currentMobileCardCleanup;
  currentMobileCardOverlay = null;
  currentMobileCardOnClose = null;
  currentMobileCardCleanup = null;
  cleanup?.();
  if (mobileOverlay) {
    mobileOverlay.replaceChildren();
    mobileOverlay.hidden = true;
    if (notify) onClose?.();
  }
}

// Сброс приближения карты к общему виду
export function resetMapView() {
  if (!mapInstance) return;
  closePopup();

  if (window.innerWidth > 760) {
    void showAllMonks({ duration: 900 });
    return;
  }

  mapInstance.flyTo({
    center: [44.8, 41.9],
    zoom: 7.5,
    speed: 1.2
  });
}
