import { removeFlatBackground } from "./logo-cutout";
import { trimTransparentEdges } from "./logo-trim";

/**
 * Everything that happens to a logo between the file picker and storage.
 *
 * The order is the whole reason this is one function. Cutting the background
 * out is what creates the transparent border, and trimming is what removes it -
 * run the other way round, trimming finds nothing to cut on a file whose empty
 * space is still painted white, and the mark goes on rendering at whatever
 * fraction of its own canvas the exporter left it at.
 *
 * Both steps hand the file back untouched when they cannot be sure of it, so a
 * logo that defeats them is stored exactly as the customer sent it.
 */
export async function prepareUploadedLogo(dataUrl: string): Promise<string> {
  return trimTransparentEdges(await removeFlatBackground(dataUrl));
}
