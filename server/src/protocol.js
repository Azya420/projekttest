export const LIMITS = {
  name: 18,
  chat: 100,
  coordinate: 56 * 48
};

export function cleanName(value) {
  return String(value || "Wędrowiec").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, LIMITS.name) || "Wędrowiec";
}

export function cleanChat(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, LIMITS.chat);
}

export function validPosition(player) {
  return Number.isFinite(player?.x) && Number.isFinite(player?.y)
    && player.x >= 0 && player.y >= 0
    && player.x <= LIMITS.coordinate && player.y <= LIMITS.coordinate;
}

export function publicPlayer(player) {
  return {
    id: String(player.id).slice(0, 64),
    name: cleanName(player.name),
    vocation: ["warden", "ranger", "arcanist", "druid"].includes(player.vocation) ? player.vocation : "warden",
    level: Math.max(1, Math.min(999, Number(player.level) || 1)),
    x: Number(player.x),
    y: Number(player.y)
  };
}
