-- A brand owner can withdraw a custom template request while it is still
-- waiting for review. Once it is ready or rejected the record is history and
-- only a platform admin may touch it.
create policy "Members delete own pending template requests"
  on public.custom_template_requests
  for delete
  to authenticated
  using (is_business_member(business_id) and status = 'processing');
