-- =========================================================
-- RNG VAULT DATABASE
-- =========================================================

create table if not exists public.game_saves (

    user_id uuid primary key
        references auth.users(id)
        on delete cascade,

    username text,

    save_data jsonb not null default '{}'::jsonb,

    updated_at timestamptz
        not null default now()

);


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.game_saves
enable row level security;


-- Users can only read their own save.

create policy "Users can read their own save"

on public.game_saves

for select

to authenticated

using (
    auth.uid() = user_id
);


-- Users can only insert their own save.

create policy "Users can insert their own save"

on public.game_saves

for insert

to authenticated

with check (
    auth.uid() = user_id
);


-- Users can only update their own save.

create policy "Users can update their own save"

on public.game_saves

for update

to authenticated

using (
    auth.uid() = user_id
)

with check (
    auth.uid() = user_id
);


-- Users can delete their own save.

create policy "Users can delete their own save"

on public.game_saves

for delete

to authenticated

using (
    auth.uid() = user_id
);
