import demoBeach from "@/assets/demo-beach.jpg";
import demoCity from "@/assets/demo-city.jpg";
import demoCoffee from "@/assets/demo-coffee.jpg";
import { globalTemplates } from "./templates";
import {
  emptyContact,
  emptyContent,
  emptyInstructions,
  type BrandProfile,
  type BusinessType,
  type PostContent,
  type Template,
} from "./types";

/**
 * Isolated preview content for the public landing page and template previews.
 * This data is never written into a real business account.
 */

export type DemoPost = {
  template: Template;
  content: PostContent;
  brand: BrandProfile;
  businessName: string;
  businessType: BusinessType;
};

const brand = (primary: string, secondary: string, fontFamily: string): BrandProfile => ({
  businessId: "preview",
  logoDataUrl: null,
  logoLocked: false,
  primary,
  secondary,
  accent: "#ff7a59",
  background: null,
  fontFamily,
  fontSecondary: null,
  showBrandName: false,
  instructions: emptyInstructions,
  contact: emptyContact,
  currency: "EUR",
  language: "en",
});

const pick = (id: string) => globalTemplates.find((t) => t.id === id) ?? globalTemplates[0]!;

export const demoPosts: DemoPost[] = [
  {
    template: pick("global_1"),
    businessName: "Travel Agency",
    businessType: "travel_agency",
    brand: brand("#5b4bff", "#c05cf6", "Sora"),
    content: {
      ...emptyContent,
      title: "7 nights in paradise",
      subject: "Maldives",
      location: "Reethi Beach Resort",
      price: "1290",
      date: "September",
      meta1: "7 nights",
      additionalText: "Limited seats, book before Friday",
      services: ["Accommodation", "Breakfast", "Transfers"],
      imageDataUrl: demoBeach,
    },
  },
  {
    template: pick("global_9"),
    businessName: "Real Estate",
    businessType: "real_estate",
    brand: brand("#3f4fd8", "#7f6bf0", "Manrope"),
    content: {
      ...emptyContent,
      title: "Light filled city apartment",
      subject: "Lisbon, Alfama",
      price: "349000",
      meta1: "3 rooms",
      meta2: "96 m2",
      date: "Available now",
      additionalText: "Renovated in 2025, top floor",
      services: ["Balcony", "Elevator", "Storage"],
      imageDataUrl: demoCity,
    },
  },
  {
    template: pick("global_21"),
    businessName: "Restaurant",
    businessType: "restaurant",
    brand: brand("#6d3df0", "#b06cf5", "Playfair Display"),
    content: {
      ...emptyContent,
      title: "Single origin Fridays",
      subject: "Filter menu",
      location: "Old Town",
      price: "4",
      date: "Every Friday",
      additionalText: "First cup on us for members",
      services: ["Dine in", "Takeaway"],
      imageDataUrl: demoCoffee,
    },
  },
];
