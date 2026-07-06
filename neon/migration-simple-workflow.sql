alter table clients
add column if not exists requires_approval boolean not null default false;
