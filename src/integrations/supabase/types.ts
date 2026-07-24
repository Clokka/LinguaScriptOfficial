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
      comprehension_snapshots: {
        Row: {
          created_at: string
          green_count: number
          id: string
          language: string
          orange_count: number
          red_count: number
          score: number
          title: string | null
          total_words: number
          unique_words: number
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          green_count?: number
          id?: string
          language: string
          orange_count?: number
          red_count?: number
          score: number
          title?: string | null
          total_words?: number
          unique_words?: number
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          green_count?: number
          id?: string
          language?: string
          orange_count?: number
          red_count?: number
          score?: number
          title?: string | null
          total_words?: number
          unique_words?: number
          user_id?: string
          video_id?: string
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
          category: string | null
          cefr_level: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: number | null
          duration_seconds: number | null
          id: string
          is_public: boolean
          language: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          url: string
        }
        Insert: {
          category?: string | null
          cefr_level?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: number | null
          duration_seconds?: number | null
          id?: string
          is_public?: boolean
          language?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          url: string
        }
        Update: {
          category?: string | null
          cefr_level?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: number | null
          duration_seconds?: number | null
          id?: string
          is_public?: boolean
          language?: string | null
          tags?: string[] | null
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
      linguascripts: {
        Row: {
          attempts: number | null
          audio_url: string | null
          combo_multiplier: number | null
          completed_at: string | null
          correct: boolean | null
          created_at: string | null
          gap_answer: string | null
          gap_options: Json | null
          gap_position: number | null
          id: string
          interest: string | null
          language: string
          mcq_answer: number | null
          mcq_options: Json | null
          saved_word_id: string | null
          scheduled_to_srs: boolean | null
          sentence: string
          speaking_answer: string | null
          status: string | null
          target_word: string
          time_spent_ms: number | null
          translation: string
          updated_at: string | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          attempts?: number | null
          audio_url?: string | null
          combo_multiplier?: number | null
          completed_at?: string | null
          correct?: boolean | null
          created_at?: string | null
          gap_answer?: string | null
          gap_options?: Json | null
          gap_position?: number | null
          id?: string
          interest?: string | null
          language?: string
          mcq_answer?: number | null
          mcq_options?: Json | null
          saved_word_id?: string | null
          scheduled_to_srs?: boolean | null
          sentence: string
          speaking_answer?: string | null
          status?: string | null
          target_word: string
          time_spent_ms?: number | null
          translation: string
          updated_at?: string | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          attempts?: number | null
          audio_url?: string | null
          combo_multiplier?: number | null
          completed_at?: string | null
          correct?: boolean | null
          created_at?: string | null
          gap_answer?: string | null
          gap_options?: Json | null
          gap_position?: number | null
          id?: string
          interest?: string | null
          language?: string
          mcq_answer?: number | null
          mcq_options?: Json | null
          saved_word_id?: string | null
          scheduled_to_srs?: boolean | null
          sentence?: string
          speaking_answer?: string | null
          status?: string | null
          target_word?: string
          time_spent_ms?: number | null
          translation?: string
          updated_at?: string | null
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "linguascripts_saved_word_id_fkey"
            columns: ["saved_word_id"]
            isOneToOne: false
            referencedRelation: "saved_words"
            referencedColumns: ["id"]
          },
        ]
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
          interests: string[]
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
          pro_expires_at: string | null
          pro_granted_at: string | null
          pro_granted_by: string | null
          pro_source: string
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
          watch_progress: Json
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
          interests?: string[]
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
          pro_expires_at?: string | null
          pro_granted_at?: string | null
          pro_granted_by?: string | null
          pro_source?: string
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
          watch_progress?: Json
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
          interests?: string[]
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
          pro_expires_at?: string | null
          pro_granted_at?: string | null
          pro_granted_by?: string | null
          pro_source?: string
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
          watch_progress?: Json
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
          is_phrase: boolean
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
          is_phrase?: boolean
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
          is_phrase?: boolean
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
      school_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          member_role: string
          school_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          member_role?: string
          school_id: string
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          member_role?: string
          school_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_invites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_members: {
        Row: {
          id: string
          joined_at: string
          member_role: string
          school_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          member_role: string
          school_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          member_role?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string | null
          product_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
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
      video_comprehension: {
        Row: {
          best_score: number | null
          content_id: string
          content_type: string
          created_at: string
          first_score: number
          first_watched_at: string
          green_count: number
          id: string
          language: string
          last_watched_at: string
          latest_score: number
          orange_count: number
          red_count: number
          total_minutes: number
          total_tokens: number
          updated_at: string
          user_id: string
          watch_count: number
        }
        Insert: {
          best_score?: number | null
          content_id: string
          content_type: string
          created_at?: string
          first_score: number
          first_watched_at?: string
          green_count?: number
          id?: string
          language: string
          last_watched_at?: string
          latest_score: number
          orange_count?: number
          red_count?: number
          total_minutes?: number
          total_tokens?: number
          updated_at?: string
          user_id: string
          watch_count?: number
        }
        Update: {
          best_score?: number | null
          content_id?: string
          content_type?: string
          created_at?: string
          first_score?: number
          first_watched_at?: string
          green_count?: number
          id?: string
          language?: string
          last_watched_at?: string
          latest_score?: number
          orange_count?: number
          red_count?: number
          total_minutes?: number
          total_tokens?: number
          updated_at?: string
          user_id?: string
          watch_count?: number
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          completion_pct: number
          created_at: string
          duration_seconds: number
          film_id: string | null
          id: string
          language: string | null
          position_seconds: number
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          video_id: string
          watched_at: string
        }
        Insert: {
          completion_pct?: number
          created_at?: string
          duration_seconds?: number
          film_id?: string | null
          id?: string
          language?: string | null
          position_seconds?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          video_id: string
          watched_at?: string
        }
        Update: {
          completion_pct?: number
          created_at?: string
          duration_seconds?: number
          film_id?: string | null
          id?: string
          language?: string | null
          position_seconds?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          video_id?: string
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_sessions: {
        Row: {
          completion_pct: number
          comprehension_pct: number
          created_at: string
          delta: number
          duration_watched_seconds: number
          film_id: string
          green_count: number
          id: string
          language: string
          orange_count: number
          prev_comprehension_pct: number | null
          red_count: number
          total_tokens: number
          user_id: string
          watch_number: number
          watched_at: string
        }
        Insert: {
          completion_pct?: number
          comprehension_pct: number
          created_at?: string
          delta?: number
          duration_watched_seconds?: number
          film_id: string
          green_count?: number
          id?: string
          language: string
          orange_count?: number
          prev_comprehension_pct?: number | null
          red_count?: number
          total_tokens?: number
          user_id: string
          watch_number: number
          watched_at?: string
        }
        Update: {
          completion_pct?: number
          comprehension_pct?: number
          created_at?: string
          delta?: number
          duration_watched_seconds?: number
          film_id?: string
          green_count?: number
          id?: string
          language?: string
          orange_count?: number
          prev_comprehension_pct?: number | null
          red_count?: number
          total_tokens?: number
          user_id?: string
          watch_number?: number
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_sessions_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
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
      accept_school_invite: { Args: { _token: string }; Returns: string }
      add_friend_by_code: { Args: { _code: string }; Returns: string }
      add_friend_by_user_id: { Args: { _target: string }; Returns: string }
      admin_grant_pro: {
        Args: { _days?: number; _user_id: string }
        Returns: boolean
      }
      admin_list_pro_users: {
        Args: never
        Returns: {
          display_name: string
          email: string
          pro_expires_at: string
          pro_granted_at: string
          pro_source: string
          user_id: string
          username: string
        }[]
      }
      admin_revoke_pro: { Args: { _user_id: string }; Returns: boolean }
      admin_search_users: {
        Args: { _q: string }
        Returns: {
          display_name: string
          email: string
          is_pro: boolean
          pro_expires_at: string
          pro_source: string
          user_id: string
          username: string
        }[]
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      bulk_invite_students: {
        Args: { _emails: string[]; _school_id: string }
        Returns: number
      }
      create_daily_linguascript: {
        Args: {
          p_gap_options: Json
          p_gap_position: number
          p_interest: string
          p_language: string
          p_mcq_options: Json
          p_sentence: string
          p_target_word: string
          p_translation: string
          p_user_id: string
        }
        Returns: string
      }
      create_linguascript_from_saved_word: {
        Args: {
          p_context: string
          p_gap_options: Json
          p_language: string
          p_mcq_options: Json
          p_saved_word_id: string
          p_translation: string
          p_user_id: string
          p_word: string
        }
        Returns: string
      }
      create_school: { Args: { _name: string; _slug: string }; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      gen_friend_code: { Args: never; Returns: string }
      get_daily_linguascripts: {
        Args: { p_language: string; p_user_id: string }
        Returns: {
          attempts: number
          audio_url: string
          combo_multiplier: number
          completed_at: string
          correct: boolean
          created_at: string
          gap_answer: string
          gap_options: Json
          gap_position: number
          id: string
          interest: string
          language: string
          mcq_answer: number
          mcq_options: Json
          scheduled_to_srs: boolean
          sentence: string
          speaking_answer: string
          status: string
          target_word: string
          time_spent_ms: number
          translation: string
          user_id: string
          xp_earned: number
        }[]
      }
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
      get_words_needing_review: {
        Args: { p_language: string; p_limit?: number; p_user_id: string }
        Returns: {
          context: string
          id: string
          next_review: string
          review_count: number
          state: string
          times_correct: number
          translation: string
          word: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_school_staff: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      list_school_students: {
        Args: { _school_id: string }
        Returns: {
          display_name: string
          email: string
          joined_at: string
          minutes_watched: number
          streak_count: number
          user_id: string
          words_known: number
          xp_level: number
          xp_total: number
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_schools: {
        Args: never
        Returns: {
          member_role: string
          name: string
          school_id: string
          slug: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_watch_session: {
        Args: {
          _completion_pct?: number
          _comprehension: number
          _duration_seconds?: number
          _film_id: string
          _green: number
          _language: string
          _orange: number
          _red: number
          _total_tokens: number
        }
        Returns: {
          best_pct: number
          delta: number
          first_pct: number
          new_pct: number
          prev_pct: number
          watch_number: number
        }[]
      }
      safe_display_name: {
        Args: { _display: string; _user_id: string; _username: string }
        Returns: string
      }
      schedule_linguascript_to_srs: {
        Args: { p_linguascript_id: string; p_user_id: string }
        Returns: undefined
      }
      seed_known_vocabulary: {
        Args: { _language: string; _level: string }
        Returns: number
      }
      set_username: { Args: { _username: string }; Returns: string }
      update_email_prefs: { Args: { _prefs: Json }; Returns: Json }
      update_privacy_settings: {
        Args: { _discoverable: boolean; _show_on_leaderboard: boolean }
        Returns: undefined
      }
      update_srs_after_linguascript: {
        Args: {
          p_correct: boolean
          p_linguascript_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      user_learning_rate: { Args: { _language: string }; Returns: number }
      user_progress_stats: {
        Args: never
        Returns: {
          avg_comprehension: number
          avg_gain_per_watch: number
          highest_comprehension: number
          total_minutes: number
          videos_in_progress: number
          videos_mastered: number
          vocab_learned: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "teacher" | "student"
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
      app_role: ["admin", "user", "teacher", "student"],
      vocab_state: ["red", "orange", "green"],
    },
  },
} as const
