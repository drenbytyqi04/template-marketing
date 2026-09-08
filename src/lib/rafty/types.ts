/**
 * krijo24 data model.
 * Every business owned record carries businessId (tenant id). Authorization is
 * enforced in Supabase with row level security, this layer only mirrors it.
 */

/**
 * Quick start categories. They only decide which fields, services and template
 * ordering are suggested, never which templates are available. Any business
 * that does not fit uses "other" plus its own custom category label.
 */
export type BusinessType =
  | "travel_agency"
  | "real_estate"
  | "car_dealership"
  | "restaurant"
  | "retail"
  | "hotel"
  | "beauty"
  | "fitness"
  | "healthcare"
  | "construction"
  | "cleaning"
  | "events"
  | "education"
  | "professional_services"
  | "ecommerce"
  | "automotive_service"
  | "other";

/**
 * Content formats. One shared template model drives all of them, so a
 * template only declares which format it belongs to plus the extra rules that
 * format needs (frame count and, for video, its timing).
 */
export type ContentFormat = "post" | "video";

export type FormatSpec = {
  format: ContentFormat;
  label: string;
  /** Export canvas in pixels. Preview uses the same aspect ratio. */
  width: number;
  height: number;
  /** Multi card formats only. Single frame formats use 1/1/1. */
  minSlides: number;
  maxSlides: number;
  defaultSlides: number;
  /** Video timing, in milliseconds. */
  minDuration: number;
  maxDuration: number;
  defaultDuration: number;
  /** True once a reliable renderer exists for this format. */
  exportable: boolean;
};

/** One frame of any format. A single post is simply one slide. */
export type Slide = {
  id: string;
  content: PostContent;
  adjustments: PostAdjustments;
  /** Video only. */
  durationMs?: number;
  imagePath?: string | null;
};

export type LanguageCode = "en" | "de" | "sq";

export type CurrencyCode = "EUR" | "CHF" | "GBP" | "USD" | "ALL" | "SEK" | "NOK" | "DKK";

export type BusinessStatus = "pending" | "approved" | "rejected" | "suspended";

export type UserRole = "owner" | "admin";

export type PlanTier = "starter" | "growth" | "studio" | "partnership";

/**
 * Entitlements are owned by the database and activated by a krijo24 admin.
 * The client only reflects them, it never grants them.
 */
export type AccountPlan = {
  userId: string;
  plan: PlanTier;
  monthlyPrice: number;
  /** False until an admin activates the account, features stay locked. */
  active: boolean;
  brandLimit: number;
  billingCycle: string;
  allowVideo: boolean;
  allowCustomTemplates: boolean;
  partnershipPostsUsed: number;
  partnershipPostsLimit: number;
};

/** Formats the active entitlement allows. Posts are always included. */
export function allowedFormats(plan: AccountPlan | null): ContentFormat[] {
  const out: ContentFormat[] = ["post"];
  if (!plan?.active) return out;
  if (plan.allowVideo) out.push("video");
  return out;
}

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
};

export type Business = {
  id: string;
  name: string;
  type: BusinessType;
  customType: string | null;
  status: BusinessStatus;
  ownerUserId: string;
  onboarded: boolean;
  createdAt: string;
};

export type BusinessMembership = {
  id: string;
  businessId: string;
  userId: string;
  role: "owner" | "member";
};

/**
 * Caption guidance owned by the brand and reused on every post.
 * styleSample is a real description the business already uses. krijo24 reads
 * style from it (length, punctuation, emoji, hashtags) and never copies facts.
 */
export type ContentInstructions = {
  styleSample: string;
  hashtags: string;
};

export const emptyInstructions: ContentInstructions = {
  styleSample: "",
  hashtags: "",
};

/** Reusable brand contact details. Brand scoped, shown only when the user opts in. */
export type BrandContact = {
  phones: string[];
  email: string;
  website: string;
  address: string;
  social: string;
  /** Extra named contact blocks, for example one per office or per city.
   * The first block always mirrors the fields above for older posts. */
  sets?: ContactSet[];
};

