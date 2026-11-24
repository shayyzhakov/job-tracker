import { type ApplicationDetailDto, INTERVIEW_TYPE_LABELS } from '@job-tracker/shared';
import { Alert, Button, Group, Text, Textarea, TextInput } from '@mantine/core';
import { IconMessage2Question } from '@tabler/icons-react';
import { useState } from 'react';
import { useActions, useInterviewMutations, useNoteMutations } from '../../api/hooks';
import { FormModal } from '../../components/FormModal';
import { formatDateTime } from '../../lib/format';

/**
 * Shown at the top of the application page while a held interview still needs "how it went".
 * The prompt comes from the same action the Tasks page shows (`debrief`), so both always agree.
 * Saving the dialog adds the text as a note on that interview and marks it debriefed, so the user
 * never has to know that a note alone does not clear the prompt.
 */
export function DebriefBanner({ app }: { app: ApplicationDetailDto }) {
  const { data: actions } = useActions();
  const [opened, setOpened] = useState(false);
  const [text, setText] = useState('');
  const [replyBy, setReplyBy] = useState('');
  const { update } = useInterviewMutations(app.id);
  const notes = useNoteMutations(app.id);

  const action = actions?.needsYou.find(
    (a) => a.applicationId === app.id && a.kind === 'debrief' && a.interviewId,
  );
  const interview = action && app.interviews.find((i) => i.id === action.interviewId);
  if (!action || !interview) return null;

  const label = INTERVIEW_TYPE_LABELS[interview.type];
  const open = () => {
    update.reset();
    notes.create.reset();
    setText('');
    setReplyBy('');
    setOpened(true);
  };
  const submit = async () => {
    if (!text.trim()) return;
    // Note first: if it fails nothing else changed and the prompt stays.
    await notes.create.mutateAsync({ interviewId: interview.id, text: text.trim() });
    await update.mutateAsync({
      id: interview.id,
      patch: { debriefed: true, ...(replyBy ? { replyBy: new Date(replyBy) } : {}) },
    });
    setOpened(false);
  };

  return (
    <>
      <Alert
        color="yellow"
        variant="light"
        icon={<IconMessage2Question size={18} />}
        title="Log how the interview went"
        data-testid="debrief-banner"
      >
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">
            Your {label} interview ({formatDateTime(interview.scheduledAt)}) is over. Write down how
            it went while you remember it.
          </Text>
          <Button size="xs" onClick={open}>
            Log how it went
          </Button>
        </Group>
      </Alert>
      <FormModal
        opened={opened}
        onClose={() => setOpened(false)}
        title={`How did the ${label} interview go?`}
        onSubmit={(e) => {
          e.preventDefault();
          submit().catch(() => {});
        }}
        submitLabel="Save"
        submitting={notes.create.isPending || update.isPending}
        submitDisabled={text.trim() === ''}
        error={(notes.create.error ?? update.error)?.message}
      >
        <Textarea
          label="How it went"
          description="Questions asked, impressions, what to do next. Saved as a note on this interview."
          autosize
          minRows={4}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          data-autofocus
        />
        <TextInput
          type="datetime-local"
          label="They'll reply by (optional)"
          description="Replaces the default follow-up timer."
          value={replyBy}
          onChange={(e) => setReplyBy(e.currentTarget.value)}
        />
      </FormModal>
    </>
  );
}
