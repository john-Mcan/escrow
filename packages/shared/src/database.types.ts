export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      disputes_evidence: {
        Row: {
          attachment_url: string | null
          comment: string
          created_at: string
          escrow_id: string
          id: string
          milestone_id: string
          submitted_by: string
        }
        Insert: {
          attachment_url?: string | null
          comment: string
          created_at?: string
          escrow_id: string
          id?: string
          milestone_id: string
          submitted_by: string
        }
        Update: {
          attachment_url?: string | null
          comment?: string
          created_at?: string
          escrow_id?: string
          id?: string
          milestone_id?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_evidence_escrow_id_fkey"
            columns: ["escrow_id"]
            isOneToOne: false
            referencedRelation: "escrows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_evidence_milestone_fkey"
            columns: ["milestone_id", "escrow_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id", "escrow_id"]
          },
          {
            foreignKeyName: "disputes_evidence_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_activity_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["escrow_action_type"]
          actor_address: string | null
          created_at: string
          escrow_id: string
          id: number
          log_index: number | null
          metadata: Json
          milestone_id: string | null
          tx_hash: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["escrow_action_type"]
          actor_address?: string | null
          created_at?: string
          escrow_id: string
          id?: never
          log_index?: number | null
          metadata?: Json
          milestone_id?: string | null
          tx_hash?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["escrow_action_type"]
          actor_address?: string | null
          created_at?: string
          escrow_id?: string
          id?: never
          log_index?: number | null
          metadata?: Json
          milestone_id?: string | null
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_activity_logs_escrow_id_fkey"
            columns: ["escrow_id"]
            isOneToOne: false
            referencedRelation: "escrows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_activity_logs_milestone_fkey"
            columns: ["milestone_id", "escrow_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id", "escrow_id"]
          },
        ]
      }
      escrows: {
        Row: {
          chain_id: number
          contract_address: string | null
          created_at: string
          creator_id: string
          description: string | null
          id: string
          onchain_escrow_id: number | null
          payee_address: string
          payee_email: string | null
          payer_address: string | null
          payer_email: string | null
          platform_fee_bps: number | null
          short_code: string
          status: Database["public"]["Enums"]["escrow_status"]
          title: string
          total_amount: number
          tx_hash_funded: string | null
          updated_at: string
        }
        Insert: {
          chain_id: number
          contract_address?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          onchain_escrow_id?: number | null
          payee_address: string
          payee_email?: string | null
          payer_address?: string | null
          payer_email?: string | null
          platform_fee_bps?: number | null
          short_code?: string
          status?: Database["public"]["Enums"]["escrow_status"]
          title: string
          total_amount: number
          tx_hash_funded?: string | null
          updated_at?: string
        }
        Update: {
          chain_id?: number
          contract_address?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          onchain_escrow_id?: number | null
          payee_address?: string
          payee_email?: string | null
          payer_address?: string | null
          payer_email?: string | null
          platform_fee_bps?: number | null
          short_code?: string
          status?: Database["public"]["Enums"]["escrow_status"]
          title?: string
          total_amount?: number
          tx_hash_funded?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrows_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          amount: number
          created_at: string
          deliverable_notes: string | null
          deliverable_url: string | null
          description: string | null
          due_date: string | null
          escrow_id: string
          id: string
          milestone_index: number
          status: Database["public"]["Enums"]["milestone_status"]
          title: string
          tx_hash_settled: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          deliverable_notes?: string | null
          deliverable_url?: string | null
          description?: string | null
          due_date?: string | null
          escrow_id: string
          id?: string
          milestone_index: number
          status?: Database["public"]["Enums"]["milestone_status"]
          title: string
          tx_hash_settled?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deliverable_notes?: string | null
          deliverable_url?: string | null
          description?: string | null
          due_date?: string | null
          escrow_id?: string
          id?: string
          milestone_index?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          title?: string
          tx_hash_settled?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_escrow_id_fkey"
            columns: ["escrow_id"]
            isOneToOne: false
            referencedRelation: "escrows"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          privy_did: string
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          privy_did: string
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          privy_did?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: number
      }
      create_escrow_draft: {
        Args: {
          p_chain_id: number
          p_creator_id: string
          p_description?: string
          p_milestones: Json
          p_payee_address: string
          p_payee_email?: string
          p_payer_email?: string
          p_title: string
        }
        Returns: {
          chain_id: number
          contract_address: string | null
          created_at: string
          creator_id: string
          description: string | null
          id: string
          onchain_escrow_id: number | null
          payee_address: string
          payee_email: string | null
          payer_address: string | null
          payer_email: string | null
          platform_fee_bps: number | null
          short_code: string
          status: Database["public"]["Enums"]["escrow_status"]
          title: string
          total_amount: number
          tx_hash_funded: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "escrows"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_checkout: { Args: { p_reference: string }; Returns: Json }
      list_user_escrows: {
        Args: { p_user_id: string }
        Returns: {
          chain_id: number
          contract_address: string | null
          created_at: string
          creator_id: string
          description: string | null
          id: string
          onchain_escrow_id: number | null
          payee_address: string
          payee_email: string | null
          payer_address: string | null
          payer_email: string | null
          platform_fee_bps: number | null
          short_code: string
          status: Database["public"]["Enums"]["escrow_status"]
          title: string
          total_amount: number
          tx_hash_funded: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "escrows"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      escrow_action_type:
        | "created"
        | "funded"
        | "deliverable_submitted"
        | "released"
        | "refunded"
        | "dispute_opened"
        | "dispute_resolved"
      escrow_status:
        | "draft"
        | "funded"
        | "in_progress"
        | "completed"
        | "disputed"
        | "cancelled"
      milestone_status:
        | "pending"
        | "funded"
        | "delivered_review"
        | "released"
        | "refunded"
        | "disputed"
        | "resolved"
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
    Enums: {
      escrow_action_type: [
        "created",
        "funded",
        "deliverable_submitted",
        "released",
        "refunded",
        "dispute_opened",
        "dispute_resolved",
      ],
      escrow_status: [
        "draft",
        "funded",
        "in_progress",
        "completed",
        "disputed",
        "cancelled",
      ],
      milestone_status: [
        "pending",
        "funded",
        "delivered_review",
        "released",
        "refunded",
        "disputed",
        "resolved",
      ],
    },
  },
} as const

