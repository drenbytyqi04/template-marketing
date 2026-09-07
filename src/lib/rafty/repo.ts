import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BRAND, PLANS } from "./constants";
import { globalTemplates } from "./templates";
import {
  emptyContent,
  emptyContact,
  emptyInstructions,
  type AccountPlan,
  type BrandProfile,
  type BrandWebsite,
  type DiscoveredItem,
  type Business,
  type BusinessService,
  type BusinessStatus,
  type BusinessType,
  type ContentInstructions,
  type CurrencyCode,
  type CustomTemplateRequest,
  type LanguageCode,
  type PlanTier,
  type Post,
  type PostAdjustments,
  type PostContent,
  type ScheduledPost,
  type ScheduleStatus,
  type ShareStatus,
  type SocialConnection,
  type SocialPlatform,
  type Template,
  type TemplateVariant,
  type TemplateZone,
  type TrialUsage,
  type User,
} from "./types";

/**
 * Supabase data access boundary.
 * Authorization lives in the database (RLS plus security definer functions).
 * Nothing here ever passes a browser supplied business id as proof of access:
 * the server resolves ownership from the signed in user.
 */

const BUCKET = "rafty-media";

export const id = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

/* --------------------------------- storage -------------------------------- */

const signedCache = new Map<string, { url: string; expires: number }>();

/** Private bucket access. Files are only reachable through short lived signed urls. */
export async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const hit = signedCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  signedCache.set(path, { url: data.signedUrl, expires: Date.now() + 3000 * 1000 });
  return data.signedUrl;
}