/** One named contact block a post can pick. */
export type ContactSet = {
  id: string;
  label: string;
  phones: string[];
  email: string;
  website: string;
  address: string;
  social: string;
};

export const emptyContact: BrandContact = {
  phones: [],
  email: "",
  website: "",
  address: "",
  social: "",
  sets: [],
};

/** Contact blocks a post can choose from, always at least the main one. */
export function contactSets(contact: BrandContact | null | undefined): ContactSet[] {
  if (!contact) return [];
  const sets = (contact.sets ?? []).filter((s) => s && s.id);
  if (sets.length) return sets;
  const main: ContactSet = {
    id: "main",
    label: "Main",
    phones: contact.phones ?? [],
    email: contact.email ?? "",
    website: contact.website ?? "",
    address: contact.address ?? "",
    social: contact.social ?? "",
  };
  const filled =
    main.phones.some((p) => p.trim()) ||
    [main.email, main.website, main.address, main.social].some((v) => v.trim());
  return filled ? [main] : [];
}

export type BrandProfile = {
  businessId: string;
  /** Private storage object path. Never a public url. */
  logoPath?: string | null;
  /** Short lived signed url used for rendering only. */
  logoDataUrl: string | null;
  /** Once a logo is saved only a krijo24 admin can replace it. */
  logoLocked: boolean;
  primary: string;
  secondary: string;
  accent: string;
  background: string | null;
  fontFamily: string;
  fontSecondary: string | null;
  showBrandName: boolean;
  instructions: ContentInstructions;
  contact: BrandContact;
  currency: CurrencyCode;
  language: LanguageCode;
};

export type BusinessService = {
  id: string;
  businessId: string;
  name: string;
  position: number;
};

export type TemplateScope = "global" | "custom";

/** Template sets that are grouped and labelled separately in the picker. */
export type TemplateCollection = "signature";

/** Visual families. The library is not locked to an industry. */
export type TemplateTag =
  | "editorial"
  | "minimal"
  | "bold"
  | "luxury"
  | "whitespace"
  | "dense"
  | "image_first"
  | "type_first"
  | "gradient"
  | "dark"
  | "light"
  | "glass"
  | "blur"
  | "asymmetric"
  | "centered"
  | "split"
  | "offer";

export type TemplateVariant = {
  align: "left" | "center" | "right";
  tone: "light" | "dark";
  badge: "pill" | "square";
  accent?: "primary" | "secondary" | "accent";
};

/** A mapped dynamic content area on an uploaded design. Percentages of canvas. */
export type TemplateZone = {
  key: ZoneKey;
  x: number;
  y: number;
  width: number;
  size: number;
  align: "left" | "center" | "right";
  color: string;
  weight: "regular" | "bold" | "extra";
  uppercase: boolean;
};

export type ZoneKey =
  | "title"
  | "subject"
  | "price"
  | "location"
  | "date"
  | "services"
  | "additionalText"
  | "cta"
  | "brandName"
  | "logo";

export type Template = {
  id: string;
  name: string;
  engine: string;
  tags: TemplateTag[];
  /** Soft recommendation only. Every template stays selectable by every brand. */
  suggestedFor?: BusinessType[] | undefined;
  variant: TemplateVariant;
  scope: TemplateScope;
  businessId: string | null;
  archived: boolean;
  /** Kept in the library so older posts still render, but never offered in the
   * picker. Used for the near identical colour variants of one layout. */
  hidden?: boolean;
  /** Named set this template belongs to. A set is shown as its own group at the
   * top of the picker, ahead of the standard library, which carries none. */
  collection?: TemplateCollection | undefined;
  /** Which content format this template renders. Defaults to post. */
  format?: ContentFormat;
  /** Multi card formats: how many slides the design supports. */
  slides?: { min: number; max: number; default: number };
  /** Video: clip timing plus its transition. */
  motion?: {
    minDuration: number;
    maxDuration: number;
    defaultDuration: number;
    transition: "fade" | "slide" | "zoom";
  };
  /** Custom templates only: locked uploaded design plus mapped zones. */
  backgroundPath?: string | null;
  backgroundUrl?: string | null;
  requirements?: string | null;
  zones?: TemplateZone[];
  lockedDesign?: boolean;
};

