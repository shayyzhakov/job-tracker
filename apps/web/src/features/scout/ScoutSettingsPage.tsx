import {
  COMPANY_SIZE_LABELS,
  COMPANY_SIZES,
  type CompanySize,
  ROLE_TRACK_LABELS,
  ROLE_TRACKS,
  type RoleTrack,
  type ScoutCriteria,
  type ScoutCriteriaDto,
  ScoutCriteriaSchema,
  SENIORITY_LABELS,
  SENIORITY_LEVELS,
  type Seniority,
} from '@job-tracker/shared';
import {
  Alert,
  Anchor,
  Button,
  Card,
  Chip,
  Group,
  Input,
  MultiSelect,
  SegmentedControl,
  Slider,
  Stack,
  TagsInput,
  Text,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useSaveScoutCriteria, useScoutCriteria } from '../../api/hooks';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { formatDateTime } from '../../lib/format';
import { zodErrors } from '../../lib/zod-form';

export function ScoutSettingsPage() {
  const { data, isPending, error } = useScoutCriteria();
  return (
    <Stack maw={720}>
      <div>
        <Title order={2}>Scout settings</Title>
        <Text c="dimmed" size="sm">
          What the AI scout looks for when it checks new listings each morning.
        </Text>
      </div>
      {isPending ? (
        <PageLoader />
      ) : error ? (
        <ErrorAlert error={error} what="scout settings" />
      ) : (
        <CriteriaForm saved={data} />
      )}
    </Stack>
  );
}

const toValues = ({ updatedAt: _updatedAt, ...criteria }: ScoutCriteriaDto): ScoutCriteria =>
  criteria;

function CriteriaForm({ saved }: { saved: ScoutCriteriaDto }) {
  const save = useSaveScoutCriteria();
  const form = useForm<ScoutCriteria>({
    initialValues: toValues(saved),
    validate: (values) => zodErrors(ScoutCriteriaSchema, values),
  });

  const onSubmit = form.onSubmit((values) =>
    save.mutate(values, { onSuccess: (next) => form.resetDirty(toValues(next)) }),
  );

  return (
    <form onSubmit={onSubmit}>
      <Stack>
        {saved.updatedAt === null && (
          <Alert icon={<IconInfoCircle />} color="blue">
            The scout won't run until you save your criteria.
          </Alert>
        )}
        <Card withBorder>
          <Stack>
            <TagsInput
              label="Roles"
              description="Job titles to look for. Press Enter after each one."
              placeholder="e.g. Backend Engineer"
              {...form.getInputProps('roles')}
            />
            <MultiSelect
              label="Seniority"
              placeholder="Any seniority"
              data={SENIORITY_LEVELS.map((s) => ({ value: s, label: SENIORITY_LABELS[s] }))}
              value={form.values.seniorities}
              onChange={(v) => form.setFieldValue('seniorities', v as Seniority[])}
              error={form.errors.seniorities}
            />
            <Input.Wrapper label="Track">
              <div>
                <SegmentedControl
                  data={ROLE_TRACKS.map((t) => ({ value: t, label: ROLE_TRACK_LABELS[t] }))}
                  value={form.values.track}
                  onChange={(v) => form.setFieldValue('track', v as RoleTrack)}
                />
              </div>
            </Input.Wrapper>
            <TagsInput
              label="Locations"
              placeholder="e.g. Tel Aviv, Remote (Israel)"
              {...form.getInputProps('locations')}
            />
          </Stack>
        </Card>

        <Card withBorder>
          <Stack>
            <Input.Wrapper
              label="Company size"
              description="Leave all unselected to accept any size."
            >
              <Chip.Group
                multiple
                value={form.values.companySizes}
                onChange={(v) => form.setFieldValue('companySizes', v as CompanySize[])}
              >
                <Group gap="xs" mt={6}>
                  {COMPANY_SIZES.map((s) => (
                    <Chip key={s} value={s}>
                      {COMPANY_SIZE_LABELS[s]}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            </Input.Wrapper>
            <Text size="sm" c="dimmed">
              Want to skip or favour specific companies?{' '}
              <Anchor component={Link} to="/scout/companies">
                Prioritize companies
              </Anchor>
              .
            </Text>
            <Input.Wrapper
              label="Minimum match score"
              description="Listings scoring lower are hidden."
            >
              <Slider
                mt="xs"
                min={0}
                max={100}
                step={5}
                marks={[{ value: 0 }, { value: 50 }, { value: 100 }]}
                label={(v) => v}
                aria-label="Minimum match score"
                {...form.getInputProps('minScore')}
              />
            </Input.Wrapper>
          </Stack>
        </Card>

        {save.error && (
          <Alert color="red" icon={<IconAlertCircle />} title="Could not save">
            {save.error.message}
          </Alert>
        )}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {save.isSuccess && !form.isDirty()
              ? 'Saved.'
              : saved.updatedAt
                ? `Last saved ${formatDateTime(saved.updatedAt)}`
                : ''}
          </Text>
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
