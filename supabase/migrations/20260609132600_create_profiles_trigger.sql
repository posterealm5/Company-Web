-- Migration: Create Profiles Trigger
-- Description: Automatically create a profile row in public.profiles when a new user signs up in auth.users.
-- Runs with SECURITY DEFINER privileges to bypass RLS policies during signup.

-- 1. Create the profile creation function
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- 2. Drop the trigger if it already exists to avoid duplication
drop trigger if exists on_auth_user_created on auth.users;

-- 3. Bind the trigger to the auth.users table
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
