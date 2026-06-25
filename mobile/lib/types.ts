export type CartStatus = 'active' | 'inactive' | 'deleted';
export type CartCategory = 'hand_truck' | 'flat_cart' | 'hand_dolly' | 'outdoor_wagon' | 'other';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type ReservationStatus = 'reserved' | 'lent' | 'returned' | 'cancelled';

export interface CartLocation {
  id: number;
  station_id: number | null;
  station_name: string | null;
  municipality: string | null;
  lending_address: string | null;
}

export interface Cart {
  id: number;
  owner_id: string;
  title: string;
  category: CartCategory | null;
  description: string | null;
  weight_kg: number | null;
  max_load_kg: number | null;
  width_cm: number | null;
  length_cm: number | null;
  foldable: boolean;
  daily_rate: number | null;
  weekly_rate: number | null;
  per_rental_rate: number | null;
  quantity: number;
  image_urls: string[];
  station_id: number | null;
  lending_address: string | null;
  status: CartStatus;
  owner_name: string | null;
  station_name: string | null;
  municipality: string | null;
  locations: CartLocation[];
}

export interface LocationFormItem {
  station_id: number | null;
  station_name: string | null;
  municipality: string | null;
  lending_address: string;
}

export interface CartFormData {
  title: string;
  category: CartCategory | null;
  description: string;
  weight_kg: string;
  max_load_kg: string;
  width_cm: string;
  length_cm: string;
  foldable: boolean;
  daily_rate: string;
  weekly_rate: string;
  per_rental_rate: string;
  quantity: string;
  locations: LocationFormItem[];
  image_urls: string[];
}

export interface RentalRequest {
  id: number;
  cart_id: number;
  renter_id: string;
  quantity: number;
  start_date: string;
  end_date: string;
  message: string | null;
  status: RequestStatus;
  created_at: string;
  cart_title: string | null;
  renter_name: string | null;
  lender_name: string | null;
  station_name: string | null;
  municipality: string | null;
  lending_address: string | null;
  reservation_status: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface Message {
  id: number;
  rental_request_id: number;
  sender_id: string;
  body: string;
  is_read: boolean;
  is_system: boolean;
  created_at: string;
  sender_name: string | null;
}

export interface Reservation {
  id: number;
  rental_request_id: number;
  lender_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  quantity: number;
  daily_rate: number;
  lent_at: string | null;
  returned_at: string | null;
  note: string | null;
  status: ReservationStatus;
  created_at: string;
  lender_name: string | null;
  renter_name: string | null;
  cart_title: string | null;
  station_name: string | null;
  municipality: string | null;
  lending_address: string | null;
}
