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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          date: string
          goal_met: boolean
          id: string
          minutes_watched: number | null
          user_id: string
          videos_watched: number | null
          words_learned: number | null
          words_reviewed: number
        }
        Insert: {
          created_at?: string
          date?: string
          goal_met?: boolean
          id?: string
          minutes_watched?: number | null
          user_id: string
          videos_watched?: number | null
          words_learned?: number | null
          words_reviewed?: number
        }
        Update: {
          created_at?: string
          date?: string
          goal_met?: boolean
          id?: string
          minutes_watched?: number | null
          user_id?: string
          videos_watched?: number | null
          words_learned?: number | null
          words_reviewed?: number
        }
        Relationships: []
      }
      catalog_row_films: {
        Row: {
          created_at: string
          film_id: string
          id: string
          row_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          film_id: string
          id?: string
          row_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          film_id?: string
          id?: string
          row_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_row_films_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_row_films_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "catalog_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_rows: {
        Row: {
          created_at: string
          id: string
          language: string | null
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      core_vocabulary: {
        Row: {
          audio_url: string | null
          created_at: string
          example_en: string | null
          example_fr: string | null
          frequency_weight: number
          id: string
          image_url: string | null
          language: string
          lemma: string
          pos: string | null
          rank: number
          topic: string | null
          translation: string
          updated_at: string
          word: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          example_en?: string | null
          example_fr?: string | null
          frequency_weight?: number
          id?: string
          image_url?: string | null
          language?: string
          lemma: string
          pos?: string | null
          rank: number
          topic?: string | null
          translation: string
          updated_at?: string
          word: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          example_en?: string | null
          example_fr?: string | null
          frequency_weight?: number
          id?: string
          image_url?: string | null
          language?: string
          lemma?: string
          pos?: string | null
          rank?: number
          topic?: string | null
          translation?: string
          updated_at?: string
          word?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_signups: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      films: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_public: boolean
          language: string | null
          thumbnail_url: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean
          language?: string | null
          thumbnail_url?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean
          language?: string | null
          thumbnail_url?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      friend_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      friendship_events: {
        Row: {
          actor_id: string
          created_at: string
          email_sent_at: string | null
          id: string
          kind: string
          recipient_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          email_sent_at?: string | null
          id?: string
          kind: string
          recipient_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          email_sent_at?: string | null
          id?: string
          kind?: string
          recipient_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cef_level: string | null
          created_at: string
          daily_video_goal: number
          daily_word_goal: number
          discoverable_by_search: boolean
          display_name: string | null
          email_prefs: Json
          friend_code: string | null
          id: string
          is_pro: boolean
          is_public: boolean
          language_switches_used: number
          last_friend_email_at: string | null
          last_monthly_email_at: string | null
          last_review_email_at: string | null
          last_streak_date: string | null
          last_streak_rescue_email_at: string | null
          last_video_id: string | null
          last_weekly_email_at: string | null
          learning_goal: string | null
          learning_language: string | null
          native_language: string | null
          onboarded: boolean
          review_emails_week_count: number
          review_emails_week_start: string | null
          school: string | null
          show_daily_briefing: boolean
          show_on_global_leaderboard: boolean
          streak_count: number
          streak_rescue_for_streak: number | null
          updated_at: string
          user_id: string
          username: string | null
          video_credit_date: string | null
          video_credit_remaining: number
          xp_level: number
          xp_total: number
        }
        Insert: {
          avatar_url?: string | null
          cef_level?: string | null
          created_at?: string
          daily_video_goal?: number
          daily_word_goal?: number
          discoverable_by_search?: boolean
          display_name?: string | null
          email_prefs?: Json
          friend_code?: string | null
          id?: string
          is_pro?: boolean
          is_public?: boolean
          language_switches_used?: number
          last_friend_email_at?: string | null
          last_monthly_email_at?: string | null
          last_review_email_at?: string | null
          last_streak_date?: string | null
          last_streak_rescue_email_at?: string | null
          last_video_id?: string | null
          last_weekly_email_at?: string | null
          learning_goal?: string | null
          learning_language?: string | null
          native_language?: string | null
          onboarded?: boolean
          review_emails_week_count?: number
          review_emails_week_start?: string | null
          school?: string | null
          show_daily_briefing?: boolean
          show_on_global_leaderboard?: boolean
          streak_count?: number
          streak_rescue_for_streak?: number | null
          updated_at?: string
          user_id: string
          username?: string | null
          video_credit_date?: string | null
          video_credit_remaining?: number
          xp_level?: number
          xp_total?: number
        }
        Update: {
          avatar_url?: string | null
          cef_level?: string | null
          created_at?: string
          daily_video_goal?: number
          daily_word_goal?: number
          discoverable_by_search?: boolean
          display_name?: string | null
          email_prefs?: Json
          friend_code?: string | null
          id?: string
          is_pro?: boolean
          is_public?: boolean
          language_switches_used?: number
          last_friend_email_at?: string | null
          last_monthly_email_at?: string | null
          last_review_email_at?: string | null
          last_streak_date?: string | null
          last_streak_rescue_email_at?: string | null
          last_video_id?: string | null
          last_weekly_email_at?: string | null
          learning_goal?: string | null
          learning_language?: string | null
          native_language?: string | null
          onboarded?: boolean
          review_emails_week_count?: number
          review_emails_week_start?: string | null
          school?: string | null
          show_daily_briefing?: boolean
          show_on_global_leaderboard?: boolean
          streak_count?: number
          streak_rescue_for_streak?: number | null
          updated_at?: string
          user_id?: string
          username?: string | null
          video_credit_date?: string | null
          video_credit_remaining?: number
          xp_level?: number
          xp_total?: number
        }
        Relationships: []
      }
      saved_words: {
        Row: {
          context: string | null
          created_at: string
          ease_factor: number
          film_id: string | null
          id: string
          interval_days: number
          ipa: string
          language: string
          next_review: string
          pronunciation: string
          review_count: number
          state: string
          state_changed_at: string | null
          times_correct: number
          translation: string
          user_id: string
          word: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          ease_factor?: number
          film_id?: string | null
          id?: string
          interval_days?: number
          ipa?: string
          language?: string
          next_review?: string
          pronunciation?: string
          review_count?: number
          state?: string
          state_changed_at?: string | null
          times_correct?: number
          translation?: string
          user_id: string
          word: string
        }
        Update: {
          context?: string | null
          created_at?: string
          ease_factor?: number
          film_id?: string | null
          id?: string
          interval_days?: number
          ipa?: string
          language?: string
          next_review?: string
          pronunciation?: string
          review_count?: number
          state?: string
          state_changed_at?: string | null
          times_correct?: number
          translation?: string
          user_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_words_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      starter_deck_cards: {
        Row: {
          created_at: string
          deck_id: string
          id: string
          ipa: string
          position: number
          reading: string
          translation: string
          word: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          id?: string
          ipa?: string
          position?: number
          reading?: string
          translation: string
          word: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          id?: string
          ipa?: string
          position?: number
          reading?: string
          translation?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "starter_deck_cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "starter_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      starter_decks: {
        Row: {
          created_at: string
          description: string
          emoji: string
          id: string
          language: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          language: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          language?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      subtitles: {
        Row: {
          created_at: string
          end_time: number
          film_id: string
          id: string
          language: string
          sort_order: number
          start_time: number
          text: string
          translation: string | null
        }
        Insert: {
          created_at?: string
          end_time: number
          film_id: string
          id?: string
          language?: string
          sort_order?: number
          start_time: number
          text: string
          translation?: string | null
        }
        Update: {
          created_at?: string
          end_time?: number
          film_id?: string
          id?: string
          language?: string
          sort_order?: number
          start_time?: number
          text?: string
          translation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtitles_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_lessons: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          last_watched_at: string | null
          original_language: string | null
          progress_percent: number | null
          thumbnail_url: string | null
          title: string
          user_id: string
          youtube_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_watched_at?: string | null
          original_language?: string | null
          progress_percent?: number | null
          thumbnail_url?: string | null
          title: string
          user_id: string
          youtube_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_watched_at?: string | null
          original_language?: string | null
          progress_percent?: number | null
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          youtube_id?: string
        }
        Relationships: []
      }
      user_vocabulary_state: {
        Row: {
          created_at: string
          first_seen_at: string
          id: string
          promoted_at: string | null
          state: Database["public"]["Enums"]["vocab_state"]
          times_correct: number
          times_seen: number
          updated_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          created_at?: string
          first_seen_at?: string
          id?: string
          promoted_at?: string | null
          state?: Database["public"]["Enums"]["vocab_state"]
          times_correct?: number
          times_seen?: number
          updated_at?: string
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: string
          first_seen_at?: string
          id?: string
          promoted_at?: string | null
          state?: Database["public"]["Enums"]["vocab_state"]
          times_correct?: number
          times_seen?: number
          updated_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_vocabulary_state_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "core_vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          action: string
          amount: number
          created_at: string
          id: string
          meta: Json | null
          user_id: string
        }
        Insert: {
          action: string
          amount: number
          created_at?: string
          id?: string
          meta?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          amount?: number
          created_at?: string
          id?: string
          meta?: Json | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_request: { Args: { _other: string }; Returns: boolean }
      add_friend_by_code: { Args: { _code: string }; Returns: string }
      add_friend_by_user_id: { Args: { _target: string }; Returns: string }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      gen_friend_code: { Args: never; Returns: string }
      get_friends_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          is_self: boolean
          streak_count: number
          user_id: string
          username: string
          xp_level: number
          xp_total: number
        }[]
      }
      get_global_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          is_self: boolean
          user_id: string
          username: string
          xp_level: number
          xp_total: number
        }[]
      }
      get_unread_message_count: { Args: never; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      safe_display_name: {
        Args: { _display: string; _user_id: string; _username: string }
        Returns: string
      }
      set_username: { Args: { _username: string }; Returns: string }
      update_email_prefs: { Args: { _prefs: Json }; Returns: Json }
      update_privacy_settings: {
        Args: { _discoverable: boolean; _show_on_leaderboard: boolean }
        Returns: undefined
      }
    }
    Enums: {
      vocab_state: "red" | "orange" | "green"
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
      vocab_state: ["red", "orange", "green"],
    },
  },
} as const
