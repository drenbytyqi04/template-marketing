import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as repo from "./repo";
import type { PostWithContact } from "./repo";
import { DEFAULT_BRAND } from "./constants";
import { makeT, type Translator } from "./i18n";
import { globalTemplates } from "./templates";
import { supabase } from "@/integrations/supabase/client";
import { allowedFormats, emptyContact, emptyInstructions } from "./types";
import type {
  AccountPlan,
  BrandProfile,
  ContentFormat,
  Business,
  BusinessService,
  BusinessType,
  LanguageCode,
  Template,
  TrialUsage,
  User,
} from "./types";

/**
 * Session and single business context backed by Supabase.
 * One account owns exactly one business, so there is no business switcher.
 * Access is enforced by row level security, this layer only mirrors it.
 */

type OnboardingInput = {
  type: BusinessType;
  customType?: string | null;
  name: string;
  logoDataUrl: string | null;
  primary: string;
  secondary: string;
  accent: string;
  fontFamily: string;
  fontSecondary: string | null;
  currency: BrandProfile["currency"];
  language: LanguageCode;
  services: string[];
  customTemplate: { fileName: string; fileType: string; previewDataUrl: string | null } | null;
};

type Result = { ok: boolean; error?: string };

type Ctx = {
  ready: boolean;
  user: User | null;
  isAdmin: boolean;
  business: Business | null;
  brand: BrandProfile | null;
  services: BusinessService[];
  posts: PostWithContact[];
  templates: Template[];
  /** Template ids this brand starred. Real persisted preference. */
  favorites: string[];
  /** Real usage counts per template id, derived from this brand's saved posts. */
  templateUsage: Record<string, number>;
  toggleFavorite: (templateId: string) => Promise<void>;
  trial: TrialUsage | null;

  plan: AccountPlan | null;
  /** Formats the activated entitlement allows. The database enforces it too. */
  formats: ContentFormat[];
  brands: Business[];
  brandSlotsLeft: number;
  language: LanguageCode;
  t: Translator;
  setLanguage: (lang: LanguageCode) => void;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<Result>;
  signOut: () => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  saveBrand: (patch: Partial<BrandProfile>) => Promise<void>;
  renameBusiness: (name: string) => Promise<void>;
  addService: (name: string) => Promise<Result>;
  renameService: (serviceId: string, name: string) => Promise<Result>;
  removeService: (serviceId: string) => Promise<Result>;
  reorderServices: (serviceIds: string[]) => Promise<Result>;

  createBrand: (input: {
    name: string;
    type: BusinessType;
    customType?: string | null;
  }) => Promise<Result>;
  selectBrand: (businessId: string) => void;
  createPost: (post: PostWithContact) => Promise<PostWithContact | null>;
  removePost: (postId: string) => Promise<void>;
  canCreatePost: boolean;
  refresh: () => void;
};

const RaftyContext = createContext<Ctx | null>(null);

