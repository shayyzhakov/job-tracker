import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

const PREFIX = 'SSM_';

/**
 * Lambda has no secret injection like ECS, so secrets live in SSM Parameter Store (SecureString, free) and the
 * function is configured with their *names*: every env var `SSM_<NAME>=<parameter name>` is resolved once per cold
 * start and exposed as `<NAME>` (e.g. SSM_ORIGIN_VERIFY_SECRET=/job-tracker/origin-verify-secret → process.env.ORIGIN_VERIFY_SECRET).
 */
export async function applySsmEnv(
  env: NodeJS.ProcessEnv = process.env,
  client: Pick<SSMClient, 'send'> = new SSMClient({}),
) {
  const wanted = Object.entries(env).filter(
    (e): e is [string, string] => e[0].startsWith(PREFIX) && Boolean(e[1]),
  );
  if (wanted.length === 0) return;
  const res = await client.send(
    new GetParametersCommand({ Names: wanted.map(([, name]) => name), WithDecryption: true }),
  );
  const values = new Map((res.Parameters ?? []).map((p) => [p.Name, p.Value]));
  const missing = wanted.filter(([, name]) => !values.has(name)).map(([, name]) => name);
  if (missing.length > 0) throw new Error(`SSM parameters not found: ${missing.join(', ')}`);
  for (const [envName, paramName] of wanted) {
    env[envName.slice(PREFIX.length)] = values.get(paramName);
  }
}
