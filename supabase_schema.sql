-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your documents
create table documents (
  id bigserial primary key,
  content text,
  embedding vector(1536), -- 1536 is the dimension for text-embedding-3-small
  subject_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a function to search for documents
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter jsonb default '{}'
) returns table (
  id bigint,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  -- Simple filter by subject_id if provided (assumes filter is { "subject_id": "..." })
  and (filter->>'subject_id' is null or documents.subject_id = filter->>'subject_id')
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create a table to store subjects metadata and structure
create table subjects (
  id text primary key,
  title text not null,
  last_studied timestamp with time zone default now(),
  progress int default 0,
  topics jsonb default '[]'::jsonb, -- Stores the nested topic/subtopic structure
  mindmap_data jsonb default null, -- Stores React Flow nodes/edges for the mindmap
  created_at timestamp with time zone default now()
);
-- 1. Add the metadata columns to the documents table (IF NOT EXISTS is safer)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS material_type text CHECK (material_type IN ('main', 'supplementary')),
ADD COLUMN IF NOT EXISTS topic_name text,
ADD COLUMN IF NOT EXISTS subtopic_name text;

-- 2. Drop the existing function first because we are changing the return type
DROP FUNCTION IF EXISTS match_documents(vector, float, int, jsonb);

-- 3. Replace the match_documents function to support the "Narrow Lens" filtering
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter jsonb default '{}'
) RETURNS TABLE (
  id bigint,
  content text,
  similarity float,
  material_type text,
  topic_name text,
  subtopic_name text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    1 - (d.embedding <=> query_embedding) AS similarity,
    d.material_type,
    d.topic_name,
    d.subtopic_name
  FROM documents d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
    -- Filter by subject_id if provided
    AND (filter->>'subject_id' IS NULL OR d.subject_id = filter->>'subject_id')
    -- "Narrow Lens" strict filter by subtopic_name if provided
    AND (filter->>'subtopic_name' IS NULL OR d.subtopic_name = filter->>'subtopic_name')
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add summary_cache column for storing generated summaries (keyed by subtopicName)
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS summary_cache jsonb DEFAULT '{}'::jsonb;

-- Create table for chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id text REFERENCES subjects(id) ON DELETE CASCADE,
  subtopic_name text,
  title text DEFAULT 'New Chat',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create table for chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create table for practice sessions
CREATE TABLE IF NOT EXISTS practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id text REFERENCES subjects(id) ON DELETE CASCADE,
  subtopic_name text,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
