import { SimpleGrid, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';

export interface ContactFormValues {
  name: string;
  role: string;
  email: string;
  phone: string;
}

export const emptyContact = (): ContactFormValues => ({ name: '', role: '', email: '', phone: '' });

/** Contact inputs bound to `form` at `prefix` (e.g. "contacts.0" or "" for a flat form). */
// biome-ignore lint/suspicious/noExplicitAny: shared between differently-shaped forms
export function ContactFields({ form, prefix }: { form: UseFormReturnType<any>; prefix: string }) {
  const path = (f: keyof ContactFormValues) => (prefix ? `${prefix}.${f}` : f);
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <TextInput label="Contact name" withAsterisk {...form.getInputProps(path('name'))} />
      <TextInput
        label="Contact role"
        placeholder="Recruiter, hiring manager…"
        {...form.getInputProps(path('role'))}
      />
      <TextInput label="Contact email" type="email" {...form.getInputProps(path('email'))} />
      <TextInput label="Contact phone" {...form.getInputProps(path('phone'))} />
    </SimpleGrid>
  );
}
