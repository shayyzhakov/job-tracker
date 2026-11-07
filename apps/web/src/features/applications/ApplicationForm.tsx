import {
  APPLICATION_METHOD_LABELS,
  APPLICATION_METHODS,
  ApplicationCreateSchema,
  type ApplicationDetailDto,
  type ApplicationMethod,
  type ApplicationStatus,
  ApplicationUpdateSchema,
  COMPANY_SIZE_LABELS,
  COMPANY_SIZES,
  type CompanySize,
  REFERRAL_CHANNEL_LABELS,
  REFERRAL_CHANNELS,
  type ReferralChannel,
} from '@job-tracker/shared';
import {
  ActionIcon,
  Autocomplete,
  Button,
  Card,
  Divider,
  Group,
  Input,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useCompanySearch } from '../../api/hooks';
import { StatusSelect } from '../../components/StatusSelect';
import { zodErrors } from '../../lib/zod-form';
import { ContactFields, type ContactFormValues, emptyContact } from './ContactFields';

export interface ApplicationFormValues {
  company: {
    name: string;
    size: CompanySize | null;
    isPublic: boolean;
    location: string;
    website: string;
  };
  roleName: string;
  isManagement: boolean;
  status: ApplicationStatus;
  listingUrl: string;
  expectedSalaryIls: number | string;
  applicationMethod: ApplicationMethod | null;
  referrerName: string;
  referrerChannel: ReferralChannel | null;
  methodDetails: string;
  appliedAt: string | null;
  /** When the employer said they'd reply by (YYYY-MM-DD). */
  replyBy: string | null;
  /** The user's own deadline: assignment due date or offer expiry (YYYY-MM-DD). */
  dueAt: string | null;
  nextStep: string;
  notes: string;
  contacts: ContactFormValues[];
}

const blankValues: ApplicationFormValues = {
  company: { name: '', size: null, isPublic: false, location: '', website: '' },
  roleName: '',
  isManagement: false,
  status: 'to_apply',
  listingUrl: '',
  expectedSalaryIls: '',
  applicationMethod: null,
  referrerName: '',
  referrerChannel: null,
  methodDetails: '',
  appliedAt: null,
  replyBy: null,
  dueAt: null,
  nextStep: '',
  notes: '',
  contacts: [],
};

/** ISO instant -> YYYY-MM-DD in the user's local time. */
const localDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** A deadline set as a date means the end of that day, local time. */
const endOfDay = (date: string | null) => (date ? new Date(`${date}T23:59:00`) : null);

export const valuesFromApplication = (a: ApplicationDetailDto): ApplicationFormValues => ({
  company: {
    name: a.company.name,
    size: a.company.size,
    isPublic: a.company.isPublic,
    location: a.company.location ?? '',
    website: a.company.website ?? '',
  },
  roleName: a.roleName,
  isManagement: a.isManagement,
  status: a.status,
  listingUrl: a.listingUrl ?? '',
  expectedSalaryIls: a.expectedSalaryIls ?? '',
  applicationMethod: a.applicationMethod,
  referrerName: a.referrerName ?? '',
  referrerChannel: a.referrerChannel,
  methodDetails: a.methodDetails ?? '',
  appliedAt: a.appliedAt ? a.appliedAt.slice(0, 10) : null,
  replyBy: a.replyBy ? localDate(a.replyBy) : null,
  dueAt: a.dueAt ? localDate(a.dueAt) : null,
  nextStep: a.nextStep ?? '',
  notes: a.notes ?? '',
  contacts: [],
});

const salary = (v: number | string) => (typeof v === 'number' ? v : undefined);

/** Form values -> create payload (blank optional fields are dropped by the schema). */
export const toCreatePayload = (v: ApplicationFormValues) => ({
  ...v,
  applicationMethod: v.applicationMethod ?? undefined,
  referrerChannel: v.referrerChannel ?? undefined,
  company: { ...v.company, size: v.company.size ?? undefined },
  expectedSalaryIls: salary(v.expectedSalaryIls),
  appliedAt: v.appliedAt ?? undefined,
  replyBy: v.replyBy ?? undefined,
  dueAt: endOfDay(v.dueAt) ?? undefined,
});

/** Form values -> PATCH payload (blank fields become null, i.e. cleared). */
export const toUpdatePayload = (v: ApplicationFormValues) => {
  const { status: _status, contacts: _contacts, ...rest } = v;
  return {
    ...rest,
    expectedSalaryIls: salary(v.expectedSalaryIls) ?? null,
    appliedAt: v.appliedAt ?? null,
    replyBy: v.replyBy ?? null,
    dueAt: endOfDay(v.dueAt),
  };
};

interface Props {
  mode: 'create' | 'edit';
  initialValues?: ApplicationFormValues;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: ApplicationFormValues) => void;
  onCancel?: () => void;
}

