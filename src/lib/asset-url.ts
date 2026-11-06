const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** URL of a file under public/assets that also works when the site lives under /<repo>/ on GitHub Pages. */
export const assetUrl = (path: string): string => `${BASE_PATH}/assets/${path.replace(/^\/+/, "")}`;
