-- Supabase Schema for Banana Studio
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STORAGE SETUP
-- ============================================
-- 1. First, create storage buckets in Supabase Dashboard:
--    a. "generated-images" → Public bucket: ON
--    b. "reference-images" → Public bucket: ON
--
-- 2. Then run these policies:

-- Drop existing storage policies if they exist (makes script idempotent)
DROP POLICY IF EXISTS "Public read access for generated images" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to generated images" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from generated images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for reference images" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to reference images" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from reference images" ON storage.objects;

-- Allow public read access to generated-images bucket
CREATE POLICY "Public read access for generated images"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-images');

-- Allow insert access (for server-side uploads)
CREATE POLICY "Allow uploads to generated images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generated-images');

-- Allow delete access
CREATE POLICY "Allow delete from generated images"
ON storage.objects FOR DELETE
USING (bucket_id = 'generated-images');

-- Allow public read access to reference-images bucket
CREATE POLICY "Public read access for reference images"
ON storage.objects FOR SELECT
USING (bucket_id = 'reference-images');

-- Allow insert access to reference-images bucket
CREATE POLICY "Allow uploads to reference images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'reference-images');

-- Allow delete access to reference-images bucket
CREATE POLICY "Allow delete from reference images"
ON storage.objects FOR DELETE
USING (bucket_id = 'reference-images');

-- ============================================
-- DATABASE TABLES
-- ============================================

-- Projects Table (must be created first as other tables reference it)
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  description TEXT
);

-- Generated Images Table
CREATE TABLE IF NOT EXISTS generated_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  resolution TEXT NOT NULL DEFAULT '2K',
  output_format TEXT NOT NULL DEFAULT 'png',
  safety_filter TEXT NOT NULL DEFAULT 'block_only_high',
  input_image_urls TEXT[] DEFAULT '{}',
  model TEXT DEFAULT NULL
);

-- Migration: Add model column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'generated_images' AND column_name = 'model'
  ) THEN
    ALTER TABLE generated_images ADD COLUMN model TEXT DEFAULT NULL;
  END IF;
END $$;

-- Reference Images Table (for uploaded input images)
CREATE TABLE IF NOT EXISTS reference_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  filename TEXT,
  size_bytes INTEGER
);

-- Video Flows Table (for construction timelapse videos)
CREATE TABLE IF NOT EXISTS video_flows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  before_image_url TEXT NOT NULL,
  after_image_url TEXT NOT NULL,
  video_url TEXT,
  prompt TEXT NOT NULL,
  video_prompt TEXT DEFAULT 'make a timelapse of this construction, camera stays stationary',
  duration TEXT DEFAULT '8s',
  resolution TEXT DEFAULT '720p',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed'))
);

-- Rooms Table (for organizing designs within a project)
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT
);

-- Room Designs Table (stores the design JSON for each room)
CREATE TABLE IF NOT EXISTS room_designs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  design_json JSONB NOT NULL,
  prompt TEXT,
  reference_image_urls TEXT[] DEFAULT '{}',
  before_image_url TEXT,
  rendered_image_url TEXT
);

-- Migration: Add image columns to room_designs if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'room_designs' AND column_name = 'before_image_url'
  ) THEN
    ALTER TABLE room_designs ADD COLUMN before_image_url TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'room_designs' AND column_name = 'rendered_image_url'
  ) THEN
    ALTER TABLE room_designs ADD COLUMN rendered_image_url TEXT;
  END IF;
END $$;

-- Prompt Categories Table
CREATE TABLE IF NOT EXISTS prompt_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT '📁',
  description TEXT
);

-- Prompt Templates Table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category_id UUID NOT NULL REFERENCES prompt_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  use_count INTEGER DEFAULT 0
);

