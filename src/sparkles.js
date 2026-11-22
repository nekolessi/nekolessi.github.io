// @ts-check

/**
 * Initializes floating pastel sparkle and heart particle bursts on click/tap.
 * @param {Document} documentRef
 * @returns {() => void} Cleanup function to remove event listener
 */
export function initSparkleEffects(documentRef = document) {
  if (
    !documentRef ||
    typeof documentRef.addEventListener !== "function" ||
    typeof documentRef.createElement !== "function"
  ) {
    return () => {};
  }

  const symbols = ["♡", "✧", "🌸", "✦", "✨", "💗"];
  const colors = ["#ff7ad9", "#e2a9ff", "#7ce8ff", "#ffe17d", "#ffb4ea"];

  /**
   * @param {PointerEvent} event
   */
  const handlePointerDown = (event) => {
    // Respect user's motion preferences
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // Only trigger for primary click
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }

    const x = event.clientX;
    const y = event.clientY;

    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) {
      return;
    }

    const count = Math.floor(Math.random() * 3) + 3; // 3 to 5 sparkles
    for (let i = 0; i < count; i++) {
      const particle = documentRef.createElement("span");
      particle.className = "sparkle-particle";
      particle.textContent =
        symbols[Math.floor(Math.random() * symbols.length)];

      const offsetX = (Math.random() - 0.5) * 56;
      const offsetY = -(Math.random() * 40 + 32);
      const rot = (Math.random() - 0.5) * 60;
      const size = Math.random() * 0.55 + 0.85;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const delay = Math.random() * 60;

      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.color = color;
      particle.style.fontSize = `${size}rem`;
      particle.style.setProperty("--tx", `${offsetX}px`);
      particle.style.setProperty("--ty", `${offsetY}px`);
      particle.style.setProperty("--rot", `${rot}deg`);
      particle.style.animationDelay = `${delay}ms`;

      if (documentRef.body) {
        documentRef.body.appendChild(particle);
        setTimeout(() => {
          if (typeof particle.remove === "function") {
            particle.remove();
          }
        }, 850);
      }
    }
  };

  documentRef.addEventListener("pointerdown", handlePointerDown, {
    passive: true,
  });

  return () => {
    documentRef.removeEventListener("pointerdown", handlePointerDown);
  };
}
