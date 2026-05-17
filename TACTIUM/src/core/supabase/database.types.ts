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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      availability: {
        Row: {
          available: boolean
          id: string
          matchday_id: string
          note: string | null
          player_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          available?: boolean
          id?: string
          matchday_id: string
          note?: string | null
          player_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          available?: boolean
          id?: string
          matchday_id?: string
          note?: string | null
          player_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          federation: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          federation?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          federation?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      lineup_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          matchday_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          matchday_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          matchday_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_variants_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          court_number: number
          created_at: string
          id: string
          matchday_id: string
          player_a_id: string | null
          player_b_id: string | null
          updated_at: string
          variant_id: string
        }
        Insert: {
          court_number: number
          created_at?: string
          id?: string
          matchday_id: string
          player_a_id?: string | null
          player_b_id?: string | null
          updated_at?: string
          variant_id: string
        }
        Update: {
          court_number?: number
          created_at?: string
          id?: string
          matchday_id?: string
          player_a_id?: string | null
          player_b_id?: string | null
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_a_id_fkey"
            columns: ["player_a_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_b_id_fkey"
            columns: ["player_b_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "lineup_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          court_number: number
          created_at: string
          forfeit: boolean
          id: string
          matchday_id: string
          set_number: number
          them: number | null
          updated_at: string
          us: number | null
        }
        Insert: {
          court_number: number
          created_at?: string
          forfeit?: boolean
          id?: string
          matchday_id: string
          set_number: number
          them?: number | null
          updated_at?: string
          us?: number | null
        }
        Update: {
          court_number?: number
          created_at?: string
          forfeit?: boolean
          id?: string
          matchday_id?: string
          set_number?: number
          them?: number | null
          updated_at?: string
          us?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_results_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
        ]
      }
      matchdays: {
        Row: {
          created_at: string
          id: string
          is_home: boolean
          jornada_number: number
          location: string | null
          match_date: string | null
          match_time: string | null
          notes: string | null
          opponent: string
          outcome: Database["public"]["Enums"]["match_outcome"] | null
          score_against: number | null
          score_for: number | null
          season_id: string
          status: Database["public"]["Enums"]["matchday_status"]
          tanda: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_home?: boolean
          jornada_number: number
          location?: string | null
          match_date?: string | null
          match_time?: string | null
          notes?: string | null
          opponent: string
          outcome?: Database["public"]["Enums"]["match_outcome"] | null
          score_against?: number | null
          score_for?: number | null
          season_id: string
          status?: Database["public"]["Enums"]["matchday_status"]
          tanda?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_home?: boolean
          jornada_number?: number
          location?: string | null
          match_date?: string | null
          match_time?: string | null
          notes?: string | null
          opponent?: string
          outcome?: Database["public"]["Enums"]["match_outcome"] | null
          score_against?: number | null
          score_for?: number | null
          season_id?: string
          status?: Database["public"]["Enums"]["matchday_status"]
          tanda?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchdays_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean
          available: boolean
          created_at: string
          id: string
          name: string
          position: Database["public"]["Enums"]["player_position"]
          pts: number
          team_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          available?: boolean
          created_at?: string
          id?: string
          name: string
          position?: Database["public"]["Enums"]["player_position"]
          pts?: number
          team_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          available?: boolean
          created_at?: string
          id?: string
          name?: string
          position?: Database["public"]["Enums"]["player_position"]
          pts?: number
          team_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          notifications_enabled: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          notifications_enabled?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notifications_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          phase: Database["public"]["Enums"]["season_phase"]
          start_date: string | null
          team_id: string
          total_matchdays: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          phase?: Database["public"]["Enums"]["season_phase"]
          start_date?: string | null
          team_id: string
          total_matchdays?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          phase?: Database["public"]["Enums"]["season_phase"]
          start_date?: string | null
          team_id?: string
          total_matchdays?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          subscription_id: string | null
        }
        Insert: {
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          received_at?: string
          subscription_id?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_period: Database["public"]["Enums"]["subscription_billing_period"]
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string | null
          id: string
          original_transaction_id: string
          payer_user_id: string
          plan_tier: Database["public"]["Enums"]["subscription_plan_tier"]
          platform: Database["public"]["Enums"]["subscription_platform"]
          product_id: string
          revenuecat_customer_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["subscription_subject_type"]
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          billing_period: Database["public"]["Enums"]["subscription_billing_period"]
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end: string
          current_period_start?: string | null
          id?: string
          original_transaction_id: string
          payer_user_id: string
          plan_tier: Database["public"]["Enums"]["subscription_plan_tier"]
          platform: Database["public"]["Enums"]["subscription_platform"]
          product_id: string
          revenuecat_customer_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["subscription_subject_type"]
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          billing_period?: Database["public"]["Enums"]["subscription_billing_period"]
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string | null
          id?: string
          original_transaction_id?: string
          payer_user_id?: string
          plan_tier?: Database["public"]["Enums"]["subscription_plan_tier"]
          platform?: Database["public"]["Enums"]["subscription_platform"]
          product_id?: string
          revenuecat_customer_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["subscription_subject_type"]
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          category: string | null
          club_id: string | null
          created_at: string
          federation: string | null
          gender: Database["public"]["Enums"]["team_gender"]
          group_name: string | null
          id: string
          league: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          club_id?: string | null
          created_at?: string
          federation?: string | null
          gender?: Database["public"]["Enums"]["team_gender"]
          group_name?: string | null
          id?: string
          league?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          club_id?: string | null
          created_at?: string
          federation?: string | null
          gender?: Database["public"]["Enums"]["team_gender"]
          group_name?: string | null
          id?: string
          league?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          accepts_privacy: boolean
          created_at: string
          email: string
          id: string
          locale: string | null
          referrer: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          accepts_privacy?: boolean
          created_at?: string
          email: string
          id?: string
          locale?: string | null
          referrer?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          accepts_privacy?: boolean
          created_at?: string
          email?: string
          id?: string
          locale?: string | null
          referrer?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      lineup_pairs: {
        Row: {
          court_number: number | null
          created_at: string | null
          id: string | null
          matchday_id: string | null
          pair_points: number | null
          player_a_id: string | null
          player_a_name: string | null
          player_a_pts: number | null
          player_b_id: string | null
          player_b_name: string | null
          player_b_pts: number | null
          updated_at: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lineups_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_a_id_fkey"
            columns: ["player_a_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_b_id_fkey"
            columns: ["player_b_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "lineup_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      captain_unclaim_player: {
        Args: { p_player_id: string }
        Returns: {
          active: boolean
          available: boolean
          created_at: string
          id: string
          name: string
          position: Database["public"]["Enums"]["player_position"]
          pts: number
          team_id: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_player: {
        Args: { p_player_id: string }
        Returns: {
          active: boolean
          available: boolean
          created_at: string
          id: string
          name: string
          position: Database["public"]["Enums"]["player_position"]
          pts: number
          team_id: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clone_lineup_variant_pairs: {
        Args: { p_source_variant_id: string; p_target_variant_id: string }
        Returns: undefined
      }
      close_matchday: {
        Args: { target_matchday: string }
        Returns: {
          created_at: string
          id: string
          is_home: boolean
          jornada_number: number
          location: string | null
          match_date: string | null
          match_time: string | null
          notes: string | null
          opponent: string
          outcome: Database["public"]["Enums"]["match_outcome"] | null
          score_against: number | null
          score_for: number | null
          season_id: string
          status: Database["public"]["Enums"]["matchday_status"]
          tanda: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "matchdays"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_team_invitation: {
        Args: {
          target_role?: Database["public"]["Enums"]["team_role"]
          target_team: string
        }
        Returns: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          used_at: string | null
          used_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "team_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_has_premium_access: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      fn_start_trial_for_subject: {
        Args: {
          p_payer_user_id: string
          p_plan_tier: Database["public"]["Enums"]["subscription_plan_tier"]
          p_subject_id: string
          p_subject_type: Database["public"]["Enums"]["subscription_subject_type"]
        }
        Returns: undefined
      }
      list_unclaimed_players: {
        Args: { p_team_id: string }
        Returns: {
          active: boolean
          available: boolean
          created_at: string
          id: string
          name: string
          position: Database["public"]["Enums"]["player_position"]
          pts: number
          team_id: string
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      redeem_team_invitation: {
        Args: { invitation_code: string }
        Returns: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          used_at: string | null
          used_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "team_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      renumber_season_matchdays: {
        Args: { target_season: string }
        Returns: undefined
      }
      set_active_lineup_variant: {
        Args: { p_variant_id: string }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          matchday_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lineup_variants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_player_self_availability: {
        Args: { p_available: boolean; p_player_id: string }
        Returns: {
          active: boolean
          available: boolean
          created_at: string
          id: string
          name: string
          position: Database["public"]["Enums"]["player_position"]
          pts: number
          team_id: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unclaim_player: {
        Args: { p_player_id: string }
        Returns: {
          active: boolean
          available: boolean
          created_at: string
          id: string
          name: string
          position: Database["public"]["Enums"]["player_position"]
          pts: number
          team_id: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      whoami: { Args: never; Returns: Json }
    }
    Enums: {
      club_role: "admin"
      match_outcome: "win" | "draw" | "loss"
      matchday_status: "upcoming" | "in_progress" | "finished"
      player_position: "Drive" | "Revés" | "Ambos"
      season_phase: "liga" | "playoff" | "mixto"
      subscription_billing_period: "monthly" | "yearly"
      subscription_plan_tier:
        | "captain"
        | "club_starter"
        | "club_pro"
        | "club_elite"
      subscription_platform: "ios" | "android" | "web"
      subscription_status:
        | "trialing"
        | "active"
        | "grace_period"
        | "canceled"
        | "expired"
      subscription_subject_type: "user" | "club"
      team_gender: "masculino" | "femenino" | "mixto"
      team_role: "captain" | "admin" | "player"
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
      club_role: ["admin"],
      match_outcome: ["win", "draw", "loss"],
      matchday_status: ["upcoming", "in_progress", "finished"],
      player_position: ["Drive", "Revés", "Ambos"],
      season_phase: ["liga", "playoff", "mixto"],
      subscription_billing_period: ["monthly", "yearly"],
      subscription_plan_tier: [
        "captain",
        "club_starter",
        "club_pro",
        "club_elite",
      ],
      subscription_platform: ["ios", "android", "web"],
      subscription_status: [
        "trialing",
        "active",
        "grace_period",
        "canceled",
        "expired",
      ],
      subscription_subject_type: ["user", "club"],
      team_gender: ["masculino", "femenino", "mixto"],
      team_role: ["captain", "admin", "player"],
    },
  },
} as const
