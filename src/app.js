import {
  APP_CONFIG,
  DEFAULT_ACTIVITY_ART,
  DEFAULT_STATUS_AVATAR,
  HERO_PROFILE_IMAGE,
  PROFILE,
  UI_TEXT,
  VIEW_COUNTER_WORKER_URL,
  VIEW_FETCH_TIMEOUT_MS,
} from "./config.js";
import { normalizeHref, simpleIconUrl, withTimeout } from "./helpers.js";
import { createPresenceController } from "./presence.js";
import { createReactionsController } from "./reactions.js";

function createFallbackStorage() {
  return {
    getItem() {
      return "";
    },
    setItem() {
      // Ignore storage writes when storage is unavailable.
    },
  };
}

function getElements(documentRef) {
  return {
    documentRef,
    heroProfileImage: documentRef.getElementById("heroProfileImage"),
    heroBio: documentRef.getElementById("heroBio"),
    profileViews: documentRef.getElementById("profileViews"),
    profileViewsText: documentRef.getElementById("profileViewsText"),
    profileLocation: documentRef.getElementById("profileLocation"),
    socialLinksRoot: documentRef.getElementById("socialLinks"),
    reactionsSection: documentRef.getElementById("reactionsSection"),
    profileReactionsRoot: documentRef.getElementById("profileReactions"),
    reactionStatus: documentRef.getElementById("reactionStatus"),
    reactionsTitle: documentRef.getElementById("reactionsTitle"),
    statusLink: documentRef.getElementById("discordStatusLink"),
    statusAvatar: documentRef.getElementById("statusAvatar"),
    statusEyebrow: documentRef.getElementById("statusEyebrow"),
    discordName: documentRef.getElementById("discordName"),
    statusDot: documentRef.getElementById("statusDot"),
    statusText: documentRef.getElementById("discordStatusText"),
    activityArt: documentRef.getElementById("activityArt"),
    activityEyebrow: documentRef.getElementById("activityEyebrow"),
    activityTitle: documentRef.getElementById("activityTitle"),
    activitySubtitle: documentRef.getElementById("activitySubtitle"),
    timeline: documentRef.getElementById("activityTimeline"),
    currentTime: documentRef.getElementById("currentTime"),
    totalTime: documentRef.getElementById("totalTime"),
    progressFill: documentRef.getElementById("progressFill"),
  };
}

