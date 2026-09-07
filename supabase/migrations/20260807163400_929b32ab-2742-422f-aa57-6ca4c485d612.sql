-- Path convention: rafty-media/<business_id>/<kind>/<file>
create policy "Members read own business files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'rafty-media'
    and (
      public.is_business_member(nullif((storage.foldername(name))[1], '')::uuid)
      or public.is_super_admin()
    )
  );

create policy "Members upload own business files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'rafty-media'
    and (
      public.is_business_member(nullif((storage.foldername(name))[1], '')::uuid)
      or public.is_super_admin()
    )
  );

create policy "Members update own business files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'rafty-media'
    and (
      public.is_business_member(nullif((storage.foldername(name))[1], '')::uuid)
      or public.is_super_admin()
    )
  )
  with check (
    bucket_id = 'rafty-media'
    and (
      public.is_business_member(nullif((storage.foldername(name))[1], '')::uuid)
      or public.is_super_admin()
    )
  );

create policy "Members delete own business files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'rafty-media'
    and (
      public.is_business_member(nullif((storage.foldername(name))[1], '')::uuid)
      or public.is_super_admin()
    )
  );