export type CustomTemplateRequestStatus = "processing" | "ready" | "rejected";

export type CustomTemplateRequest = {
  id: string;
  businessId: string;
  businessName: string;
  fileName: string;
  fileType: string;
  /** Private storage path of the uploaded design. Never a public url. */
  filePath: string | null;
  previewDataUrl: string | null;
  status: CustomTemplateRequestStatus;
  templateId: string | null;
  createdAt: string;
};

/**
 * One extra line of text the user placed on the post. Deliberately tiny:
 * three sizes, three horizontal and three vertical slots. Everything else is
 * owned by the template, so a user can never break the design.
 */
export type TextSize = "small" | "medium" | "large";
export type TextAlign = "left" | "center" | "right";
export type TextBand = "top" | "middle" | "bottom";

export type PostTextItem = {
  id: string;
  text: string;
  size: TextSize;
  align: TextAlign;
  band: TextBand;
};

/** Hard cap so extra text can never take over a design. */
export const MAX_TEXT_ITEMS = 3;

/** Post text/media content. Field relevance is suggested by business type. */
export type PostContent = {
  title: string;
  subject: string;
  location: string;
  price: string;
  date: string;
  meta1: string;
  meta2: string;
  additionalText: string;
  cta: string;
  services: string[];
  /** User placed extra lines, rendered identically in preview and export. */
  extras?: PostTextItem[];
  /** Per field wording chosen by the user, for example "Nights" or "Guests".
   * A numeric value is printed together with its label: 4 -> "4 Nights". */
  labels?: Partial<Record<string, string>>;
  /** Which brand contact block this post prints, when contact is shown. */
  contactSetId?: string | null;
  /** Chosen output size inside the format, for example "4:5" or "1:1". */
  sizeKey?: string;
  imageDataUrl: string | null;
  /** Uploaded footage for the video format. The design renders on top of it. */
  videoDataUrl?: string | null;
  /** Private storage path of that footage. Never a public url. */
  videoPath?: string | null;
  caption: string;
};

/** Safe content nudges. Values are clamped by the adjust controls. */
export type LayerAdjust = {
  x: number;
  y: number;
  scale: number;
  align: "left" | "center" | "right";
};

export type PostAdjustments = {
  text?: LayerAdjust;
  image?: { x: number; y: number; scale: number };
};

export type ShareStatus = {
  savedToDevice?: boolean;
  instagram?: "not_connected" | "ready" | "publishing" | "published" | "failed";
  facebook?: "not_connected" | "ready" | "publishing" | "published" | "failed";
};

/**
 * The brand styling a post was made with.
 *
 * Posts used to render from whatever the brand looked like right now, so
 * changing a colour restyled every post ever saved - including ones already
 * downloaded and published. A saved post is a finished artefact, so it carries
 * the styling it was made with. Absent on posts created before this existed;
 * those still fall back to the live brand.
 */
export type BrandSnapshot = {
  primary: string;
  secondary: string;
  accent: string;
  background: string | null;
  fontFamily: string;
  fontSecondary: string | null;
  logoPath: string | null;
  currency: CurrencyCode;
  language: LanguageCode;
};

/** Captures the styling a post is rendered with, for freezing at save time. */
export function snapshotOfBrand(brand: BrandProfile): BrandSnapshot {
  return {
    primary: brand.primary,
    secondary: brand.secondary,
    accent: brand.accent,
    background: brand.background,
    fontFamily: brand.fontFamily,
    fontSecondary: brand.fontSecondary,
    logoPath: brand.logoPath ?? null,
    currency: brand.currency,
    language: brand.language,
  };
}

