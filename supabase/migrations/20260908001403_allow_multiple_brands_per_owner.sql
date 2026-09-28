-- businesses_owner_unique made one brand per owner a physical constraint, so no
-- plan limit or UI change could ever have allowed a second one: the insert in
-- create_brand() would fail on the unique index. The upstream schema shipped this
-- index in its first migration and added multi-brand plans afterwards, so the
-- feature could not have worked as sold.
drop index if exists public.businesses_owner_unique;

-- Owner lookups still need an index, just not a unique one.
create index if not exists businesses_owner_idx on public.businesses (owner_id);
