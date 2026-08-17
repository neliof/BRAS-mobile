import { supabase } from './supabase';
import type { Product, Venue } from '../types';

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchActiveProducts(venueId?: string): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .eq('active', true);

  if (venueId) {
    query = query.eq('venue_id', venueId);
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}
