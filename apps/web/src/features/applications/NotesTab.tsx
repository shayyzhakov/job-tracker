import { INTERVIEW_TYPE_LABELS, type InterviewDto, type NoteDto } from '@job-tracker/shared';
import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import { formatDateTime } from '../../lib/format';
import { NoteList } from './NoteList';

/** Every note of the application in one view, grouped by interview (newest interview first). */
export function NotesTab({
  applicationId,
  interviews,
  notes,
}: {
  applicationId: string;
  interviews: InterviewDto[];
  notes: NoteDto[];
}) {
  const groups = [...interviews]
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
    .map((interview) => ({
      interview,
      notes: notes.filter((n) => n.interviewId === interview.id),
    }))
    .filter((g) => g.notes.length > 0);

  if (groups.length === 0) {
    return (
      <Card withBorder padding="lg">
        <Text c="dimmed" size="sm">
          No notes yet. Under Details, open Notes on an interview to add the first one.
        </Text>
      </Card>
    );
  }

  return (
    <Stack>
      {groups.map(({ interview, notes: group }) => (
        <Card key={interview.id} withBorder padding="lg" data-testid="notes-group">
          <Group gap="xs" mb="sm">
            <Text fw={600}>{formatDateTime(interview.scheduledAt)}</Text>
            <Badge variant="outline" size="sm">
              {INTERVIEW_TYPE_LABELS[interview.type]}
            </Badge>
          </Group>
          <NoteList applicationId={applicationId} interviewId={interview.id} notes={group} />
        </Card>
      ))}
    </Stack>
  );
}