export function ApplicationForm({
  mode,
  initialValues = blankValues,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const form = useForm<ApplicationFormValues>({
    mode: 'controlled',
    initialValues,
    validate: (values) =>
      mode === 'create'
        ? zodErrors(ApplicationCreateSchema, toCreatePayload(values))
        : zodErrors(ApplicationUpdateSchema, toUpdatePayload(values)),
  });

  const [companyQuery] = useDebouncedValue(form.values.company.name, 200);
  const companies = useCompanySearch(mode === 'create' ? companyQuery : '');

  return (
    <form onSubmit={form.onSubmit(onSubmit)} noValidate>
      <Stack>
        <Card withBorder padding="lg">
          <Text fw={600} mb="sm">
            Company
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Autocomplete
              label="Company name"
              withAsterisk
              data={(companies.data ?? []).map((c) => c.name)}
              {...form.getInputProps('company.name')}
            />
            <Select
              label="Company size"
              placeholder="Select…"
              clearable
              data={COMPANY_SIZES.map((s) => ({
                value: s,
                label: COMPANY_SIZE_LABELS[s],
              }))}
              {...form.getInputProps('company.size')}
            />
            <TextInput
              label="Location"
              placeholder="Tel Aviv, Remote…"
              {...form.getInputProps('company.location')}
            />
            <TextInput label="Company website" {...form.getInputProps('company.website')} />
            <Input.Wrapper label="Company type">
              <SegmentedControl
                fullWidth
                aria-label="Company type"
                value={form.values.company.isPublic ? 'public' : 'private'}
                onChange={(v) => form.setFieldValue('company.isPublic', v === 'public')}
                data={[
                  { value: 'private', label: 'Private' },
                  { value: 'public', label: 'Public' },
                ]}
              />
            </Input.Wrapper>
          </SimpleGrid>
        </Card>

        <Card withBorder padding="lg">
          <Text fw={600} mb="sm">
            Role
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Role name" withAsterisk {...form.getInputProps('roleName')} />
            {mode === 'create' && (
              <StatusSelect
                label="Status"
                value={form.values.status}
                onChange={(s) => form.setFieldValue('status', s)}
              />
            )}
            <TextInput
              label="Listing URL"
              placeholder="https://…"
              {...form.getInputProps('listingUrl')}
            />
            <NumberInput
              label="Expected salary (₪/month, gross)"
              min={0}
              step={1000}
              thousandSeparator=","
              allowDecimal={false}
              {...form.getInputProps('expectedSalaryIls')}
            />
            <DateInput
              label="Applied on"
              clearable
              valueFormat="DD MMM YYYY"
              {...form.getInputProps('appliedAt')}
            />
            <Input.Wrapper label="Role type">
              <SegmentedControl
                fullWidth
                aria-label="Role type"
                value={form.values.isManagement ? 'management' : 'ic'}
                onChange={(v) => form.setFieldValue('isManagement', v === 'management')}
                data={[
                  { value: 'ic', label: 'Individual contributor' },
                  { value: 'management', label: 'Management' },
                ]}
              />
            </Input.Wrapper>
          </SimpleGrid>
          <Textarea label="Notes" autosize minRows={3} mt="sm" {...form.getInputProps('notes')} />
        </Card>

        <Card withBorder padding="lg">
          <Text fw={600} mb="sm">
            Timeline
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <DateInput
              label="They said they'd reply by"
              description="Replaces the default waiting time before a follow-up is suggested."
              clearable
              valueFormat="DD MMM YYYY"
              {...form.getInputProps('replyBy')}
            />
            <DateInput
              label="Your deadline"
              description="Home assignment due date or offer expiry."
              clearable
              valueFormat="DD MMM YYYY"
              {...form.getInputProps('dueAt')}
            />
          </SimpleGrid>
          <TextInput
            label="Next step"
            description="Anything you want to remember to do."
            mt="sm"
            {...form.getInputProps('nextStep')}
          />
        </Card>

        <Card withBorder padding="lg">
          <Text fw={600} mb="sm">
            How you applied
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Application method"
              placeholder="Select…"
              clearable
              data={APPLICATION_METHODS.map((m) => ({
                value: m,
                label: APPLICATION_METHOD_LABELS[m],
              }))}
              {...form.getInputProps('applicationMethod')}
            />
            {form.values.applicationMethod === 'referral' && (
              <>
                <TextInput
                  label="Referred by"
                  placeholder="Name of the person"
                  {...form.getInputProps('referrerName')}
                />
                <Select
                  label="How did you speak?"
                  placeholder="Select…"
                  clearable
                  data={REFERRAL_CHANNELS.map((c) => ({
                    value: c,
                    label: REFERRAL_CHANNEL_LABELS[c],
                  }))}
                  {...form.getInputProps('referrerChannel')}
                />
              </>
            )}
          </SimpleGrid>
          <Textarea
            label="Method details"
            description="Job board name, recruiter, event, how it came up…"
            autosize
            minRows={2}
            mt="sm"
            {...form.getInputProps('methodDetails')}
          />
        </Card>

        {mode === 'create' && (
          <Card withBorder padding="lg">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Contacts</Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => form.insertListItem('contacts', emptyContact())}
              >
                Add contact
              </Button>
            </Group>
            <Stack>
              {form.values.contacts.length === 0 && (
                <Text size="sm" c="dimmed">
                  No contacts yet.
                </Text>
              )}
              {form.values.contacts.map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: list items have no stable id before save
                <Stack key={i} gap="xs">
                  {i > 0 && <Divider />}
                  <Group justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="Remove contact"
                      onClick={() => form.removeListItem('contacts', i)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                  <ContactFields form={form} prefix={`contacts.${i}`} />
                </Stack>
              ))}
            </Stack>
          </Card>
        )}

        <Group justify="flex-end">
          {onCancel && (
            <Button variant="default" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
