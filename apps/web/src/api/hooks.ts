import type {
  ActionsDto,
  ApplicationCreateInput,
  ApplicationDetailDto,
  ApplicationDto,
  ApplicationStatus,
  ApplicationUpdateInput,
  CompanyDetailDto,
  CompanyDto,
  CompanyInput,
  CompanyUpdate,
  CompanyWithCountsDto,
  ContactCreateInput,
  ContactDto,
  ContactUpdateInput,
  HandOverReason,
  InterviewCreateInput,
  InterviewDto,
  InterviewUpdateInput,
  NoteDto,
  OpportunityDto,
  OpportunityStatus,
  OverviewDto,
  ScoutCriteriaDto,
  ScoutCriteriaInput,
} from '@job-tracker/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emitAppEvent } from '../lib/app-events';
import { api } from './client';

export interface ApplicationFilters {
  q?: string;
  status?: ApplicationStatus;
  active?: boolean;
}

export const queryKeys = {
  actions: ['actions'] as const,
  overview: ['overview'] as const,
  applications: ['applications'] as const,
  applicationList: (f: ApplicationFilters) => ['applications', 'list', f] as const,
  application: (id: string) => ['applications', 'detail', id] as const,
  companies: (q: string) => ['companies', q] as const,
  companyList: (q: string) => ['company-list', q] as const,
  opportunities: ['opportunities'] as const,
  opportunityList: (status: OpportunityStatus) => ['opportunities', status] as const,
  scoutCriteria: ['scout-criteria'] as const,
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

export const useActions = () =>
  useQuery({ queryKey: queryKeys.actions, queryFn: () => api<ActionsDto>('/actions') });

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

export const useCompanies = (q: string) =>
  useQuery({
    queryKey: queryKeys.companyList(q),
    queryFn: () => api<CompanyWithCountsDto[]>(`/companies/with-counts?q=${encodeURIComponent(q)}`),
    placeholderData: keepPreviousData,
  });

/** A company change touches the company lists, the name suggestions and every application showing it. */
function useInvalidateCompanies() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['company-list'] }),
      qc.invalidateQueries({ queryKey: ['companies'] }),
      qc.invalidateQueries({ queryKey: queryKeys.applications }),
      qc.invalidateQueries({ queryKey: queryKeys.overview }),
      qc.invalidateQueries({ queryKey: queryKeys.actions }),
    ]);
}

export function useCreateCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (input: CompanyInput) =>
      api<CompanyWithCountsDto>('/companies', { method: 'POST', json: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CompanyUpdate }) =>
      api<CompanyDetailDto>(`/companies/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: invalidate,
  });
}

export function useDeleteCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/companies/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Any write can change lists, detail and aggregates, so refresh them all. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.applications }),
      qc.invalidateQueries({ queryKey: queryKeys.overview }),
      qc.invalidateQueries({ queryKey: queryKeys.actions }),
    ]);
}

export function useCreateApplication() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: ApplicationCreateInput) =>
      api<ApplicationDetailDto>('/applications', { method: 'POST', json: input }),
    onSuccess: async (created) => {
      await invalidate();
      emitAppEvent({ type: 'application.created', applicationId: created.id });
    },
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
    mutationFn: ({
      id,
      status,
      interviewAt,
      replyBy,
      dueAt,
    }: {
      id: string;
      status: ApplicationStatus;
      /** When the interview for a round stage takes place; defaults to now on the server. */
      interviewAt?: Date;
      /** When the employer said they'd reply by. */
      replyBy?: Date;
      /** The user's own deadline for this stage (assignment due, offer expiry). */
      dueAt?: Date;
    }) =>
      api<ApplicationDetailDto>(`/applications/${id}/status`, {
        method: 'PATCH',
        json: { status, interviewAt, replyBy, dueAt },
      }),
    onSuccess: async (_updated, { id, status }) => {
      await invalidate();
      emitAppEvent({ type: 'status.changed', applicationId: id, status });
    },
  });
}

export function useSnooze() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, until }: { id: string; until: Date }) =>
      api<ApplicationDetailDto>(`/applications/${id}/snooze`, { method: 'POST', json: { until } }),
    onSuccess: invalidate,
  });
}

/** "I did my part, now it's their move": follow-up sent, assignment submitted, or they're scheduling. */
export function useHandOver() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: HandOverReason }) =>
      api<ApplicationDetailDto>(`/applications/${id}/hand-over`, {
        method: 'POST',
        json: { reason },
      }),
    onSuccess: invalidate,
  });
}

/** Marks an interview as debriefed from outside its application page (Tasks cards). */
export function useDebrief() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ applicationId, interviewId }: { applicationId: string; interviewId: string }) =>
      api<InterviewDto>(`/applications/${applicationId}/interviews/${interviewId}`, {
        method: 'PATCH',
        json: { debriefed: true },
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteApplication() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/applications/${id}`, { method: 'DELETE' }),
    onSuccess: async (_void, id) => {
      await invalidate();
      emitAppEvent({ type: 'application.deleted', applicationId: id });
    },
  });
}

function useChildMutations<TInput, TUpdate, TDto>(applicationId: string, resource: string) {
  const invalidate = useInvalidateAll();
  const base = `/applications/${applicationId}/${resource}`;
  return {
    create: useMutation({
      mutationFn: (input: TInput) => api<TDto>(base, { method: 'POST', json: input }),
      onSuccess: async () => {
        await invalidate();
        emitAppEvent({
          type: `${resource.slice(0, -1)}.created` as 'contact.created',
          applicationId,
        });
      },
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

export const useOpportunities = (status: OpportunityStatus = 'new') =>
  useQuery({
    queryKey: queryKeys.opportunityList(status),
    queryFn: () => api<OpportunityDto[]>(`/opportunities?status=${status}`),
  });

/** Creates an application from a suggestion; refreshes suggestions and everything applications feed. */
export function usePromoteOpportunity() {
  const invalidate = useInvalidateAll();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<ApplicationDetailDto>(`/opportunities/${id}/promote`, { method: 'POST' }),
    onSuccess: async (created) => {
      await Promise.all([
        invalidate(),
        qc.invalidateQueries({ queryKey: queryKeys.opportunities }),
      ]);
      emitAppEvent({ type: 'application.created', applicationId: created.id });
    },
  });
}

export function useDismissOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<OpportunityDto>(`/opportunities/${id}/dismiss`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.opportunities }),
  });
}

export const useScoutCriteria = () =>
  useQuery({
    queryKey: queryKeys.scoutCriteria,
    queryFn: () => api<ScoutCriteriaDto>('/scout/criteria'),
  });

export function useSaveScoutCriteria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (criteria: ScoutCriteriaInput) =>
      api<ScoutCriteriaDto>('/scout/criteria', { method: 'PUT', json: criteria }),
    onSuccess: (saved) => qc.setQueryData(queryKeys.scoutCriteria, saved),
  });
}

/** Notes are loaded with the application; writes only refresh the application (no app event, no other queries). */
export function useNoteMutations(applicationId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.application(applicationId) });
  const base = (interviewId: string) =>
    `/applications/${applicationId}/interviews/${interviewId}/notes`;
  return {
    create: useMutation({
      mutationFn: ({ interviewId, text }: { interviewId: string; text: string }) =>
        api<NoteDto>(base(interviewId), { method: 'POST', json: { text } }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ interviewId, id, text }: { interviewId: string; id: string; text: string }) =>
        api<NoteDto>(`${base(interviewId)}/${id}`, { method: 'PATCH', json: { text } }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: ({ interviewId, id }: { interviewId: string; id: string }) =>
        api<void>(`${base(interviewId)}/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}
