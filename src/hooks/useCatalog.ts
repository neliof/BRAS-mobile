import { useQuery } from '@tanstack/react-query';
import { fetchActiveProducts, fetchVenues } from '../api/catalog';

export function useVenues() {
  return useQuery({
    queryKey: ['venues'],
    queryFn: fetchVenues,
    staleTime: 5 * 60 * 1000,
  });
}

export function useActiveProducts(venueId?: string) {
  return useQuery({
    queryKey: ['products', 'active', venueId ?? 'all'],
    queryFn: () => fetchActiveProducts(venueId),
    staleTime: 5 * 60 * 1000,
  });
}
