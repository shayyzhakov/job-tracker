import type {
  ApplicationCreateInput,
  ApplicationDetailDto,
  ApplicationDto,
  ApplicationStatus,
  ApplicationUpdateInput,
  CompanyDto,
  ContactCreateInput,
  ContactDto,
  ContactUpdateInput,
  InterviewCreateInput,
  InterviewDto,
  InterviewUpdateInput,
  OverviewDto,
} from '@job-tracker/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export interface ApplicationFilters {
  q?: string;
  status?: ApplicationStatus;
  active?: boolean;
}

export const queryKeys = {
  overview: ['overview'] as const,
  applications: ['applications'] as const,
  applicationList: (f: ApplicationFilters) => ['applications', 'list', f] as const,
  application: (id: string) => ['applications', 'detail', id] as const,
  companies: (q: string) => ['companies', q] as const,
};

const toSearch = (f: ApplicationFilters) => {
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.status) params.set('status', f.status);
  if (f.active !== undefined) params.set('active', String(f.active));
  const s = params.toString();
  return s ? `?${s}` : '';
};

export const useOverview = () =>
  useQuery({ queryKey: queryKeys.overview, queryFn: () => api<OverviewDto>('/overview') });

export const useApplications = (filters: ApplicationFilters) =>
  useQuery({
    queryKey: queryKeys.applicationList(filters),
    queryFn: () => api<ApplicationDto[]>(`/applications${toSearch(filters)}`),
    placeholderData: keepPreviousData,
  });

export const useApplication = (id: string) =>
  useQuery({
    queryKey: queryKeys.application(id),
    queryFn: () => api<ApplicationDetailDto>(`/applications/${id}`),
  });

export const useCompanySearch = (q: string) =>
  useQuery({
    queryKey: queryKeys.companies(q),
    queryFn: () => api<CompanyDto[]>(`/companies?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });

/** Any write can change lists, detail and aggregates, so refresh them all. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.applications }),
      qc.invalidateQueries({ queryKey: queryKeys.overview }),
    ]);
}

export function useCreateApplication() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: ApplicationCreateInput) =>
      api<ApplicationDetailDto>('/applications', { method: 'POST', json: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateApplication(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (patch: ApplicationUpdateInput) =>
      api<ApplicationDetailDto>(`/applications/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: invalidate,
  });
}

export function useChangeStatus() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      api<ApplicationDetailDto>(`/applications/${id}/status`, {
        method: 'PATCH',
        json: { status },
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteApplication() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/applications/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

function useChildMutations<TInput, TUpdate, TDto>(applicationId: string, resource: string) {
  const invalidate = useInvalidateAll();
  const base = `/applications/${applicationId}/${resource}`;
  return {
    create: useMutation({
      mutationFn: (input: TInput) => api<TDto>(base, { method: 'POST', json: input }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: TUpdate }) =>
        api<TDto>(`${base}/${id}`, { method: 'PATCH', json: patch }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`${base}/${id}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
  };
}

export const useContactMutations = (applicationId: string) =>
  useChildMutations<ContactCreateInput, ContactUpdateInput, ContactDto>(applicationId, 'contacts');

export const useInterviewMutations = (applicationId: string) =>
  useChildMutations<InterviewCreateInput, InterviewUpdateInput, InterviewDto>(
    applicationId,
    'interviews',
  );
