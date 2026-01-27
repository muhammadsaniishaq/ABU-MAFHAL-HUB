-- Allow authenticated users to upload files to 'kyc-documents'
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Allow authenticated users to view their own uploaded files
create policy "Allow authenticated downloads"
on storage.objects for select
to authenticated
using ( bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Allow users to update their own files (if needed)
create policy "Allow authenticated updates"
on storage.objects for update
to authenticated
using ( bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1] );
