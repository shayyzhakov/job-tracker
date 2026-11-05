import { INTERVIEW_TYPE_LABELS, type OverviewDto, STATUS_LABELS } from '@job-tracker/shared';
import { BarChart } from '@mantine/charts';
import { Anchor, Card, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { IconCalendarEvent } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useOverview } from '../../api/hooks';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { formatDateTime, formatIls, formatPercent } from '../../lib/format';

function Kpi({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return (
    <Card withBorder padding="lg">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text fz={32} fw={700} data-testid={testId}>
        {value}
      </Text>
    </Card>
  );
}

function NextInterview({ overview }: { overview: OverviewDto }) {
  const next = overview.nextInterview;
  return (
    <Card withBorder padding="lg" data-testid="next-interview">
      <Group gap="xs" mb="xs">
        <IconCalendarEvent size={18} />
        <Text fw={600}>Next interview</Text>
      </Group>
      {next ? (
        <Stack gap={2}>
          <Text fz="xl" fw={700}>
            {formatDateTime(next.scheduledAt)}
          </Text>
          <Anchor component={Link} to={`/applications/${next.applicationId}`}>
            {next.companyName} · {next.roleName}
          </Anchor>
          <Text size="sm" c="dimmed">
            {INTERVIEW_TYPE_LABELS[next.type]}
            {next.durationMinutes ? ` · ${next.durationMinutes} min` : ''}
          </Text>
        </Stack>
      ) : (
        <Text c="dimmed">No upcoming interviews scheduled.</Text>
      )}
    </Card>
  );
}

export function OverviewPage() {
  const { data, isPending, error } = useOverview();
  if (isPending) return <PageLoader />;
  if (error) return <ErrorAlert error={error} what="overview" />;

  const statusData = Object.entries(data.countsByStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status: STATUS_LABELS[status as keyof typeof STATUS_LABELS],
      count,
    }));

  return (
    <Stack>
      <Title order={2}>Overview</Title>
      <SimpleGrid cols={{ base: 2, md: 5 }}>
        <Kpi label="Active" value={data.activeApplications} testId="kpi-active" />
        <Kpi label="Total" value={data.totalApplications} testId="kpi-total" />
        <Kpi
          label="Response rate"
          value={formatPercent(data.responseRate)}
          testId="kpi-response-rate"
        />
        <Kpi
          label="Interviews (7 days)"
          value={data.interviewsNext7Days}
          testId="kpi-interviews-week"
        />
        <Kpi label="Offers" value={data.offers} testId="kpi-offers" />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <NextInterview overview={data} />
        <Card withBorder padding="lg">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Avg. expected salary (active)
          </Text>
          <Text fz={32} fw={700}>
            {formatIls(data.averageExpectedSalaryIls)}
          </Text>
          <Text size="sm" c="dimmed">
            Monthly gross
          </Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder padding="lg">
          <Text fw={600} mb="md">
            Applications by status
          </Text>
          {statusData.length > 0 ? (
            <BarChart
              h={260}
              data={statusData}
              dataKey="status"
              orientation="vertical"
              yAxisProps={{ width: 130 }}
              series={[{ name: 'count', label: 'Applications', color: 'indigo.6' }]}
            />
          ) : (
            <Text c="dimmed">No applications yet.</Text>
          )}
        </Card>
        <Card withBorder padding="lg">
          <Text fw={600} mb="md">
            Applied per week
          </Text>
          <BarChart
            h={260}
            data={data.weeklyApplied}
            dataKey="weekStart"
            series={[{ name: 'count', label: 'Applied', color: 'indigo.6' }]}
            xAxisProps={{ tickFormatter: (v: string) => v.slice(5) }}
            yAxisProps={{ allowDecimals: false }}
          />
        </Card>
      </SimpleGrid>

      <Card withBorder padding="lg">
        <Text fw={600} mb="md">
          Upcoming interviews
        </Text>
        {data.upcomingInterviews.length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>When</Table.Th>
                <Table.Th>Company</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Type</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.upcomingInterviews.map((i) => (
                <Table.Tr key={i.id}>
                  <Table.Td>{formatDateTime(i.scheduledAt)}</Table.Td>
                  <Table.Td>
                    <Anchor component={Link} to={`/applications/${i.applicationId}`}>
                      {i.companyName}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{i.roleName}</Table.Td>
                  <Table.Td>{INTERVIEW_TYPE_LABELS[i.type]}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed">Nothing scheduled yet. Add interviews from an application page.</Text>
        )}
      </Card>
    </Stack>
  );
}
