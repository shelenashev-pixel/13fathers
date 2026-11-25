/**
 * Lightweight, non-blocking PostHog analytics for 13fathers.
 *
 * Paste your PostHog Project API Key (`phc_...`) into `POSTHOG_KEY` below.
 * Switch `POSTHOG_HOST` to 'https://us.i.posthog.com' if your project is on US Cloud.
 */
export const POSTHOG_KEY = 'phc_mEHSJohwN7PHjokwQocFvxTqDFS7WY3qGFu96oBXCF6t';
export const POSTHOG_HOST = 'https://eu.i.posthog.com';

const OPT_OUT_STORAGE_KEY = '13fathers_analytics_opt_out';
const LEGACY_OPT_OUT_KEY = '13monks_analytics_opt_out';

let isInitialized = false;
let isTrackingEnabled = false;

function isLocalEnvironment() {
  const { protocol, hostname } = window.location;
  return protocol === 'file:' || hostname === 'localhost' || hostname === '127.0.0.1';
}

function syncOptOutPreference() {
  let optedOut = false;
  let explicitOptIn = false;

  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('notrack');

    if (param === '1' || param === 'true') {
      window.localStorage.setItem(OPT_OUT_STORAGE_KEY, '1');
      window.localStorage.removeItem(LEGACY_OPT_OUT_KEY);
      optedOut = true;
      url.searchParams.delete('notrack');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } else if (param === '0' || param === 'false') {
      window.localStorage.removeItem(OPT_OUT_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_OPT_OUT_KEY);
      optedOut = false;
      explicitOptIn = true;
      url.searchParams.delete('notrack');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } else {
      if (window.localStorage.getItem(LEGACY_OPT_OUT_KEY) === '1') {
        window.localStorage.setItem(OPT_OUT_STORAGE_KEY, '1');
        window.localStorage.removeItem(LEGACY_OPT_OUT_KEY);
      }
      optedOut = window.localStorage.getItem(OPT_OUT_STORAGE_KEY) === '1';
    }
  } catch {
    optedOut = false;
  }

  return { optedOut, explicitOptIn };
}

function isDebugEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    return isLocalEnvironment() || params.get('debug_analytics') === '1';
  } catch {
    return isLocalEnvironment();
  }
}

function getSharedParams() {
  return {
    viewport: window.innerWidth <= 760 ? 'mobile' : 'desktop',
    lang: document.documentElement.lang || 'en'
  };
}

function getAssetsHost(apiHost) {
  try {
    const url = new URL(apiHost);
    url.hostname = url.hostname.replace(/^(us|eu)\.i\./, '$1-assets.i.');
    return url.origin;
  } catch {
    return 'https://eu-assets.i.posthog.com';
  }
}

function loadPostHogSnippet(apiKey, apiHost) {
  if (window.posthog && window.posthog.__SV) return;

  /* eslint-disable */
  !function (t, e) {
    var o, n, p, r;
    e.__SV || (
      window.posthog = e,
      e._i = [],
      e.init = function (i, s, a) {
        function g(t, e) {
          var o = e.split('.');
          2 == o.length && (t = t[o[0]], e = o[1]);
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        }
        (p = t.createElement('script')).type = 'text/javascript';
        p.crossOrigin = 'anonymous';
        p.async = !0;
        p.src = getAssetsHost(s.api_host) + '/static/array.js';
        (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r);
        var u = e;
        void 0 !== a ? u = e[a] = [] : a = 'posthog';
        u.people = u.people || [];
        u.toString = function (t) {
          var e = 'posthog';
          return 'posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e;
        };
        u.people.toString = function () {
          return u.toString(1) + '.people (stub)';
        };
        o = 'init capture register register_once unregister opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties'.split(' ');
        for (n = 0; n < o.length; n++) g(u, o[n]);
        e._i.push([i, s, a]);
      },
      e.__SV = 1
    );
  }(document, window.posthog || []);
  /* eslint-enable */

  window.posthog.init(apiKey, {
    api_host: apiHost,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    enable_heatmaps: true,
    disable_session_recording: false
  });
}

export function initAnalytics() {
  if (isInitialized) return;
  isInitialized = true;

  const { optedOut, explicitOptIn } = syncOptOutPreference();
  const key = POSTHOG_KEY.trim();
  if (!key || isLocalEnvironment() || optedOut) {
    isTrackingEnabled = false;
    return;
  }

  isTrackingEnabled = true;

  const start = () => {
    try {
      loadPostHogSnippet(key, POSTHOG_HOST);
      if (explicitOptIn && window.posthog && typeof window.posthog.opt_in_capturing === 'function') {
        window.posthog.opt_in_capturing();
      }
    } catch {
      // Never let analytics failures break the app
    }
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 2000 });
  } else {
    window.setTimeout(start, 0);
  }
}

export function trackEvent(eventName, params = {}) {
  if (!eventName) return;

  const payload = {
    ...getSharedParams(),
    ...params
  };

  if (isDebugEnabled()) {
    console.debug('[Analytics dev]', eventName, payload);
  }

  if (!isTrackingEnabled) return;

  try {
    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(eventName, payload);
    }
  } catch {
    // Safe guard against ad blockers or network restrictions
  }
}
