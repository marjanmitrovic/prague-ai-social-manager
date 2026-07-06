create extension if not exists "pgcrypto";

create type post_status as enum (
  'draft', 'pending_approval', 'approved', 'scheduled',
  'publishing', 'published', 'failed', 'manual_action'
);

create type platform_name as enum ('instagram', 'tiktok');

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text default 'gastro',
  timezone text not null default 'Europe/Prague',
  requires_approval boolean not null default false,
  created_at timestamptz not null default now()
);

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  platform platform_name not null,
  external_account_id text,
  account_name text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  connection_status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  unique(client_id, platform)
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  brief text,
  caption text,
  media_type text not null,
  media_urls jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz,
  status post_status not null default 'draft',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  platform platform_name not null,
  target_format text not null,
  platform_settings jsonb not null default '{}'::jsonb,
  status post_status not null default 'draft',
  external_post_id text,
  error_message text,
  published_at timestamptz,
  unique(post_id, platform)
);

create table comments_inbox (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  platform platform_name not null,
  external_comment_id text not null,
  author_name text,
  body text not null,
  ai_reply_draft text,
  reply_status text not null default 'unanswered',
  created_at timestamptz not null default now(),
  unique(platform, external_comment_id)
);

create table audit_log (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index posts_schedule_idx on posts(status, scheduled_at);
create index post_targets_status_idx on post_targets(status);
