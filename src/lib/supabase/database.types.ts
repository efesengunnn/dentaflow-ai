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
      appointment_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["appointment_activity_type"]
          appointment_id: string
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          metadata: Json | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["appointment_activity_type"]
          appointment_id: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["appointment_activity_type"]
          appointment_id?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_activities_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_activities_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          clinic_id: string
          control_date: string | null
          created_at: string
          created_by: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          ends_at: string
          id: string
          patient_id: string
          reason: string | null
          staff_id: string
          standalone_price: number | null
          standalone_treatment_name: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          treatment_plan_id: string | null
          treatment_plan_item_id: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          clinic_id: string
          control_date?: string | null
          created_at?: string
          created_by: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          ends_at: string
          id?: string
          patient_id: string
          reason?: string | null
          staff_id: string
          standalone_price?: number | null
          standalone_treatment_name?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          treatment_plan_id?: string | null
          treatment_plan_item_id?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          clinic_id?: string
          control_date?: string | null
          created_at?: string
          created_by?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          ends_at?: string
          id?: string
          patient_id?: string
          reason?: string | null
          staff_id?: string
          standalone_price?: number | null
          standalone_treatment_name?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          treatment_plan_id?: string | null
          treatment_plan_item_id?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_treatment_plan_item_id_fkey"
            columns: ["treatment_plan_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          clinic_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          staff_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          staff_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          business_hours: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          business_hours?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          business_hours?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinics_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["lead_activity_type"]
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          lead_id: string
          metadata: Json | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["lead_activity_type"]
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          lead_id: string
          metadata?: Json | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["lead_activity_type"]
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          clinic_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          phone: string
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          tc_kimlik_no: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          assigned_to?: string | null
          clinic_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone: string
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tc_kimlik_no?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          assigned_to?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tc_kimlik_no?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["patient_activity_type"]
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          metadata: Json | null
          patient_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["patient_activity_type"]
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          metadata?: Json | null
          patient_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["patient_activity_type"]
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_activities_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_activities_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          assigned_to: string | null
          clinic_id: string
          created_at: string
          created_by: string
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          lead_id: string | null
          phone: string
          tc_kimlik_no: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          assigned_to?: string | null
          clinic_id: string
          created_at?: string
          created_by: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          lead_id?: string | null
          phone: string
          tc_kimlik_no?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          assigned_to?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          lead_id?: string | null
          phone?: string
          tc_kimlik_no?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          clinic_id: string
          granted_at: string
          granted_by: string | null
          id: string
          permission_key: string
          staff_id: string
        }
        Insert: {
          clinic_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_key: string
          staff_id: string
        }
        Update: {
          clinic_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_key?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_treatment_catalog_items: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          currency: string
          default_price: number | null
          id: string
          is_active: boolean
          staff_id: string
          treatment_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          default_price?: number | null
          id?: string
          is_active?: boolean
          staff_id: string
          treatment_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          default_price?: number | null
          id?: string
          is_active?: boolean
          staff_id?: string
          treatment_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_treatment_catalog_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_treatment_catalog_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_treatment_catalog_items_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_treatment_catalog_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["treatment_activity_type"]
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          metadata: Json | null
          series_id: string | null
          treatment_id: string | null
          treatment_plan_id: string | null
          treatment_plan_item_id: string | null
          treatment_session_id: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["treatment_activity_type"]
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          metadata?: Json | null
          series_id?: string | null
          treatment_id?: string | null
          treatment_plan_id?: string | null
          treatment_plan_item_id?: string | null
          treatment_session_id?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["treatment_activity_type"]
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          series_id?: string | null
          treatment_id?: string | null
          treatment_plan_id?: string | null
          treatment_plan_item_id?: string | null
          treatment_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_activities_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_activities_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "treatment_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_activities_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_activities_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_activities_treatment_plan_item_id_fkey"
            columns: ["treatment_plan_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_activities_treatment_session_id_fkey"
            columns: ["treatment_session_id"]
            isOneToOne: false
            referencedRelation: "treatment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_payments: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          currency: string
          entry_type: Database["public"]["Enums"]["treatment_payment_entry_type"]
          id: string
          method: Database["public"]["Enums"]["treatment_payment_method"]
          note: string | null
          paid_at: string
          recorded_by: string
          related_payment_id: string | null
          series_id: string | null
          treatment_plan_id: string | null
        }
        Insert: {
          amount: number
          clinic_id: string
          created_at?: string
          currency?: string
          entry_type?: Database["public"]["Enums"]["treatment_payment_entry_type"]
          id?: string
          method: Database["public"]["Enums"]["treatment_payment_method"]
          note?: string | null
          paid_at: string
          recorded_by: string
          related_payment_id?: string | null
          series_id?: string | null
          treatment_plan_id?: string | null
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string
          currency?: string
          entry_type?: Database["public"]["Enums"]["treatment_payment_entry_type"]
          id?: string
          method?: Database["public"]["Enums"]["treatment_payment_method"]
          note?: string | null
          paid_at?: string
          recorded_by?: string
          related_payment_id?: string | null
          series_id?: string | null
          treatment_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payments_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "treatment_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payments_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "treatment_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payments_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_items: {
        Row: {
          catalog_item_id: string | null
          clinic_id: string
          control_date: string | null
          created_at: string
          created_by: string
          currency: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          legacy_series_id: string | null
          patient_id: string
          provider_id: string
          provider_share_amount: number | null
          revision_no: number
          session_count: number
          status: Database["public"]["Enums"]["treatment_lifecycle_status"]
          total_price: number | null
          treatment_name: string
          treatment_plan_id: string
          unit_price: number | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          catalog_item_id?: string | null
          clinic_id: string
          control_date?: string | null
          created_at?: string
          created_by: string
          currency?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          legacy_series_id?: string | null
          patient_id: string
          provider_id: string
          provider_share_amount?: number | null
          revision_no?: number
          session_count?: number
          status?: Database["public"]["Enums"]["treatment_lifecycle_status"]
          total_price?: number | null
          treatment_name: string
          treatment_plan_id: string
          unit_price?: number | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          catalog_item_id?: string | null
          clinic_id?: string
          control_date?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          legacy_series_id?: string | null
          patient_id?: string
          provider_id?: string
          provider_share_amount?: number | null
          revision_no?: number
          session_count?: number
          status?: Database["public"]["Enums"]["treatment_lifecycle_status"]
          total_price?: number | null
          treatment_name?: string
          treatment_plan_id?: string
          unit_price?: number | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "staff_treatment_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_legacy_series_id_fkey"
            columns: ["legacy_series_id"]
            isOneToOne: false
            referencedRelation: "treatment_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string
          currency: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          legacy_series_id: string | null
          patient_id: string
          plan_name: string
          status: Database["public"]["Enums"]["treatment_lifecycle_status"]
          updated_at: string
          updated_by: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by: string
          currency?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          legacy_series_id?: string | null
          patient_id: string
          plan_name: string
          status?: Database["public"]["Enums"]["treatment_lifecycle_status"]
          updated_at?: string
          updated_by: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          legacy_series_id?: string | null
          patient_id?: string
          plan_name?: string
          status?: Database["public"]["Enums"]["treatment_lifecycle_status"]
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_legacy_series_id_fkey"
            columns: ["legacy_series_id"]
            isOneToOne: true
            referencedRelation: "treatment_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_products: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string
          id: string
          product_name: string
          quantity: number
          treatment_id: string
          unit: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by: string
          id?: string
          product_name: string
          quantity: number
          treatment_id: string
          unit?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string
          id?: string
          product_name?: string
          quantity?: number
          treatment_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_products_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_products_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_series: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string
          currency: string
          id: string
          patient_id: string
          status: Database["public"]["Enums"]["treatment_lifecycle_status"]
          total_fee: number | null
          total_sessions: number
          treatment_type: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          patient_id: string
          status?: Database["public"]["Enums"]["treatment_lifecycle_status"]
          total_fee?: number | null
          total_sessions?: number
          treatment_type: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          patient_id?: string
          status?: Database["public"]["Enums"]["treatment_lifecycle_status"]
          total_fee?: number | null
          total_sessions?: number
          treatment_type?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_series_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_series_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_series_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_sessions: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          control_date: string | null
          corrected_at: string | null
          corrected_by: string | null
          correction_reason: string | null
          created_at: string
          created_by: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          legacy_treatment_id: string | null
          notes: string | null
          patient_id: string
          performed_at: string
          performed_by: string
          replaced_by_session_id: string | null
          session_number: number
          status: Database["public"]["Enums"]["treatment_session_status"]
          treatment_plan_item_id: string
          unit_price_snapshot: number | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          control_date?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          legacy_treatment_id?: string | null
          notes?: string | null
          patient_id: string
          performed_at: string
          performed_by: string
          replaced_by_session_id?: string | null
          session_number: number
          status?: Database["public"]["Enums"]["treatment_session_status"]
          treatment_plan_item_id: string
          unit_price_snapshot?: number | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          control_date?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          legacy_treatment_id?: string | null
          notes?: string | null
          patient_id?: string
          performed_at?: string
          performed_by?: string
          replaced_by_session_id?: string | null
          session_number?: number
          status?: Database["public"]["Enums"]["treatment_session_status"]
          treatment_plan_item_id?: string
          unit_price_snapshot?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_legacy_treatment_id_fkey"
            columns: ["legacy_treatment_id"]
            isOneToOne: true
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_replaced_by_session_id_fkey"
            columns: ["replaced_by_session_id"]
            isOneToOne: false
            referencedRelation: "treatment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_treatment_plan_item_id_fkey"
            columns: ["treatment_plan_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          control_date: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          patient_id: string
          series_id: string
          session_number: number
          staff_id: string
          status: Database["public"]["Enums"]["treatment_lifecycle_status"]
          treatment_date: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          control_date?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          patient_id: string
          series_id: string
          session_number: number
          staff_id: string
          status?: Database["public"]["Enums"]["treatment_lifecycle_status"]
          treatment_date: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          control_date?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          patient_id?: string
          series_id?: string
          session_number?: number
          staff_id?: string
          status?: Database["public"]["Enums"]["treatment_lifecycle_status"]
          treatment_date?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "treatment_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_lead_to_patient: { Args: { p_lead_id: string }; Returns: string }
      current_clinic_id: { Args: never; Returns: string }
      current_staff_has_permission: {
        Args: { p_key: string }
        Returns: boolean
      }
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
    }
    Enums: {
      appointment_activity_type:
        | "appointment_created"
        | "appointment_updated"
        | "status_changed"
        | "note_added"
        | "appointment_deleted"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      lead_activity_type:
        | "lead_created"
        | "lead_updated"
        | "status_changed"
        | "note_added"
        | "lead_deleted"
      lead_source:
        | "website"
        | "referral"
        | "social_media"
        | "phone_call"
        | "walk_in"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "consultation_scheduled"
        | "proposal_sent"
        | "converted"
        | "lost"
      patient_activity_type:
        | "patient_created"
        | "patient_updated"
        | "note_added"
        | "patient_deleted"
      staff_role: "owner" | "doctor" | "secretary" | "beauty_specialist"
      treatment_activity_type:
        | "series_created"
        | "series_updated"
        | "treatment_created"
        | "treatment_updated"
        | "status_changed"
        | "payment_recorded"
        | "note_added"
        | "treatment_deleted"
        | "plan_deleted"
        | "plan_item_deleted"
        | "session_deleted"
      treatment_lifecycle_status:
        | "active"
        | "completed"
        | "cancelled"
        | "voided"
      treatment_payment_entry_type: "payment" | "refund" | "adjustment" | "void"
      treatment_payment_method:
        | "cash"
        | "credit_card"
        | "bank_transfer"
        | "other"
      treatment_session_status: "completed" | "corrected" | "voided"
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
      appointment_activity_type: [
        "appointment_created",
        "appointment_updated",
        "status_changed",
        "note_added",
        "appointment_deleted",
      ],
      appointment_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      lead_activity_type: [
        "lead_created",
        "lead_updated",
        "status_changed",
        "note_added",
        "lead_deleted",
      ],
      lead_source: [
        "website",
        "referral",
        "social_media",
        "phone_call",
        "walk_in",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "consultation_scheduled",
        "proposal_sent",
        "converted",
        "lost",
      ],
      patient_activity_type: [
        "patient_created",
        "patient_updated",
        "note_added",
        "patient_deleted",
      ],
      staff_role: ["owner", "doctor", "secretary", "beauty_specialist"],
      treatment_activity_type: [
        "series_created",
        "series_updated",
        "treatment_created",
        "treatment_updated",
        "status_changed",
        "payment_recorded",
        "note_added",
        "treatment_deleted",
        "plan_deleted",
        "plan_item_deleted",
        "session_deleted",
      ],
      treatment_lifecycle_status: [
        "active",
        "completed",
        "cancelled",
        "voided",
      ],
      treatment_payment_entry_type: ["payment", "refund", "adjustment", "void"],
      treatment_payment_method: [
        "cash",
        "credit_card",
        "bank_transfer",
        "other",
      ],
      treatment_session_status: ["completed", "corrected", "voided"],
    },
  },
} as const

