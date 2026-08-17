import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeProductPrice,
  createProduct,
  createVenue,
  deactivateProduct,
  fetchActiveProducts,
  fetchVenues,
} from '../api/catalog';
import type { Product } from '../types';

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

export function useCreateVenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; address?: string }) => createVenue(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      venueId: string;
      name: string;
      category: Product['category'];
      unitSize: string;
      price: number;
    }) => createProduct(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useChangeProductPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { productId: string; price: number }) => changeProductPrice(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeactivateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => deactivateProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
