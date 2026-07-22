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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action_type: string
          actor_codename: string
          actor_id: string | null
          created_at: string
          details: string
          id: string
          target_id: string | null
        }
        Insert: {
          action_type: string
          actor_codename: string
          actor_id?: string | null
          created_at?: string
          details: string
          id?: string
          target_id?: string | null
        }
        Update: {
          action_type?: string
          actor_codename?: string
          actor_id?: string | null
          created_at?: string
          details?: string
          id?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chuti: {
        Row: {
          adjust_short_leave: boolean
          adjusted_hour: string | null
          adjustment: boolean
          admin_edit_request: Json | null
          admin_edit_status: string
          bulk_id: string | null
          comment: string | null
          created_at: string | null
          date: string
          deleted_at: string | null
          id: string
          is_edited: boolean
          leave_hour: string | null
          leave_type: string
          reserve_adjustment_status: string
          reserve_holiday: string | null
          sign_in_time: string | null
          sign_out_time: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          adjust_short_leave?: boolean
          adjusted_hour?: string | null
          adjustment?: boolean
          admin_edit_request?: Json | null
          admin_edit_status?: string
          bulk_id?: string | null
          comment?: string | null
          created_at?: string | null
          date: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          leave_hour?: string | null
          leave_type: string
          reserve_adjustment_status?: string
          reserve_holiday?: string | null
          sign_in_time?: string | null
          sign_out_time?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          adjust_short_leave?: boolean
          adjusted_hour?: string | null
          adjustment?: boolean
          admin_edit_request?: Json | null
          admin_edit_status?: string
          bulk_id?: string | null
          comment?: string | null
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          leave_hour?: string | null
          leave_type?: string
          reserve_adjustment_status?: string
          reserve_holiday?: string | null
          sign_in_time?: string | null
          sign_out_time?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chuti_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rules: {
        Row: {
          category: string
          company_name: string | null
          company_tags: string[] | null
          content: string
          created_at: string
          extra_info: string | null
          id: string
          is_deleted: boolean
          sub_category: string
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          company_name?: string | null
          company_tags?: string[] | null
          content: string
          created_at?: string
          extra_info?: string | null
          id?: string
          is_deleted?: boolean
          sub_category: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          company_name?: string | null
          company_tags?: string[] | null
          content?: string
          created_at?: string
          extra_info?: string | null
          id?: string
          is_deleted?: boolean
          sub_category?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissed_notifications: {
        Row: {
          dismissed_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dismissed_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      govt_holiday_responses: {
        Row: {
          created_at: string | null
          holiday_date: string
          holiday_name: string
          id: string
          response: string
          updated_by_admin: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          holiday_date: string
          holiday_name: string
          id?: string
          response: string
          updated_by_admin?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          holiday_date?: string
          holiday_name?: string
          id?: string
          response?: string
          updated_by_admin?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "govt_holiday_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_assessments: {
        Row: {
          appraisee_sign_date: string | null
          appraisee_signed: boolean | null
          appraiser_name: string | null
          appraiser_sign_date: string | null
          appraiser_signed: boolean | null
          created_at: string
          date_of_joining: string | null
          department: string | null
          emp_id: string | null
          id: string
          kpis: Json
          month_year: string
          reviewer_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          appraisee_sign_date?: string | null
          appraisee_signed?: boolean | null
          appraiser_name?: string | null
          appraiser_sign_date?: string | null
          appraiser_signed?: boolean | null
          created_at?: string
          date_of_joining?: string | null
          department?: string | null
          emp_id?: string | null
          id?: string
          kpis?: Json
          month_year: string
          reviewer_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          appraisee_sign_date?: string | null
          appraisee_signed?: boolean | null
          appraiser_name?: string | null
          appraiser_sign_date?: string | null
          appraiser_signed?: boolean | null
          created_at?: string
          date_of_joining?: string | null
          department?: string | null
          emp_id?: string | null
          id?: string
          kpis?: Json
          month_year?: string
          reviewer_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_archive: {
        Row: {
          archived_at: string
          branch: string | null
          full_name: string | null
          id: string
          job_role: string | null
          quotes_count: number
          rank: number
          requotes_count: number
          reviews_count: number
          sales_count: number
          total_submitted: number
          user_id: string | null
          username: string
          year: number
        }
        Insert: {
          archived_at?: string
          branch?: string | null
          full_name?: string | null
          id?: string
          job_role?: string | null
          quotes_count?: number
          rank: number
          requotes_count?: number
          reviews_count?: number
          sales_count?: number
          total_submitted?: number
          user_id?: string | null
          username: string
          year: number
        }
        Update: {
          archived_at?: string
          branch?: string | null
          full_name?: string | null
          id?: string
          job_role?: string | null
          quotes_count?: number
          rank?: number
          requotes_count?: number
          reviews_count?: number
          sales_count?: number
          total_submitted?: number
          user_id?: string | null
          username?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_archive_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_settlements: {
        Row: {
          action_by: string | null
          action_type: string
          adjust_leave_days: number | null
          carry_forward_days: number | null
          created_at: string | null
          id: string
          leave_category: string
          payment_days: number | null
          period: string
          processed_at: string | null
          processed_by: string | null
          remaining_days: number
          status: string
          user_id: string
          year: string
        }
        Insert: {
          action_by?: string | null
          action_type: string
          adjust_leave_days?: number | null
          carry_forward_days?: number | null
          created_at?: string | null
          id?: string
          leave_category: string
          payment_days?: number | null
          period?: string
          processed_at?: string | null
          processed_by?: string | null
          remaining_days: number
          status?: string
          user_id: string
          year: string
        }
        Update: {
          action_by?: string | null
          action_type?: string
          adjust_leave_days?: number | null
          carry_forward_days?: number | null
          created_at?: string | null
          id?: string
          leave_category?: string
          payment_days?: number | null
          period?: string
          processed_at?: string | null
          processed_by?: string | null
          remaining_days?: number
          status?: string
          user_id?: string
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_settlements_action_by_fkey"
            columns: ["action_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_settlements_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_settlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_codes: {
        Row: {
          code: string
          login_id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          code: string
          login_id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          login_id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mobile_app_versions: {
        Row: {
          created_at: string | null
          id: number
          required: boolean | null
          version: string
          zip_url: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          required?: boolean | null
          version: string
          zip_url: string
        }
        Update: {
          created_at?: string | null
          id?: number
          required?: boolean | null
          version?: string
          zip_url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allow_overtime: boolean | null
          allow_reserve: boolean | null
          allowed_types: string[]
          break_time: number | null
          can_manage_rules: boolean
          converted_short_leaves_days: number | null
          converted_short_leaves_hours: number | null
          created_at: string
          default_sign_in: string | null
          default_sign_out: string | null
          delegated_kpi_supervisor_id: string | null
          delegated_leave_supervisor_id: string | null
          delegated_supervisor_id: string | null
          eligible_govt_holiday: boolean | null
          eligible_office_leave: boolean | null
          full_name: string | null
          global_settings: Json | null
          has_changed_password: boolean
          has_chuti_access: boolean | null
          has_edited_profile: boolean
          has_quotes_access: boolean | null
          id: string
          is_setup_completed: boolean | null
          job_role: string | null
          max_full_leaves: number | null
          max_short_leaves: number | null
          needs_supervisor_approval: boolean | null
          profile_change_status: string
          quotes_role: string | null
          requested_break_time: number | null
          requested_default_sign_in: string | null
          requested_default_sign_out: string | null
          requested_full_name: string | null
          requested_job_role: string | null
          requested_working_hours: number | null
          role: string
          supervisor_ids: string[] | null
          username: string
          username_changes: number
          username_request_status: string
          working_hours: number | null
        }
        Insert: {
          allow_overtime?: boolean | null
          allow_reserve?: boolean | null
          allowed_types?: string[]
          break_time?: number | null
          can_manage_rules?: boolean
          converted_short_leaves_days?: number | null
          converted_short_leaves_hours?: number | null
          created_at?: string
          default_sign_in?: string | null
          default_sign_out?: string | null
          delegated_kpi_supervisor_id?: string | null
          delegated_leave_supervisor_id?: string | null
          delegated_supervisor_id?: string | null
          eligible_govt_holiday?: boolean | null
          eligible_office_leave?: boolean | null
          full_name?: string | null
          global_settings?: Json | null
          has_changed_password?: boolean
          has_chuti_access?: boolean | null
          has_edited_profile?: boolean
          has_quotes_access?: boolean | null
          id: string
          is_setup_completed?: boolean | null
          job_role?: string | null
          max_full_leaves?: number | null
          max_short_leaves?: number | null
          needs_supervisor_approval?: boolean | null
          profile_change_status?: string
          quotes_role?: string | null
          requested_break_time?: number | null
          requested_default_sign_in?: string | null
          requested_default_sign_out?: string | null
          requested_full_name?: string | null
          requested_job_role?: string | null
          requested_working_hours?: number | null
          role?: string
          supervisor_ids?: string[] | null
          username: string
          username_changes?: number
          username_request_status?: string
          working_hours?: number | null
        }
        Update: {
          allow_overtime?: boolean | null
          allow_reserve?: boolean | null
          allowed_types?: string[]
          break_time?: number | null
          can_manage_rules?: boolean
          converted_short_leaves_days?: number | null
          converted_short_leaves_hours?: number | null
          created_at?: string
          default_sign_in?: string | null
          default_sign_out?: string | null
          delegated_kpi_supervisor_id?: string | null
          delegated_leave_supervisor_id?: string | null
          delegated_supervisor_id?: string | null
          eligible_govt_holiday?: boolean | null
          eligible_office_leave?: boolean | null
          full_name?: string | null
          global_settings?: Json | null
          has_changed_password?: boolean
          has_chuti_access?: boolean | null
          has_edited_profile?: boolean
          has_quotes_access?: boolean | null
          id?: string
          is_setup_completed?: boolean | null
          job_role?: string | null
          max_full_leaves?: number | null
          max_short_leaves?: number | null
          needs_supervisor_approval?: boolean | null
          profile_change_status?: string
          quotes_role?: string | null
          requested_break_time?: number | null
          requested_default_sign_in?: string | null
          requested_default_sign_out?: string | null
          requested_full_name?: string | null
          requested_job_role?: string | null
          requested_working_hours?: number | null
          role?: string
          supervisor_ids?: string[] | null
          username?: string
          username_changes?: number
          username_request_status?: string
          working_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_delegated_kpi_supervisor_id_fkey"
            columns: ["delegated_kpi_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_delegated_leave_supervisor_id_fkey"
            columns: ["delegated_leave_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_delegated_supervisor_id_fkey"
            columns: ["delegated_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          branch_name: string
          codename: string
          created_at: string
          file_name: string
          file_type: string
          id: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_name: string
          codename: string
          created_at?: string
          file_name: string
          file_type: string
          id?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_name?: string
          codename?: string
          created_at?: string
          file_name?: string
          file_type?: string
          id?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          codename: string
          comment: string | null
          created_at: string
          id: string
          is_all_time: boolean
          last_activity_at: string
          status: string
          task: string
          todo_date: string
          user_id: string
        }
        Insert: {
          codename: string
          comment?: string | null
          created_at?: string
          id?: string
          is_all_time?: boolean
          last_activity_at?: string
          status?: string
          task: string
          todo_date?: string
          user_id: string
        }
        Update: {
          codename?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_all_time?: boolean
          last_activity_at?: string
          status?: string
          task?: string
          todo_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_insert_chuti_records_bulk: {
        Args: {
          p_adjust_short_leave: boolean
          p_adjustments: boolean[]
          p_bulk_id?: string
          p_comment?: string
          p_dates: string[]
          p_leave_hour?: string
          p_leave_type: string
          p_reserve_holiday?: string
          p_sign_in_time?: string
          p_sign_out_time?: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_update_user_credentials: {
        Args: {
          p_new_password?: string
          p_new_username?: string
          p_user_id: string
        }
        Returns: undefined
      }
      archive_and_prune_old_records: {
        Args: { p_tz?: string }
        Returns: Json
      }
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      create_new_user: {
        Args: {
          p_allow_overtime?: boolean
          p_allow_reserve?: boolean
          p_email: string
          p_full_name: string
          p_needs_supervisor_approval?: boolean
          p_password: string
          p_role: string
          p_supervisor_ids?: string[]
          p_username: string
        }
        Returns: string
      }
      delete_user_by_id: { Args: { p_user_id: string }; Returns: undefined }
      get_leaderboard_data: {
        Args: {
          p_month: string
          p_period: string
          p_today: string
          p_tz?: string
          p_year: string
        }
        Returns: {
          badge: Json
          branch: string
          earliest_achievement_timestamp: string
          full_name: string
          job_role: string
          months_count: number
          overall_score: number
          quotes_count: number
          rank: number
          requotes_count: number
          reviews_count: number
          role: string
          sales_count: number
          todays_count: number
          total_submitted: number
          user_id: string
          username: string
        }[]
      }
      get_user_email_by_username: {
        Args: { p_username: string }
        Returns: string
      }
      has_kpi_access: {
        Args: { employee_id: string; supervisor_id: string }
        Returns: boolean
      }
      has_leave_access: {
        Args: { employee_id: string; supervisor_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_supervisor: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      is_supervisor: { Args: never; Returns: boolean }
      is_supervisor_of: {
        Args: { employee_id: string; supervisor_id: string }
        Returns: boolean
      }
      is_user_in_top_5_for_month: {
        Args: { p_month: number; p_user_id: string; p_year: number }
        Returns: boolean
      }
      set_sanitizer_words: { Args: { p_words: string[] }; Returns: undefined }
      sync_top_performer_badges: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
