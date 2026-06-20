export type CartStatus = 'active' | 'inactive' | 'deleted';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface Cart {
  id: number;
  owner_id: string;
  title: string;
  description: string | null;
  daily_rate: number;
  quantity: number;
  image_urls: string[];
  station_id: number | null;
  status: CartStatus;
  owner_name: string | null;
  station_name: string | null;
  municipality: string | null;
}

export interface CartFormData {
  title: string;
  description: string;
  daily_rate: string;
  quantity: string;
  station_id: number | null;
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
}
