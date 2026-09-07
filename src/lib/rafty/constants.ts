import type {
  BusinessType,
  ContentFormat,
  CurrencyCode,
  FormatSpec,
  LanguageCode,
  PlanTier,
  SocialPlatform,
} from "./types";

export const BUSINESS_TYPES: BusinessType[] = [
  "travel_agency",
  "real_estate",
  "car_dealership",
  "restaurant",
  "retail",
  "hotel",
  "beauty",
  "fitness",
  "healthcare",
  "construction",
  "cleaning",
  "events",
  "education",
  "professional_services",
  "ecommerce",
  "automotive_service",
  "other",
];

/** Canonical English names used in the data model. */
export const BUSINESS_TYPE_NAMES: Record<BusinessType, string> = {
  travel_agency: "Travel Agency",
  real_estate: "Real Estate",
  car_dealership: "Car Dealership",
  restaurant: "Restaurant",
  retail: "Retail",
  hotel: "Hotel / Accommodation",
  beauty: "Beauty / Salon",
  fitness: "Fitness / Gym",
  healthcare: "Healthcare / Clinic",
  construction: "Construction / Trades",
  cleaning: "Cleaning Service",
  events: "Events",
  education: "Education",
  professional_services: "Professional Services",
  ecommerce: "E-commerce",
  automotive_service: "Automotive Service",
  other: "Other / Custom",
};

/**
 * Suggestions for the custom category field. krijo24 is not limited to the five
 * quick start types, these simply help a business describe itself.
 */
export const CUSTOM_TYPE_SUGGESTIONS = [
  "Hair salon",
  "Beauty studio",
  "Gym",
  "Personal trainer",
  "Dental clinic",
  "Medical clinic",
  "Hotel",
  "Guesthouse",
  "Construction",
  "Trades and repairs",
  "Cleaning company",
  "Events and weddings",
  "Education and courses",
  "Professional services",
  "Automotive service",
  "Local shop",
  "Online shop",
  "Creator",
];

/* --------------------------------- fonts ---------------------------------- */

export type FontCategory =
  "Modern Sans" | "Editorial Serif" | "Luxury" | "Bold Display" | "Clean Business";

export type FontOption = { family: string; category: FontCategory; weights: string };

/** Curated library. Every family is loaded in the root route so posts render it. */
export const FONT_LIBRARY: FontOption[] = [
  { family: "Inter", category: "Modern Sans", weights: "400;600;800" },
  { family: "DM Sans", category: "Modern Sans", weights: "400;500;700" },
  { family: "Manrope", category: "Modern Sans", weights: "400;600;800" },
  { family: "Plus Jakarta Sans", category: "Modern Sans", weights: "400;600;800" },
  { family: "Sora", category: "Modern Sans", weights: "400;600;800" },
  { family: "Outfit", category: "Modern Sans", weights: "400;600;800" },
  { family: "Space Grotesk", category: "Modern Sans", weights: "400;600;700" },
  { family: "Playfair Display", category: "Editorial Serif", weights: "400;600;800" },
  { family: "Lora", category: "Editorial Serif", weights: "400;600;700" },
  { family: "Libre Baskerville", category: "Editorial Serif", weights: "400;700" },
  { family: "Fraunces", category: "Editorial Serif", weights: "400;600;900" },
  { family: "Cormorant Garamond", category: "Luxury", weights: "400;600;700" },
  { family: "Marcellus", category: "Luxury", weights: "400" },
  { family: "Italiana", category: "Luxury", weights: "400" },
  { family: "Prata", category: "Luxury", weights: "400" },
  { family: "Archivo Black", category: "Bold Display", weights: "400" },
  { family: "Anton", category: "Bold Display", weights: "400" },
  { family: "Bebas Neue", category: "Bold Display", weights: "400" },
  { family: "Oswald", category: "Bold Display", weights: "400;600;700" },
  { family: "Work Sans", category: "Clean Business", weights: "400;600;700" },
  { family: "IBM Plex Sans", category: "Clean Business", weights: "400;600;700" },
  { family: "Source Sans 3", category: "Clean Business", weights: "400;600;700" },
  { family: "Figtree", category: "Clean Business", weights: "400;600;800" },
  { family: "Public Sans", category: "Clean Business", weights: "400;600;700" },
];

