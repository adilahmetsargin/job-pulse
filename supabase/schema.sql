create table if not exists public.job_notifications (
  job_id text primary key,
  source text not null,
  title text not null,
  company text not null,
  url text not null,
  location text not null default '',
  category text not null default '',
  published text not null default '',
  job_type text not null default '',
  payload jsonb not null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_sent_at timestamptz,
  dismissed_at timestamptz
);

create index if not exists job_notifications_last_sent_idx
  on public.job_notifications (last_sent_at);

create index if not exists job_notifications_dismissed_idx
  on public.job_notifications (dismissed_at);

alter table public.job_notifications enable row level security;

drop policy if exists "job_notifications_service_only" on public.job_notifications;

create policy "job_notifications_service_only"
on public.job_notifications
for all
to service_role
using (true)
with check (true);