export function RaftyProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [services, setServices] = useState<BusinessService[]>([]);
  const [posts, setPosts] = useState<PostWithContact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [trial, setTrial] = useState<TrialUsage | null>(null);
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [brands, setBrands] = useState<Business[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [guestLanguage, setGuestLanguage] = useState<LanguageCode>("en");
  const loading = useRef(false);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  /**
   * Plan and approval changes are made by a krijo24 admin, outside this tab.
   * Re-reading them when the tab becomes visible again means an activated plan
   * shows up for the customer without asking them to reload.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    loading.current = true;

    (async () => {
      const u = await repo.currentUser();
      if (cancelled) return;
      setUser(u);

      if (!u) {
        setBusiness(null);
        setBrand(null);
        setServices([]);
        setPosts([]);
        setTemplates(globalTemplates);
        setTrial(null);
        setReady(true);
        return;
      }

      const [nextPlan, nextBrands] = await Promise.all([repo.getMyPlan(), repo.myBrands()]);
      if (cancelled) return;
      setPlan(nextPlan);
      setBrands(nextBrands);
      const b = nextBrands.find((x) => x.id === activeBrandId) ?? nextBrands[0] ?? null;
      setBusiness(b);

      if (!b) {
        setBrand(null);
        setServices([]);
        setPosts([]);
        setTemplates(globalTemplates);
        setTrial(null);
        setReady(true);
        return;
      }

      const [nextBrand, nextServices, nextPosts, nextTemplates, nextTrial, nextFavorites] =
        await Promise.all([
          repo.getBrand(b.id),
          repo.listServices(b.id),
          repo.listPosts(b.id),
          repo.templatesForBusiness(b.id),
          repo.getTrial(b.id),
          repo.listFavorites(b.id),
        ]);
      if (cancelled) return;
      setBrand(nextBrand);
      setServices(nextServices);
      setPosts(nextPosts);
      setTemplates(nextTemplates);
      setTrial(nextTrial);
      setFavorites(nextFavorites);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [tick, activeBrandId]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await repo.signIn(email, password);
      if (res.ok) refresh();
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    [refresh],
  );

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const res = await repo.signUp(input);
      if (res.ok) refresh();
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    [refresh],
  );

  const signOutFn = useCallback(async () => {
    await repo.signOut();
    refresh();
  }, [refresh]);

  const completeOnboarding = useCallback(
    async (input: OnboardingInput) => {
      if (!user) return;
      const existing = await repo.myBusiness();
      const businessId =
        existing?.id ??
        (await repo.createMyBusiness({
          name: input.name,
          type: input.type,
          customType: input.customType ?? null,
        }));
      if (!businessId) return;

      await repo.updateBusiness(businessId, {
        name: input.name,
        type: input.type,
        customType: input.customType ?? null,
        onboarded: true,
      });
      await repo.saveBrand(businessId, {
        logoDataUrl: input.logoDataUrl,
        primary: input.primary,
        secondary: input.secondary,
        accent: input.accent,
        fontFamily: input.fontFamily,
        fontSecondary: input.fontSecondary,
        currency: input.currency,
        language: input.language,
      });
      const current = await repo.listServices(businessId);
      await Promise.all(current.map((s) => repo.removeService(s.id)));
      for (const name of input.services) await repo.addService(businessId, name);
      if (input.customTemplate) {
        await repo.createRequest({
          businessId,
          fileName: input.customTemplate.fileName,
          fileType: input.customTemplate.fileType,
          previewDataUrl: input.customTemplate.previewDataUrl,
        });
      }
      refresh();
    },
    [user, refresh],
  );

  const saveBrandFn = useCallback(
    async (patch: Partial<BrandProfile>) => {
      if (!business) return;
      await repo.saveBrand(business.id, patch);
      refresh();
    },
    [business, refresh],
  );

  const renameBusiness = useCallback(
    async (name: string) => {
      if (!business) return;
      await repo.updateBusiness(business.id, { name });
      refresh();
    },
    [business, refresh],
  );

  /** Service writes are awaited, then the brand data is reloaded, so the UI can
   * only report success when the database actually accepted the write. */
  const addServiceFn = useCallback(
    async (name: string) => {
      if (!business) return { ok: false, error: "No active brand" };
      const res = await repo.addService(business.id, name);
      if (res.error) return { ok: false, error: res.error };
      setServices(await repo.listServices(business.id));
      return { ok: true };
    },
    [business],
  );

  const renameServiceFn = useCallback(
    async (serviceId: string, name: string) => {
      const res = await repo.renameService(serviceId, name);
      if (res.error) return { ok: false, error: res.error };
      if (business) setServices(await repo.listServices(business.id));
      return { ok: true };
    },
    [business],
  );

  const removeServiceFn = useCallback(
    async (serviceId: string) => {
      const res = await repo.removeService(serviceId);
      if (res.error) return { ok: false, error: res.error };
      if (business) setServices(await repo.listServices(business.id));
      return { ok: true };
    },
    [business],
  );

  const reorderServicesFn = useCallback(
    async (serviceIds: string[]) => {
      const res = await repo.reorderServices(serviceIds);
      if (res.error) return { ok: false, error: res.error };
      if (business) setServices(await repo.listServices(business.id));
      return { ok: true };
    },
    [business],
  );

  const createBrandFn = useCallback(
    async (input: { name: string; type: BusinessType; customType?: string | null }) => {
      const res = await repo.createBrand(input);
      if (!res.id) return { ok: false, error: res.error ?? "Could not create the brand" };
      setActiveBrandId(res.id);
      refresh();
      return { ok: true };
    },
    [refresh],
  );

  const selectBrand = useCallback(
    (businessId: string) => {
      setActiveBrandId(businessId);
      refresh();
    },
    [refresh],
  );

  const createPost = useCallback(
    async (post: PostWithContact) => {
      if (!business || post.businessId !== business.id) return null;
      const saved = await repo.savePost(post);
      refresh();
      return saved;
    },
    [business, refresh],
  );

  const removePost = useCallback(
    async (postId: string) => {
      if (!business) return;
      await repo.deletePost(postId);
      refresh();
    },
    [business, refresh],
  );

  const language = brand?.language ?? guestLanguage;

  const setLanguage = useCallback(
    (lang: LanguageCode) => {
      setGuestLanguage(lang);
      if (business) void saveBrandFn({ language: lang });
    },
    [business, saveBrandFn],
  );

  /** Mirrors the database rule exactly: an approved brand on an active plan
   * creates without any limit, everyone else is on the trial allowance. */
  const canCreatePost = useMemo(() => {
    if (!business) return false;
    if (business.status === "rejected" || business.status === "suspended") return false;
    if (business.status === "approved" && plan?.active) return true;
    const used = trial?.postsCreated ?? 0;
    return used < (trial?.freePostLimit ?? 1);
  }, [business, plan, trial]);

  /** Real counts from this brand's own saved posts, never seeded data. */
  const templateUsage = useMemo(() => {
    const out: Record<string, number> = {};
    for (const post of posts) out[post.templateId] = (out[post.templateId] ?? 0) + 1;
    return out;
  }, [posts]);

  const toggleFavoriteFn = useCallback(
    async (templateId: string) => {
      if (!business) return;
      const next = !favorites.includes(templateId);
      setFavorites((prev) => (next ? [...prev, templateId] : prev.filter((x) => x !== templateId)));
      const res = await repo.toggleFavorite(business.id, templateId, next);
      if (res.error) setFavorites(await repo.listFavorites(business.id));
    },
    [business, favorites],
  );

  const value = useMemo<Ctx>(
    () => ({
      ready,
      user,
      isAdmin: user?.role === "admin",
      business,
      brand,
      services,
      posts,
      templates,
      favorites,
      templateUsage,
      toggleFavorite: toggleFavoriteFn,
      trial,

      plan,
      formats: allowedFormats(plan),
      brands,
      brandSlotsLeft: Math.max(0, (plan?.brandLimit ?? 1) - brands.length),
      language,
      t: makeT(language),
      setLanguage,
      signIn,
      signUp,
      signOut: signOutFn,
      completeOnboarding,
      saveBrand: saveBrandFn,
      renameBusiness,
      addService: addServiceFn,
      renameService: renameServiceFn,
      removeService: removeServiceFn,
      reorderServices: reorderServicesFn,
      createBrand: createBrandFn,
      selectBrand,
      createPost,
      removePost,
      canCreatePost,
      refresh,
    }),
    [
      ready,
      user,
      business,
      brand,
      services,
      posts,
      favorites,
      templateUsage,
      toggleFavoriteFn,

      templates,
      trial,
      plan,
      brands,
      language,
      setLanguage,
      signIn,
      signUp,
      signOutFn,
      completeOnboarding,
      saveBrandFn,
      renameBusiness,
      addServiceFn,
      renameServiceFn,
      removeServiceFn,
      reorderServicesFn,
      createBrandFn,
      selectBrand,
      createPost,
      removePost,
      canCreatePost,
      refresh,
    ],
  );

  return <RaftyContext.Provider value={value}>{children}</RaftyContext.Provider>;
}

export function useRafty() {
  const ctx = useContext(RaftyContext);
  if (!ctx) throw new Error("useRafty must be used inside RaftyProvider");
  return ctx;
}

/** Neutral brand used only for isolated previews such as the landing page. */
export const previewBrand: BrandProfile = {
  businessId: "preview",
  logoDataUrl: null,
  logoLocked: false,
  accent: DEFAULT_BRAND.accent,
  background: null,
  fontSecondary: null,
  showBrandName: false,
  instructions: emptyInstructions,
  contact: emptyContact,
  primary: DEFAULT_BRAND.primary,
  secondary: DEFAULT_BRAND.secondary,
  fontFamily: DEFAULT_BRAND.fontFamily,
  currency: DEFAULT_BRAND.currency,
  language: "en",
};