export const FONT_CATEGORIES: FontCategory[] = [
  "Modern Sans",
  "Editorial Serif",
  "Luxury",
  "Bold Display",
  "Clean Business",
];

export const FONTS = FONT_LIBRARY.map((f) => f.family);

/** Google Fonts stylesheet covering the whole curated library. */
export const FONT_STYLESHEET_HREF = `https://fonts.googleapis.com/css2?${FONT_LIBRARY.map(
  (f) => `family=${f.family.replace(/ /g, "+")}:wght@${f.weights}`,
).join("&")}&display=swap`;

/* -------------------------------- currency -------------------------------- */

export const CURRENCIES: CurrencyCode[] = ["EUR", "CHF", "GBP", "USD", "ALL", "SEK", "NOK", "DKK"];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: "€",
  CHF: "CHF",
  GBP: "£",
  USD: "$",
  ALL: "L",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
};

/** Amount first, symbol after, for example "299 €". */
export function formatPrice(value: string, currency: CurrencyCode): string {
  const raw = value.trim();
  if (!raw) return "";
  const numeric = raw.replace(/[^\d.,]/g, "");
  if (!numeric) return raw;
  return `${numeric} ${CURRENCY_SYMBOLS[currency]}`;
}

export const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "sq", label: "Shqip" },
];

/* ---------------------------------- plans --------------------------------- */

/**
 * Commercial catalog. The database is the source of truth for what an account
 * may actually do, this list only describes the offers.
 */
export const PLANS: {
  tier: PlanTier;
  name: string;
  monthly: number;
  brands: number;
  partnershipPosts: number;
  formats: string;
  features: string[];
}[] = [
  {
    tier: "starter",
    name: "Starter",
    monthly: 50,
    brands: 1,
    partnershipPosts: 0,
    formats: "Image posts",
    features: [
      "1 brand",
      "Image posts",
      "Unlimited ready made templates",
      "Your own uploaded templates",
    ],
  },
  {
    tier: "growth",
    name: "Growth",
    monthly: 100,
    brands: 1,
    partnershipPosts: 0,
    formats: "Posts, carousels, story and reel",
    features: [
      "1 brand",
      "Full app: posts, carousels, story and reel",
      "Unlimited ready made templates",
      "Your own uploaded templates",
    ],
  },
  {
    tier: "studio",
    name: "Studio",
    monthly: 150,
    brands: 2,
    partnershipPosts: 0,
    formats: "Posts, carousels, story and reel",
    features: [
      "2 brands",
      "Full app: posts, carousels, story and reel",
      "Unlimited ready made templates",
      "Your own uploaded templates",
    ],
  },
  {
    tier: "partnership",
    name: "Partnership",
    monthly: 200,
    brands: 1,
    partnershipPosts: 30,
    formats: "Posts, carousels, story and reel",
    features: [
      "Full app plus a content team",
      "1 brand",
      "30 posts per month created by krijo24 from your pictures and information",
      "Every additional 100 € per month adds 30 more done for you posts",
      "You still create unlimited posts yourself",
    ],
  },
];

export const PLAN_NAMES: Record<PlanTier, string> = {
  starter: "Starter",
  growth: "Growth",
  studio: "Studio",
  partnership: "Partnership",
};

/** Mirrors the database plan_defaults function, for display only. */
/** Prices an admin can activate. Partnership scales in 100 € steps. */
export const PRICE_POINTS = [50, 100, 150, 200, 300, 400, 500];

/** Mirrors the database tier mapping, for labels only. */
export function tierForPrice(monthlyPrice: number): PlanTier {
  if (monthlyPrice >= 200) return "partnership";
  if (monthlyPrice >= 150) return "studio";
  if (monthlyPrice >= 100) return "growth";
  return "starter";
}

