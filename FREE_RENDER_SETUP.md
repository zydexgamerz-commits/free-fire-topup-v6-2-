# Free Render + Supabase setup

This version is designed for a **$0 Render Web Service**. Render Free has an ephemeral filesystem, so prices, orders, QR codes and uploaded images are stored in Supabase instead of local files.

## 1. Create a free Supabase project

Create a project at https://supabase.com/ and keep it on the Free plan.

## 2. Create the database/storage

Open **SQL Editor** in Supabase, create a new query, paste the complete contents of `supabase-schema.sql`, and click **Run**.

## 3. Get the server credentials

In Supabase open **Settings → API Keys**. Prefer the new **Secret key** (`sb_secret_...`) for the backend. Older projects may still show `service_role`; that also works with this project.

Set these Render environment variables:

- `SUPABASE_URL` = your project URL
- `SUPABASE_SECRET_KEY` = your Supabase Secret key
- `SUPABASE_STORAGE_BUCKET` = `uploads`
- `ADMIN_PASSWORD` = your admin password
- `UID_VERIFY_API_KEY` = your UID API key
- `UID_VERIFY_USERUID` = your UID API user ID
- `UID_SUPPORTED_REGIONS` = `ind,pk,bd`

**Never put the Supabase Secret key in frontend JavaScript or GitHub.** It is a server secret.

## 4. Deploy to Render Free

Use your existing Render Web Service and connected Git repository. Replace the repository files with this project and push/commit them to the branch Render deploys.

The included `render.yaml` uses:

- `plan: free`
- `npm install`
- `npm start`
- no Persistent Disk

Do **not** add a Render Persistent Disk; Free Web Services do not support it.

## 5. Test persistence

1. Open the admin panel.
2. Change a diamond/pass price.
3. Save it.
4. Upload a product image or payment QR.
5. Refresh the store.
6. Wait for Render to spin the Free service down or manually redeploy it.
7. Check the price/QR/image again.

The data should remain because it is stored in Supabase, not the Render filesystem.

## Important Free-tier limitations

- Render Free Web Services can spin down after inactivity and take about a minute to wake up.
- Supabase Free currently includes 500 MB database storage and 1 GB file storage.
- Supabase Free projects can pause after inactivity, so this setup is suitable for a hobby/small store, not guaranteed production infrastructure.
- Supabase Storage uploads are limited by the bucket/global file-size settings; this app limits admin images to 6 MB.


IMPORTANT: This version seeds the bundled products and settings in Supabase when the schema is first run.
