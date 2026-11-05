import {
  ApplicationCreateSchema,
  type ApplicationDetailDto,
  type ApplicationStatus,
  ApplicationUpdateSchema,
  COMPANY_SIZE_LABELS,
  COMPANY_SIZES,
  type CompanySize,
} from '@job-tracker/shared';
import {
  ActionIcon,
  Autocomplete,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  NumberInput,
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
  source: string;
  appliedAt: string | null;
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
  source: '',
  appliedAt: null,
  notes: '',
  contacts: [],
};

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
  source: a.source ?? '',
  appliedAt: a.appliedAt ? a.appliedAt.slice(0, 10) : null,
  notes: a.notes ?? '',
  contacts: [],
});

const salary = (v: number | string) => (typeof v === 'number' ? v : undefined);

/** Form values -> create payload (blank optional fields are dropped by the schema). */
export const toCreatePayload = (v: ApplicationFormValues) => ({
  ...v,
  company: { ...v.company, size: v.company.size ?? undefined },
  expectedSalaryIls: salary(v.expectedSalaryIls),
  appliedAt: v.appliedAt ?? undefined,
});

/** Form values -> PATCH payload (blank fields become null, i.e. cleared). */
export const toUpdatePayload = (v: ApplicationFormValues) => {
  const { status: _status, contacts: _contacts, ...rest } = v;
  return {
    ...rest,
    expectedSalaryIls: salary(v.expectedSalaryIls) ?? null,
    appliedAt: v.appliedAt ?? null,
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
              data={COMPANY_SIZES.map((s) => ({ value: s, label: COMPANY_SIZE_LABELS[s] }))}
              {...form.getInputProps('company.size')}
            />
            <TextInput
              label="Location"
              placeholder="Tel Aviv, Remote…"
              {...form.getInputProps('company.location')}
            />
            <TextInput label="Company website" {...form.getInputProps('company.website')} />
            <Checkbox
              label="Public company"
              {...form.getInputProps('company.isPublic', { type: 'checkbox' })}
            />
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
            <TextInput
              label="Source"
              placeholder="LinkedIn, referral…"
              {...form.getInputProps('source')}
            />
            <DateInput
              label="Applied on"
              clearable
              valueFormat="DD MMM YYYY"
              {...form.getInputProps('appliedAt')}
            />
            <Checkbox
              label="Management role"
              {...form.getInputProps('isManagement', { type: 'checkbox' })}
            />
          </SimpleGrid>
          <Textarea label="Notes" autosize minRows={3} mt="sm" {...form.getInputProps('notes')} />
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
