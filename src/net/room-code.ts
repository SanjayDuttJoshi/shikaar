/** No 0/O, 1/I/L so codes are easy to read out loud. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

export const generateRoomCode = (random: () => number = Math.random): string =>
  Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]).join("");

/** Normalises user input: uppercase and only letters/digits. */
export const normalizeRoomCode = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);

export const isValidRoomCode = (code: string): boolean =>
  code.length === ROOM_CODE_LENGTH && [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch));

export const buildInviteLink = (origin: string, pathname: string, code: string): string =>
  `${origin}${pathname}?room=${encodeURIComponent(code)}`;
