export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isString = (value: unknown, maxLength = 256): value is string =>
  typeof value === "string" && value.length <= maxLength;

export const isNumberArray = (value: unknown, maxLength = 64): value is number[] =>
  Array.isArray(value) && value.length <= maxLength && value.every(isFiniteNumber);

export const isEnumValue = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);
