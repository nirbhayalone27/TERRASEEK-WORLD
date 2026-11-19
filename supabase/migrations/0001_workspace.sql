-- Apply with the Supabase migration runner. Review and test in a development project first.
create extension if not exists postgis with schema extensions;
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text, created_at timestamptz not null default now());
create table public.organizations (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), name text not null check(length(name) between 1 and 200), created_at timestamptz not null default now());
create table public.organization_members (organization_id uuid references public.organizations(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, role text not null check(role in ('owner','editor','viewer')), primary key(organization_id,user_id));
create table public.projects (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, organization_id uuid references public.organizations(id), name text not null check(length(name) between 1 and 200), body jsonb not null default '{}' check(octet_length(body::text)<1000000), created_at timestamptz not null default now());
create index on public.projects(owner_id,created_at desc);
create table public.saved_aois (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, project_id uuid references public.projects(id) on delete cascade, name text not null, geometry extensions.geometry(Polygon,4326) not null, check(extensions.st_isvalid(geometry)));
create table public.saved_searches (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, query jsonb not null, created_at timestamptz not null default now());
create table public.analysis_jobs (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, project_id uuid references public.projects(id), input jsonb not null, status text not null default 'queued' check(status in ('queued','running','complete','failed')), created_at timestamptz not null default now());
create table public.analysis_results (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), job_id uuid references public.analysis_jobs(id), evidence jsonb not null, created_at timestamptz not null default now());
create table public.reports (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), project_id uuid references public.projects(id), storage_path text not null, created_at timestamptz not null default now());
create table public.audit_events (id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id), action text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create table public.usage_records (id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id), operation text not null, quantity integer not null check(quantity>=0), created_at timestamptz not null default now());
-- Owner-only first release; organization membership does NOT grant cross-user access yet.
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
alter table public.organizations enable row level security;
create policy own_org on public.organizations for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
alter table public.organization_members enable row level security;
create policy read_membership on public.organization_members for select to authenticated using(user_id=auth.uid());
-- No client membership writes; invite workflow must run with checked server authorization.
do $$ declare t text; begin
 foreach t in array array['projects','saved_aois','saved_searches','analysis_jobs','analysis_results','reports','audit_events','usage_records'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy own_read on public.%I for select to authenticated using(owner_id=auth.uid())',t);
 end loop;
 foreach t in array array['projects','saved_searches'] loop
  execute format('create policy own_write on public.%I for insert to authenticated with check(owner_id=auth.uid())',t);
  execute format('create policy own_update on public.%I for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid())',t);
  execute format('create policy own_delete on public.%I for delete to authenticated using(owner_id=auth.uid())',t);
 end loop;
end $$;
-- Job results, reports, usage and audit writes are reserved for trusted services.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('reports','reports',false,10000000,array['application/json','application/pdf','image/png']) on conflict(id) do nothing;
create policy own_report_read on storage.objects for select to authenticated using(bucket_id='reports' and (storage.foldername(name))[1]=auth.uid()::text);
-- No public storage writes, signed URL creation must respect owner authorization.
