// config.js — connects "Write to me" to your Supabase project.
// Supabase → Project Settings → API: copy the Project URL and the anon public key here.
// The anon key is meant to be public; the database only lets it call the three visitor functions.
// Leave both empty and the contact page just shows your email and X instead of the form.
window.MAIL = {
  url: "",        // e.g. "https://abcdefgh.supabase.co"
  anonKey: ""     // the long "anon public" key
};