/**
 * Brand to render a saved post with.
 *
 * Returns the styling frozen at save time when the post has a snapshot, so an
 * existing post keeps its look after the brand palette changes. Posts saved
 * before snapshots existed have none and still follow the live brand.
 *
 * The logo is intentionally taken from the live brand: it is locked after the
 * first save, so its path does not drift, and re-signing a stored path here
 * would make rendering asynchronous.
 */
export function brandForPost(
  brand: BrandProfile,
  post: { brandSnapshot?: BrandSnapshot | null },
): BrandProfile {
  const snap = post.brandSnapshot;
  if (!snap) return brand;
  return {
    ...brand,
    primary: snap.primary,
    secondary: snap.secondary,
    accent: snap.accent,
    background: snap.background,
    fontFamily: snap.fontFamily,
    fontSecondary: snap.fontSecondary,
    currency: snap.currency,
    language: snap.language,
  };
}

export type Post = {
  id: string;
  businessId: string;
  templateId: string;
  imagePath?: string | null;
  content: PostContent;
  showBrandName: boolean;
  adjustments: PostAdjustments;
  shareStatus: ShareStatus;
  createdAt: string;
  /** Absent means a single image post, kept for records saved before formats. */
  format?: ContentFormat;
  /** Multi card formats store every frame here, in display order. */
  slides?: Slide[];
  /** Brand styling frozen at save time. Absent on posts made before snapshots. */
  brandSnapshot?: BrandSnapshot | null;
};

export type TrialUsage = {
  businessId: string;
  postsCreated: number;
  freePostLimit: number;
};

export const emptyContent: PostContent = {
  title: "",
  subject: "",
  location: "",
  price: "",
  date: "",
  meta1: "",
  meta2: "",
  additionalText: "",
  cta: "",
  services: [],
  imageDataUrl: null,
  caption: "",
};

export const defaultAdjust: LayerAdjust = { x: 0, y: 0, scale: 1, align: "left" };

/* ------------------------- scheduling and connections ---------------------- */

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "tiktok" | "x" | "youtube";

export type ScheduleStatus = "queued" | "cancelled" | "published" | "failed";

/** A real queue entry. krijo24 never claims a social publish it cannot perform:
 * queued items are prepared content with a time, not a promised post. */
export type ScheduledPost = {
  id: string;
  businessId: string;
  postId: string;
  platform: SocialPlatform;
  scheduledAt: string;
  timezone: string;
  status: ScheduleStatus;
  note: string;
  failureReason: string | null;
  createdAt: string;
};

export type SocialConnectionStatus =
  "unavailable" | "not_connected" | "connected" | "ready" | "failed";

export type SocialConnection = {
  id: string;
  businessId: string;
  platform: SocialPlatform;
  status: SocialConnectionStatus;
  accountLabel: string;
};

/* --------------------------- website automation --------------------------- */

export type ScanFrequency = "off" | "daily" | "weekly";
/** off: nothing automatic. draft: posts are created and wait for approval.
 *  publish: approved brands let krijo24 queue and publish them. */
export type AutoMode = "off" | "draft" | "publish";

export type BrandWebsite = {
  businessId: string;
  url: string;
  scanFrequency: ScanFrequency;
  autoMode: AutoMode;
  defaultTemplateId: string | null;
  postTime: string;
  timezone: string;
  platforms: SocialPlatform[];
  lastScannedAt: string | null;
};

export type DiscoveredItemStatus = "new" | "used" | "ignored";

export type DiscoveredItem = {
  id: string;
  businessId: string;
  sourceUrl: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  imageUrl: string | null;
  status: DiscoveredItemStatus;
  postId: string | null;
  createdAt: string;
};
