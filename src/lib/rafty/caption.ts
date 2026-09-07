import { formatPrice } from "./constants";
import type { BusinessType, ContentInstructions, CurrencyCode, PostContent } from "./types";

/**
 * Caption writer. Text only, never layout.
 *
 * Facts come exclusively from this post and this business. The brand's own
 * saved description (styleSample) is used as a *style* reference only: length,
 * punctuation, emoji habits and hashtags. Sentences from the sample are never
 * copied, so krijo24 can never state a fact the user did not enter, and never
 * borrows another brand's information.
 */

const OPENERS: Partial<Record<BusinessType, string[]>> = {
  travel_agency: [
    "Pack light, stay longer.",
    "This one books out fast.",
    "Your next trip, sorted.",
  ],
  real_estate: ["Just listed.", "Room to breathe.", "A place worth seeing in person."],
  car_dealership: ["Ready to drive today.", "Just arrived on the lot.", "Keys are waiting."],
  restaurant: ["On the menu now.", "Fresh out of the kitchen.", "Tonight tastes good."],
  retail: ["New in stock.", "Small drop, big favourite.", "Back by request."],
  hotel: ["Rooms open for these dates.", "Stay a little longer.", "Your weekend, handled."],
  beauty: ["Fresh look, booked in minutes.", "New in the studio.", "Time for something new."],
  fitness: ["Start this week.", "Training that fits your day.", "Progress starts here."],
  healthcare: ["Appointments open this week.", "Care when you need it.", "Book a check up."],
  construction: ["Another project delivered.", "Built to last.", "From plan to finished."],
  cleaning: ["Spotless, on schedule.", "Booked in minutes.", "Fresh start for your space."],
  events: ["Dates are opening up.", "Every detail planned.", "Let's make it memorable."],
  education: ["Enrolment is open.", "New course starting.", "Learn at your own pace."],
  professional_services: [
    "Now taking new clients.",
    "Straight answers, fast.",
    "Let's get it sorted.",
  ],
  ecommerce: ["New in the shop.", "Back in stock.", "Ships today."],
  automotive_service: ["Service slots open.", "In and out the same day.", "Keep it running right."],
  other: ["Something new from us.", "Now available.", "Worth a closer look."],
};

const DEFAULT_CLOSERS: Partial<Record<BusinessType, string>> = {
  travel_agency: "Send us a message to reserve.",
  real_estate: "Message us to book a viewing.",
  car_dealership: "Message us for a test drive.",
  restaurant: "Reserve your table today.",
  retail: "Message us to order.",
  hotel: "Message us to check availability.",
  beauty: "Message us to book your spot.",
  fitness: "Message us to start your trial.",
  healthcare: "Message us to book an appointment.",
  construction: "Message us for a free estimate.",
  cleaning: "Message us to book a cleaning.",
  events: "Message us to check your date.",
  education: "Message us to enrol.",
  professional_services: "Message us for a free consultation.",
  ecommerce: "Order online today.",
  automotive_service: "Message us to book a service.",
  other: "Message us to learn more.",
};

const MAX_LENGTH = 2200;

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

type Style = {
  /** Sentence ending the brand tends to use. */
  punctuation: string;
  /** Emoji the sample uses, reused sparingly at the end of the first line. */
  emoji: string | null;
  /** Prefer short captions when the sample is short. */
  concise: boolean;
  /** Hashtags found in the sample, used only when none are configured. */
  hashtags: string[];
};

/** Reads writing habits out of the brand's own description. Style only. */
function readStyle(sample: string): Style {
  const value = sample.trim();
  if (!value) return { punctuation: ".", emoji: null, concise: false, hashtags: [] };

  const emojiMatch = value.match(EMOJI_RE);
  const exclamations = (value.match(/!/g) ?? []).length;
  const sentences = value.split(/(?<=[.!?])\s+/).filter(Boolean);
  const words = value.split(/\s+/).filter(Boolean).length;
  const hashtags = (value.match(/#[\p{L}\p{N}_]+/gu) ?? []).slice(0, 12);

  return {
    punctuation: exclamations >= Math.max(1, sentences.length / 2) ? "!" : ".",
    emoji: emojiMatch ? emojiMatch[0] : null,
    concise: words > 0 && words < 45,
    hashtags,
  };
}

function buildHashtags(input: {
  configured: string;
  fromSample: string[];
  subject: string;
  businessName: string;
}): string[] {
  const custom = input.configured
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => (v.startsWith("#") ? v : `#${v}`));
  if (custom.length) return custom.slice(0, 12);
  if (input.fromSample.length) return input.fromSample;
  return [input.subject, input.businessName]
    .map((v) => v.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .map((v) => `#${v}`);
}

export function generateCaption(input: {
  content: PostContent;
  businessType: BusinessType;
  businessName: string;
  currency: CurrencyCode;
  instructions: ContentInstructions;
  services?: string[];
  seed?: number;
}): string {
  const { content, businessType, businessName, currency, instructions } = input;
  const seed = input.seed ?? 0;
  const style = readStyle(instructions.styleSample);

  const title = content.title.trim() || "New offer";
  const openers = OPENERS[businessType] ?? OPENERS.other!;
  const opener = openers[(title.length + seed) % openers.length]!;
  const parts: string[] = [style.emoji ? `${opener.replace(/\.$/, "")} ${style.emoji}` : opener];

  const subject = content.subject.trim();
  parts.push(
    subject ? `${title} in ${subject}${style.punctuation}` : `${title}${style.punctuation}`,
  );

  const price = formatPrice(content.price, currency);
  if (price) parts.push(`From ${price}.`);

  const details = [content.meta1, content.meta2, content.location, content.date]
    .map((v) => v.trim())
    .filter(Boolean);
  // A concise brand gets only the strongest detail, a longer writer gets all.
  (style.concise ? details.slice(0, 1) : details).forEach((v) => parts.push(`${v}.`));

  const services = input.services?.length ? input.services : content.services;
  if (services.length) parts.push(`Includes: ${services.join(", ")}.`);

  // Extra lines the user placed on the design are their own words, so they are
  // safe to reuse in the caption.
  const extras = (content.extras ?? [])
    .map((item) => item.text.trim())
    .filter(Boolean)
    .slice(0, style.concise ? 1 : 3);
  if (content.additionalText.trim()) extras.unshift(content.additionalText.trim());
  extras.forEach((v) => parts.push(v.replace(/\.$/, "") + "."));

  const cta = content.cta.trim() || DEFAULT_CLOSERS[businessType] || DEFAULT_CLOSERS.other!;
  parts.push(cta.replace(/\.$/, "") + ".");

  let body = parts
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const tags = buildHashtags({
    configured: instructions.hashtags,
    fromSample: style.hashtags,
    subject,
    businessName,
  });

  let caption = [body, tags.join(" ")].filter(Boolean).join("\n\n");
  if (caption.length > MAX_LENGTH) {
    body = body.slice(0, MAX_LENGTH - tags.join(" ").length - 4).trim() + "...";
    caption = [body, tags.join(" ")].filter(Boolean).join("\n\n");
  }
  return caption;
}