export function partnershipPostsFor(monthlyPrice: number): number {
  return monthlyPrice >= 200 ? (Math.floor((monthlyPrice - 200) / 100) + 1) * 30 : 0;
}

export const ANNUAL_DISCOUNT = 0.2;

export const annualPerMonth = (monthly: number) =>
  Math.round(monthly * (1 - ANNUAL_DISCOUNT) * 100) / 100;

/* --------------------------------- fields --------------------------------- */

export type FieldKey = "title" | "subject" | "location" | "price" | "date" | "meta1" | "meta2";

/** Suggested fields per business type. Templates are never restricted by type. */
export const TYPE_FIELDS: Record<BusinessType, { key: FieldKey; labelKey: string }[]> = {
  travel_agency: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.destination" },
    { key: "location", labelKey: "field.hotel" },
    { key: "price", labelKey: "field.price" },
    { key: "date", labelKey: "field.date" },
    { key: "meta1", labelKey: "field.nights" },
  ],
  real_estate: [
    { key: "title", labelKey: "field.property" },
    { key: "subject", labelKey: "field.location" },
    { key: "price", labelKey: "field.price" },
    { key: "meta1", labelKey: "field.rooms" },
    { key: "meta2", labelKey: "field.area" },
    { key: "date", labelKey: "field.available" },
  ],
  car_dealership: [
    { key: "title", labelKey: "field.vehicle" },
    { key: "subject", labelKey: "field.model" },
    { key: "price", labelKey: "field.price" },
    { key: "meta1", labelKey: "field.year" },
    { key: "meta2", labelKey: "field.mileage" },
    { key: "date", labelKey: "field.financing" },
  ],
  restaurant: [
    { key: "title", labelKey: "field.dish" },
    { key: "subject", labelKey: "field.menu" },
    { key: "price", labelKey: "field.price" },
    { key: "location", labelKey: "field.location" },
    { key: "date", labelKey: "field.when" },
  ],
  retail: [
    { key: "title", labelKey: "field.product" },
    { key: "subject", labelKey: "field.category" },
    { key: "price", labelKey: "field.price" },
    { key: "meta1", labelKey: "field.offer" },
    { key: "date", labelKey: "field.validUntil" },
  ],
  hotel: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.hotel" },
    { key: "location", labelKey: "field.location" },
    { key: "price", labelKey: "field.price" },
    { key: "date", labelKey: "field.date" },
    { key: "meta1", labelKey: "field.nights" },
  ],
  beauty: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.subject" },
    { key: "price", labelKey: "field.price" },
    { key: "date", labelKey: "field.when" },
    { key: "location", labelKey: "field.location" },
    { key: "meta1", labelKey: "field.detail" },
  ],
  fitness: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.subject" },
    { key: "price", labelKey: "field.price" },
    { key: "date", labelKey: "field.when" },
    { key: "location", labelKey: "field.location" },
    { key: "meta1", labelKey: "field.detail" },
  ],
  healthcare: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.subject" },
    { key: "location", labelKey: "field.location" },
    { key: "date", labelKey: "field.when" },
    { key: "price", labelKey: "field.price" },
    { key: "meta1", labelKey: "field.detail" },
  ],
  construction: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.subject" },
    { key: "location", labelKey: "field.location" },
    { key: "price", labelKey: "field.price" },
    { key: "date", labelKey: "field.available" },
    { key: "meta1", labelKey: "field.detail" },
  ],
  cleaning: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.subject" },
    { key: "location", labelKey: "field.location" },
    { key: "price", labelKey: "field.price" },
    { key: "date", labelKey: "field.when" },
    { key: "meta1", labelKey: "field.detail" },
  ],
  events: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.subject" },
    { key: "location", labelKey: "field.location" },
    { key: "date", labelKey: "field.when" },
    { key: "price", labelKey: "field.price" },
    { key: "meta1", labelKey: "field.detail" },
  ],
  education: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.subject" },
    { key: "date", labelKey: "field.when" },
    { key: "price", labelKey: "field.price" },
    { key: "location", labelKey: "field.location" },
    { key: "meta1", labelKey: "field.detail" },
  ],
  professional_services: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.subject" },
    { key: "location", labelKey: "field.location" },
    { key: "price", labelKey: "field.price" },
    { key: "date", labelKey: "field.when" },
    { key: "meta1", labelKey: "field.detail" },
  ],
  ecommerce: [
    { key: "title", labelKey: "field.product" },
    { key: "subject", labelKey: "field.category" },
    { key: "price", labelKey: "field.price" },
    { key: "meta1", labelKey: "field.offer" },
    { key: "date", labelKey: "field.validUntil" },
  ],
  automotive_service: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.subject" },
    { key: "price", labelKey: "field.price" },
    { key: "location", labelKey: "field.location" },
    { key: "date", labelKey: "field.when" },
    { key: "meta1", labelKey: "field.detail" },
  ],
  other: [
    { key: "title", labelKey: "field.offer" },
    { key: "subject", labelKey: "field.subject" },
    { key: "location", labelKey: "field.location" },
    { key: "price", labelKey: "field.price" },
    { key: "date", labelKey: "field.when" },
    { key: "meta1", labelKey: "field.detail" },
  ],
};

