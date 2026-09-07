export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      account_plans: {
        Row: {
          active: boolean
          allow_carousel: boolean
          allow_custom_templates: boolean
          allow_video: boolean
          billing_cycle: string
          brand_limit: number
          created_at: string
          monthly_price: number
          partnership_posts_limit: number
          partnership_posts_used: number
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          allow_carousel?: boolean
          allow_custom_templates?: boolean
          allow_video?: boolean
          billing_cycle?: string
          brand_limit?: number
          created_at?: string
          monthly_price?: number
          partnership_posts_limit?: number
          partnership_posts_used?: number
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          allow_carousel?: boolean
          allow_custom_templates?: boolean
          allow_video?: boolean
          billing_cycle?: string
          brand_limit?: number
          created_at?: string
          monthly_price?: number
          partnership_posts_limit?: number
          partnership_posts_used?: number
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      brand_profiles: {
        Row: {
          accent_color: string
          background_color: string | null
          business_id: string
          contact_info: Json
          content_instructions: Json
          created_at: string
          currency: string
          font_family: string
          font_secondary: string | null
          language: string
          logo_locked: boolean
          logo_path: string | null
          primary_color: string
          secondary_color: string
          show_brand_name: boolean
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_color?: string | null
          business_id: string
          contact_info?: Json
          content_instructions?: Json
          created_at?: string
          currency?: string
          font_family?: string
          font_secondary?: string | null
          language?: string
          logo_locked?: boolean
          logo_path?: string | null
          primary_color?: string
          secondary_color?: string
          show_brand_name?: boolean
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_color?: string | null
          business_id?: string
          contact_info?: Json
          content_instructions?: Json
          created_at?: string
          currency?: string
          font_family?: string
          font_secondary?: string | null
          language?: string
          logo_locked?: boolean
          logo_path?: string | null
          primary_color?: string
          secondary_color?: string
          show_brand_name?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_social_connections: {
        Row: {
          account_label: string
          business_id: string
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["social_platform"]
          status: Database["public"]["Enums"]["social_conn_status"]
          updated_at: string
        }
        Insert: {
          account_label?: string
          business_id: string
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["social_platform"]
          status?: Database["public"]["Enums"]["social_conn_status"]
          updated_at?: string
        }
        Update: {
          account_label?: string
          business_id?: string
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          status?: Database["public"]["Enums"]["social_conn_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_social_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_websites: {
        Row: {
          auto_mode: string
          business_id: string
          created_at: string
          default_template_id: string | null
          last_scanned_at: string | null
          platforms: string[]
          post_time: string
          scan_frequency: string
          timezone: string
          updated_at: string
          url: string
        }
        Insert: {
          auto_mode?: string
          business_id: string
          created_at?: string
          default_template_id?: string | null
          last_scanned_at?: string | null
          platforms?: string[]
          post_time?: string
          scan_frequency?: string
          timezone?: string
          updated_at?: string
          url?: string
        }
        Update: {
          auto_mode?: string
          business_id?: string
          created_at?: string
          default_template_id?: string | null
          last_scanned_at?: string | null
          platforms?: string[]
          post_time?: string
          scan_frequency?: string
          timezone?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_websites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_services: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          custom_type: string | null
          id: string
          name: string
          onboarded: boolean
          owner_id: string
          status: Database["public"]["Enums"]["business_status"]
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_type?: string | null
          id?: string
          name: string
          onboarded?: boolean
          owner_id: string
          status?: Database["public"]["Enums"]["business_status"]
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_type?: string | null
          id?: string
          name?: string
          onboarded?: boolean
          owner_id?: string
          status?: Database["public"]["Enums"]["business_status"]
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          business: string
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string
          name: string
        }
        Insert: {
          business?: string
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message?: string
          name: string
        }
        Update: {
          business?: string
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      custom_template_requests: {
        Row: {
          business_id: string
          created_at: string
          file_name: string
          file_path: string | null
          file_type: string | null
          id: string
          status: Database["public"]["Enums"]["template_request_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          file_name: string
          file_path?: string | null
          file_type?: string | null
          id?: string
          status?: Database["public"]["Enums"]["template_request_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          file_name?: string
          file_path?: string | null
          file_type?: string | null
          id?: string
          status?: Database["public"]["Enums"]["template_request_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_template_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_template_requests_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "custom_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_templates: {
        Row: {
          archived: boolean
          background_path: string | null
          business_id: string
          created_at: string
          engine: string
          id: string
          locked_design: boolean
          name: string
          requirements: string | null
          updated_at: string
          variant: Json
          zones: Json
        }
        Insert: {
          archived?: boolean
          background_path?: string | null
          business_id: string
          created_at?: string
          engine: string
          id?: string
          locked_design?: boolean
          name: string
          requirements?: string | null
          updated_at?: string
          variant?: Json
          zones?: Json
        }
        Update: {
          archived?: boolean
          background_path?: string | null
          business_id?: string
          created_at?: string
          engine?: string
          id?: string
          locked_design?: boolean
          name?: string
          requirements?: string | null
          updated_at?: string
          variant?: Json
          zones?: Json
        }
        Relationships: [
          {
            foreignKeyName: "custom_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      discovered_items: {
        Row: {
          business_id: string
          created_at: string
          currency: string
          description: string
          fingerprint: string
          id: string
          image_url: string | null
          post_id: string | null
          price: string
          source_url: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency?: string
          description?: string
          fingerprint: string
          id?: string
          image_url?: string | null
          post_id?: string | null
          price?: string
          source_url: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string
          description?: string
          fingerprint?: string
          id?: string
          image_url?: string | null
          post_id?: string | null
          price?: string
          source_url?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovered_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          adjustments: Json
          business_id: string
          caption: string
          content: Json
          created_at: string
          format: string
          id: string
          image_path: string | null
          render_path: string | null
          share_status: Json
          show_brand_name: boolean
          show_contact: boolean
          slides: Json
          template_id: string
          updated_at: string
        }
        Insert: {
          adjustments?: Json
          business_id: string
          caption?: string
          content?: Json
          created_at?: string
          format?: string
          id?: string
          image_path?: string | null
          render_path?: string | null
          share_status?: Json
          show_brand_name?: boolean
          show_contact?: boolean
          slides?: Json
          template_id: string
          updated_at?: string
        }
        Update: {
          adjustments?: Json
          business_id?: string
          caption?: string
          content?: Json
          created_at?: string
          format?: string
          id?: string
          image_path?: string | null
          render_path?: string | null
          share_status?: Json
          show_brand_name?: boolean
          show_contact?: boolean
          slides?: Json
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          business_id: string
          created_at: string
          failure_reason: string | null
          id: string
          note: string
          platform: Database["public"]["Enums"]["social_platform"]
          post_id: string
          published_at: string | null
          remote_post_id: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["schedule_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          note?: string
          platform: Database["public"]["Enums"]["social_platform"]
          post_id: string
          published_at?: string | null
          remote_post_id?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["schedule_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          note?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          post_id?: string
          published_at?: string | null
          remote_post_id?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_oauth_accounts: {
        Row: {
          access_token: string
          account_label: string
          business_id: string
          created_at: string
          expires_at: string | null
          external_id: string
          id: string
          platform: Database["public"]["Enums"]["social_platform"]
          refresh_token: string | null
          scopes: string
          updated_at: string
        }
        Insert: {
          access_token: string
          account_label?: string
          business_id: string
          created_at?: string
          expires_at?: string | null
          external_id?: string
          id?: string
          platform: Database["public"]["Enums"]["social_platform"]
          refresh_token?: string | null
          scopes?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_label?: string
          business_id?: string
          created_at?: string
          expires_at?: string | null
          external_id?: string
          id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          refresh_token?: string | null
          scopes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_oauth_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      template_favorites: {
        Row: {
          business_id: string
          created_at: string
          id: string
          template_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          template_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_favorites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_usage: {
        Row: {
          business_id: string
          created_at: string
          free_post_limit: number
          posts_created: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          free_post_limit?: number
          posts_created?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          free_post_limit?: number
          posts_created?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_usage_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_business: {
        Args: { _business_id: string; _monthly_price?: number }
        Returns: undefined
      }
      admin_set_plan: {
        Args: {
          _active: boolean
          _billing_cycle?: string
          _brand_limit?: number
          _monthly_price: number
          _user_id: string
        }
        Returns: undefined
      }
      claim_admin_role: { Args: never; Returns: boolean }
      create_brand: {
        Args: {
          _custom_type?: string
          _name: string
          _type: Database["public"]["Enums"]["business_type"]
        }
        Returns: string
      }
      create_my_business: {
        Args: {
          _custom_type?: string
          _name: string
          _type: Database["public"]["Enums"]["business_type"]
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_member: { Args: { _business_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      my_brand_limit: { Args: never; Returns: number }
      my_business_id: { Args: never; Returns: string }
      plan_defaults: {
        Args: { _monthly_price: number }
        Returns: {
          allow_carousel: boolean
          allow_video: boolean
          brand_limit: number
          partnership_posts_limit: number
        }[]
      }
      register_post_usage: {
        Args: { _business_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "business_user"
      business_status: "pending" | "approved" | "rejected" | "suspended"
      business_type:
        | "travel_agency"
        | "real_estate"
        | "car_dealership"
        | "restaurant"
        | "retail"
        | "other"
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
      plan_tier: "starter" | "growth" | "partnership" | "studio"
      schedule_status: "queued" | "cancelled" | "published" | "failed"
      social_conn_status:
        | "unavailable"
        | "not_connected"
        | "connected"
        | "ready"
        | "failed"
      social_platform:
        | "instagram"
        | "facebook"
        | "linkedin"
        | "tiktok"
        | "x"
        | "youtube"
      template_request_status: "processing" | "ready" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "business_user"],
      business_status: ["pending", "approved", "rejected", "suspended"],
      business_type: [
        "travel_agency",
        "real_estate",
        "car_dealership",
        "restaurant",
        "retail",
        "other",
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
      ],
      plan_tier: ["starter", "growth", "partnership", "studio"],
      schedule_status: ["queued", "cancelled", "published", "failed"],
      social_conn_status: [
        "unavailable",
        "not_connected",
        "connected",
        "ready",
        "failed",
      ],
      social_platform: [
        "instagram",
        "facebook",
        "linkedin",
        "tiktok",
        "x",
        "youtube",
      ],
      template_request_status: ["processing", "ready", "rejected"],
    },
  },
} as const
