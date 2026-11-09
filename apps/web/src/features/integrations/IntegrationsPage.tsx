import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  List,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { IconCheck, IconCopy, IconInfoCircle } from '@tabler/icons-react';
import { mcpUrl } from './mcp-url';

const TOOLS: { area: string; tools: string[] }[] = [
  {
    area: 'Applications',
    tools: [
      'list_applications',
      'get_application',
      'create_application',
      'update_application',
      'change_application_status',
      'delete_application',
    ],
  },
  {
    area: 'Contacts',
    tools: ['list_contacts', 'get_contact', 'add_contact', 'update_contact', 'remove_contact'],
  },
  { area: 'Interviews', tools: ['schedule_interview', 'update_interview', 'remove_interview'] },
  { area: 'Interview notes', tools: ['list_notes', 'add_note', 'update_note', 'remove_note'] },
  {
    area: 'Companies',
    tools: [
      'search_companies',
      'list_companies',
      'get_company',
      'create_company',
      'update_company',
      'delete_company',
    ],
  },
  { area: 'Overview', tools: ['get_overview'] },
  {
    area: 'Suggestions',
    tools: ['list_suggestions', 'add_suggestion', 'promote_suggestion', 'dismiss_suggestion'],
  },
  { area: 'Scout settings', tools: ['get_scout_criteria', 'update_scout_criteria'] },
];

const EXAMPLES = [
  'What applications are waiting for a reply?',
  'Add an application for Senior Backend Engineer at Acme, found on LinkedIn.',
  'Move my Globex application to "interview" and schedule a call for next Tuesday at 10:00.',
  'Show this morning’s scout suggestions and add the best two to my applications.',
];

function CopyBlock({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Code block style={{ flex: 1, overflowX: 'auto' }} aria-label={label}>
        {value}
      </Code>
      <CopyButton value={value}>
        {({ copied, copy }) => (
          <Button
            variant="light"
            size="xs"
            onClick={copy}
            leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            aria-label={`Copy ${label}`}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </CopyButton>
    </Group>
  );
}

export function IntegrationsPage() {
  const url = mcpUrl(window.location.origin, import.meta.env.DEV);
  const claudeCode = `claude mcp add --transport http job-tracker ${url}`;
  const desktop = JSON.stringify(
    { mcpServers: { 'job-tracker': { command: 'npx', args: ['mcp-remote', url] } } },
    null,
    2,
  );

  return (
    <Stack maw={820}>
      <div>
        <Title order={2}>Integrations</Title>
        <Text c="dimmed" size="sm">
          Connect Claude to Job Tracker so you can manage your job search by chatting.
        </Text>
      </div>

      <Card withBorder>
        <Stack gap="xs">
          <Group gap="xs">
            <Title order={4}>MCP server</Title>
            <Badge variant="light">Streamable HTTP</Badge>
          </Group>
          <Text size="sm">
            Job Tracker exposes a{' '}
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">
              Model Context Protocol
            </a>{' '}
            server. Once connected, Claude can read and change your applications, contacts,
            interviews, suggestions and scout settings.
          </Text>
          <Text size="sm" fw={500}>
            Server URL
          </Text>
          <CopyBlock label="server URL" value={url} />
        </Stack>
      </Card>

      {import.meta.env.DEV ? (
        <Alert icon={<IconInfoCircle />} color="blue" title="Local development">
          Locally the endpoint has no authentication and only accepts connections from this machine.
          Start the API with <Code>pnpm dev</Code> before connecting.
        </Alert>
      ) : (
        <Alert icon={<IconInfoCircle />} color="blue" title="Sign in when you connect">
          The server uses OAuth. Add the URL to your client; it registers itself and opens a Sign-in
          page for your Job Tracker account. There is no token to copy.
        </Alert>
      )}

      <Card withBorder>
        <Title order={4} mb="sm">
          Connect
        </Title>
        <Tabs defaultValue="code">
          <Tabs.List>
            <Tabs.Tab value="web">Claude.ai</Tabs.Tab>
            <Tabs.Tab value="code">Claude Code</Tabs.Tab>
            <Tabs.Tab value="desktop">Claude Desktop</Tabs.Tab>
            <Tabs.Tab value="inspector">MCP Inspector</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="web" pt="md">
            <Stack gap="sm">
              <Text size="sm">
                In <b>Settings → Connectors → Add custom connector</b>, paste the server URL and
                leave the OAuth client fields empty. Claude registers itself and sends you to the
                Job Tracker sign-in page.
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="code" pt="md">
            <Stack gap="sm">
              <Text size="sm">Run this once in your terminal:</Text>
              <CopyBlock label="Claude Code command" value={claudeCode} />
              <Text size="sm" c="dimmed">
                Then start <Code>claude</Code>, run <Code>/mcp</Code>, pick <Code>job-tracker</Code>{' '}
                and choose Authenticate to sign in.
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="desktop" pt="md">
            <Stack gap="sm">
              <Text size="sm">
                Claude Desktop runs local servers, so bridge to the remote endpoint with{' '}
                <Code>mcp-remote</Code> (requires Node.js). Open{' '}
                <b>Settings → Developer → Edit Config</b> and add this to{' '}
                <Code>claude_desktop_config.json</Code>:
              </Text>
              <CopyBlock label="Claude Desktop config" value={desktop} />
              <Text size="sm" c="dimmed">
                Restart Claude Desktop afterwards. The Job Tracker tools appear in the tools menu of
                the chat box.
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="inspector" pt="md">
            <Stack gap="sm">
              <Text size="sm">To debug the connection or try the tools by hand:</Text>
              <CopyBlock label="Inspector command" value="npx @modelcontextprotocol/inspector" />
              <Text size="sm" c="dimmed">
                Choose the <Code>Streamable HTTP</Code> transport and enter the server URL above.
              </Text>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">
          Try asking Claude
        </Title>
        <List size="sm" spacing={4}>
          {EXAMPLES.map((e) => (
            <List.Item key={e}>{e}</List.Item>
          ))}
        </List>
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">
          Available tools
        </Title>
        <Table>
          <Table.Tbody>
            {TOOLS.map(({ area, tools }) => (
              <Table.Tr key={area}>
                <Table.Th w={140}>{area}</Table.Th>
                <Table.Td>
                  <Group gap={6}>
                    {tools.map((t) => (
                      <Code key={t}>{t}</Code>
                    ))}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Text size="xs" c="dimmed" mt="xs">
          Read-only tools are marked as such, and deletes are flagged destructive, so Claude asks
          before removing anything.
        </Text>
      </Card>
    </Stack>
  );
}
