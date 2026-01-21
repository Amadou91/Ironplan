alter table public.profiles
  add column if not exists height_in numeric(5,2),
  add column if not exists weight_lb numeric(6,2),
  add column if not exists body_fat_percent numeric(5,2),
  add column if not exists birthdate date,
  add column if not exists sex text;