-- Function to increment prompt use count
CREATE OR REPLACE FUNCTION increment_prompt_use_count(prompt_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE prompt_templates
  SET use_count = use_count + 1
  WHERE id = prompt_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_images_project ON generated_images(project_id);
CREATE INDEX IF NOT EXISTS idx_reference_images_project ON reference_images(project_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_use_count ON prompt_templates(use_count DESC);
CREATE INDEX IF NOT EXISTS idx_video_flows_project ON video_flows(project_id);
CREATE INDEX IF NOT EXISTS idx_video_flows_created_at ON video_flows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_project ON rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_designs_room ON room_designs(room_id);
CREATE INDEX IF NOT EXISTS idx_room_designs_created_at ON room_designs(created_at DESC);

-- Function to update project updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects SET updated_at = NOW() WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update project timestamp when images are added
DROP TRIGGER IF EXISTS update_project_on_generated_image ON generated_images;
CREATE TRIGGER update_project_on_generated_image
  AFTER INSERT ON generated_images
  FOR EACH ROW
  WHEN (NEW.project_id IS NOT NULL)
  EXECUTE FUNCTION update_project_timestamp();

DROP TRIGGER IF EXISTS update_project_on_reference_image ON reference_images;
CREATE TRIGGER update_project_on_reference_image
  AFTER INSERT ON reference_images
  FOR EACH ROW
  WHEN (NEW.project_id IS NOT NULL)
  EXECUTE FUNCTION update_project_timestamp();

-- Function to update room updated_at timestamp
CREATE OR REPLACE FUNCTION update_room_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE rooms SET updated_at = NOW() WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update room timestamp when designs are modified
DROP TRIGGER IF EXISTS update_room_on_design ON room_designs;
CREATE TRIGGER update_room_on_design
  AFTER INSERT OR UPDATE ON room_designs
  FOR EACH ROW
  EXECUTE FUNCTION update_room_timestamp();

-- Function to update project timestamp from room changes
CREATE OR REPLACE FUNCTION update_project_from_room_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects SET updated_at = NOW() 
  WHERE id = (SELECT project_id FROM rooms WHERE id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update project timestamp when rooms are modified
DROP TRIGGER IF EXISTS update_project_on_room ON rooms;
CREATE TRIGGER update_project_on_room
  AFTER INSERT OR UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_project_from_room_timestamp();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_designs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (makes script idempotent)
DROP POLICY IF EXISTS "Allow public access to projects" ON projects;
DROP POLICY IF EXISTS "Allow public insert to projects" ON projects;
DROP POLICY IF EXISTS "Allow public update to projects" ON projects;
DROP POLICY IF EXISTS "Allow public delete from projects" ON projects;
DROP POLICY IF EXISTS "Allow public read access to generated_images" ON generated_images;
DROP POLICY IF EXISTS "Allow public insert to generated_images" ON generated_images;
DROP POLICY IF EXISTS "Allow public delete from generated_images" ON generated_images;
DROP POLICY IF EXISTS "Allow public access to reference_images" ON reference_images;
DROP POLICY IF EXISTS "Allow public insert to reference_images" ON reference_images;
DROP POLICY IF EXISTS "Allow public delete from reference_images" ON reference_images;
DROP POLICY IF EXISTS "Allow public read access to prompt_categories" ON prompt_categories;
DROP POLICY IF EXISTS "Allow public read access to prompt_templates" ON prompt_templates;
DROP POLICY IF EXISTS "Allow public update to prompt_templates" ON prompt_templates;

-- Projects table policies (full public access)
CREATE POLICY "Allow public access to projects"
ON projects FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to projects"
ON projects FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update to projects"
ON projects FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete from projects"
ON projects FOR DELETE
USING (true);

-- Allow public read/write access to generated_images
CREATE POLICY "Allow public read access to generated_images"
ON generated_images FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to generated_images"
ON generated_images FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public delete from generated_images"
ON generated_images FOR DELETE
USING (true);

-- Reference images policies (full public access)
CREATE POLICY "Allow public access to reference_images"
ON reference_images FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to reference_images"
ON reference_images FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public delete from reference_images"
ON reference_images FOR DELETE
USING (true);

-- Video flows policies (full public access)
DROP POLICY IF EXISTS "Allow public access to video_flows" ON video_flows;
DROP POLICY IF EXISTS "Allow public insert to video_flows" ON video_flows;
DROP POLICY IF EXISTS "Allow public update to video_flows" ON video_flows;
DROP POLICY IF EXISTS "Allow public delete from video_flows" ON video_flows;

CREATE POLICY "Allow public access to video_flows"
ON video_flows FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to video_flows"
ON video_flows FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update to video_flows"
ON video_flows FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete from video_flows"
ON video_flows FOR DELETE
USING (true);

-- Rooms policies (full public access)
DROP POLICY IF EXISTS "Allow public access to rooms" ON rooms;
DROP POLICY IF EXISTS "Allow public insert to rooms" ON rooms;
DROP POLICY IF EXISTS "Allow public update to rooms" ON rooms;
DROP POLICY IF EXISTS "Allow public delete from rooms" ON rooms;

CREATE POLICY "Allow public access to rooms"
ON rooms FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to rooms"
ON rooms FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update to rooms"
ON rooms FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete from rooms"
ON rooms FOR DELETE
USING (true);

-- Room designs policies (full public access)
DROP POLICY IF EXISTS "Allow public access to room_designs" ON room_designs;
DROP POLICY IF EXISTS "Allow public insert to room_designs" ON room_designs;
DROP POLICY IF EXISTS "Allow public update to room_designs" ON room_designs;
DROP POLICY IF EXISTS "Allow public delete from room_designs" ON room_designs;

CREATE POLICY "Allow public access to room_designs"
ON room_designs FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to room_designs"
ON room_designs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update to room_designs"
ON room_designs FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete from room_designs"
ON room_designs FOR DELETE
USING (true);

-- Allow public read access to prompt_categories
CREATE POLICY "Allow public read access to prompt_categories"
ON prompt_categories FOR SELECT
USING (true);

-- Allow public read access to prompt_templates
CREATE POLICY "Allow public read access to prompt_templates"
ON prompt_templates FOR SELECT
USING (true);

-- Allow public insert to prompt_templates (for user-created prompts)
CREATE POLICY "Allow public insert to prompt_templates"
ON prompt_templates FOR INSERT
WITH CHECK (true);

-- Allow public update to prompt_templates (for use_count increment)
CREATE POLICY "Allow public update to prompt_templates"
ON prompt_templates FOR UPDATE
USING (true);

-- Allow public delete from prompt_templates (for user-created prompts)
CREATE POLICY "Allow public delete from prompt_templates"
ON prompt_templates FOR DELETE
USING (true);

-- Insert default prompt categories
INSERT INTO prompt_categories (name, icon, description) VALUES
  ('🎨 Art Styles', '🎨', 'Different artistic styles and techniques'),
  ('🌄 Landscapes', '🌄', 'Nature, scenery, and environment prompts'),
  ('👤 Portraits', '👤', 'People, faces, and character prompts'),
  ('🏙️ Architecture', '🏙️', 'Buildings, interiors, and urban scenes'),
  ('🐾 Animals', '🐾', 'Wildlife, pets, and creature prompts'),
  ('🚀 Sci-Fi', '🚀', 'Futuristic and science fiction themes'),
  ('✨ Fantasy', '✨', 'Magical and mythical themes'),
  ('📸 Photography', '📸', 'Realistic photo-style prompts'),
  ('🎭 Abstract', '🎭', 'Abstract and experimental visuals'),
  ('🍔 Food', '🍔', 'Food photography and culinary art')
ON CONFLICT (name) DO NOTHING;

-- Insert sample prompt templates
INSERT INTO prompt_templates (category_id, name, prompt, description) VALUES
  -- Art Styles
  ((SELECT id FROM prompt_categories WHERE name = '🎨 Art Styles'), 
   'Oil Painting', 
   'painted in rich oil painting style with visible brushstrokes, classical composition, museum quality, dramatic lighting',
   'Classic oil painting aesthetic'),
  ((SELECT id FROM prompt_categories WHERE name = '🎨 Art Styles'), 
   'Watercolor', 
   'delicate watercolor painting with soft washes, bleeding colors, paper texture visible, ethereal and dreamy',
   'Soft watercolor style'),
  ((SELECT id FROM prompt_categories WHERE name = '🎨 Art Styles'), 
   'Studio Ghibli', 
   'in the style of Studio Ghibli animation, soft colors, whimsical, detailed backgrounds, magical atmosphere',
   'Anime style inspired by Ghibli'),
  ((SELECT id FROM prompt_categories WHERE name = '🎨 Art Styles'), 
   'Pixel Art', 
   'retro pixel art style, 16-bit aesthetic, limited color palette, crisp pixels, nostalgic video game look',
   '16-bit pixel art aesthetic'),

  -- Landscapes
  ((SELECT id FROM prompt_categories WHERE name = '🌄 Landscapes'), 
   'Golden Hour', 
   'during golden hour, warm sunlight, long shadows, magical atmosphere, cinematic composition',
   'Beautiful sunset/sunrise lighting'),
  ((SELECT id FROM prompt_categories WHERE name = '🌄 Landscapes'), 
   'Misty Mountains', 
   'majestic mountain range shrouded in mist, ethereal atmosphere, layers of peaks fading into distance, dramatic scale',
   'Atmospheric mountain scenery'),
  ((SELECT id FROM prompt_categories WHERE name = '🌄 Landscapes'), 
   'Enchanted Forest', 
   'mystical forest with rays of light filtering through ancient trees, magical particles floating, moss-covered, serene',
   'Magical forest atmosphere'),

  -- Portraits
  ((SELECT id FROM prompt_categories WHERE name = '👤 Portraits'), 
   'Cinematic Portrait', 
   'cinematic portrait, shallow depth of field, dramatic rim lighting, movie still quality, emotional expression',
   'Film-quality portrait style'),
  ((SELECT id FROM prompt_categories WHERE name = '👤 Portraits'), 
   'Renaissance Portrait', 
   'Renaissance portrait style, chiaroscuro lighting, dark background, noble pose, oil painting texture, classical',
   'Classical Renaissance aesthetic'),

  -- Architecture
  ((SELECT id FROM prompt_categories WHERE name = '🏙️ Architecture'), 
   'Brutalist', 
   'brutalist architecture, raw concrete, geometric forms, monumental scale, dramatic shadows, urban photography',
   'Bold concrete architecture'),
  ((SELECT id FROM prompt_categories WHERE name = '🏙️ Architecture'), 
   'Cozy Interior', 
   'cozy interior design, warm lighting, plants, natural materials, hygge aesthetic, inviting atmosphere',
   'Warm and welcoming spaces'),

  -- Sci-Fi
  ((SELECT id FROM prompt_categories WHERE name = '🚀 Sci-Fi'), 
   'Cyberpunk City', 
   'cyberpunk cityscape, neon lights, rain-slicked streets, holograms, flying vehicles, blade runner aesthetic',
   'Neon-lit future cities'),
  ((SELECT id FROM prompt_categories WHERE name = '🚀 Sci-Fi'), 
   'Space Station', 
   'orbiting space station, Earth visible below, sleek futuristic design, stars in background, zero gravity',
   'Orbital sci-fi scenes'),

  -- Fantasy
  ((SELECT id FROM prompt_categories WHERE name = '✨ Fantasy'), 
   'Dragon', 
   'majestic dragon with intricate scales, powerful wings, breathing fire, fantasy art, epic scale',
   'Mythical dragon imagery'),
  ((SELECT id FROM prompt_categories WHERE name = '✨ Fantasy'), 
   'Magical Castle', 
   'enchanted castle floating among clouds, waterfalls, glowing windows, fantasy architecture, dreamlike',
   'Fantastical castle scenes'),

  -- Photography
  ((SELECT id FROM prompt_categories WHERE name = '📸 Photography'), 
   'Product Shot', 
   'professional product photography, studio lighting, clean background, sharp focus, commercial quality',
   'Clean product photography'),
  ((SELECT id FROM prompt_categories WHERE name = '📸 Photography'), 
   'Street Photography', 
   'candid street photography, urban environment, decisive moment, natural lighting, documentary style',
   'Urban documentary style'),

  -- Abstract
  ((SELECT id FROM prompt_categories WHERE name = '🎭 Abstract'), 
   'Fluid Art', 
   'fluid abstract art, swirling colors, marble effect, organic flowing shapes, vibrant palette',
   'Flowing abstract patterns'),
  ((SELECT id FROM prompt_categories WHERE name = '🎭 Abstract'), 
   'Geometric', 
   'geometric abstract composition, bold shapes, mathematical precision, modern art, minimalist color scheme',
   'Clean geometric abstraction'),

  -- Food
  ((SELECT id FROM prompt_categories WHERE name = '🍔 Food'), 
   'Food Photography', 
   'professional food photography, appetizing presentation, shallow depth of field, natural lighting, editorial quality',
   'Magazine-quality food shots'),
  ((SELECT id FROM prompt_categories WHERE name = '🍔 Food'), 
   'Rustic Food', 
   'rustic food styling, wooden surfaces, natural ingredients, farm-to-table aesthetic, warm tones',
   'Cozy rustic food aesthetic');