export function createSiteApp({
  documentRef = document,
  fetchImpl = fetch,
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
  localStorageImpl = globalThis.localStorage || createFallbackStorage(),
} = {}) {
  const elements = getElements(documentRef);
  let profileViewsFetchInFlight = false;

  function setProfileViewsLabel(visibleLabel, spokenLabel) {
    if (elements.profileViews) {
      elements.profileViews.textContent = visibleLabel;
    }

    if (elements.profileViewsText) {
      elements.profileViewsText.textContent = spokenLabel;
    }
  }

  function applyStaticUiText() {
    if (elements.profileViewsText) {
      elements.profileViewsText.textContent = UI_TEXT.profileViewsLoading;
    }

    if (elements.statusEyebrow) {
      elements.statusEyebrow.textContent = UI_TEXT.statusEyebrow;
    }

    if (elements.activityEyebrow) {
      elements.activityEyebrow.textContent = UI_TEXT.activityEyebrow;
    }

    if (elements.reactionsTitle) {
      elements.reactionsTitle.textContent = UI_TEXT.reactionsTitle;
    }

    if (elements.statusText) {
      elements.statusText.textContent = UI_TEXT.statusUserIdMissing;
    }

    if (elements.activityTitle) {
      elements.activityTitle.textContent = UI_TEXT.activityEmptyTitle;
    }

    if (elements.activitySubtitle) {
      elements.activitySubtitle.textContent =
        UI_TEXT.activityDisconnectedSubtitle;
      elements.activitySubtitle.hidden = false;
    }
  }

  function renderHeroBio() {
    if (!elements.heroBio) {
      return;
    }

    elements.heroBio.innerHTML = "";

    PROFILE.bioBlocks.forEach((block) => {
      const line = String(block || "").trim();
      if (!line) {
        return;
      }

      const span = documentRef.createElement("span");
      span.className = "bio-block";
      span.textContent = line;
      elements.heroBio.appendChild(span);
    });
  }

  function renderSocialLinks() {
    if (!elements.socialLinksRoot) {
      return;
    }

    elements.socialLinksRoot.innerHTML = "";

    PROFILE.links.forEach((link) => {
      const finalHref = normalizeHref(link);
      if (!finalHref || !link.simpleIcon) {
        return;
      }

      const anchor = documentRef.createElement("a");
      anchor.href = finalHref;
      anchor.title = link.label;
      anchor.setAttribute("aria-label", link.label);

      if (!finalHref.startsWith("mailto:")) {
        anchor.target = "_blank";
        anchor.rel = "noreferrer noopener";
      }

      const image = documentRef.createElement("img");
      image.className = "social-icon-image";
      image.src = simpleIconUrl(link.simpleIcon, link.iconColor);
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.loading = "eager";
      image.decoding = "async";

      anchor.appendChild(image);
      elements.socialLinksRoot.appendChild(anchor);
    });
  }

  async function fetchViewCountFromWorker() {
    const response = await withTimeout(
      fetchImpl(VIEW_COUNTER_WORKER_URL, {
        cache: "no-store",
      }),
      VIEW_FETCH_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Worker counter request failed (${response.status})`);
    }

    const payload = await response.json();
    const count = String(payload?.count ?? "").replace(/\D/g, "");
    if (!count) {
      throw new Error("Worker counter payload missing count");
    }

    return count;
  }

  async function updateProfileViews() {
    if (!elements.profileViews || profileViewsFetchInFlight) {
      return;
    }

    profileViewsFetchInFlight = true;
    const currentLabel = elements.profileViews.textContent.trim();
    if (!/^\d+$/.test(currentLabel)) {
      setProfileViewsLabel("...", UI_TEXT.profileViewsLoading);
    }

    try {
      const count = await fetchViewCountFromWorker();
      if (/^\d+$/.test(count)) {
        setProfileViewsLabel(count, `Profile views: ${count}`);
      }
    } catch {
      // Keep the existing label if the counter fetch fails.
    } finally {
      profileViewsFetchInFlight = false;
    }
  }

  function bindImageFallbacks() {
    if (elements.statusAvatar) {
      elements.statusAvatar.onerror = () => {
        if (elements.statusAvatar.src !== DEFAULT_STATUS_AVATAR) {
          elements.statusAvatar.src = DEFAULT_STATUS_AVATAR;
        }
      };
    }

    if (elements.activityArt) {
      elements.activityArt.onerror = () => {
        if (elements.activityArt.src !== DEFAULT_ACTIVITY_ART) {
          elements.activityArt.src = DEFAULT_ACTIVITY_ART;
        }
      };
    }

    if (elements.heroProfileImage) {
      elements.heroProfileImage.onerror = () => {
        if (
          elements.heroProfileImage.src !== APP_CONFIG.heroProfileImageLocal
        ) {
          elements.heroProfileImage.src = APP_CONFIG.heroProfileImageLocal;
          return;
        }

        elements.heroProfileImage.style.opacity = "0.45";
      };
    }
  }

  function applyProfileConfig() {
    if (elements.heroProfileImage) {
      elements.heroProfileImage.src = HERO_PROFILE_IMAGE;
    }

    if (elements.profileLocation) {
      elements.profileLocation.textContent = PROFILE.location;
    }
  }

  const reactionsController = createReactionsController({
    elements,
    fetchImpl,
    localStorageImpl,
  });

  const presenceController = createPresenceController({
    elements,
    documentRef,
    fetchImpl,
    setIntervalImpl,
    clearIntervalImpl,
  });

  async function init() {
    applyProfileConfig();
    bindImageFallbacks();
    renderHeroBio();
    renderSocialLinks();
    applyStaticUiText();

    await Promise.all([
      reactionsController.init(),
      updateProfileViews(),
      presenceController.start(),
    ]);

    return api;
  }

  function destroy() {
    presenceController.destroy();
  }

  const api = {
    init,
    destroy,
    elements,
    renderHeroBio,
    renderSocialLinks,
    updateProfileViews,
  };

  return api;
}
