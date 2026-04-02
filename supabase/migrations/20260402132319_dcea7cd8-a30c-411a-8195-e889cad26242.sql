-- Add new columns to tasks table
ALTER TABLE public.tasks ADD COLUMN category text NOT NULL DEFAULT 'outros';
ALTER TABLE public.tasks ADD COLUMN attachments text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN resolution_note text;

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true);

-- Storage policies for task-attachments bucket
CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Anyone can view task attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can delete task attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments');