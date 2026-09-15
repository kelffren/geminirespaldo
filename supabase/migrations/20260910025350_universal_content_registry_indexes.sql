create index if not exists content_review_decided_by_idx on public.content_review_requests(decided_by) where decided_by is not null;
create index if not exists content_publications_published_by_idx on public.content_publications(published_by) where published_by is not null;
