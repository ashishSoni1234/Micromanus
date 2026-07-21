// lib/supabase/database.types.ts
// TypeScript types matching the Supabase database schema.
// Using loose types to avoid strict never inference issues with generated client.
// Regenerate with: npx supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          credits: number;
          paywall_cleared: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          email?: string;
          credits?: number;
          paywall_cleared?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          credits?: number;
          paywall_cleared?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          encrypted_key: string;
          iv: string;
          auth_tag: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          provider?: string;
          encrypted_key?: string;
          iv?: string;
          auth_tag?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          encrypted_key?: string;
          iv?: string;
          auth_tag?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chats: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          chat_id: string;
          role: string;
          content: string;
          tool_calls: Json | null;
          tool_result: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id?: string;
          role?: string;
          content?: string;
          tool_calls?: Json | null;
          tool_result?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: string;
          role?: string;
          content?: string;
          tool_calls?: Json | null;
          tool_result?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      usage_records: {
        Row: {
          id: string;
          user_id: string;
          chat_id: string;
          model: string;
          provider: string;
          input_tokens: number;
          output_tokens: number;
          cache_write_tokens: number;
          cache_read_tokens: number;
          cost_usd: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          chat_id?: string;
          model?: string;
          provider?: string;
          input_tokens?: number;
          output_tokens?: number;
          cache_write_tokens?: number;
          cache_read_tokens?: number;
          cost_usd?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          chat_id?: string;
          model?: string;
          provider?: string;
          input_tokens?: number;
          output_tokens?: number;
          cache_write_tokens?: number;
          cache_read_tokens?: number;
          cost_usd?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          stripe_event_id: string;
          processed_at: string;
        };
        Insert: {
          stripe_event_id?: string;
          processed_at?: string;
        };
        Update: {
          stripe_event_id?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      decrement_credits: {
        Args: { user_id_input: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