/** Editable suggestions only. Businesses own their final service list. */
export const SERVICE_SUGGESTIONS: Record<BusinessType, string[]> = {
  travel_agency: [
    "Accommodation",
    "Breakfast",
    "Half board",
    "Transfers",
    "Pool",
    "Beach",
    "Spa",
    "Guided tours",
  ],
  real_estate: [
    "Parking",
    "Balcony",
    "Elevator",
    "Garden",
    "Furnished",
    "New build",
    "Sea view",
    "Storage",
  ],
  car_dealership: [
    "Warranty",
    "Financing",
    "Trade in",
    "Service history",
    "Automatic",
    "Navigation",
    "Leather seats",
    "Winter tires",
  ],
  restaurant: [
    "Dine in",
    "Takeaway",
    "Delivery",
    "Vegetarian",
    "Vegan",
    "Gluten free",
    "Terrace",
    "Reservations",
  ],
  retail: [
    "Free shipping",
    "In store pickup",
    "Returns 30 days",
    "Warranty",
    "Gift wrapping",
    "Limited stock",
    "New arrival",
    "Members price",
  ],
  hotel: [
    "Breakfast included",
    "Free parking",
    "Pool",
    "Spa",
    "Sea view",
    "Family rooms",
    "Late checkout",
    "Airport transfer",
  ],
  beauty: [
    "Consultation",
    "Hair styling",
    "Coloring",
    "Manicure",
    "Facial",
    "Makeup",
    "Bridal package",
    "Products included",
  ],
  fitness: [
    "Personal training",
    "Group classes",
    "Nutrition plan",
    "Free trial",
    "Sauna",
    "Open early",
    "No contract",
    "Student price",
  ],
  healthcare: [
    "Same day appointment",
    "Consultation",
    "Check up",
    "Insurance accepted",
    "Modern equipment",
    "Specialists",
    "Follow up included",
    "Evening hours",
  ],
  construction: [
    "Free estimate",
    "Licensed team",
    "Materials included",
    "Warranty",
    "Fixed price",
    "On schedule",
    "Renovation",
    "Site cleanup",
  ],
  cleaning: [
    "Deep cleaning",
    "Eco products",
    "Weekly plan",
    "Move in and out",
    "Office cleaning",
    "Insured team",
    "Flexible hours",
    "Same day service",
  ],
  events: [
    "Venue",
    "Catering",
    "Decoration",
    "Photography",
    "Music and DJ",
    "Full planning",
    "Custom packages",
    "Guest support",
  ],
  education: [
    "Small groups",
    "Certified teachers",
    "Online option",
    "Flexible schedule",
    "Materials included",
    "Certificate",
    "Free trial lesson",
    "Exam preparation",
  ],
  professional_services: [
    "Free consultation",
    "Fixed fee",
    "Fast turnaround",
    "Confidential",
    "Remote friendly",
    "Ongoing support",
    "Certified experts",
    "Custom scope",
  ],
  ecommerce: [
    "Free shipping",
    "Fast delivery",
    "Easy returns",
    "Warranty",
    "Secure payment",
    "Cash on delivery",
    "Limited stock",
    "New arrival",
  ],
  automotive_service: [
    "Free diagnostics",
    "Oil change",
    "Tire service",
    "Warranty on work",
    "Original parts",
    "While you wait",
    "Pickup and delivery",
    "Fixed price",
  ],
  other: [
    "Fast delivery",
    "Free consultation",
    "Flexible hours",
    "Custom order",
    "Warranty",
    "Support",
  ],
};