async function uploadDataUrl(
  businessId: string,
  kind: "logos" | "posts" | "requests" | "templates",
  dataUrl: string,
): Promise<string | null> {
  const blob = await (await fetch(dataUrl)).blob();
  const ext = (blob.type.split("/")[1] ?? "png").replace("+xml", "");
  const path = `${businessId}/${kind}/${id(kind)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) return null;
  return path;
}

async function removeFile(path: string | null) {
  if (!path) return;
  signedCache.delete(path);
  await supabase.storage.from(BUCKET).remove([path]);
}

const isDataUrl = (value: string | null): value is string => !!value?.startsWith("data:");

/* ---------------------------------- auth ---------------------------------- */

export async function currentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) return null;
  // Database decides admin rights. The function grants the platform role only
  // when the verified account email is on the server side allowlist, and
  // otherwise just reports the existing role. No client side email checks.
  const { data: isAdmin } = await supabase.rpc("claim_admin_role");
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", authUser.id)
    .maybeSingle();
  return {
    id: authUser.id,
    email: authUser.email ?? "",
    name: profile?.display_name || (authUser.email ?? "").split("@")[0] || "Account",
    role: isAdmin ? "admin" : "owner",
    createdAt: authUser.created_at ?? new Date().toISOString(),
  };
}

export async function signUp(input: { name: string; email: string; password: string }) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      ...(typeof window === "undefined" ? {} : { emailRedirectTo: window.location.origin }),
      data: { display_name: input.name.trim() },
    },
  });
  if (error) return { ok: false as const, error: error.message };
  if (!data.session) {
    return { ok: false as const, error: "Check your email to confirm your account, then sign in." };
  }
  if (input.name.trim()) {
    await supabase
      .from("profiles")
      .upsert(
        { id: data.user!.id, email: data.user!.email ?? null, display_name: input.name.trim() },
        { onConflict: "id" },
      );
  }
  return { ok: true as const };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function signOut() {
  await supabase.auth.signOut();
  signedCache.clear();
}

/* -------------------------------- business -------------------------------- */

type BusinessRow = {
  id: string;
  name: string;
  type: BusinessType;
  custom_type: string | null;
  status: BusinessStatus;
  owner_id: string;
  onboarded: boolean;
  created_at: string;
};

const toBusiness = (row: BusinessRow): Business => ({
  id: row.id,
  name: row.name,
  type: row.type,
  customType: row.custom_type,
  status: row.status,
  ownerUserId: row.owner_id,
  onboarded: row.onboarded,
  createdAt: row.created_at,
});

/** Resolves the caller's business through membership, never through a client id. */
export async function myBusiness(): Promise<Business | null> {
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data ? toBusiness(data as BusinessRow) : null;
}

export async function createMyBusiness(input: {
  name: string;
  type: BusinessType;
  customType?: string | null;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("create_my_business", {
    _name: input.name,
    _type: input.type,
    ...(input.customType ? { _custom_type: input.customType } : {}),
  });
  if (error) return null;
  return data as string;
}

export async function updateBusiness(businessId: string, patch: Partial<Business>) {
  const row: Record<string, any> = {};
  if (patch.name !== undefined) row["name"] = patch.name;
  if (patch.type !== undefined) row["type"] = patch.type;
  if (patch.customType !== undefined) row["custom_type"] = patch.customType;
  if (patch.onboarded !== undefined) row["onboarded"] = patch.onboarded;
  if (patch.status !== undefined) row["status"] = patch.status;
  if (Object.keys(row).length === 0) return;
  await supabase
    .from("businesses")
    .update(row as never)
    .eq("id", businessId);
}

/* ---------------------------------- brand --------------------------------- */

type BrandRow = {
  business_id: string;
  logo_path: string | null;
  logo_locked: boolean;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string | null;
  font_family: string;
  font_secondary: string | null;
  show_brand_name: boolean;
  content_instructions: Partial<ContentInstructions> | null;
  currency: string;
  language: string;
};

export async function getBrand(businessId: string): Promise<BrandProfile | null> {
  const { data } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as BrandRow;
  return {
    businessId: row.business_id,
    logoPath: row.logo_path,
    logoDataUrl: await signedUrl(row.logo_path),
    logoLocked: !!row.logo_locked,
    primary: row.primary_color,
    secondary: row.secondary_color,
    accent: row.accent_color ?? DEFAULT_BRAND.accent,
    background: row.background_color ?? null,
    fontFamily: row.font_family,
    fontSecondary: row.font_secondary ?? null,
    showBrandName: !!row.show_brand_name,
    instructions: { ...emptyInstructions, ...(row.content_instructions ?? {}) },
    contact: {
      ...emptyContact,
      ...((row as unknown as { contact_info?: Partial<typeof emptyContact> }).contact_info ?? {}),
    },
    currency: row.currency as CurrencyCode,
    language: row.language as LanguageCode,
  };
}

export async function saveBrand(businessId: string, patch: Partial<BrandProfile>) {
  const row: Record<string, any> = {};
  if (patch.primary !== undefined) row["primary_color"] = patch.primary;
  if (patch.secondary !== undefined) row["secondary_color"] = patch.secondary;
  if (patch.accent !== undefined) row["accent_color"] = patch.accent;
  if (patch.background !== undefined) row["background_color"] = patch.background;
  if (patch.fontFamily !== undefined) row["font_family"] = patch.fontFamily;
  if (patch.fontSecondary !== undefined) row["font_secondary"] = patch.fontSecondary;
  if (patch.showBrandName !== undefined) row["show_brand_name"] = patch.showBrandName;
  if (patch.instructions !== undefined) row["content_instructions"] = patch.instructions;
  if (patch.currency !== undefined) row["currency"] = patch.currency;
  if (patch.language !== undefined) row["language"] = patch.language;
  if (patch.contact !== undefined) row["contact_info"] = patch.contact;

  if (patch.logoDataUrl !== undefined) {
    const current = await supabase
      .from("brand_profiles")
      .select("logo_path, logo_locked")
      .eq("business_id", businessId)
      .maybeSingle();
    const currentRow = current.data as { logo_path: string | null; logo_locked: boolean } | null;
    const oldPath = currentRow?.logo_path ?? null;
    // The database also blocks this. A locked logo can only be changed by an admin.
    if (!currentRow?.logo_locked) {
      if (patch.logoDataUrl === null) {
        await removeFile(oldPath);
        row["logo_path"] = null;
      } else if (isDataUrl(patch.logoDataUrl)) {
        const path = await uploadDataUrl(businessId, "logos", patch.logoDataUrl);
        if (path) {
          await removeFile(oldPath);
          row["logo_path"] = path;
        }
      }
    }
  }

  if (Object.keys(row).length === 0) return;
  await supabase
    .from("brand_profiles")
    .upsert({ business_id: businessId, ...row } as never, { onConflict: "business_id" });
}

/* ---------------------------------- plan ---------------------------------- */

type PlanRow = {
  user_id: string;
  plan: PlanTier;
  monthly_price?: number | null;
  active?: boolean | null;
  brand_limit: number;
  billing_cycle: string;
  allow_carousel?: boolean | null;
  allow_video?: boolean | null;
  allow_custom_templates?: boolean | null;
  partnership_posts_used: number;
  partnership_posts_limit: number;
};

function toPlan(row: PlanRow): AccountPlan {
  return {
    userId: row.user_id,
    plan: row.plan,
    monthlyPrice: row.monthly_price ?? 50,
    active: !!row.active,
    brandLimit: row.brand_limit,
    billingCycle: row.billing_cycle,
    allowCarousel: !!row.allow_carousel,
    allowVideo: !!row.allow_video,
    allowCustomTemplates: row.allow_custom_templates !== false,
    partnershipPostsUsed: row.partnership_posts_used,
    partnershipPostsLimit: row.partnership_posts_limit,
  };
}

/** Reflects the database owned entitlement. Never a client granted plan. */
export async function getMyPlan(): Promise<AccountPlan | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("account_plans")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (!data)
    return {
      userId: uid,
      plan: "starter",
      monthlyPrice: 50,
      active: false,
      brandLimit: 1,
      billingCycle: "monthly",
      allowCarousel: false,
      allowVideo: false,
      allowCustomTemplates: true,
      partnershipPostsUsed: 0,
      partnershipPostsLimit: 0,
    };
  return toPlan(data as unknown as PlanRow);
}

/** Brands the caller is a member of. RLS decides what comes back. */
export async function myBrands(): Promise<Business[]> {
  const { data } = await supabase.from("businesses").select("*").order("created_at");
  return (data ?? []).map((row) => toBusiness(row as BusinessRow));
}

/** Extra brand slots are enforced by the database against the account plan. */
export async function createBrand(input: {
  name: string;
  type: BusinessType;
  customType?: string | null;
}): Promise<{ id: string | null; error?: string }> {
  const { data, error } = await supabase.rpc("create_brand", {
    _name: input.name,
    _type: input.type,
    ...(input.customType ? { _custom_type: input.customType } : {}),
  });
  if (error) return { id: null, error: error.message };
  return { id: data as string };
}

/* -------------------------------- services -------------------------------- */

export async function listServices(businessId: string): Promise<BusinessService[]> {
  const { data } = await supabase
    .from("business_services")
    .select("*")
    .eq("business_id", businessId)
    .order("position")
    .order("created_at");
  return (data ?? []).map((s) => ({
    id: s.id as string,
    businessId: s.business_id as string,
    name: s.name as string,
    position: ((s as { position?: number }).position ?? 0) as number,
  }));
}

/**
 * Service writes surface their error instead of failing silently. RLS scopes
 * every row to the caller's own brand, so a rejected write means the user does
 * not own that brand, and the UI must not pretend it saved.
 */
export type WriteResult = { error?: string };

export async function addService(businessId: string, name: string): Promise<WriteResult> {
  const value = name.trim();
  if (!value) return { error: "Enter a service name" };
  const existing = await listServices(businessId);
  if (existing.some((s) => s.name.toLowerCase() === value.toLowerCase())) {
    return { error: "That service already exists" };
  }
  const { error } = await supabase
    .from("business_services")
    .insert({ business_id: businessId, name: value, position: existing.length } as never);
  return error ? { error: error.message } : {};
}

export async function renameService(serviceId: string, name: string): Promise<WriteResult> {
  const value = name.trim();
  if (!value) return { error: "Enter a service name" };
  const { error } = await supabase
    .from("business_services")
    .update({ name: value })
    .eq("id", serviceId);
  return error ? { error: error.message } : {};
}

export async function removeService(serviceId: string): Promise<WriteResult> {
  const { error } = await supabase.from("business_services").delete().eq("id", serviceId);
  return error ? { error: error.message } : {};
}

/** Persists a new order. RLS still scopes every row to the caller's brand. */
export async function reorderServices(serviceIds: string[]): Promise<WriteResult> {
  const results = await Promise.all(
    serviceIds.map((serviceId, index) =>
      supabase
        .from("business_services")
        .update({ position: index } as never)
        .eq("id", serviceId),
    ),
  );
  const failed = results.find((r) => r.error);
  return failed?.error ? { error: failed.error.message } : {};
}

/* -------------------------------- templates ------------------------------- */

type CustomTemplateRow = {
  id: string;
  business_id: string;
  name: string;
  engine: string;
  variant: TemplateVariant;
  archived: boolean;
  background_path: string | null;
  requirements: string | null;
  zones: TemplateZone[] | null;
  locked_design: boolean;
};

async function toTemplate(row: CustomTemplateRow): Promise<Template> {
  return {
    id: row.id,
    name: row.name,
    engine: row.engine,
    tags: ["image_first"],
    variant: row.variant,
    scope: "custom",
    businessId: row.business_id,
    archived: row.archived,
    backgroundPath: row.background_path,
    backgroundUrl: await signedUrl(row.background_path),
    requirements: row.requirements,
    zones: row.zones ?? [],
    lockedDesign: row.locked_design ?? true,
  };
}

export async function listCustomTemplates(businessId: string): Promise<Template[]> {
  const { data } = await supabase
    .from("custom_templates")
    .select("*")
    .eq("business_id", businessId)
    .eq("archived", false)
    .order("created_at", { ascending: false });
  return Promise.all((data ?? []).map((row) => toTemplate(row as unknown as CustomTemplateRow)));
}

export async function saveCustomTemplate(input: {
  businessId: string;
  name: string;
  engine: string;
  variant: TemplateVariant;
  backgroundDataUrl?: string | null;
  requirements?: string | null;
  zones?: TemplateZone[];
  lockedDesign?: boolean;
}): Promise<string | null> {
  const backgroundPath = isDataUrl(input.backgroundDataUrl ?? null)
    ? await uploadDataUrl(input.businessId, "templates", input.backgroundDataUrl as string)
    : null;
  const { data } = await supabase
    .from("custom_templates")
    .insert({
      business_id: input.businessId,
      name: input.name,
      engine: input.engine,
      variant: input.variant,
      background_path: backgroundPath,
      requirements: input.requirements ?? null,
      zones: input.zones ?? [],
      locked_design: input.lockedDesign ?? true,
    } as never)
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateCustomTemplateZones(templateId: string, zones: TemplateZone[]) {
  await supabase
    .from("custom_templates")
    .update({ zones } as never)
    .eq("id", templateId);
}

export async function archiveTemplate(templateId: string) {
  await supabase.from("custom_templates").update({ archived: true }).eq("id", templateId);
}

/**
 * Global library plus templates owned by this business only. The library is not
 * restricted by business type, a brand's own uploads simply come first.
 */
export async function templatesForBusiness(businessId: string): Promise<Template[]> {
  const custom = await listCustomTemplates(businessId);
  return [...custom, ...globalTemplates];
}

/* ------------------------------- favourites ------------------------------- */
/** Per brand favourites. RLS scopes every row to the caller's own brand. */

export async function listFavorites(businessId: string): Promise<string[]> {
  const { data } = await supabase
    .from("template_favorites")
    .select("template_id")
    .eq("business_id", businessId);
  return (data ?? []).map((row) => row.template_id as string);
}

export async function toggleFavorite(
  businessId: string,
  templateId: string,
  next: boolean,
): Promise<{ error?: string }> {
  if (next) {
    const { error } = await supabase
      .from("template_favorites")
      .upsert({ business_id: businessId, template_id: templateId } as never, {
        onConflict: "business_id,template_id",
      });
    return error ? { error: error.message } : {};
  }
  const { error } = await supabase
    .from("template_favorites")
    .delete()
    .eq("business_id", businessId)
    .eq("template_id", templateId);
  return error ? { error: error.message } : {};
}

/* --------------------------- custom template flow ------------------------- */

type RequestRow = {
  id: string;
  business_id: string;
  file_name: string;
  file_type: string | null;
  file_path: string | null;
  status: CustomTemplateRequest["status"];
  template_id: string | null;
  created_at: string;
  businesses?: { name: string } | null;
};

async function toRequest(row: RequestRow): Promise<CustomTemplateRequest> {
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.businesses?.name ?? "",
    fileName: row.file_name,
    fileType: row.file_type ?? "",
    filePath: row.file_path,
    previewDataUrl: await signedUrl(row.file_path),
    status: row.status,
    templateId: row.template_id,
    createdAt: row.created_at,
  };
}

export async function listRequests(businessId?: string): Promise<CustomTemplateRequest[]> {
  let query = supabase
    .from("custom_template_requests")
    .select("*, businesses(name)")
    .order("created_at", { ascending: false });
  if (businessId) query = query.eq("business_id", businessId);
  const { data } = await query;
  return Promise.all((data ?? []).map((row) => toRequest(row as RequestRow)));
}

export async function createRequest(input: {
  businessId: string;
  fileName: string;
  fileType: string;
  previewDataUrl: string | null;
}): Promise<string | null> {
  const path = isDataUrl(input.previewDataUrl)
    ? await uploadDataUrl(input.businessId, "requests", input.previewDataUrl)
    : null;
  const { data } = await supabase
    .from("custom_template_requests")
    .insert({
      business_id: input.businessId,
      file_name: input.fileName,
      file_type: input.fileType,
      file_path: path,
    })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateRequest(
  requestId: string,
  patch: { status?: CustomTemplateRequest["status"]; templateId?: string | null },
) {
  const row: Record<string, any> = {};
  if (patch.status !== undefined) row["status"] = patch.status;
  if (patch.templateId !== undefined) row["template_id"] = patch.templateId;
  if (Object.keys(row).length === 0) return;
  await supabase
    .from("custom_template_requests")
    .update(row as never)
    .eq("id", requestId);
}

/* ---------------------------------- posts --------------------------------- */

type PostRow = {
  id: string;
  business_id: string;
  template_id: string;
  content: Partial<PostContent>;
  caption: string | null;
  adjustments: PostAdjustments | null;
  show_brand_name: boolean | null;
  show_contact: boolean | null;
  share_status: ShareStatus | null;
  image_path: string | null;
  format: string | null;
  slides: StoredSlide[] | null;
  created_at: string;
  businesses?: { name: string } | null;
};

/** Slides are stored without any data url, only the private storage path. */
type StoredSlide = {
  id: string;
  content: Partial<PostContent>;
  adjustments: PostAdjustments | null;
  durationMs?: number;
  imagePath?: string | null;
};

/**
 * The Post type in types.ts does not yet include showContact. Files that need
 * it (store.tsx, create.tsx) use this local extension instead of editing types.ts.
 */
export type PostWithContact = Post & { showContact?: boolean };

async function toPost(row: PostRow): Promise<PostWithContact> {
  return {
    id: row.id,
    businessId: row.business_id,
    templateId: row.template_id,
    imagePath: row.image_path,
    content: {
      ...emptyContent,
      ...row.content,
      caption: row.caption || row.content?.caption || "",
      imageDataUrl: await signedUrl(row.image_path),
    },
    showBrandName: !!row.show_brand_name,
    showContact: !!row.show_contact,
    adjustments: row.adjustments ?? {},
    shareStatus: row.share_status ?? {},
    createdAt: row.created_at,
    format: (row.format as Post["format"]) ?? "post",
    slides: await Promise.all(
      (row.slides ?? []).map(async (slide) => ({
        id: slide.id,
        content: {
          ...emptyContent,
          ...slide.content,
          imageDataUrl: await signedUrl(slide.imagePath ?? null),
        },
        adjustments: slide.adjustments ?? {},
        ...(slide.durationMs !== undefined ? { durationMs: slide.durationMs } : {}),
        imagePath: slide.imagePath ?? null,
      })),
    ),
  };
}

export async function listPosts(businessId: string): Promise<PostWithContact[]> {
  const { data } = await supabase
    .from("posts")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return Promise.all((data ?? []).map((row) => toPost(row as unknown as PostRow)));
}

export async function savePost(post: PostWithContact): Promise<PostWithContact | null> {
  const { imageDataUrl, ...text } = post.content;
  let imagePath = post.imagePath ?? null;
  if (isDataUrl(imageDataUrl)) {
    const uploaded = await uploadDataUrl(post.businessId, "posts", imageDataUrl);
    if (uploaded) {
      if (imagePath) await removeFile(imagePath);
      imagePath = uploaded;
    }
  }
  // Every slide keeps its own storage object, uploaded from its own content,
  // so saving one slide can never overwrite another slide's media.
  const storedSlides: StoredSlide[] = [];
  for (const slide of post.slides ?? []) {
    const { imageDataUrl, ...slideText } = slide.content;
    let slidePath = slide.imagePath ?? null;
    if (isDataUrl(imageDataUrl)) {
      const uploaded = await uploadDataUrl(post.businessId, "posts", imageDataUrl);
      if (uploaded) {
        if (slidePath) await removeFile(slidePath);
        slidePath = uploaded;
      }
    }
    storedSlides.push({
      id: slide.id,
      content: slideText,
      adjustments: slide.adjustments ?? {},
      ...(slide.durationMs !== undefined ? { durationMs: slide.durationMs } : {}),
      imagePath: slidePath,
    });
  }

  const payload = {
    business_id: post.businessId,
    template_id: post.templateId,
    content: text,
    caption: post.content.caption ?? "",
    adjustments: post.adjustments ?? {},
    show_brand_name: post.showBrandName ?? false,
    show_contact: post.showContact ?? false,
    share_status: post.shareStatus ?? {},
    image_path: imagePath,
    format: post.format ?? "post",
    slides: storedSlides,
  };
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    post.id ?? "",
  );
  const existing = isUuid
    ? await supabase.from("posts").select("id").eq("id", post.id).maybeSingle()
    : { data: null };
  const query = existing.data
    ? supabase
        .from("posts")
        .update(payload as never)
        .eq("id", post.id)
        .select("*")
        .maybeSingle()
    : supabase
        .from("posts")
        .insert(payload as never)
        .select("*")
        .maybeSingle();
  const { data } = await query;
  if (!data) return null;
  const saved = await toPost(data as unknown as PostRow);
  if (!existing.data) await supabase.rpc("register_post_usage", { _business_id: post.businessId });
  return saved;
}

export async function deletePost(postId: string) {
  const { data } = await supabase
    .from("posts")
    .select("image_path, slides")
    .eq("id", postId)
    .maybeSingle();
  const row = data as { image_path: string | null; slides: StoredSlide[] | null } | null;
  await removeFile(row?.image_path ?? null);
  for (const slide of row?.slides ?? []) await removeFile(slide.imagePath ?? null);
  await supabase.from("posts").delete().eq("id", postId);
}

/* ---------------------------------- trial --------------------------------- */

export async function getTrial(businessId: string): Promise<TrialUsage> {
  const { data } = await supabase
    .from("trial_usage")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  return {
    businessId,
    postsCreated: (data?.posts_created as number) ?? 0,
    freePostLimit: (data?.free_post_limit as number) ?? 1,
  };
}

/* ---------------------------------- admin --------------------------------- */
/** These reads only return rows for platform admins, enforced by RLS. */

export async function adminListBusinesses(): Promise<Business[]> {
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => toBusiness(row as BusinessRow));
}

export async function adminListTrials(): Promise<TrialUsage[]> {
  const { data } = await supabase.from("trial_usage").select("*");
  return (data ?? []).map((t) => ({
    businessId: t.business_id as string,
    postsCreated: (t.posts_created as number) ?? 0,
    freePostLimit: (t.free_post_limit as number) ?? 1,
  }));
}

export async function adminListPosts(): Promise<Post[]> {
  const { data } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return Promise.all((data ?? []).map((row) => toPost(row as unknown as PostRow)));
}

export async function adminListCustomTemplates(): Promise<
  { id: string; businessId: string; name: string; archived: boolean }[]
> {
  const { data } = await supabase
    .from("custom_templates")
    .select("id, business_id, name, archived")
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id as string,
    businessId: row.business_id as string,
    name: row.name as string,
    archived: row.archived as boolean,
  }));
}

/**
 * Approving a brand also activates its plan, in one database function that
 * verifies the caller is a platform admin. An approved brand therefore always
 * has the unlimited allowance its plan promises.
 */
export async function adminSetStatus(
  businessId: string,
  status: BusinessStatus,
  monthlyPrice = 100,
): Promise<{ error?: string }> {
  if (status === "approved") {
    const { error } = await supabase.rpc("admin_approve_business", {
      _business_id: businessId,
      _monthly_price: monthlyPrice,
    });
    return error ? { error: error.message } : {};
  }
  const { error } = await supabase.from("businesses").update({ status }).eq("id", businessId);
  return error ? { error: error.message } : {};
}

export async function adminListPlans(): Promise<AccountPlan[]> {
  const { data } = await supabase.from("account_plans").select("*");
  return (data ?? []).map((row) => toPlan(row as unknown as PlanRow));
}

/**
 * Activation and pricing are applied by a database function that verifies the
 * caller is a platform admin, so entitlements can never come from the browser.
 */
export async function adminSetPlan(
  ownerUserId: string,
  monthlyPrice: number,
  active: boolean,
  billingCycle = "monthly",
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("admin_set_plan", {
    _user_id: ownerUserId,
    _monthly_price: monthlyPrice,
    _active: active,
    _billing_cycle: billingCycle,
  });
  return error ? { error: error.message } : {};
}

/** Account emails, so admin rows show a real person instead of a raw id. */
export async function adminListProfiles(): Promise<
  { id: string; email: string; displayName: string }[]
> {
  const { data } = await supabase.from("profiles").select("id, email, display_name");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    email: (row.email as string) ?? "",
    displayName: (row.display_name as string) ?? "",
  }));
}

/**
 * Approves the brand and activates its plan in one step, so the customer app
 * immediately reflects the paid entitlement instead of staying on the trial.
 */
export async function adminActivateAccount(
  businessId: string,
  monthlyPrice: number,
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("admin_approve_business", {
    _business_id: businessId,
    _monthly_price: monthlyPrice,
  });
  return error ? { error: error.message } : {};
}

/**
 * Turns a customer's uploaded design into a custom template that belongs to
 * that one brand only. The uploaded file is reused, nothing is copied to
 * another business, and RLS keeps the template private to its brand.
 */
export async function adminAttachTemplateToBusiness(input: {
  requestId: string;
  businessId: string;
  filePath: string | null;
  name: string;
}): Promise<{ error?: string; templateId?: string }> {
  const { data, error } = await supabase
    .from("custom_templates")
    .insert({
      business_id: input.businessId,
      name: input.name,
      engine: "custom",
      variant: { align: "left", tone: "dark", badge: "pill" },
      background_path: input.filePath,
      requirements: null,
      zones: [],
      locked_design: true,
    } as never)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  const templateId = (data?.id as string) ?? undefined;
  const { error: linkError } = await supabase
    .from("custom_template_requests")
    .update({ status: "ready", template_id: templateId ?? null } as never)
    .eq("id", input.requestId);
  if (linkError) return { error: linkError.message };
  return templateId ? { templateId } : {};
}

/* ------------------------ scheduling and connections ----------------------- */
/**
 * The queue is a real database record: brand, post, platform, time, timezone
 * and status. Nothing here marks an item as published, that can only happen
 * once a genuine publishing connection exists.
 */

type ScheduleRow = {
  id: string;
  business_id: string;
  post_id: string;
  platform: SocialPlatform;
  scheduled_at: string;
  timezone: string;
  status: ScheduleStatus;
  note: string | null;
  failure_reason: string | null;
  created_at: string;
};

function toSchedule(row: ScheduleRow): ScheduledPost {
  return {
    id: row.id,
    businessId: row.business_id,
    postId: row.post_id,
    platform: row.platform,
    scheduledAt: row.scheduled_at,
    timezone: row.timezone,
    status: row.status,
    note: row.note ?? "",
    failureReason: row.failure_reason ?? null,
    createdAt: row.created_at,
  };
}

export async function listSchedules(businessId: string): Promise<ScheduledPost[]> {
  const { data } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("business_id", businessId)
    .order("scheduled_at", { ascending: true });
  return (data ?? []).map((row) => toSchedule(row as unknown as ScheduleRow));
}

export async function createSchedule(input: {
  businessId: string;
  postId: string;
  platform: SocialPlatform;
  scheduledAt: string;
  timezone: string;
  note?: string;
}): Promise<{ error?: string }> {
  const { error } = await supabase.from("scheduled_posts").insert({
    business_id: input.businessId,
    post_id: input.postId,
    platform: input.platform,
    scheduled_at: input.scheduledAt,
    timezone: input.timezone,
    note: input.note ?? "",
  });
  return error ? { error: error.message } : {};
}

export async function cancelSchedule(scheduleId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("scheduled_posts")
    .update({ status: "cancelled" })
    .eq("id", scheduleId);
  return error ? { error: error.message } : {};
}

export async function deleteSchedule(scheduleId: string) {
  await supabase.from("scheduled_posts").delete().eq("id", scheduleId);
}

export async function adminListSchedules(): Promise<ScheduledPost[]> {
  const { data } = await supabase
    .from("scheduled_posts")
    .select("*")
    .order("scheduled_at", { ascending: true })
    .limit(200);
  return (data ?? []).map((row) => toSchedule(row as unknown as ScheduleRow));
}

export async function listConnections(businessId: string): Promise<SocialConnection[]> {
  const { data } = await supabase
    .from("brand_social_connections")
    .select("*")
    .eq("business_id", businessId);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    businessId: row.business_id as string,
    platform: row.platform as SocialPlatform,
    status: row.status as SocialConnection["status"],
    accountLabel: (row.account_label as string) ?? "",
  }));
}

/** Only stores the handle a brand wants used once publishing is available. */
export async function saveConnectionLabel(
  businessId: string,
  platform: SocialPlatform,
  accountLabel: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("brand_social_connections")
    .upsert(
      { business_id: businessId, platform, account_label: accountLabel, status: "not_connected" },
      { onConflict: "business_id,platform" },
    );
  return error ? { error: error.message } : {};
}

/* ----------------------------- demo requests ------------------------------ */

/**
 * Public demo request. Length and email checks are enforced again by the
 * database policy, so a crafted client cannot store junk.
 */
export async function submitContactRequest(input: {
  name: string;
  email: string;
  business: string;
  message: string;
}): Promise<{ error?: string }> {
  const name = input.name.trim().slice(0, 100);
  const email = input.email.trim().slice(0, 255);
  const business = input.business.trim().slice(0, 120);
  const message = input.message.trim().slice(0, 2000);
  if (!name) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Please enter a valid email address." };
  const { error } = await supabase
    .from("contact_requests")
    .insert({ name, email, business, message });
  return error ? { error: error.message } : {};
}

export async function adminListContactRequests(): Promise<
  {
    id: string;
    name: string;
    email: string;
    business: string;
    message: string;
    handled: boolean;
    createdAt: string;
  }[]
> {
  const { data } = await supabase
    .from("contact_requests")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    business: row.business,
    message: row.message,
    handled: row.handled,
    createdAt: row.created_at,
  }));
}

export async function adminSetContactHandled(requestId: string, handled: boolean) {
  await supabase.from("contact_requests").update({ handled }).eq("id", requestId);
}

/* --------------------------- website automation --------------------------- */
/**
 * A brand's own website is the source for automatic content. Every row here is
 * scoped to the caller's brand by RLS, exactly like posts and schedules.
 */

const DEFAULT_WEBSITE = (businessId: string): BrandWebsite => ({
  businessId,
  url: "",
  scanFrequency: "off",
  autoMode: "off",
  defaultTemplateId: null,
  postTime: "10:00",
  timezone: "UTC",
  platforms: [],
  lastScannedAt: null,
});

export async function getWebsite(businessId: string): Promise<BrandWebsite> {
  const { data } = await supabase
    .from("brand_websites")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) return DEFAULT_WEBSITE(businessId);
  const row = data as unknown as {
    url: string;
    scan_frequency: string;
    auto_mode: string;
    default_template_id: string | null;
    post_time: string;
    timezone: string;
    platforms: string[] | null;
    last_scanned_at: string | null;
  };
  return {
    businessId,
    url: row.url ?? "",
    scanFrequency: (row.scan_frequency as BrandWebsite["scanFrequency"]) ?? "off",
    autoMode: (row.auto_mode as BrandWebsite["autoMode"]) ?? "off",
    defaultTemplateId: row.default_template_id ?? null,
    postTime: row.post_time ?? "10:00",
    timezone: row.timezone ?? "UTC",
    platforms: (row.platforms ?? []) as SocialPlatform[],
    lastScannedAt: row.last_scanned_at ?? null,
  };
}

export async function saveWebsite(
  businessId: string,
  patch: Partial<BrandWebsite>,
): Promise<{ error?: string }> {
  const row: Record<string, any> = { business_id: businessId };
  if (patch.url !== undefined) row["url"] = patch.url.trim().slice(0, 500);
  if (patch.scanFrequency !== undefined) row["scan_frequency"] = patch.scanFrequency;
  if (patch.autoMode !== undefined) row["auto_mode"] = patch.autoMode;
  if (patch.defaultTemplateId !== undefined) row["default_template_id"] = patch.defaultTemplateId;
  if (patch.postTime !== undefined) row["post_time"] = patch.postTime;
  if (patch.timezone !== undefined) row["timezone"] = patch.timezone;
  if (patch.platforms !== undefined) row["platforms"] = patch.platforms;
  const { error } = await supabase
    .from("brand_websites")
    .upsert(row as never, { onConflict: "business_id" });
  return error ? { error: error.message } : {};
}

export async function listDiscovered(businessId: string): Promise<DiscoveredItem[]> {
  const { data } = await supabase
    .from("discovered_items")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []).map((raw) => {
    const row = raw as unknown as {
      id: string;
      business_id: string;
      source_url: string;
      title: string;
      description: string;
      price: string;
      currency: string;
      image_url: string | null;
      status: string;
      post_id: string | null;
      created_at: string;
    };
    return {
      id: row.id,
      businessId: row.business_id,
      sourceUrl: row.source_url,
      title: row.title,
      description: row.description,
      price: row.price,
      currency: row.currency,
      imageUrl: row.image_url,
      status: (row.status as DiscoveredItem["status"]) ?? "new",
      postId: row.post_id,
      createdAt: row.created_at,
    };
  });
}

export async function setDiscoveredStatus(
  itemId: string,
  status: DiscoveredItem["status"],
  postId?: string | null,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("discovered_items")
    .update({ status, ...(postId !== undefined ? { post_id: postId } : {}) } as never)
    .eq("id", itemId);
  return error ? { error: error.message } : {};
}

export async function removeDiscovered(itemId: string) {
  await supabase.from("discovered_items").delete().eq("id", itemId);
}

/**
 * Stores the exact rendered 1080 wide image for a saved post. Publishing sends
 * this file, so what a brand sees in the preview is what goes out.
 */
export async function savePostRender(
  businessId: string,
  postId: string,
  dataUrl: string,
): Promise<{ error?: string }> {
  if (!isDataUrl(dataUrl)) return { error: "Nothing to store." };
  const path = await uploadDataUrl(businessId, "posts", dataUrl);
  if (!path) return { error: "The rendered image could not be stored." };
  const { data: current } = await supabase
    .from("posts")
    .select("render_path")
    .eq("id", postId)
    .maybeSingle();
  const { error } = await supabase
    .from("posts")
    .update({ render_path: path } as never)
    .eq("id", postId);
  if (error) return { error: error.message };
  const old = (current as { render_path: string | null } | null)?.render_path ?? null;
  if (old && old !== path) await removeFile(old);
  return {};
}

/** Ids of this brand's posts that still have no rendered image stored. */
export async function listPostsMissingRender(businessId: string): Promise<string[]> {
  const { data } = await supabase
    .from("posts")
    .select("id, render_path")
    .eq("business_id", businessId)
    .is("render_path", null);
  return (data ?? []).map((row) => (row as { id: string }).id);
}

export const DEFAULTS = DEFAULT_BRAND;
