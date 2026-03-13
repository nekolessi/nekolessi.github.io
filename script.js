const fill = document.getElementById("progressFill");
const current = document.getElementById("currentTime");

let secs = 2 * 60 + 57;
const total = 5 * 60 + 51;

setInterval(() => {
  secs = secs >= total ? 0 : secs + 1;
  const pct = (secs / total) * 100;
  fill.style.width = `${pct}%`;

  const min = Math.floor(secs / 60);
  const sec = String(secs % 60).padStart(2, "0");
  current.textContent = `${min}:${sec}`;
}, 1000);