/** Simple CTA presets used on posts and in captions. */
export const CTA_PRESETS = [
  "Send us a message",
  "Book now",
  "Call us today",
  "Visit us",
  "Order online",
  "Reserve your spot",
  "Limited availability",
];

export const DEFAULT_BRAND = {
  primary: "#6d4dff",
  secondary: "#b06cf5",
  accent: "#ff7a59",
  background: null as string | null,
  fontFamily: "Sora",
  fontSecondary: null as string | null,
  currency: "EUR" as CurrencyCode,
  language: "en" as LanguageCode,
};

/* --------------------------------- formats -------------------------------- */

/**
 * One shared table of content formats. Every canvas, preview, export and
 * template definition reads its dimensions and limits from here, so there is
 * a single source of truth instead of per feature magic numbers.
 */
export const FORMAT_SPECS: Record<ContentFormat, FormatSpec> = {
  post: {
    format: "post",
    label: "Post",
    width: 1080,
    height: 1350,
    minSlides: 1,
    maxSlides: 1,
    defaultSlides: 1,
    minDuration: 0,
    maxDuration: 0,
    defaultDuration: 0,
    exportable: true,
  },
  carousel: {
    format: "carousel",
    label: "Carousel",
    width: 1080,
    height: 1350,
    minSlides: 2,
    maxSlides: 8,
    defaultSlides: 3,
    minDuration: 0,
    maxDuration: 0,
    defaultDuration: 0,
    exportable: true,
  },
  video: {
    format: "video",
    label: "Video",
    width: 1080,
    height: 1920,
    minSlides: 2,
    maxSlides: 6,
    defaultSlides: 3,
    minDuration: 1500,
    maxDuration: 8000,
    defaultDuration: 3000,
    exportable: false,
  },
  story: {
    format: "story",
    label: "Story",
    width: 1080,
    height: 1920,
    minSlides: 1,
    maxSlides: 1,
    defaultSlides: 1,
    minDuration: 0,
    maxDuration: 0,
    defaultDuration: 0,
    exportable: true,
  },
};

export const CONTENT_FORMATS: ContentFormat[] = ["post", "carousel", "video", "story"];

export const FORMAT_HINTS: Record<ContentFormat, string> = {
  post: "One image, one design.",
  carousel: "Several slides in one order.",
  video: "Short storyboard with timing.",
  story: "Tall full screen design.",
};

/** Clamps a card duration into the template or format safe bounds. */
export const clampDuration = (ms: number, spec: FormatSpec) =>
  Math.min(spec.maxDuration, Math.max(spec.minDuration, Math.round(ms / 500) * 500));

/* ----------------------------- output sizes -------------------------------- */

export type SizeOption = {
  key: string;
  label: string;
  note: string;
  width: number;
  height: number;
};

/**
 * The sizes each network actually renders without cropping. Feeds keep 4:5 as
 * the tallest safe frame, square is the safest for carousels because every
 * slide lines up, and vertical formats stay 9:16.
 */
