import type { ContentFormat, Slide } from "./types";

/**
 * Create keeps an in progress post while the user walks away to Brand,
 * Templates or Website and comes back. It lives in sessionStorage: it is
 * per tab, disappears with the tab and never touches the database, so an
 * unfinished draft can never look like a saved post.
 */
export type CreateDraft = {
  businessId: string;
  format: ContentFormat;
  templateId: string;
  sizeKey: string;
  slides: Slide[];
  activeIndex: number;
  showBrandName: boolean;
  showContact: boolean;
  generated: boolean;
  postId: string | null;
};

const KEY = "krijo24.create.draft";

const canUse = () => typeof window !== "undefined" && !!window.sessionStorage;

export function readDraft(businessId: string | undefined): CreateDraft | null {
  if (!canUse() || !businessId) return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CreateDraft;
    if (draft.businessId !== businessId || !Array.isArray(draft.slides) || !draft.slides.length) {
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function writeDraft(draft: CreateDraft): void {
  if (!canUse()) return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Images can blow the storage quota. The text is what matters for coming
    // back, so retry without the uploaded pictures instead of losing it all.
    try {
      const light: CreateDraft = {
        ...draft,
        slides: draft.slides.map((slide) => ({
          ...slide,
          content: { ...slide.content, imageDataUrl: null },
        })),
      };
      window.sessionStorage.setItem(KEY, JSON.stringify(light));
    } catch {
      /* nothing else to do, the draft is simply not kept */
    }
  }
}

export function clearDraft(): void {
  if (!canUse()) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
