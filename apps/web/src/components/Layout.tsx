import { AppShell, Burger, Button, Group, NavLink, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBriefcase, IconLayoutDashboard, IconList, IconPlus } from '@tabler/icons-react';
import { Link, Outlet, useLocation } from 'react-router';

const NAV = [
  { to: '/', label: 'Overview', icon: IconLayoutDashboard, exact: true },
  { to: '/applications', label: 'Applications', icon: IconList, exact: false },
];

export function Layout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { pathname } = useLocation();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <IconBriefcase size={22} />
            <Text fw={700}>Job Tracker</Text>
          </Group>
          <Button
            component={Link}
            to="/applications/new"
            size="xs"
            leftSection={<IconPlus size={14} />}
          >
            New application
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        {NAV.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            component={Link}
            to={to}
            label={label}
            leftSection={<Icon size={18} />}
            active={exact ? pathname === to : pathname.startsWith(to)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
