// TACTIUM · Supabase project (eu-central-1)
// La clave anon (JWT) se puede embeber en cliente con seguridad — RLS hace el trabajo.
// Usamos el custom domain (login.tactium.io) en vez de <ref>.supabase.co para que el
// login con Google muestre "login.tactium.io" en vez del dominio de Supabase. El custom
// domain proxea toda la API (auth/rest/storage/realtime). URL original de respaldo:
// 'https://aabgnylvmntkzmgixlpe.supabase.co'
export const SUPABASE_URL = 'https://login.tactium.io';
export const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhYmdueWx2bW50a3ptZ2l4bHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjUxNTYsImV4cCI6MjA5MzIwMTE1Nn0.E54x79rYq22MLxWbA-huEglHTOojWU9TT4AmUuX0soI';
