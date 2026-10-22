-- documents.template_id có trong schema_update.sql.
-- Dùng để biết tài liệu AI sinh theo template nào khi Staff xem xét.

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS template_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'documents_template_id_fkey'
    ) THEN
        ALTER TABLE documents
            ADD CONSTRAINT documents_template_id_fkey
            FOREIGN KEY (template_id) REFERENCES doc_templates(id) ON DELETE SET NULL;
    END IF;
END $$;
