export const kiroyaIconNames = [
  "kiroya-key",
  "kiroya-shield-check",
  "kiroya-photo-act",
  "kiroya-handshake",
  "kiroya-clock-money",
  "kiroya-laptop",
  "kiroya-wrench",
  "kiroya-scooter",
  "kiroya-camera",
  "kiroya-tent",
  "kiroya-star-badge",
  "kiroya-location-pin",
  "kiroya-qr-scan",
  "kiroya-deposit",
  "kiroya-verified",
  "kiroya-home",
] as const;

export type KiroyaIconName = (typeof kiroyaIconNames)[number];

export const KIROYA_ICONS_PATH = "/svgicons/kiroya";
