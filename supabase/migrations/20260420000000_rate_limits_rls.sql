-- Enable RLS on rate_limits — table is server-side only (edge functions via service role)
alter table rate_limits enable row level security;

-- Deny all access to anon and authenticated roles
create policy "No public access" on rate_limits as restrictive
  for all
  to anon, authenticated
  using (false);
