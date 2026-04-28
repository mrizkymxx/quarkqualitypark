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
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      divisions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          created_at: string
          division_id: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          division_id?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          division_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      material_deliveries: {
        Row: {
          condition_notes: string | null
          created_at: string
          created_by: string | null
          delivery_date: string
          id: string
          purchase_order_id: string
          quantity_received: number
        }
        Insert: {
          condition_notes?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          id?: string
          purchase_order_id: string
          quantity_received?: number
        }
        Update: {
          condition_notes?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          id?: string
          purchase_order_id?: string
          quantity_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_deliveries_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          division_id: string | null
          email: string | null
          full_name: string
          id: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          division_id?: string | null
          email?: string | null
          full_name?: string
          id: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          division_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_division_fk"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_arrival: string | null
          id: string
          is_stock_po: boolean
          material_type: string
          notes: string | null
          ordered_quantity: number
          po_number: string
          sales_order_id: string | null
          supplier_id: string | null
          supplier_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_arrival?: string | null
          id?: string
          is_stock_po?: boolean
          material_type: string
          notes?: string | null
          ordered_quantity?: number
          po_number: string
          sales_order_id?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_arrival?: string | null
          id?: string
          is_stock_po?: boolean
          material_type?: string
          notes?: string | null
          ordered_quantity?: number
          po_number?: string
          sales_order_id?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          client_confirmation_date: string | null
          client_confirmation_notes: string | null
          client_name: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          needs_client_confirmation: boolean
          notes: string | null
          product_name: string
          product_type: string | null
          quantity: number
          so_number: string
          status: Database["public"]["Enums"]["so_status"]
          updated_at: string
        }
        Insert: {
          client_confirmation_date?: string | null
          client_confirmation_notes?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          needs_client_confirmation?: boolean
          notes?: string | null
          product_name: string
          product_type?: string | null
          quantity?: number
          so_number: string
          status?: Database["public"]["Enums"]["so_status"]
          updated_at?: string
        }
        Update: {
          client_confirmation_date?: string | null
          client_confirmation_notes?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          needs_client_confirmation?: boolean
          notes?: string | null
          product_name?: string
          product_type?: string | null
          quantity?: number
          so_number?: string
          status?: Database["public"]["Enums"]["so_status"]
          updated_at?: string
        }
        Relationships: []
      }
      shift_reports: {
        Row: {
          completion: Database["public"]["Enums"]["shift_completion"]
          created_at: string
          id: string
          issues: string | null
          machine_id: string | null
          machine_name: string | null
          operator_name: string
          operator_user_id: string | null
          ppic_correction_notes: string | null
          qty_processed: number
          qty_reject: number
          reject_reason: string | null
          report_date: string
          shift: Database["public"]["Enums"]["shift_type"]
          workflow_stage_id: string
        }
        Insert: {
          completion?: Database["public"]["Enums"]["shift_completion"]
          created_at?: string
          id?: string
          issues?: string | null
          machine_id?: string | null
          machine_name?: string | null
          operator_name: string
          operator_user_id?: string | null
          ppic_correction_notes?: string | null
          qty_processed?: number
          qty_reject?: number
          reject_reason?: string | null
          report_date?: string
          shift: Database["public"]["Enums"]["shift_type"]
          workflow_stage_id: string
        }
        Update: {
          completion?: Database["public"]["Enums"]["shift_completion"]
          created_at?: string
          id?: string
          issues?: string | null
          machine_id?: string | null
          machine_name?: string | null
          operator_name?: string
          operator_user_id?: string | null
          ppic_correction_notes?: string | null
          qty_processed?: number
          qty_reject?: number
          reject_reason?: string | null
          report_date?: string
          shift?: Database["public"]["Enums"]["shift_type"]
          workflow_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_reports_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_reports_workflow_stage_id_fkey"
            columns: ["workflow_stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      spk: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          issue_date: string
          notes: string | null
          sales_order_id: string
          spk_number: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          sales_order_id: string
          spk_number: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          sales_order_id?: string
          spk_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "spk_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      spk_purchase_orders: {
        Row: {
          purchase_order_id: string
          spk_id: string
        }
        Insert: {
          purchase_order_id: string
          spk_id: string
        }
        Update: {
          purchase_order_id?: string
          spk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spk_purchase_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spk_purchase_orders_spk_id_fkey"
            columns: ["spk_id"]
            isOneToOne: false
            referencedRelation: "spk"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
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
      workflow_stages: {
        Row: {
          created_at: string
          division_id: string | null
          estimated_duration_hours: number | null
          id: string
          machine_id: string | null
          notes: string | null
          pending_ppic_review: boolean
          sales_order_id: string
          stage_name: string
          stage_order: number
          status: Database["public"]["Enums"]["stage_status"]
          target_end: string | null
          target_start: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          division_id?: string | null
          estimated_duration_hours?: number | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          pending_ppic_review?: boolean
          sales_order_id: string
          stage_name: string
          stage_order?: number
          status?: Database["public"]["Enums"]["stage_status"]
          target_end?: string | null
          target_start?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          division_id?: string | null
          estimated_duration_hours?: number | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          pending_ppic_review?: boolean
          sales_order_id?: string
          stage_name?: string
          stage_order?: number
          status?: Database["public"]["Enums"]["stage_status"]
          target_end?: string | null
          target_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_stages_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_stages_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_stages_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          stages: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          stages?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          stages?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_division: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ppic" | "operator" | "manager"
      shift_completion: "in_progress" | "selesai_shift" | "tahap_selesai"
      shift_type: "pagi" | "malam"
      so_status:
        | "menunggu_konfirmasi"
        | "dikonfirmasi"
        | "menunggu_bahan"
        | "siap_produksi"
        | "dalam_produksi"
        | "selesai"
      stage_status: "belum_mulai" | "sedang_berjalan" | "selesai" | "ditunda"
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
      app_role: ["ppic", "operator", "manager"],
      shift_completion: ["in_progress", "selesai_shift", "tahap_selesai"],
      shift_type: ["pagi", "malam"],
      so_status: [
        "menunggu_konfirmasi",
        "dikonfirmasi",
        "menunggu_bahan",
        "siap_produksi",
        "dalam_produksi",
        "selesai",
      ],
      stage_status: ["belum_mulai", "sedang_berjalan", "selesai", "ditunda"],
    },
  },
} as const
