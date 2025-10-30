## 🔐 GitHub Authentication Setup (Supabase + GitHub Pages)

This project uses **Supabase Auth** with **GitHub OAuth** to allow secure login and restrict database edits to the owner.

### 1. GitHub OAuth App Configuration
1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Fill in:
   - **Application name:** `travel-map`
   - **Homepage URL:** `https://laggerstatten.github.io/travelmap/`
   - **Authorization callback URL:** `https://czuldnytepaujjkjpwqi.supabase.co/auth/v1/callback`
3. Click **Register application**, then copy the **Client ID** and **Client Secret**.

### 2. Supabase Setup
1. In **Supabase → Authentication → Providers → GitHub**:
   - Paste your Client ID and Secret.
   - Enable the GitHub provider.
2. In **Authentication → URL Configuration (or Settings → Site URL)**, set:
    https://laggerstatten.github.io/travelmap/
(This replaces the default `http://localhost:3000` so OAuth redirects correctly.)
3. Save your changes.

### 3. Frontend Integration
- Added “Login with GitHub” and “Logout” buttons.
- Initialized Supabase:
    ```js
    const supabase = window.supabase.createClient(
    'https://czuldnytepaujjkjpwqi.supabase.co',
    'PUBLIC_ANON_KEY'
    );
- Handled login and logout:
    await supabase.auth.signInWithOAuth({ provider: 'github' });
    supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    // show/hide UI based on login state
    });

### 4. Database Security (RLS)
1. Enabled Row-Level Security:
    alter table visited enable row level security;

2. Allowed public reads:
    create policy "Public read"
    on visited for select using (true);

3. Allowed only your GitHub user to edit:
    create policy "Only Eric can edit"
    on visited
    for all
    using (auth.uid() = 'YOUR-UUID-HERE')
    with check (auth.uid() = 'YOUR-UUID-HERE');

(Find your UUID under Authentication → Users in Supabase.)

### 5. Final Behavior
Anyone can view data.

Only your GitHub account can edit.

Works on both localhost and GitHub Pages.




