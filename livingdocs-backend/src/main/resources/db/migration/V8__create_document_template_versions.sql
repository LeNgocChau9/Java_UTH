-- document_template_versions theo schema_update.sql
-- version_id, template_id, version_num, structure_json, rules_json, created_by, created_at

CREATE TABLE IF NOT EXISTS document_template_versions (
    version_id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES doc_templates(id) ON DELETE CASCADE,
    version_num INTEGER NOT NULL,
    structure_json JSONB NOT NULL,
    rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_template_versions_template_id_version_num_key UNIQUE (template_id, version_num)
);

CREATE INDEX IF NOT EXISTS idx_document_template_versions_template_id
    ON document_template_versions (template_id, version_num DESC);

ALTER TABLE document_template_versions
    DROP CONSTRAINT IF EXISTS document_template_versions_created_by_fkey;

ALTER TABLE document_template_versions
    ADD CONSTRAINT document_template_versions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL;
