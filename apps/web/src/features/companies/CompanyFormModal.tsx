import {
  COMPANY_PRIORITIES,
  COMPANY_PRIORITY_LABELS,
  COMPANY_SIZE_LABELS,
  COMPANY_SIZES,
  type CompanyPriority,
  type CompanySize,
  type CompanyWithCountsDto,
  DEFAULT_COMPANY_PRIORITY,
} from '@job-tracker/shared';
import {
  Alert,
  Button,
  Group,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useCreateCompany, useUpdateCompany } from '../../api/hooks';

interface Values {
  name: string;
  size: CompanySize | null;
  priority: CompanyPriority;
  isPublic: boolean;
  website: string;
  location: string;
}

const EMPTY: Values = {
  name: '',
  size: null,
  priority: DEFAULT_COMPANY_PRIORITY,
  isPublic: false,
  website: '',
  location: '',
};

const toValues = (c: CompanyWithCountsDto): Values => ({
  name: c.name,
  size: c.size,
  priority: c.priority,
  isPublic: c.isPublic,
  website: c.website ?? '',
  location: c.location ?? '',
});

/** Add a company (company === null) or edit an existing one. */
export function CompanyFormModal({
  opened,
  company,
  onClose,
}: {
  opened: boolean;
  company: CompanyWithCountsDto | null;
  onClose: () => void;
}) {
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const form = useForm<Values>({
    initialValues: EMPTY,
    validate: { name: (v) => (v.trim() ? null : 'Required') },
  });
  const { setValues, resetDirty } = form;

  // Reset every time the modal opens (for a different company or a blank one).
  // biome-ignore lint/correctness/useExhaustiveDependencies: form and mutation helpers are stable
  useEffect(() => {
    if (!opened) return;
    const values = company ? toValues(company) : EMPTY;
    setValues(values);
    resetDirty(values);
    create.reset();
    update.reset();
  }, [opened, company]);

  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const submit = form.onSubmit(async (v) => {
    try {
      if (company) {
        await update.mutateAsync({
          id: company.id,
          patch: {
            name: v.name,
            size: v.size,
            priority: v.priority,
            isPublic: v.isPublic,
            website: v.website,
            location: v.location,
          },
        });
      } else {
        await create.mutateAsync({
          name: v.name,
          size: v.size ?? undefined,
          priority: v.priority,
          isPublic: v.isPublic,
          website: v.website,
          location: v.location,
        });
      }
      onClose();
    } catch {
      // Shown below from the mutation error.
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title={company ? 'Edit company' : 'Add company'}>
      <form onSubmit={submit} noValidate>
        <Stack>
          {company && company.totalApplications > 0 && (
            <Alert variant="light" color="blue" role="status">
              Changes apply to all {company.totalApplications} application
              {company.totalApplications === 1 ? '' : 's'} at this company.
            </Alert>
          )}
          <TextInput label="Name" withAsterisk data-autofocus {...form.getInputProps('name')} />
          <Select
            label="Size"
            placeholder="Select…"
            clearable
            data={COMPANY_SIZES.map((s) => ({ value: s, label: COMPANY_SIZE_LABELS[s] }))}
            {...form.getInputProps('size')}
          />
          <Select
            label="Scout priority"
            description="How hard the scout should look for jobs here. Blacklist hides the company from the scout."
            allowDeselect={false}
            data={COMPANY_PRIORITIES.map((p) => ({ value: p, label: COMPANY_PRIORITY_LABELS[p] }))}
            {...form.getInputProps('priority')}
          />
          <Input.Wrapper label="Type">
            <SegmentedControl
              fullWidth
              aria-label="Company type"
              value={form.values.isPublic ? 'public' : 'private'}
              onChange={(v) => form.setFieldValue('isPublic', v === 'public')}
              data={[
                { value: 'private', label: 'Private' },
                { value: 'public', label: 'Public' },
              ]}
            />
          </Input.Wrapper>
          <TextInput label="Website" {...form.getInputProps('website')} />
          <TextInput
            label="Location"
            placeholder="Tel Aviv, Remote…"
            {...form.getInputProps('location')}
          />
          {error && (
            <Alert color="red" role="alert">
              {error.message}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {company ? 'Save' : 'Add company'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
