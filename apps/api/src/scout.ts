// Entry point for the scout worker (`@job-tracker/api/scout`): reuses the API's DynamoDB access and repositories.

export { createDb, type Db, type DbConfig, resolveDbConfig } from './db/dynamo.js';
export {
  type CompaniesRepository,
  DynamoCompaniesRepository,
} from './modules/companies/companies.repository.js';
export {
  DynamoOpportunitiesRepository,
  type NewOpportunity,
  type OpportunitiesRepository,
} from './modules/opportunities/opportunities.repository.js';
export {
  DynamoScoutCriteriaRepository,
  type ScoutCriteriaRepository,
} from './modules/scout-criteria/scout-criteria.repository.js';
export { applySsmEnv } from './ssm.js';
