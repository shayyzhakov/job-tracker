import {
  AppShell,
  Avatar,
  Badge,
  Burger,
  Group,
  Menu,
  NavLink,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBriefcase,
  IconChecklist,
  IconLayoutDashboard,
  IconList,
  IconLogout,
  IconPlugConnected,
  IconSparkles,
} from '@tabler/icons-react';
import { Link, Outlet, useLocation } from 'react-router';
import { useActions, useOpportunities } from '../api/hooks';
import { useSession } from '../auth/AuthGate';
import { displayNameOf, initialsOf } from '../auth/initials';
import { Slot } from '../lib/extensions';

const NAV = [
  { to: '/', label: 'Today', icon: IconChecklist, exact: true, countsActions: true },
  { to: '/overview', label: 'Overview', icon: IconLayoutDashboard, exact: true },
  { to: '/applications', label: 'Applications', icon: IconList, exact: false },
  { to: '/suggestions', label: 'Suggestions', icon: IconSparkles, exact: false, countsNew: true },
  { to: '/integrations', label: 'Integrations', icon: IconPlugConnected, exact: false },
];

export function Layout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { pathname } = useLocation();
  const session = useSession();
  const userName = session && displayNameOf(session.user);
  const { data: newSuggestions } = useOpportunities('new');
  const suggestionCount = newSuggestions?.length ?? 0;
  const { data: actions } = useActions();
  const actionCount = actions?.counts.needsYou ?? 0;
  const overdueCount = actions?.counts.overdue ?? 0;

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <AppShell
        header={{ height: 56 }}
        navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="xs">
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <IconBriefcase size={22} aria-hidden />
              <Text fw={700}>Job Tracker</Text>
            </Group>
            <Group gap="sm">
              <Slot name="header.right" />
              {session && (
                <Menu position="bottom-end" shadow="md" width={240}>
                  <Menu.Target>
                    <UnstyledButton
                      data-testid="user-badge"
                      aria-label={`Account menu for ${userName ?? 'user'}`}
                      style={{ borderRadius: '50%', display: 'flex' }}
                    >
                      <Avatar color="indigo" variant="filled" radius="xl" size="sm">
                        {initialsOf(userName)}
                      </Avatar>
                    </UnstyledButton>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>
                      <Text size="sm" c="dimmed" truncate="end" data-testid="user-email">
                        {session.user.email ?? userName}
                      </Text>
                    </Menu.Label>
                    <Menu.Divider />
                    <Menu.Item leftSection={<IconLogout size={18} />} onClick={session.signOut}>
                      Sign out
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          </Group>
        </AppShell.Header>
        <AppShell.Navbar p="xs">
          {NAV.map(({ to, label, icon: Icon, exact, countsNew, countsActions }) => (
            <NavLink
              key={to}
              component={Link}
              to={to}
              label={label}
              leftSection={<Icon size={18} />}
              rightSection={
                countsActions && actionCount > 0 ? (
                  <Badge
                    size="sm"
                    radius="xl"
                    variant="filled"
                    color={overdueCount > 0 ? 'red' : 'indigo'}
                    aria-label={`${actionCount} actions need you${overdueCount > 0 ? `, ${overdueCount} overdue` : ''}`}
                    data-testid="actions-count"
                  >
                    {actionCount}
                  </Badge>
                ) : countsNew && suggestionCount > 0 ? (
                  <Badge
                    size="sm"
                    radius="xl"
                    variant="filled"
                    color="indigo"
                    aria-label={`${suggestionCount} suggestions`}
                    data-testid="suggestions-count"
                  >
                    {suggestionCount}
                  </Badge>
                ) : undefined
              }
              active={exact ? pathname === to : pathname.startsWith(to)}
              onClick={close}
            />
          ))}
        </AppShell.Navbar>
        <AppShell.Main id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
          <Outlet />
        </AppShell.Main>
      </AppShell>
    </>
  );
}
