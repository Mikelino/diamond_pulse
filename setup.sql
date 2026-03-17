-- ============================================================
--  WALK-UP SONGS — Script d'installation Supabase
--  À exécuter une seule fois dans :
--  Supabase Dashboard > SQL Editor > New query
-- ============================================================


-- ── 1. TABLE DE CONFIGURATION ────────────────────────────────
-- Stocke toutes les données de l'appli (joueurs, équipes, identité du club)

CREATE TABLE IF NOT EXISTS config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ligne initiale vide (sera remplie au premier lancement de l'appli)
INSERT INTO config (key, value)
VALUES ('app', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ── 2. ACCÈS PUBLIC EN LECTURE/ÉCRITURE (RLS) ─────────────────
-- L'appli utilise la clé anon, donc on autorise tout via RLS.
-- Pour une sécurité renforcée, vous pouvez restreindre selon vos besoins.

ALTER TABLE config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique" ON config
  FOR SELECT USING (true);

CREATE POLICY "Écriture publique" ON config
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Mise à jour publique" ON config
  FOR UPDATE USING (true);


-- ── 3. BUCKET AUDIO (songs) ───────────────────────────────────
-- Stocke les fichiers MP3/WAV des walk-up songs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('songs', 'songs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Upload audio public" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'songs');

CREATE POLICY "Lecture audio public" ON storage.objects
  FOR SELECT USING (bucket_id = 'songs');

CREATE POLICY "Remplacement audio public" ON storage.objects
  FOR UPDATE USING (bucket_id = 'songs');

CREATE POLICY "Suppression audio public" ON storage.objects
  FOR DELETE USING (bucket_id = 'songs');


-- ── 4. BUCKET PHOTOS (photos) ─────────────────────────────────
-- Stocke les photos de profil des joueurs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Upload photos public" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Lecture photos public" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "Remplacement photos public" ON storage.objects
  FOR UPDATE USING (bucket_id = 'photos');

CREATE POLICY "Suppression photos public" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos');


-- ── TERMINÉ ───────────────────────────────────────────────────
-- Votre base de données est prête.
-- Retournez dans config.js pour renseigner l'URL et la clé Supabase.
