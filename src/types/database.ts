/**
 * Supabase Database Type Definitions
 * 
 * These types define the schema for all database tables used in the application.
 * Update these types whenever the Supabase database schema changes.
 * 
 * To auto-generate types from your Supabase project, run:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
 */

export type Database = {
  public: {
    Tables: {
      products: {
        Row: {
          id: number;
          name: string;
          genre: string;
          price: number;
          image: string;
          description: string;
          display_name: string | null;
          seo_title: string | null;
          meta_description: string | null;
          slug: string | null;
          alt_text: string | null;
          created_at: string;
          updated_at: string;
          is_active: boolean;
          is_featured: boolean;
          is_popular: boolean;
          tags: string[];
        };
        Insert: {
          id?: number;
          name: string;
          genre: string;
          price: number;
          image: string;
          description: string;
          display_name?: string | null;
          seo_title?: string | null;
          meta_description?: string | null;
          slug?: string | null;
          alt_text?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          is_featured?: boolean;
          is_popular?: boolean;
          tags?: string[];
        };
        Update: {
          id?: number;
          name?: string;
          genre?: string;
          price?: number;
          image?: string;
          description?: string;
          display_name?: string | null;
          seo_title?: string | null;
          meta_description?: string | null;
          slug?: string | null;
          alt_text?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          is_featured?: boolean;
          is_popular?: boolean;
          tags?: string[];
        };
        Relationships: any[];
      };
      orders: {
        Row: {
          id: number;
          user_id: string | null;
          items: OrderItem[];
          subtotal: number;
          shipping_charge: number;
          total: number;
          status: OrderStatus;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          shipping_address: string;
          payment_id: string | null;
          payment_method: string | null;
          payment_status: string | null;
          razorpay_order_id: string | null;
          razorpay_signature: string | null;
          tracking_number: string | null;
          courier_name: string | null;
          shipped_at: string | null;
          delivered_at: string | null;
          delivery_method: 'local' | 'courier';
          cancelled_by: string | null;
          cancelled_at: string | null;
          coupon_code: string | null;
          discount_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          items: OrderItem[];
          subtotal: number;
          shipping_charge: number;
          total: number;
          status?: OrderStatus;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          shipping_address: string;
          payment_id?: string | null;
          payment_method?: string | null;
          payment_status?: string | null;
          razorpay_order_id?: string | null;
          razorpay_signature?: string | null;
          tracking_number?: string | null;
          courier_name?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          delivery_method?: 'local' | 'courier';
          cancelled_by?: string | null;
          cancelled_at?: string | null;
          coupon_code?: string | null;
          discount_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string | null;
          items?: OrderItem[];
          subtotal?: number;
          shipping_charge?: number;
          total?: number;
          status?: OrderStatus;
          customer_name?: string;
          customer_email?: string;
          customer_phone?: string;
          shipping_address?: string;
          payment_id?: string | null;
          payment_method?: string | null;
          payment_status?: string | null;
          razorpay_order_id?: string | null;
          razorpay_signature?: string | null;
          tracking_number?: string | null;
          courier_name?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          delivery_method?: 'local' | 'courier';
          cancelled_by?: string | null;
          cancelled_at?: string | null;
          coupon_code?: string | null;
          discount_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: any[];
      };
      categories: {
        Row: {
          id: number;
          name: string;
          slug: string;
          image: string;
          item_count: number;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          slug: string;
          image: string;
          item_count?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string;
          image?: string;
          item_count?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: any[];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: any[];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          recipient_name: string;
          phone: string;
          house: string;
          street: string | null;
          landmark: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          country: string;
          address_type: 'Home' | 'Work' | 'Other';
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipient_name: string;
          phone: string;
          house: string;
          street?: string | null;
          landmark?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          country?: string;
          address_type: 'Home' | 'Work' | 'Other';
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recipient_name?: string;
          phone?: string;
          house?: string;
          street?: string | null;
          landmark?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          country?: string;
          address_type?: 'Home' | 'Work' | 'Other';
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: any[];
      };
      offers: {
        Row: {
          id: string;
          title: string;
          is_active: boolean;
          display_order: number;
          highlight_color: string | null;
          start_date: string | null;
          end_date: string | null;
          coupon_code: string | null;
          target_link: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          is_active?: boolean;
          display_order?: number;
          highlight_color?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          coupon_code?: string | null;
          target_link?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          is_active?: boolean;
          display_order?: number;
          highlight_color?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          coupon_code?: string | null;
          target_link?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: any[];
      };
      reviews: {
        Row: {
          id: string;
          name: string;
          review_text: string;
          rating: number;
          avatar_url: string | null;
          display_order: number;
          is_featured: boolean;
          is_verified_purchase: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          review_text: string;
          rating: number;
          avatar_url?: string | null;
          display_order?: number;
          is_featured?: boolean;
          is_verified_purchase?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          review_text?: string;
          rating?: number;
          avatar_url?: string | null;
          display_order?: number;
          is_featured?: boolean;
          is_verified_purchase?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: any[];
      };
      wall_showcase: {
        Row: {
          id: string;
          customer_name: string | null;
          city: string | null;
          caption: string | null;
          image_url: string;
          display_order: number;
          is_featured: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_name?: string | null;
          city?: string | null;
          caption?: string | null;
          image_url: string;
          display_order?: number;
          is_featured?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_name?: string | null;
          city?: string | null;
          caption?: string | null;
          image_url?: string;
          display_order?: number;
          is_featured?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: any[];
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: number;
          created_at?: string;
        };
        Relationships: any[];
       };
      coupons: {
        Row: {
          id: number;
          code: string;
          name: string;
          type: 'percentage' | 'buy_x_get_y';
          value: number | null;
          buy_qty: number | null;
          free_qty: number | null;
          min_subtotal: number | null;
          description: string;
          is_active: boolean;
          start_date: string | null;
          end_date: string | null;
          max_redemptions: number | null;
          max_redemptions_per_user: number | null;
          current_redemptions: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          code: string;
          name: string;
          type: 'percentage' | 'buy_x_get_y';
          value?: number | null;
          buy_qty?: number | null;
          free_qty?: number | null;
          min_subtotal?: number | null;
          description: string;
          is_active?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          max_redemptions?: number | null;
          max_redemptions_per_user?: number | null;
          current_redemptions?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          code?: string;
          name?: string;
          type?: 'percentage' | 'buy_x_get_y';
          value?: number | null;
          buy_qty?: number | null;
          free_qty?: number | null;
          min_subtotal?: number | null;
          description?: string;
          is_active?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          max_redemptions?: number | null;
          max_redemptions_per_user?: number | null;
          current_redemptions?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: any[];
      };
      coupon_users: {
        Row: {
          coupon_id: number;
          user_id: string;
        };
        Insert: {
          coupon_id: number;
          user_id: string;
        };
        Update: {
          coupon_id?: number;
          user_id?: string;
        };
        Relationships: any[];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}

// Helper types derived from database schema
export type Product = Database['public']['Tables']['products']['Row'];
export type ProductInsert = Database['public']['Tables']['products']['Insert'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderInsert = Database['public']['Tables']['orders']['Insert'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Offer = Database['public']['Tables']['offers']['Row'];
export type OfferInsert = Database['public']['Tables']['offers']['Insert'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert'];
export type ShowcaseEntry = Database['public']['Tables']['wall_showcase']['Row'];
export type ShowcaseEntryInsert = Database['public']['Tables']['wall_showcase']['Insert'];

export type Address = Database['public']['Tables']['addresses']['Row'];
export type AddressInsert = Database['public']['Tables']['addresses']['Insert'];
export type AddressUpdate = Database['public']['Tables']['addresses']['Update'];

export type CouponRow = Database['public']['Tables']['coupons']['Row'];
export type CouponInsert = Database['public']['Tables']['coupons']['Insert'];
export type CouponUserRow = Database['public']['Tables']['coupon_users']['Row'];


export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'shipped' | 'delivered' | 'cancelled' | 'failed';

export interface OrderItem {
  product_id: number;
  name: string;
  size: string;
  material: string;
  price: number;
  quantity: number;
  image: string;
  
  // New tracking fields
  selected_size?: string;
  selected_material?: string;
  unit_price?: number;
  line_total?: number;
  width?: number;
  height?: number;
  area?: number;
  custom_price?: number;
  isFreeItem?: boolean;
  couponCode?: string;
}