export const SIZE_OPTIONS: Record<ContentFormat, SizeOption[]> = {
  post: [
    { key: "4:5", label: "4:5", note: "Feed, tallest safe", width: 1080, height: 1350 },
    { key: "1:1", label: "1:1", note: "Square, works everywhere", width: 1080, height: 1080 },
    { key: "9:16", label: "9:16", note: "Full screen vertical", width: 1080, height: 1920 },
    { key: "16:9", label: "16:9", note: "Landscape, LinkedIn", width: 1080, height: 608 },
  ],
  carousel: [
    { key: "1:1", label: "1:1", note: "Square, slides line up", width: 1080, height: 1080 },
    { key: "4:5", label: "4:5", note: "Taller, more presence", width: 1080, height: 1350 },
  ],
  story: [{ key: "9:16", label: "9:16", note: "Full screen", width: 1080, height: 1920 }],
  video: [
    { key: "9:16", label: "9:16", note: "Reels, TikTok, Shorts", width: 1080, height: 1920 },
    { key: "1:1", label: "1:1", note: "Square video", width: 1080, height: 1080 },
  ],
};

/** Resolves a chosen size, falling back to the first option of the format. */
export function sizeFor(format: ContentFormat, key?: string | null): SizeOption {
  const list = SIZE_OPTIONS[format];
  return list.find((s) => s.key === key) ?? list[0]!;
}

/**
 * Interface safe area. Stories, reels and TikToks cover the top and bottom of
 * the frame with profile rows, captions and buttons, so content is kept inside
 * these insets. Values are percentages of the canvas width, matching the
 * container relative sizing used by every template.
 */
export const SAFE_INSETS: Record<ContentFormat, { top: number; bottom: number }> = {
  post: { top: 0, bottom: 0 },
  carousel: { top: 0, bottom: 0 },
  story: { top: 14, bottom: 24 },
  video: { top: 14, bottom: 28 },
};

/* ----------------------------- field wording ------------------------------- */

/**
 * Wording a business can pick per field. Every business names things
 * differently, so the label is editable instead of hard coded per type.
 */
export const FIELD_LABEL_PRESETS: Record<FieldKey, string[]> = {
  title: ["field.offer", "field.product", "field.property", "field.vehicle", "field.dish"],
  subject: ["field.destination", "field.model", "field.category", "field.menu", "field.location"],
  location: ["field.hotel", "field.location", "field.area"],
  price: ["field.price", "field.financing"],
  date: ["field.date", "field.validUntil", "field.available", "field.when"],
  meta1: ["field.nights", "field.rooms", "field.year", "field.guests", "field.days"],
  meta2: ["field.area", "field.mileage", "field.persons", "field.detail"],
};

/** A plain number plus its label reads better than the number alone. */
export function labelledValue(value: string, label?: string): string {
  const v = (value ?? "").trim();
  if (!v || !label) return v;
  return /^\d+([.,]\d+)?$/.test(v) ? `${v} ${label.trim()}` : v;
}

/* --------------------------- social and scheduling ------------------------- */

/**
 * Publishing surfaces. `available` is false for every platform whose publishing
 * API is not wired up, so the UI can say "Connect when available" instead of
 * pretending a connection exists.
 */
export const SOCIAL_PLATFORMS: {
  platform: SocialPlatform;
  label: string;
  available: boolean;
  note: string;
}[] = [
  {
    platform: "instagram",
    label: "Instagram",
    available: false,
    note: "Needs a professional account linked to a Facebook Page through a Meta business account.",
  },
  {
    platform: "facebook",
    label: "Facebook",
    available: false,
    note: "Needs a Facebook Page inside a Meta business account.",
  },
  {
    platform: "linkedin",
    label: "LinkedIn",
    available: false,
    note: "Needs a LinkedIn company page with posting access.",
  },
];

/** The only platforms offered in the product today. Older records may still
 * reference other platforms, so PLATFORM_LABELS keeps every historic value. */
export const PUBLISHING_PLATFORMS: SocialPlatform[] = SOCIAL_PLATFORMS.map((p) => p.platform);

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
};

/** Timezones offered for scheduling. Stored with every queue entry. */
export const TIMEZONES = [
  "UTC",
  "Europe/Tirane",
  "Europe/Zurich",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Athens",
  "America/New_York",
  "America/Los_Angeles",
];
