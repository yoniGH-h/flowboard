// Development seed data. Mirrors frontend/src/mock/seedData.ts so the same
// demo accounts and sample projects exist once the backend is the source of truth.
// All data is fictional. Password for every seeded user is "password123".
//
// Run with: npm run prisma:seed   (wipes the existing data first - dev databases only!)
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
// Role permissions come from the same catalog the server enforces.
import { PERMISSION_BY_KEY, ROLE_DEFAULTS } from '../src/permissions/catalog.js';
import { calculateRisk } from '../src/modules/projects/risk.js';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const UPLOADS_DIR = resolve(import.meta.dirname, '..', process.env.UPLOADS_DIR ?? './uploads');
const NOW = new Date();
function iso(offsetDays, hour = 9) {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}
const PASSWORD_HASH = bcrypt.hashSync('password123', 12);
const ROLE_DEFINITIONS = [
  {
    name: 'EMPLOYEE',
    label: 'Employee',
    description: 'Can manage assigned work inside the projects they belong to.',
    permissions: ROLE_DEFAULTS.EMPLOYEE,
  },
  {
    name: 'PROJECT_MANAGER',
    label: 'Project Manager',
    description: 'Manages projects, teams, boards, and reporting for owned projects.',
    permissions: ROLE_DEFAULTS.PROJECT_MANAGER,
  },
  {
    name: 'ORG_ADMIN',
    label: 'Organization Administrator',
    description: 'Owns organization-wide configuration, users, roles, and audit visibility.',
    permissions: ROLE_DEFAULTS.ORG_ADMIN,
  },
  {
    name: 'SYSTEM_ADMIN',
    label: 'System Administrator',
    description: 'Oversees all organizations registered on the FlowBoard platform.',
    permissions: ROLE_DEFAULTS.SYSTEM_ADMIN,
  },
];
const LABELS = [
  { key: 'bug', name: 'Bug', color: '#D64545' },
  { key: 'feature', name: 'Feature', color: '#3454D1' },
  { key: 'design', name: 'Design', color: '#A056E0' },
  { key: 'backend', name: 'Backend', color: '#1B998B' },
  { key: 'frontend', name: 'Frontend', color: '#E1701A' },
  { key: 'tech-debt', name: 'Tech Debt', color: '#6B7280' },
  { key: 'docs', name: 'Documentation', color: '#2E7D32' },
];
const ORGANIZATIONS = [
  { key: 'nimbus', name: 'Nimbus Digital', slug: 'nimbus-digital', plan: 'BUSINESS' },
  { key: 'harborline', name: 'Harborline Logistics', slug: 'harborline-logistics', plan: 'TEAM' },
  { key: 'solstice', name: 'Solstice Health', slug: 'solstice-health', plan: 'BUSINESS' },
];
const USERS = [
  {
    key: 'ava',
    org: 'nimbus',
    firstName: 'Ava',
    lastName: 'Reynolds',
    email: 'ava.reynolds@nimbusdigital.io',
    avatarColor: '#3454D1',
    title: 'Head of Engineering',
    roles: ['EMPLOYEE', 'PROJECT_MANAGER', 'ORG_ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'daniel',
    org: 'nimbus',
    firstName: 'Daniel',
    lastName: 'Cho',
    email: 'daniel.cho@nimbusdigital.io',
    avatarColor: '#1B998B',
    title: 'Engineering Manager',
    roles: ['EMPLOYEE', 'PROJECT_MANAGER'],
  },
  {
    key: 'priya',
    org: 'nimbus',
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@nimbusdigital.io',
    avatarColor: '#E1701A',
    title: 'Frontend Developer',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'marcus',
    org: 'nimbus',
    firstName: 'Marcus',
    lastName: 'Webb',
    email: 'marcus.webb@nimbusdigital.io',
    avatarColor: '#7A5CFA',
    title: 'Backend Developer',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'lena',
    org: 'nimbus',
    firstName: 'Lena',
    lastName: 'Fischer',
    email: 'lena.fischer@nimbusdigital.io',
    avatarColor: '#C4406A',
    title: 'QA Engineer',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'sam',
    org: 'nimbus',
    firstName: 'Sam',
    lastName: 'Okafor',
    email: 'sam.okafor@nimbusdigital.io',
    avatarColor: '#2E7D32',
    title: 'Platform Administrator',
    roles: ['EMPLOYEE', 'SYSTEM_ADMIN'],
  },
  {
    key: 'grace',
    org: 'harborline',
    firstName: 'Grace',
    lastName: 'Kim',
    email: 'grace.kim@harborline.com',
    avatarColor: '#3454D1',
    title: 'Operations Director',
    roles: ['EMPLOYEE', 'PROJECT_MANAGER', 'ORG_ADMIN'],
  },
  {
    key: 'tomas',
    org: 'harborline',
    firstName: 'Tomás',
    lastName: 'Alvarez',
    email: 'tomas.alvarez@harborline.com',
    avatarColor: '#1B998B',
    title: 'Delivery Lead',
    roles: ['EMPLOYEE', 'PROJECT_MANAGER'],
  },
  {
    key: 'nadia',
    org: 'harborline',
    firstName: 'Nadia',
    lastName: 'Petrov',
    email: 'nadia.petrov@harborline.com',
    avatarColor: '#E1701A',
    title: 'Data Analyst',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'ethan',
    org: 'harborline',
    firstName: 'Ethan',
    lastName: 'Brooks',
    email: 'ethan.brooks@harborline.com',
    avatarColor: '#7A5CFA',
    title: 'Support Engineer',
    roles: ['EMPLOYEE'],
  },
  // --- Additional Nimbus Digital team members ---
  {
    key: 'olivia',
    org: 'nimbus',
    firstName: 'Olivia',
    lastName: 'Bennett',
    email: 'olivia.bennett@nimbusdigital.io',
    avatarColor: '#D64545',
    title: 'Product Manager',
    roles: ['EMPLOYEE', 'PROJECT_MANAGER'],
  },
  {
    key: 'ravi',
    org: 'nimbus',
    firstName: 'Ravi',
    lastName: 'Patel',
    email: 'ravi.patel@nimbusdigital.io',
    avatarColor: '#1B998B',
    title: 'Backend Developer',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'sofia',
    org: 'nimbus',
    firstName: 'Sofia',
    lastName: 'Moreau',
    email: 'sofia.moreau@nimbusdigital.io',
    avatarColor: '#A056E0',
    title: 'UX Designer',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'james',
    org: 'nimbus',
    firstName: 'James',
    lastName: "O'Brien",
    email: 'james.obrien@nimbusdigital.io',
    avatarColor: '#6B7280',
    title: 'DevOps Engineer',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'chloe',
    org: 'nimbus',
    firstName: 'Chloe',
    lastName: 'Tanaka',
    email: 'chloe.tanaka@nimbusdigital.io',
    avatarColor: '#E1701A',
    title: 'Frontend Developer',
    roles: ['EMPLOYEE'],
  },
  // --- Additional Harborline Logistics team members ---
  {
    key: 'isabella',
    org: 'harborline',
    firstName: 'Isabella',
    lastName: 'Rossi',
    email: 'isabella.rossi@harborline.com',
    avatarColor: '#C4406A',
    title: 'Fleet Coordinator',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'felix',
    org: 'harborline',
    firstName: 'Felix',
    lastName: 'Nakamura',
    email: 'felix.nakamura@harborline.com',
    avatarColor: '#2E7D32',
    title: 'Warehouse Supervisor',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'amara',
    org: 'harborline',
    firstName: 'Amara',
    lastName: 'Okonkwo',
    email: 'amara.okonkwo@harborline.com',
    avatarColor: '#3454D1',
    title: 'Finance Analyst',
    roles: ['EMPLOYEE', 'PROJECT_MANAGER'],
  },
  // --- Solstice Health ---
  {
    key: 'maya',
    org: 'solstice',
    firstName: 'Maya',
    lastName: 'Lindqvist',
    email: 'maya.lindqvist@solsticehealth.io',
    avatarColor: '#3454D1',
    title: 'Head of Product',
    roles: ['EMPLOYEE', 'PROJECT_MANAGER', 'ORG_ADMIN'],
  },
  {
    key: 'ben',
    org: 'solstice',
    firstName: 'Ben',
    lastName: 'Ferreira',
    email: 'ben.ferreira@solsticehealth.io',
    avatarColor: '#1B998B',
    title: 'Backend Developer',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'zara',
    org: 'solstice',
    firstName: 'Zara',
    lastName: 'Ahmadi',
    email: 'zara.ahmadi@solsticehealth.io',
    avatarColor: '#E1701A',
    title: 'Frontend Developer',
    roles: ['EMPLOYEE'],
  },
  {
    key: 'leo',
    org: 'solstice',
    firstName: 'Leo',
    lastName: 'Kowalski',
    email: 'leo.kowalski@solsticehealth.io',
    avatarColor: '#C4406A',
    title: 'QA Engineer',
    roles: ['EMPLOYEE'],
  },
];
const COLUMN_DEFS = [
  { name: 'Backlog', category: 'TODO', order: 0 },
  { name: 'To Do', category: 'TODO', order: 1 },
  { name: 'In Progress', category: 'IN_PROGRESS', order: 2, wipLimit: 5 },
  { name: 'In Review', category: 'REVIEW', order: 3, wipLimit: 4 },
  { name: 'Done', category: 'DONE', order: 4 },
];
const PROJECTS = [
  {
    key: 'atlas',
    org: 'nimbus',
    name: 'Atlas Customer Portal',
    description: 'Self-service customer portal covering billing, support tickets, and account management.',
    status: 'ACTIVE',
    manager: 'daniel',
    members: ['daniel', 'priya', 'marcus', 'lena'],
    startOffset: -90,
    targetOffset: 30,
    progress: 62,
    archived: false,
    riskScore: 28,
    riskLevel: 'LOW',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 8, detail: '1 of 9 open tasks overdue (11%)' },
      { label: 'Blocked tasks', contribution: 4, detail: '1 of 9 open tasks blocked (11%)' },
      { label: 'Team workload', contribution: 6, detail: 'Team utilization within healthy range' },
      { label: 'Remaining time', contribution: 5, detail: '30 days remaining, on schedule' },
      { label: 'Progress vs plan', contribution: 5, detail: 'Actual progress close to planned pace' },
    ],
  },
  {
    key: 'mobile',
    org: 'nimbus',
    name: 'Nimbus Mobile Revamp',
    description: 'Rebuild of the companion mobile web experience with a new component library.',
    status: 'AT_RISK',
    manager: 'ava',
    members: ['ava', 'priya', 'marcus'],
    startOffset: -70,
    targetOffset: 10,
    progress: 38,
    archived: false,
    riskScore: 68,
    riskLevel: 'HIGH',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 22, detail: '3 of 7 open tasks overdue (43%)' },
      { label: 'Blocked tasks', contribution: 16, detail: '2 of 7 open tasks blocked (29%)' },
      { label: 'Team workload', contribution: 12, detail: 'Two contributors above 90% allocation' },
      { label: 'Remaining time', contribution: 10, detail: 'Only 10 days remaining before target date' },
      { label: 'Progress vs plan', contribution: 8, detail: 'Actual progress trailing planned pace by ~24 points' },
    ],
  },
  {
    key: 'analytics',
    org: 'nimbus',
    name: 'Internal Analytics Suite',
    description: 'Cross-team reporting suite for engineering and product KPIs.',
    status: 'PLANNING',
    manager: 'daniel',
    members: ['daniel', 'marcus'],
    startOffset: 5,
    targetOffset: 95,
    progress: 6,
    archived: false,
    riskScore: 15,
    riskLevel: 'LOW',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 0, detail: 'No open tasks overdue yet' },
      { label: 'Blocked tasks', contribution: 0, detail: 'No blocked tasks' },
      { label: 'Team workload', contribution: 5, detail: 'Light early-stage allocation' },
      { label: 'Remaining time', contribution: 5, detail: '95 days remaining, plenty of runway' },
      { label: 'Progress vs plan', contribution: 5, detail: 'Still within planning buffer' },
    ],
  },
  {
    key: 'marketing',
    org: 'nimbus',
    name: 'Q3 Marketing Site',
    description: 'Public marketing site refresh for the Q3 product launch.',
    status: 'COMPLETED',
    manager: 'ava',
    members: ['ava', 'lena'],
    startOffset: -160,
    targetOffset: -40,
    progress: 100,
    archived: true,
    riskScore: 5,
    riskLevel: 'LOW',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 0, detail: 'No open tasks remain' },
      { label: 'Blocked tasks', contribution: 0, detail: 'No blocked tasks' },
      { label: 'Team workload', contribution: 0, detail: 'Project closed out' },
      { label: 'Remaining time', contribution: 0, detail: 'Delivered before target date' },
      { label: 'Progress vs plan', contribution: 5, detail: 'Completed on planned schedule' },
    ],
  },
  {
    key: 'fleet',
    org: 'harborline',
    name: 'Fleet Tracking Dashboard',
    description: 'Live GPS fleet tracking dashboard with delay alerts for dispatch.',
    status: 'ACTIVE',
    manager: 'tomas',
    members: ['tomas', 'nadia', 'ethan'],
    startOffset: -50,
    targetOffset: 40,
    progress: 45,
    archived: false,
    riskScore: 34,
    riskLevel: 'MEDIUM',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 12, detail: '1 of 5 open tasks overdue (20%)' },
      { label: 'Blocked tasks', contribution: 8, detail: '1 of 5 open tasks blocked (20%)' },
      { label: 'Team workload', contribution: 6, detail: 'Balanced across the small team' },
      { label: 'Remaining time', contribution: 4, detail: '40 days remaining' },
      { label: 'Progress vs plan', contribution: 4, detail: 'Slightly behind planned pace' },
    ],
  },
  {
    key: 'warehouse',
    org: 'harborline',
    name: 'Warehouse Automation Pilot',
    description: 'Pilot program evaluating automated sorting for the north warehouse.',
    status: 'ON_HOLD',
    manager: 'tomas',
    members: ['tomas', 'nadia'],
    startOffset: -30,
    targetOffset: 120,
    progress: 12,
    archived: false,
    riskScore: 22,
    riskLevel: 'LOW',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 0, detail: 'No open tasks overdue' },
      { label: 'Blocked tasks', contribution: 10, detail: 'On hold pending budget approval' },
      { label: 'Team workload', contribution: 4, detail: 'Minimal active allocation' },
      { label: 'Remaining time', contribution: 4, detail: '120 days remaining' },
      { label: 'Progress vs plan', contribution: 4, detail: 'Paused, limited progress expected' },
    ],
  },
  {
    key: 'billing',
    org: 'nimbus',
    name: 'Billing Platform Migration',
    description: 'Migrate subscription billing off the legacy processor onto the new usage-based billing engine.',
    status: 'ACTIVE',
    manager: 'olivia',
    members: ['olivia', 'ravi', 'james'],
    startOffset: -60,
    targetOffset: 45,
    progress: 55,
    archived: false,
    riskScore: 30,
    riskLevel: 'LOW',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 8, detail: '1 of 8 open tasks overdue (13%)' },
      { label: 'Blocked tasks', contribution: 6, detail: '1 of 8 open tasks blocked (13%)' },
      { label: 'Team workload', contribution: 6, detail: 'Team utilization within healthy range' },
      { label: 'Remaining time', contribution: 5, detail: '45 days remaining, on schedule' },
      { label: 'Progress vs plan', contribution: 5, detail: 'Actual progress close to planned pace' },
    ],
  },
  {
    key: 'designsystem',
    org: 'nimbus',
    name: 'Design System 2.0',
    description: 'Rebuild the shared component library and design tokens used across all Nimbus products.',
    status: 'PLANNING',
    manager: 'ava',
    members: ['ava', 'sofia', 'chloe'],
    startOffset: 10,
    targetOffset: 100,
    progress: 8,
    archived: false,
    riskScore: 12,
    riskLevel: 'LOW',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 0, detail: 'No open tasks overdue yet' },
      { label: 'Blocked tasks', contribution: 0, detail: 'No blocked tasks' },
      { label: 'Team workload', contribution: 4, detail: 'Light early-stage allocation' },
      { label: 'Remaining time', contribution: 4, detail: '100 days remaining, plenty of runway' },
      { label: 'Progress vs plan', contribution: 4, detail: 'Still within planning buffer' },
    ],
  },
  {
    key: 'notifysvc',
    org: 'nimbus',
    name: 'Customer Notification Service',
    description: 'Shared email, SMS, and in-app notification service consolidating five legacy senders.',
    status: 'COMPLETED',
    manager: 'olivia',
    members: ['olivia', 'ravi'],
    startOffset: -120,
    targetOffset: -20,
    progress: 100,
    archived: true,
    riskScore: 4,
    riskLevel: 'LOW',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 0, detail: 'No open tasks remain' },
      { label: 'Blocked tasks', contribution: 0, detail: 'No blocked tasks' },
      { label: 'Team workload', contribution: 0, detail: 'Project closed out' },
      { label: 'Remaining time', contribution: 0, detail: 'Delivered before target date' },
      { label: 'Progress vs plan', contribution: 4, detail: 'Completed on planned schedule' },
    ],
  },
  {
    key: 'safety',
    org: 'harborline',
    name: 'Driver Safety Compliance Portal',
    description: 'Portal for tracking driver certifications, inspections, and safety incident reporting.',
    status: 'ACTIVE',
    manager: 'amara',
    members: ['amara', 'isabella', 'felix'],
    startOffset: -40,
    targetOffset: 50,
    progress: 40,
    archived: false,
    riskScore: 33,
    riskLevel: 'MEDIUM',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 10, detail: '1 of 6 open tasks overdue (17%)' },
      { label: 'Blocked tasks', contribution: 8, detail: '1 of 6 open tasks blocked (17%)' },
      { label: 'Team workload', contribution: 6, detail: 'Balanced across the small team' },
      { label: 'Remaining time', contribution: 5, detail: '50 days remaining' },
      { label: 'Progress vs plan', contribution: 4, detail: 'Slightly behind planned pace' },
    ],
  },
  {
    key: 'routing',
    org: 'harborline',
    name: 'Route Optimization Engine',
    description: 'Evaluate and integrate a route optimization engine to reduce fuel costs across delivery routes.',
    status: 'PLANNING',
    manager: 'grace',
    members: ['grace', 'tomas'],
    startOffset: 15,
    targetOffset: 110,
    progress: 5,
    archived: false,
    riskScore: 10,
    riskLevel: 'LOW',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 0, detail: 'No open tasks overdue yet' },
      { label: 'Blocked tasks', contribution: 0, detail: 'No blocked tasks' },
      { label: 'Team workload', contribution: 3, detail: 'Light early-stage allocation' },
      { label: 'Remaining time', contribution: 3, detail: '110 days remaining, plenty of runway' },
      { label: 'Progress vs plan', contribution: 4, detail: 'Still within planning buffer' },
    ],
  },
  {
    key: 'intake',
    org: 'solstice',
    name: 'Patient Intake Redesign',
    description: 'Redesign the digital patient intake flow to cut average check-in time and reduce paperwork errors.',
    status: 'ACTIVE',
    manager: 'maya',
    members: ['maya', 'ben', 'zara', 'leo'],
    startOffset: -55,
    targetOffset: 25,
    progress: 48,
    archived: false,
    riskScore: 45,
    riskLevel: 'MEDIUM',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 14, detail: '2 of 8 open tasks overdue (25%)' },
      { label: 'Blocked tasks', contribution: 10, detail: '1 of 8 open tasks blocked (13%)' },
      { label: 'Team workload', contribution: 8, detail: 'One contributor above 90% allocation' },
      { label: 'Remaining time', contribution: 7, detail: '25 days remaining before target date' },
      { label: 'Progress vs plan', contribution: 6, detail: 'Actual progress trailing planned pace slightly' },
    ],
  },
  {
    key: 'reminders',
    org: 'solstice',
    name: 'Appointment Reminder Automations',
    description: 'Automated multi-channel reminders to cut missed-appointment rates across all clinics.',
    status: 'AT_RISK',
    manager: 'maya',
    members: ['maya', 'ben'],
    startOffset: -35,
    targetOffset: 5,
    progress: 20,
    archived: false,
    riskScore: 60,
    riskLevel: 'HIGH',
    riskFactors: [
      { label: 'Overdue tasks', contribution: 20, detail: '2 of 4 open tasks overdue (50%)' },
      { label: 'Blocked tasks', contribution: 14, detail: '1 of 4 open tasks blocked (25%)' },
      { label: 'Team workload', contribution: 10, detail: 'Single contributor carrying most open work' },
      { label: 'Remaining time', contribution: 9, detail: 'Only 5 days remaining before target date' },
      { label: 'Progress vs plan', contribution: 7, detail: 'Actual progress trailing planned pace by ~30 points' },
    ],
  },
];
const TASKS = [
  // Atlas Customer Portal
  t('atlas', 'Design new billing summary page', 'Create high-fidelity mockups for the redesigned billing summary, including empty and error states.', 'priya', 'daniel', 'HIGH', -20, -2, 16, 15, ['design', 'frontend'], 'Done', false, -3),
  t('atlas', 'Implement invoice PDF export', 'Allow customers to export a single invoice or a date range as PDF.', 'marcus', 'daniel', 'MEDIUM', -14, 3, 12, 6, ['backend'], 'In Progress', false, null),
  t('atlas', 'Fix support ticket pagination bug', 'Pagination resets to page 1 after replying to a ticket.', 'marcus', 'lena', 'URGENT', -5, -1, 4, 5, ['bug', 'backend'], 'Done', false, -1),
  t('atlas', 'Add two-factor authentication settings', 'Let customers enable SMS or authenticator-app based 2FA from account settings.', 'marcus', 'daniel', 'HIGH', -10, 6, 20, 9, ['backend', 'feature'], 'In Progress', false, null),
  t('atlas', 'QA pass on account management flows', 'Full regression pass across profile, billing, and team management pages.', 'lena', 'daniel', 'MEDIUM', -2, 4, 10, null, ['frontend'], 'To Do', false, null),
  t('atlas', 'Refactor billing API client', 'Consolidate duplicate request logic into a shared billing API client.', 'marcus', 'marcus', 'LOW', -8, -1, 6, 7, ['tech-debt', 'backend'], 'Done', false, -2),
  t('atlas', 'Write help-center article for 2FA', 'Document the new 2FA setup flow for the customer help center.', 'priya', 'daniel', 'LOW', null, 12, 3, null, ['docs'], 'Backlog', false, null),
  t('atlas', 'Investigate slow ticket search', 'Search over 10k+ tickets takes more than 4 seconds; needs indexing review.', 'marcus', 'lena', 'HIGH', -3, -3, 8, null, ['bug', 'backend'], 'In Review', true, null),
  t('atlas', 'Design empty states for new users', 'Cover first-run states across dashboard, tickets, and billing tabs.', 'priya', 'daniel', 'LOW', null, 20, 5, null, ['design'], 'Backlog', false, null),
  // Nimbus Mobile Revamp
  t('mobile', 'Migrate navigation shell to new component kit', 'Replace legacy nav drawer with the new shared component library.', 'priya', 'ava', 'HIGH', -25, -6, 18, 14, ['frontend'], 'Done', false, -8),
  t('mobile', 'Rebuild task list virtualization', 'Long task lists lag on mid-tier devices; needs windowed rendering.', 'marcus', 'ava', 'URGENT', -20, -4, 14, 10, ['frontend', 'bug'], 'In Progress', true, null),
  t('mobile', 'Update design tokens for dark mode', 'Extend the token set with dark-mode equivalents for all surfaces.', 'priya', 'ava', 'MEDIUM', -15, -8, 10, null, ['design'], 'In Progress', false, null),
  t('mobile', 'Offline caching for recent boards', 'Cache the last 3 opened boards for offline viewing.', 'marcus', 'ava', 'HIGH', -12, -3, 16, null, ['feature', 'frontend'], 'To Do', true, null),
  t('mobile', 'Performance audit of board rendering', 'Profile render cost of large Kanban boards and propose fixes.', 'marcus', 'ava', 'MEDIUM', -10, -5, 8, null, ['tech-debt'], 'To Do', false, null),
  t('mobile', 'Accessibility pass on mobile nav', 'Ensure the new nav shell meets keyboard and screen-reader requirements.', 'priya', 'ava', 'MEDIUM', -6, 4, 8, null, ['frontend'], 'Backlog', false, null),
  t('mobile', 'Cross-browser QA on revamped shell', 'Validate the new shell on Safari, Firefox, and Chrome mobile.', 'priya', 'ava', 'LOW', null, 15, 6, null, ['frontend'], 'Backlog', false, null),
  // Internal Analytics Suite
  t('analytics', 'Define KPI data model', 'Agree on the core metrics and dimensions for the v1 reporting model.', 'daniel', 'daniel', 'HIGH', 5, 15, 10, null, ['backend'], 'To Do', false, null),
  t('analytics', 'Prototype chart library evaluation', 'Compare charting libraries for the analytics dashboards.', 'marcus', 'daniel', 'LOW', 8, 25, 6, null, ['frontend'], 'Backlog', false, null),
  t('analytics', 'Draft data warehouse schema', 'Initial schema for the shared reporting warehouse.', 'marcus', 'daniel', 'MEDIUM', 6, 20, 12, null, ['backend'], 'Backlog', false, null),
  // Q3 Marketing Site (archived)
  t('marketing', 'Launch new homepage hero section', 'Ship the redesigned hero with updated product messaging.', 'lena', 'ava', 'HIGH', -150, -45, 12, 11, ['frontend', 'design'], 'Done', false, -46),
  t('marketing', 'Set up marketing site analytics', 'Wire up conversion and scroll-depth tracking for the new site.', 'lena', 'ava', 'MEDIUM', -140, -50, 6, 5, ['backend'], 'Done', false, -51),
  t('marketing', 'Final launch QA checklist', 'Run through the full pre-launch checklist across devices.', 'lena', 'ava', 'MEDIUM', -145, -41, 8, 7, ['frontend'], 'Done', false, -42),
  // Fleet Tracking Dashboard
  t('fleet', 'Integrate live GPS feed', 'Connect the dashboard to the live GPS ingestion service.', 'nadia', 'tomas', 'URGENT', -18, -2, 20, 18, ['backend'], 'In Review', false, null),
  t('fleet', 'Build delay alert rules UI', 'Let dispatchers configure delay thresholds per route.', 'ethan', 'tomas', 'HIGH', -12, 5, 14, 4, ['frontend', 'feature'], 'In Progress', false, null),
  t('fleet', 'Fix map marker clustering glitch', 'Markers overlap incorrectly when zoomed out past city level.', 'nadia', 'ethan', 'MEDIUM', -6, -1, 6, null, ['bug', 'frontend'], 'In Progress', true, null),
  t('fleet', 'Weekly on-time delivery report', 'Automated weekly summary of on-time vs delayed deliveries.', 'nadia', 'tomas', 'MEDIUM', -4, 8, 8, null, ['backend'], 'To Do', false, null),
  t('fleet', 'Driver mobile check-in flow', 'Simple check-in flow for drivers arriving at a stop.', 'ethan', 'tomas', 'LOW', null, 18, 10, null, ['feature'], 'Backlog', false, null),
  // Warehouse Automation Pilot
  t('warehouse', 'Vendor shortlist for sorting hardware', 'Narrow down automated sorting hardware vendors to three finalists.', 'tomas', 'tomas', 'MEDIUM', -20, 10, 8, 3, ['docs'], 'In Progress', false, null),
  t('warehouse', 'Draft pilot budget proposal', 'Budget proposal pending finance approval before pilot can proceed.', 'tomas', 'tomas', 'HIGH', -15, -5, 6, 6, ['docs'], 'In Review', true, null),
  // Billing Platform Migration
  t('billing', 'Map legacy billing data model', 'Document every table and field used by the legacy processor before migration.', 'ravi', 'olivia', 'HIGH', -55, -35, 14, 15, ['backend', 'docs'], 'Done', false, -33),
  t('billing', 'Build usage-metering ingestion pipeline', 'Stream usage events into the new billing engine in near real time.', 'ravi', 'olivia', 'URGENT', -30, 5, 20, 12, ['backend'], 'In Progress', false, null),
  t('billing', 'Set up dual-write reconciliation job', 'Compare legacy and new ledgers nightly to catch drift during the transition.', 'james', 'olivia', 'HIGH', -20, 10, 16, 8, ['backend', 'tech-debt'], 'In Progress', false, null),
  t('billing', 'Design migration rollback plan', 'Document the rollback procedure in case the cutover needs to be reversed.', 'james', 'olivia', 'HIGH', -25, -5, 8, null, ['docs'], 'In Review', true, null),
  t('billing', 'Load-test new billing engine', 'Simulate peak invoicing volume against the new engine before cutover.', 'ravi', 'olivia', 'MEDIUM', null, 20, 10, null, ['backend'], 'To Do', false, null),
  t('billing', 'Write cutover runbook', 'Step-by-step runbook for the finance team on cutover day.', 'james', 'olivia', 'LOW', null, 35, 6, null, ['docs'], 'To Do', false, null),
  t('billing', 'Legacy processor contract termination', 'Coordinate contract termination timing with procurement.', 'olivia', 'olivia', 'LOW', null, 40, 3, null, ['docs'], 'Backlog', false, null),
  t('billing', 'Reconcile Q2 invoice discrepancies', 'Investigate and resolve a batch of flagged Q2 invoice mismatches.', 'ravi', 'olivia', 'MEDIUM', -45, -30, 10, 9, ['backend', 'bug'], 'Done', false, -31),
  // Design System 2.0
  t('designsystem', 'Audit existing component inconsistencies', 'Catalog visual and behavioral drift across the current component set.', 'sofia', 'ava', 'LOW', 3, 12, 6, 5, ['design'], 'Done', false, 11),
  t('designsystem', 'Define new design tokens', 'Establish the new color, spacing, and typography token set.', 'sofia', 'ava', 'MEDIUM', 8, 20, 12, 5, ['design'], 'In Progress', false, null),
  t('designsystem', 'Build Button/Input/Select primitives', 'Implement the first wave of core primitives on the new token set.', 'chloe', 'ava', 'HIGH', null, 35, 20, null, ['frontend'], 'To Do', false, null),
  t('designsystem', 'Set up Storybook documentation site', 'Stand up a Storybook instance documenting every component and variant.', 'chloe', 'ava', 'LOW', null, 45, 8, null, ['frontend', 'docs'], 'Backlog', false, null),
  t('designsystem', 'Accessibility guidelines doc', 'Write the accessibility contribution guidelines for the design system.', 'sofia', 'ava', 'MEDIUM', null, 50, 6, null, ['docs'], 'Backlog', false, null),
  t('designsystem', 'Migration guide for existing teams', 'Guide for product teams migrating from the old component library.', 'ava', 'ava', 'LOW', null, 90, 4, null, ['docs'], 'Backlog', false, null),
  // Customer Notification Service (archived)
  t('notifysvc', 'Consolidate email/SMS senders', 'Replace five legacy notification senders with a single unified client.', 'ravi', 'olivia', 'HIGH', -115, -90, 16, 15, ['backend'], 'Done', false, -91),
  t('notifysvc', 'Build unified template engine', 'Shared templating engine supporting email, SMS, and in-app copy.', 'ravi', 'olivia', 'HIGH', -100, -70, 14, 13, ['backend'], 'Done', false, -71),
  t('notifysvc', 'Migrate legacy senders traffic', 'Cut traffic over from legacy senders behind a feature flag.', 'olivia', 'olivia', 'MEDIUM', -80, -40, 10, 12, ['backend'], 'Done', false, -41),
  t('notifysvc', 'Post-launch monitoring setup', 'Delivery-rate and bounce dashboards for the new notification service.', 'ravi', 'olivia', 'LOW', -50, -25, 6, 5, ['backend'], 'Done', false, -26),
  // Driver Safety Compliance Portal
  t('safety', 'Certification expiry tracking', 'Track driver certification expiry dates with automatic renewal reminders.', 'isabella', 'amara', 'HIGH', -35, 5, 12, 6, ['backend'], 'In Progress', false, null),
  t('safety', 'Incident report form', 'Digital incident reporting form replacing the paper-based process.', 'felix', 'amara', 'URGENT', -30, -5, 10, 8, ['frontend', 'feature'], 'In Progress', false, null),
  t('safety', 'Inspection checklist digitization', 'Move the pre-trip inspection checklist from paper to the driver app.', 'isabella', 'amara', 'MEDIUM', null, 20, 8, null, ['frontend'], 'To Do', false, null),
  t('safety', 'Compliance dashboard for managers', 'Fleet-wide compliance overview for safety managers.', 'amara', 'amara', 'MEDIUM', null, 35, 14, null, ['frontend', 'feature'], 'To Do', false, null),
  t('safety', 'SMS reminder for expiring certs', 'Automated SMS reminder 30 days before a certification expires.', 'felix', 'amara', 'LOW', null, 15, 6, null, ['backend'], 'Backlog', true, null),
  t('safety', 'Audit trail for safety incidents', 'Immutable audit log for every safety incident record change.', 'isabella', 'amara', 'MEDIUM', -38, -20, 8, 7, ['backend'], 'Done', false, -21),
  // Route Optimization Engine
  t('routing', 'Vendor evaluation: routing APIs', 'Compare routing/optimization API vendors on cost and accuracy.', 'tomas', 'grace', 'MEDIUM', null, 40, 10, 3, ['docs'], 'In Progress', false, null),
  t('routing', 'Define optimization success metrics', 'Agree on the metrics that will define a successful pilot.', 'grace', 'grace', 'HIGH', null, 30, 4, null, ['docs'], 'To Do', false, null),
  t('routing', 'Pilot route selection', 'Select a representative set of routes for the optimization pilot.', 'tomas', 'grace', 'LOW', null, 80, 6, null, ['docs'], 'Backlog', false, null),
  // Patient Intake Redesign
  t('intake', 'Map current intake pain points', 'Shadow front-desk staff to catalog friction points in the current flow.', 'zara', 'maya', 'MEDIUM', -50, -35, 8, 7, ['design'], 'Done', false, -36),
  t('intake', 'Redesign digital intake form', 'New multi-step intake form with conditional logic and save-and-resume.', 'zara', 'maya', 'HIGH', -30, -2, 18, 14, ['design', 'frontend'], 'In Progress', false, null),
  t('intake', 'Insurance verification API integration', 'Real-time eligibility checks against the clearinghouse API.', 'ben', 'maya', 'URGENT', -25, -8, 20, 10, ['backend'], 'In Progress', true, null),
  t('intake', 'Consent form e-signature flow', 'Legally compliant e-signature capture for intake consent forms.', 'ben', 'maya', 'HIGH', -15, 8, 10, 6, ['backend', 'feature'], 'In Review', false, null),
  t('intake', 'QA pass on intake flow', 'End-to-end QA across desktop, tablet, and kiosk breakpoints.', 'leo', 'maya', 'MEDIUM', null, 15, 8, null, ['frontend'], 'To Do', false, null),
  t('intake', 'Kiosk mode for in-clinic tablets', 'Locked-down kiosk mode for self-service check-in tablets.', 'zara', 'maya', 'LOW', null, 40, 12, null, ['frontend', 'feature'], 'Backlog', false, null),
  t('intake', 'HIPAA compliance review', 'Legal and security review of the new intake data flow before launch.', 'maya', 'maya', 'HIGH', -20, 3, 6, null, ['docs'], 'To Do', true, null),
  t('intake', 'Multi-language support for forms', 'Spanish and Mandarin translations for all intake form copy.', 'zara', 'maya', 'LOW', null, 45, 8, null, ['frontend', 'docs'], 'Backlog', false, null),
  // Appointment Reminder Automations
  t('reminders', 'SMS reminder integration', 'Automated SMS reminders 48 hours and 2 hours before each appointment.', 'ben', 'maya', 'URGENT', -30, -3, 14, 9, ['backend'], 'In Progress', false, null),
  t('reminders', 'Email reminder templates', 'Branded, clinic-specific email reminder templates.', 'ben', 'maya', 'HIGH', -20, -8, 8, 5, ['design', 'backend'], 'In Review', true, null),
  t('reminders', 'No-show rate tracking dashboard', 'Track no-show rate improvements per clinic after rollout.', 'maya', 'maya', 'MEDIUM', -15, -1, 10, null, ['frontend'], 'To Do', false, null),
  t('reminders', 'Opt-out preference center', 'Let patients manage reminder channel preferences and opt out.', 'ben', 'maya', 'LOW', null, 12, 4, null, ['frontend'], 'Backlog', false, null),
  // Internal Analytics Suite (top-up)
  t('analytics', 'Set up data pipeline orchestration', 'Orchestrate nightly ETL jobs feeding the reporting warehouse.', 'marcus', 'daniel', 'MEDIUM', null, 30, 12, null, ['backend'], 'Backlog', false, null),
  t('analytics', 'Define access control model for reports', 'Row-level security model so teams only see their own metrics.', 'daniel', 'daniel', 'MEDIUM', null, 25, 6, null, ['backend'], 'Backlog', false, null),
  t('analytics', 'Build embedding SDK prototype', 'Prototype for embedding dashboards inside other internal tools.', 'marcus', 'daniel', 'LOW', null, 60, 10, null, ['frontend'], 'Backlog', false, null),
  t('analytics', 'Stakeholder interview summary', 'Summarize requirements gathered from engineering and product leads.', 'daniel', 'daniel', 'LOW', 2, 8, 4, 4, ['docs'], 'Done', false, 7),
  // Warehouse Automation Pilot (top-up)
  t('warehouse', 'Site survey for sorting hardware', 'On-site survey of the north warehouse floor plan for hardware fit.', 'tomas', 'tomas', 'MEDIUM', -28, -10, 6, 5, ['docs'], 'Done', false, -11),
  t('warehouse', 'ROI model for automation pilot', 'Financial model justifying the pilot investment to leadership.', 'tomas', 'tomas', 'HIGH', -22, -8, 8, 6, ['docs'], 'In Review', true, null),
  t('warehouse', 'Safety review with facilities team', 'Joint safety review of the proposed automated sorting layout.', 'nadia', 'tomas', 'LOW', null, 30, 4, null, ['docs'], 'Backlog', false, null),
];
function t(project, title, description, assignee, creator, priority, startOffset, dueOffset, estimatedHours, actualHours, labels, column, blocked, completedOffset) {
  return {
    project,
    title,
    description,
    assignee,
    creator,
    priority,
    startOffset,
    dueOffset,
    estimatedHours,
    actualHours,
    labels,
    column,
    blocked,
    completedOffset,
  };
}
async function main() {
  console.log('Seeding FlowBoard database...');
  // --- Reset (dev only) ---
  await prisma.$transaction([
    prisma.auditLogEntry.deleteMany(),
    prisma.decision.deleteMany(),
    prisma.projectRiskSnapshot.deleteMany(),
    prisma.taskStatusChange.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.automationRule.deleteMany(),
    prisma.activityEntry.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.taskDependency.deleteMany(),
    prisma.taskLabel.deleteMany(),
    prisma.task.deleteMany(),
    prisma.boardColumn.deleteMany(),
    prisma.board.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.project.deleteMany(),
    prisma.label.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.userPermissionOverride.deleteMany(),
    prisma.organizationRolePermission.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.organization.deleteMany(),
  ]);
  // --- Roles & permissions ---
  const roleIds = new Map();
  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.create({ data: { name: def.name, label: def.label, description: def.description } });
    roleIds.set(def.name, role.id);
    for (const key of def.permissions) {
      const permission = await prisma.permission.upsert({
        where: { key },
        create: { key, description: PERMISSION_BY_KEY.get(key).description },
        update: {},
      });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
  }
  // --- Organizations ---
  const orgIds = new Map();
  for (const org of ORGANIZATIONS) {
    const created = await prisma.organization.create({
      data: { name: org.name, slug: org.slug, plan: org.plan, status: 'ACTIVE' },
    });
    orgIds.set(org.key, created.id);
  }
  // --- Users ---
  const userIds = new Map();
  const avatarPalette = ['#3454D1', '#1B998B', '#E1701A', '#7A5CFA', '#C4406A', '#2E7D32'];
  for (const u of USERS) {
    const created = await prisma.user.create({
      data: {
        organizationId: orgIds.get(u.org),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        passwordHash: PASSWORD_HASH,
        avatarColor: u.avatarColor ?? avatarPalette[Math.floor(Math.random() * avatarPalette.length)],
        title: u.title,
        status: 'ACTIVE',
        roles: {
          create: u.roles.map((roleName) => ({ roleId: roleIds.get(roleName), organizationId: orgIds.get(u.org) })),
        },
      },
    });
    userIds.set(u.key, created.id);
  }
  // One INVITED user for realism (Harborline)
  await prisma.user.update({
    where: { id: userIds.get('ethan') },
    data: { status: 'ACTIVE' },
  });
  // --- Labels (per organization) ---
  const labelIds = new Map();
  for (const orgKey of orgIds.keys()) {
    const map = new Map();
    for (const label of LABELS) {
      const created = await prisma.label.create({
        data: { organizationId: orgIds.get(orgKey), name: label.name, color: label.color },
      });
      map.set(label.key, created.id);
    }
    labelIds.set(orgKey, map);
  }
  // --- Projects, boards, columns, members ---
  const projectIds = new Map();
  const columnIds = new Map();
  for (const p of PROJECTS) {
    const project = await prisma.project.create({
      data: {
        organizationId: orgIds.get(p.org),
        name: p.name,
        description: p.description,
        status: p.status,
        managerId: userIds.get(p.manager),
        startDate: iso(p.startOffset),
        targetDate: iso(p.targetOffset),
        progress: p.progress,
        archived: p.archived,
        riskScore: p.riskScore,
        riskLevel: p.riskLevel,
        riskFactors: p.riskFactors,
        members: {
          create: p.members.map((m) => ({
            userId: userIds.get(m),
            roleOnProject: m === p.manager ? 'MANAGER' : 'CONTRIBUTOR',
          })),
        },
      },
    });
    projectIds.set(p.key, project.id);
    const board = await prisma.board.create({ data: { projectId: project.id, name: `${p.name} Board` } });
    const colMap = new Map();
    for (const col of COLUMN_DEFS) {
      const created = await prisma.boardColumn.create({
        data: { boardId: board.id, name: col.name, category: col.category, order: col.order, wipLimit: col.wipLimit },
      });
      colMap.set(col.name, created.id);
    }
    columnIds.set(p.key, colMap);
  }
  // --- Tasks ---
  const taskIds = [];
  const seededTasks = []; // kept in memory to rebuild the risk history below
  for (const [index, task] of TASKS.entries()) {
    const projectOrg = PROJECTS.find((p) => p.key === task.project).org;
    // A task exists before it starts, is due, or is completed - and never in the future.
    const plannedStart = task.startOffset ?? (task.dueOffset !== null ? task.dueOffset - 14 : -10);
    const createdAt = iso(Math.min(plannedStart, task.completedOffset ?? 0, 0) - 2, 8);
    const completedAt = task.completedOffset === null ? null : iso(task.completedOffset);
    const created = await prisma.task.create({
      data: {
        createdAt,
        projectId: projectIds.get(task.project),
        columnId: columnIds.get(task.project).get(task.column),
        title: task.title,
        description: task.description,
        assigneeId: task.assignee ? userIds.get(task.assignee) : null,
        creatorId: userIds.get(task.creator),
        priority: task.priority,
        startDate: task.startOffset === null ? null : iso(task.startOffset),
        dueDate: task.dueOffset === null ? null : iso(task.dueOffset),
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        blocked: task.blocked,
        archived: false,
        completedAt,
        labels: { create: task.labels.map((l) => ({ labelId: labelIds.get(projectOrg).get(l) })) },
      },
    });
    taskIds.push(created.id);
    seededTasks.push({ ...task, createdAt, completedAt, assigneeId: created.assigneeId, dueDate: created.dueDate });

    // Column history (TaskStatusChange): the task walked the board from Backlog / To Do to the
    // column it is in now. The time is split between the stages by weight - "In Review" is
    // made the slowest stage, so the "where work waits" insight has something to find.
    const STAGE_WEIGHT = { Backlog: 1.2, 'To Do': 1, 'In Progress': 2, 'In Review': 3 };
    const names = COLUMN_DEFS.map((c) => c.name);
    const path = names.slice(task.column === 'Backlog' ? 0 : 1, names.indexOf(task.column) + 1);
    const end = completedAt ?? NOW;
    // Open tasks are still in their last column, so it takes part of the span too.
    const timed = completedAt ? path.slice(0, -1) : path;
    const jitter = (i) => 0.7 + (((index + 1) * (i + 3) * 37) % 7) / 10; // deterministic variety
    const weights = timed.map((name, i) => (STAGE_WEIGHT[name] ?? 1) * jitter(i));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
    let at = createdAt.getTime();
    const history = path.map((name, i) => {
      const enteredAt = name === 'Done' && completedAt ? completedAt : new Date(at);
      if (i < weights.length) at += ((end - createdAt) * weights[i]) / totalWeight;
      const def = COLUMN_DEFS.find((c) => c.name === name);
      return {
        taskId: created.id,
        projectId: created.projectId,
        fromColumnName: i === 0 ? null : path[i - 1],
        toColumnName: name,
        toCategory: def.category,
        changedAt: enteredAt,
      };
    });
    await prisma.taskStatusChange.createMany({ data: history });
  }

  // --- Risk history: the last 30 days, reconstructed by replaying the tasks' dates ---
  // (From today on, the server records a real snapshot every hour.)
  for (const p of PROJECTS.filter((proj) => !proj.archived)) {
    const tasks = seededTasks.filter((t) => t.project === p.key);
    const doneNow = tasks.filter((t) => t.completedAt).length || 1;
    const snapshots = [];
    for (let d = 30; d >= 1; d -= 1) {
      const at = iso(-d, 12);
      const open = tasks.filter((t) => t.createdAt <= at && (!t.completedAt || t.completedAt > at));
      const doneThen = tasks.filter((t) => t.completedAt && t.completedAt <= at).length;
      const risk = calculateRisk(
        { startDate: iso(p.startOffset), targetDate: iso(p.targetOffset), progress: Math.round((p.progress * doneThen) / doneNow) },
        open.map((t) => ({ assigneeId: t.assigneeId, dueDate: t.dueDate, blocked: t.blocked })),
        p.members.length,
        at,
      );
      snapshots.push({
        projectId: projectIds.get(p.key),
        day: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())),
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
      });
    }
    await prisma.projectRiskSnapshot.createMany({ data: snapshots });
  }
  // --- Comments ---
  const commentSeeds = [
    {
      taskIndex: 1,
      author: 'daniel',
      body: 'Can we scope this to a single invoice first, then add range export as a follow-up?',
      offsetDays: -3,
      hour: 10,
    },
    {
      taskIndex: 1,
      author: 'marcus',
      body: 'Good call, splitting it. Single invoice export is in progress now.',
      offsetDays: -2,
      hour: 14,
    },
    {
      taskIndex: 3,
      author: 'priya',
      body: 'UX copy for the 2FA setup wizard is ready for review in Figma.',
      offsetDays: -4,
      hour: 11,
    },
    {
      taskIndex: 7,
      author: 'lena',
      body: 'Confirmed repro: search over 12k tickets takes ~4.6s consistently.',
      offsetDays: -3,
      hour: 9,
    },
    {
      taskIndex: 7,
      author: 'marcus',
      body: 'Looks like the tickets table is missing a composite index. Testing a fix now.',
      offsetDays: -2,
      hour: 16,
    },
    {
      taskIndex: 10,
      author: 'marcus',
      body: 'Virtualization is dropping frames on scroll on the Pixel 6a test device.',
      offsetDays: -4,
      hour: 13,
    },
    {
      taskIndex: 10,
      author: 'ava',
      body: 'This is our biggest risk item for the revamp - please flag if you need help.',
      offsetDays: -3,
      hour: 9,
    },
    {
      taskIndex: 22,
      author: 'nadia',
      body: 'Live feed is connected in staging, validating packet loss handling now.',
      offsetDays: -2,
      hour: 10,
    },
    {
      taskIndex: 24,
      author: 'ethan',
      body: 'Clustering glitch reproduces only below zoom level 6.',
      offsetDays: -1,
      hour: 12,
    },
    {
      taskIndex: 28,
      author: 'tomas',
      body: 'Finance review is scheduled for next week, holding here until then.',
      offsetDays: -2,
      hour: 9,
    },
    {
      taskIndex: 0,
      author: 'daniel',
      body: 'Mockups look great, approved for implementation.',
      offsetDays: -3,
      hour: 17,
    },
    {
      taskIndex: 30,
      author: 'olivia',
      body: 'What is our rollback window once the pipeline is live in production?',
      offsetDays: -5,
      hour: 10,
    },
    {
      taskIndex: 30,
      author: 'ravi',
      body: 'We can roll back within a 15-minute window for the first two weeks post-launch.',
      offsetDays: -5,
      hour: 15,
    },
    {
      taskIndex: 48,
      author: 'amara',
      body: 'Legal wants an audit trail on every incident report edit, not just creation.',
      offsetDays: -4,
      hour: 11,
    },
    {
      taskIndex: 58,
      author: 'maya',
      body: 'This is blocking three downstream tasks - what is the clearinghouse ETA?',
      offsetDays: -3,
      hour: 9,
    },
    {
      taskIndex: 58,
      author: 'ben',
      body: 'Clearinghouse sandbox access came through this morning, unblocking testing.',
      offsetDays: -2,
      hour: 13,
    },
    {
      taskIndex: 64,
      author: 'maya',
      body: 'No-show rate is climbing again this week, can we prioritize this over the email templates?',
      offsetDays: -2,
      hour: 9,
    },
  ];
  for (const c of commentSeeds) {
    await prisma.comment.create({
      data: {
        taskId: taskIds[c.taskIndex],
        authorId: userIds.get(c.author),
        body: c.body,
        createdAt: iso(c.offsetDays, c.hour),
      },
    });
  }
  // --- Attachments (with tiny placeholder files on disk so downloads work) ---
  const uploadsDir = join(UPLOADS_DIR, 'seed');
  mkdirSync(uploadsDir, { recursive: true });
  const attachmentSeeds = [
    {
      taskIndex: 0,
      fileName: 'billing-summary-v3.txt',
      fileType: 'text/plain',
      sizeKb: 3400,
      uploadedBy: 'priya',
      offsetDays: -4,
    },
    {
      taskIndex: 1,
      fileName: 'invoice-export-spec.txt',
      fileType: 'text/plain',
      sizeKb: 210,
      uploadedBy: 'daniel',
      offsetDays: -6,
    },
    {
      taskIndex: 3,
      fileName: '2fa-flow-copy.txt',
      fileType: 'text/plain',
      sizeKb: 48,
      uploadedBy: 'priya',
      offsetDays: -4,
    },
    {
      taskIndex: 7,
      fileName: 'search-latency-trace.txt',
      fileType: 'text/plain',
      sizeKb: 640,
      uploadedBy: 'lena',
      offsetDays: -3,
    },
    {
      taskIndex: 22,
      fileName: 'gps-ingestion-contract.txt',
      fileType: 'text/plain',
      sizeKb: 302,
      uploadedBy: 'nadia',
      offsetDays: -6,
    },
    {
      taskIndex: 28,
      fileName: 'pilot-budget-draft.txt',
      fileType: 'text/plain',
      sizeKb: 76,
      uploadedBy: 'tomas',
      offsetDays: -5,
    },
  ];
  for (const a of attachmentSeeds) {
    const storageKey = `seed/${randomBytes(8).toString('hex')}-${a.fileName}`;
    writeFileSync(join(UPLOADS_DIR, storageKey), `Seed placeholder for ${a.fileName}\n`);
    await prisma.attachment.create({
      data: {
        taskId: taskIds[a.taskIndex],
        fileName: a.fileName,
        fileType: a.fileType,
        sizeKb: a.sizeKb,
        storageKey,
        uploadedById: userIds.get(a.uploadedBy),
        uploadedAt: iso(a.offsetDays),
      },
    });
  }
  // --- Notifications (for Ava) ---
  const notificationSeeds = [
    {
      type: 'OVERDUE',
      title: 'Task overdue',
      body: '"Rebuild task list virtualization" is now overdue.',
      read: false,
      offsetDays: -4,
      project: 'mobile',
      taskIndex: 10,
    },
    {
      type: 'STATUS_CHANGED',
      title: 'Task moved to In Review',
      body: 'Marcus Webb moved "Investigate slow ticket search" to In Review.',
      read: false,
      offsetDays: -3,
      project: 'atlas',
      taskIndex: 7,
    },
    {
      type: 'COMMENT_ADDED',
      title: 'New comment',
      body: 'Daniel Cho commented on "Implement invoice PDF export".',
      read: true,
      offsetDays: -3,
      project: 'atlas',
      taskIndex: 1,
    },
    {
      type: 'DUE_SOON',
      title: 'Due in 2 days',
      body: '"Implement invoice PDF export" is due in 2 days.',
      read: false,
      offsetDays: -1,
      project: 'atlas',
      taskIndex: 1,
    },
    {
      type: 'MEMBER_ADDED',
      title: 'Member added',
      body: 'Lena Fischer was added to Atlas Customer Portal.',
      read: true,
      offsetDays: -20,
      project: 'atlas',
      taskIndex: null,
    },
    {
      type: 'TASK_ASSIGNED',
      title: 'Task assigned to you',
      body: 'You were assigned "Cross-browser QA on revamped shell".',
      read: true,
      offsetDays: -6,
      project: 'mobile',
      taskIndex: 15,
    },
    {
      type: 'AUTOMATION_TRIGGERED',
      title: 'Automation triggered',
      body: 'Overdue automation notified Marcus Webb and Ava Reynolds.',
      read: false,
      offsetDays: -4,
      project: 'mobile',
      taskIndex: null,
    },
    {
      type: 'OVERDUE',
      title: 'Task overdue',
      body: '"Offline caching for recent boards" is now overdue.',
      read: false,
      offsetDays: -3,
      project: 'mobile',
      taskIndex: 12,
    },
    {
      type: 'COMMENT_ADDED',
      title: 'New comment',
      body: 'Marcus Webb commented on "Rebuild task list virtualization".',
      read: true,
      offsetDays: -4,
      project: 'mobile',
      taskIndex: 10,
    },
    {
      type: 'DUE_SOON',
      title: 'Due tomorrow',
      body: '"QA pass on account management flows" is due soon.',
      read: false,
      offsetDays: 0,
      project: 'atlas',
      taskIndex: 4,
    },
  ];
  for (const n of notificationSeeds) {
    await prisma.notification.create({
      data: {
        organizationId: orgIds.get('nimbus'),
        userId: userIds.get('ava'),
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: iso(n.offsetDays),
        relatedProjectId: projectIds.get(n.project),
        relatedTaskId: n.taskIndex === null ? null : taskIds[n.taskIndex],
      },
    });
  }
  // --- Audit log ---
  const auditSeeds = [
    { org: 'nimbus', actor: 'ava', action: 'USER_SIGNED_IN', entityType: 'User', entityId: 'ava', offsetDays: 0 },
    { org: 'nimbus', actor: 'ava', action: 'USER_ROLES_CHANGED', entityType: 'User', entityId: 'sam', offsetDays: -15 },
    {
      org: 'nimbus',
      actor: 'ava',
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: 'analytics',
      offsetDays: -10,
    },
    { org: 'nimbus', actor: 'daniel', action: 'TASK_ASSIGNED', entityType: 'Task', entityId: 'task', offsetDays: -10 },
    {
      org: 'nimbus',
      actor: 'daniel',
      action: 'TASK_STATUS_CHANGED',
      entityType: 'Task',
      entityId: 'task',
      offsetDays: -3,
    },
    {
      org: 'nimbus',
      actor: 'ava',
      action: 'PROJECT_ARCHIVED',
      entityType: 'Project',
      entityId: 'marketing',
      offsetDays: -40,
    },
    {
      org: 'nimbus',
      actor: 'ava',
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      entityType: 'Organization',
      entityId: 'nimbus',
      offsetDays: -25,
    },
    {
      org: 'harborline',
      actor: 'grace',
      action: 'USER_SIGNED_IN',
      entityType: 'User',
      entityId: 'grace',
      offsetDays: 0,
    },
    {
      org: 'harborline',
      actor: 'tomas',
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: 'warehouse',
      offsetDays: -35,
    },
    {
      org: 'harborline',
      actor: 'grace',
      action: 'USER_SUSPENDED',
      entityType: 'User',
      entityId: 'ethan',
      offsetDays: -2,
    },
    {
      org: 'nimbus',
      actor: 'olivia',
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: 'billing',
      offsetDays: -60,
    },
    {
      org: 'nimbus',
      actor: 'ava',
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: 'designsystem',
      offsetDays: -1,
    },
    {
      org: 'nimbus',
      actor: 'olivia',
      action: 'PROJECT_ARCHIVED',
      entityType: 'Project',
      entityId: 'notifysvc',
      offsetDays: -20,
    },
    {
      org: 'harborline',
      actor: 'amara',
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: 'safety',
      offsetDays: -40,
    },
    { org: 'solstice', actor: 'maya', action: 'USER_SIGNED_IN', entityType: 'User', entityId: 'maya', offsetDays: 0 },
    {
      org: 'solstice',
      actor: 'maya',
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: 'intake',
      offsetDays: -55,
    },
    {
      org: 'solstice',
      actor: 'maya',
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: 'reminders',
      offsetDays: -35,
    },
    {
      org: 'solstice',
      actor: 'maya',
      action: 'USER_ROLES_CHANGED',
      entityType: 'User',
      entityId: 'ben',
      offsetDays: -30,
    },
  ];
  for (const a of auditSeeds) {
    const entityId = projectIds.get(a.entityId) ?? userIds.get(a.entityId) ?? orgIds.get(a.entityId) ?? (a.entityId === 'task' ? taskIds[0] : a.entityId);
    await prisma.auditLogEntry.create({
      data: {
        organizationId: orgIds.get(a.org),
        actorId: userIds.get(a.actor),
        action: a.action,
        entityType: a.entityType,
        entityId,
        createdAt: iso(a.offsetDays),
      },
    });
  }
  // --- Automation rules (data model only - engine ships in a later phase) ---
  await prisma.automationRule.createMany({
    data: [
      {
        organizationId: orgIds.get('nimbus'),
        projectId: projectIds.get('mobile'),
        name: 'Notify on overdue task',
        enabled: true,
        trigger: { type: 'TASK_OVERDUE', label: 'When a task becomes overdue' },
        action: { type: 'NOTIFY_ASSIGNEE_AND_MANAGER', label: 'Notify the assignee and project manager' },
      },
      {
        organizationId: orgIds.get('nimbus'),
        projectId: null,
        name: 'Move to review when subtasks complete',
        enabled: true,
        trigger: { type: 'ALL_SUBTASKS_COMPLETED', label: 'When all subtasks are completed' },
        action: { type: 'MOVE_TO_COLUMN', label: 'Move parent task to "In Review"' },
      },
      {
        organizationId: orgIds.get('harborline'),
        projectId: null,
        name: 'Due date reminder',
        enabled: true,
        trigger: { type: 'DUE_DATE_APPROACHING', label: 'When a due date is 2 days away' },
        action: { type: 'CREATE_NOTIFICATION', label: 'Create a reminder notification' },
      },
      {
        organizationId: orgIds.get('solstice'),
        projectId: projectIds.get('reminders'),
        name: 'Escalate overdue reminders',
        enabled: true,
        trigger: { type: 'TASK_OVERDUE', label: 'When a task becomes overdue' },
        action: { type: 'NOTIFY_ASSIGNEE_AND_MANAGER', label: 'Notify the assignee and project manager' },
      },
    ],
  });
  // --- Decision log: one past decision, so the log shows how a decision played out ---
  const billingId = projectIds.get('billing');
  const riskThen = await prisma.projectRiskSnapshot.findFirst({
    where: { projectId: billingId, day: { lte: iso(-12, 12) } },
    orderBy: { day: 'desc' },
  });
  const pipelineTask = taskIds[TASKS.findIndex((t) => t.title === 'Build usage-metering ingestion pipeline')];
  await prisma.decision.create({
    data: {
      organizationId: orgIds.get('nimbus'),
      projectId: billingId,
      actorId: userIds.get('olivia'),
      source: 'RECOMMENDATION',
      title: 'Reassign "Build usage-metering ingestion pipeline" from James O\'Brien to Ravi Patel',
      changes: { reassign: [{ taskId: pipelineTask, toUserId: userIds.get('ravi') }] },
      summary: ['Reassign "Build usage-metering ingestion pipeline" from James O\'Brien to Ravi Patel'],
      note: 'James is needed on the dual-write job; Ravi owns the ingestion service.',
      riskBefore: riskThen?.riskScore ?? 0,
      riskPredicted: riskThen?.riskScore ?? 0,
      daysLateBefore: null,
      daysLatePredicted: null,
      createdAt: iso(-12, 10),
    },
  });
  // --- Permission exceptions (examples for the per-employee permissions screen) ---
  await prisma.userPermissionOverride.createMany({
    data: [
      {
        organizationId: orgIds.get('nimbus'),
        userId: userIds.get('priya'),
        permissionKey: 'tasks.create',
        granted: true,
        reason: 'Leads the QA effort - opens bug tasks directly',
        grantedById: userIds.get('ava'),
      },
      {
        organizationId: orgIds.get('nimbus'),
        userId: userIds.get('marcus'),
        permissionKey: 'calls.start',
        granted: false,
        expiresAt: iso(14),
        reason: 'Focus time - no calls until the release',
        grantedById: userIds.get('ava'),
      },
    ],
  });
  console.log('Seed complete.');
  console.log('Demo accounts (password for all: password123):');
  for (const u of USERS) {
    console.log(`  ${u.email} - ${u.roles.join(', ')} - ${ORGANIZATIONS.find((o) => o.key === u.org).name}`);
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
