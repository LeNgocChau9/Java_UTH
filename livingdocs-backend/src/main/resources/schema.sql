-- LivingDocs Database DDL generated from ERD
BEGIN;

-- 1. Roles & Users & Workspaces (Core Multi-tenancy & Auth)
CREATE TABLE IF NOT EXISTS public.roles
(
    role_id bigserial NOT NULL,
    role_name character varying(50) COLLATE pg_catalog."default" NOT NULL,
    description character varying(255) COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT roles_pkey PRIMARY KEY (role_id),
    CONSTRAINT roles_role_name_key UNIQUE (role_name)
);

CREATE TABLE IF NOT EXISTS public.users
(
    user_id bigserial NOT NULL,
    email character varying(255) COLLATE pg_catalog."default" NOT NULL,
    password_hash character varying(255) COLLATE pg_catalog."default" NOT NULL,
    full_name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    avatar_url character varying(500) COLLATE pg_catalog."default",
    status character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'ACTIVE'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_pkey PRIMARY KEY (user_id),
    CONSTRAINT users_email_key UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS public.workspaces
(
    workspace_id bigserial NOT NULL,
    name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    slug character varying(150) COLLATE pg_catalog."default" NOT NULL,
    owner_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workspaces_pkey PRIMARY KEY (workspace_id),
    CONSTRAINT workspaces_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.workspace_members
(
    workspace_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role_id bigint NOT NULL,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workspace_members_pkey PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens
(
    token_id bigserial NOT NULL,
    user_id bigint NOT NULL,
    token_hash character varying(128) COLLATE pg_catalog."default" NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (token_id),
    CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE TABLE IF NOT EXISTS public.user_notification_preferences
(
    user_id bigint NOT NULL,
    email_enabled boolean NOT NULL DEFAULT true,
    github_enabled boolean NOT NULL DEFAULT true,
    review_enabled boolean NOT NULL DEFAULT true,
    document_enabled boolean NOT NULL DEFAULT true,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (user_id)
);

-- 2. GitHub Connections & Repositories
CREATE TABLE IF NOT EXISTS public.github_connections
(
    connection_id bigserial NOT NULL,
    workspace_id bigint NOT NULL,
    user_id bigint NOT NULL,
    github_user_id bigint,
    github_username character varying(100) COLLATE pg_catalog."default" NOT NULL,
    access_token_encrypted text COLLATE pg_catalog."default" NOT NULL,
    token_scope character varying(255) COLLATE pg_catalog."default",
    token_expires_at timestamp with time zone,
    status character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'CONNECTED'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT github_connections_pkey PRIMARY KEY (connection_id),
    CONSTRAINT uk_gh_conn_workspace_user UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.repositories
(
    repository_id bigserial NOT NULL,
    workspace_id bigint NOT NULL,
    connection_id bigint NOT NULL,
    github_repo_id bigint NOT NULL,
    repo_name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    repo_full_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    default_branch character varying(100) COLLATE pg_catalog."default" NOT NULL DEFAULT 'main'::character varying,
    clone_url character varying(500) COLLATE pg_catalog."default",
    webhook_id bigint,
    is_active boolean NOT NULL DEFAULT true,
    auto_doc_enabled boolean NOT NULL DEFAULT true,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT repositories_pkey PRIMARY KEY (repository_id),
    CONSTRAINT uk_repo_workspace_github_id UNIQUE (workspace_id, github_repo_id)
);

CREATE TABLE IF NOT EXISTS public.pull_requests
(
    pr_id bigserial NOT NULL,
    repository_id bigint NOT NULL,
    github_pr_id bigint NOT NULL,
    pr_number integer NOT NULL,
    title character varying(500) COLLATE pg_catalog."default" NOT NULL,
    head_branch character varying(150) COLLATE pg_catalog."default" NOT NULL,
    base_branch character varying(150) COLLATE pg_catalog."default" NOT NULL,
    head_commit_hash character varying(64) COLLATE pg_catalog."default" NOT NULL,
    base_commit_hash character varying(64) COLLATE pg_catalog."default" NOT NULL,
    state character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'OPEN'::character varying,
    author_username character varying(100) COLLATE pg_catalog."default",
    github_created_at timestamp with time zone,
    github_updated_at timestamp with time zone,
    github_closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pull_requests_pkey PRIMARY KEY (pr_id),
    CONSTRAINT uk_pr_repo_number UNIQUE (repository_id, pr_number)
);

CREATE TABLE IF NOT EXISTS public.commits
(
    commit_id bigserial NOT NULL,
    repository_id bigint NOT NULL,
    commit_hash character varying(64) COLLATE pg_catalog."default" NOT NULL,
    author_name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    author_email character varying(255) COLLATE pg_catalog."default",
    commit_message text COLLATE pg_catalog."default" NOT NULL,
    committed_at timestamp with time zone NOT NULL,
    pr_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT commits_pkey PRIMARY KEY (commit_id),
    CONSTRAINT uk_commit_repo_hash UNIQUE (repository_id, commit_hash)
);

CREATE TABLE IF NOT EXISTS public.code_entities
(
    entity_id bigserial NOT NULL,
    repository_id bigint NOT NULL,
    file_path character varying(500) COLLATE pg_catalog."default" NOT NULL,
    entity_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    class_name character varying(255) COLLATE pg_catalog."default",
    method_name character varying(255) COLLATE pg_catalog."default",
    signature text COLLATE pg_catalog."default",
    return_type character varying(150) COLLATE pg_catalog."default",
    parameters text COLLATE pg_catalog."default",
    start_line integer,
    end_line integer,
    commit_hash character varying(64) COLLATE pg_catalog."default" NOT NULL,
    doc_status character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'UNDOCUMENTED'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT code_entities_pkey PRIMARY KEY (entity_id)
);

-- 3. Templates & Collections
CREATE TABLE IF NOT EXISTS public.doc_templates
(
    id bigserial NOT NULL,
    name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    structure_json jsonb NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT doc_templates_pkey PRIMARY KEY (id),
    CONSTRAINT uk_doc_templates_type UNIQUE (type)
);

CREATE TABLE IF NOT EXISTS public.document_template_versions
(
    version_id bigserial NOT NULL,
    template_id bigint NOT NULL,
    version_num integer NOT NULL,
    structure_json jsonb NOT NULL,
    rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by bigint,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_template_versions_pkey PRIMARY KEY (version_id),
    CONSTRAINT document_template_versions_template_id_version_num_key UNIQUE (template_id, version_num)
);

CREATE TABLE IF NOT EXISTS public.doc_collections
(
    id bigserial NOT NULL,
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    owner_id bigint,
    default_template_id bigint,
    CONSTRAINT doc_collections_pkey PRIMARY KEY (id)
);

-- 4. Documents & Versions
CREATE TABLE IF NOT EXISTS public.documents
(
    doc_id bigserial NOT NULL,
    collection_id bigint,
    repo_id bigint NOT NULL,
    title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    target_path character varying(500) COLLATE pg_catalog."default",
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'DRAFT'::character varying,
    current_version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    template_id bigint,
    source_commit character varying(64) COLLATE pg_catalog."default",
    CONSTRAINT documents_pkey PRIMARY KEY (doc_id)
);

CREATE TABLE IF NOT EXISTS public.document_versions
(
    version_id bigserial NOT NULL,
    doc_id bigint NOT NULL,
    version_num integer NOT NULL,
    content text COLLATE pg_catalog."default",
    actor_role character varying(50) COLLATE pg_catalog."default",
    trigger_type character varying(100) COLLATE pg_catalog."default",
    hash character varying(256) COLLATE pg_catalog."default",
    prev_hash character varying(256) COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_versions_pkey PRIMARY KEY (version_id)
);

-- 5. Reviews & Review Comments
CREATE TABLE IF NOT EXISTS public.reviews
(
    review_id bigserial NOT NULL,
    doc_id bigint,
    version_id bigint,
    reviewer character varying(100) COLLATE pg_catalog."default" NOT NULL,
    general_comment text COLLATE pg_catalog."default",
    result character varying(50) COLLATE pg_catalog."default" DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reviews_pkey PRIMARY KEY (review_id)
);

CREATE TABLE IF NOT EXISTS public.review_comments
(
    comment_id bigserial NOT NULL,
    review_id bigint NOT NULL,
    text_segment character varying(255) COLLATE pg_catalog."default",
    detailed_comment text COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT review_comments_pkey PRIMARY KEY (comment_id)
);

-- 6. Alerts & Policies
CREATE TABLE IF NOT EXISTS public.document_change_alerts
(
    alert_id bigserial NOT NULL,
    document_id bigint NOT NULL,
    repository_id bigint NOT NULL,
    classification character varying(30) COLLATE pg_catalog."default" NOT NULL DEFAULT 'SEMANTIC'::character varying,
    severity character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'MEDIUM'::character varying,
    status character varying(30) COLLATE pg_catalog."default" NOT NULL DEFAULT 'OPEN'::character varying,
    source_commit character varying(64) COLLATE pg_catalog."default",
    source_pr_id bigint,
    details text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp with time zone,
    CONSTRAINT document_change_alerts_pkey PRIMARY KEY (alert_id)
);

CREATE TABLE IF NOT EXISTS public.document_change_policies
(
    policy_id bigserial NOT NULL,
    workspace_id bigint NOT NULL,
    repository_id bigint,
    module_pattern character varying(500) COLLATE pg_catalog."default",
    document_type character varying(100) COLLATE pg_catalog."default",
    threshold integer NOT NULL DEFAULT 1,
    auto_update_enabled boolean NOT NULL DEFAULT false,
    updated_by bigint,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_change_policies_pkey PRIMARY KEY (policy_id)
);

CREATE TABLE IF NOT EXISTS public.document_update_policies
(
    policy_id bigserial NOT NULL,
    document_type character varying(100) COLLATE pg_catalog."default" NOT NULL,
    trigger_commit boolean NOT NULL DEFAULT true,
    trigger_pull_request boolean NOT NULL DEFAULT true,
    trigger_merge boolean NOT NULL DEFAULT true,
    action character varying(40) COLLATE pg_catalog."default" NOT NULL DEFAULT 'REVIEW'::character varying,
    updated_by bigint,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_update_policies_pkey PRIMARY KEY (policy_id),
    CONSTRAINT document_update_policies_document_type_key UNIQUE (document_type)
);

CREATE TABLE IF NOT EXISTS public.manager_approval_policies
(
    policy_id bigserial NOT NULL,
    workspace_id bigint NOT NULL,
    document_type character varying(100) COLLATE pg_catalog."default" NOT NULL,
    approval_required boolean NOT NULL DEFAULT true,
    merge_policy character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'WARN'::character varying,
    updated_by bigint,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT manager_approval_policies_pkey PRIMARY KEY (policy_id),
    CONSTRAINT uk_manager_policy_workspace_type UNIQUE (workspace_id, document_type)
);

CREATE TABLE IF NOT EXISTS public.manager_approval_delegations
(
    delegation_id bigserial NOT NULL,
    workspace_id bigint NOT NULL,
    delegator_id bigint NOT NULL,
    delegate_id bigint NOT NULL,
    starts_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at timestamp with time zone,
    reason text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT manager_approval_delegations_pkey PRIMARY KEY (delegation_id)
);

-- 7. Knowledge RAG & Integrations & Admin
-- Lưu ý: Kiểm tra pgvector trước khi dùng kiểu vector
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.knowledge_chunks
(
    chunk_id bigserial NOT NULL,
    repository_id bigint,
    document_id bigint,
    source_path character varying(500) COLLATE pg_catalog."default" NOT NULL,
    content text COLLATE pg_catalog."default" NOT NULL,
    commit_hash character varying(64) COLLATE pg_catalog."default",
    embedding vector(768),
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (chunk_id)
);

CREATE TABLE IF NOT EXISTS public.external_integrations
(
    integration_id bigserial NOT NULL,
    provider character varying(50) COLLATE pg_catalog."default" NOT NULL,
    workspace_id bigint,
    enabled boolean NOT NULL DEFAULT false,
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    secret_configured boolean NOT NULL DEFAULT false,
    updated_by bigint,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT external_integrations_pkey PRIMARY KEY (integration_id),
    CONSTRAINT external_integrations_provider_workspace_id_key UNIQUE (provider, workspace_id)
);

CREATE TABLE IF NOT EXISTS public.supported_languages
(
    language_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    display_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    updated_by bigint,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT supported_languages_pkey PRIMARY KEY (language_code)
);

CREATE TABLE IF NOT EXISTS public.admin_settings
(
    setting_key character varying(150) COLLATE pg_catalog."default" NOT NULL,
    setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_by bigint,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT admin_settings_pkey PRIMARY KEY (setting_key)
);

CREATE TABLE IF NOT EXISTS public.audit_logs
(
    log_id bigserial NOT NULL,
    user_id bigint,
    action character varying(100) COLLATE pg_catalog."default" NOT NULL,
    resource_type character varying(100) COLLATE pg_catalog."default" NOT NULL,
    resource_id character varying(100) COLLATE pg_catalog."default",
    detail text COLLATE pg_catalog."default",
    ip_address character varying(45) COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id)
);

CREATE TABLE IF NOT EXISTS public.jobs
(
    job_id bigserial NOT NULL,
    type character varying(100) COLLATE pg_catalog."default" NOT NULL,
    payload_json text COLLATE pg_catalog."default" NOT NULL DEFAULT '{}'::text,
    status character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'PENDING'::character varying,
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    last_error text COLLATE pg_catalog."default",
    locked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT jobs_pkey PRIMARY KEY (job_id)
);

-- Foreign Keys & Constraints
ALTER TABLE IF EXISTS public.admin_settings
    ADD CONSTRAINT admin_settings_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.audit_logs
    ADD CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.code_entities
    ADD CONSTRAINT fk_entity_repository FOREIGN KEY (repository_id)
    REFERENCES public.repositories (repository_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.commits
    ADD CONSTRAINT fk_commit_pr FOREIGN KEY (pr_id)
    REFERENCES public.pull_requests (pr_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.commits
    ADD CONSTRAINT fk_commit_repository FOREIGN KEY (repository_id)
    REFERENCES public.repositories (repository_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.doc_collections
    ADD CONSTRAINT doc_collections_default_template_id_fkey FOREIGN KEY (default_template_id)
    REFERENCES public.doc_templates (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.doc_collections
    ADD CONSTRAINT doc_collections_owner_id_fkey FOREIGN KEY (owner_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.document_change_alerts
    ADD CONSTRAINT document_change_alerts_document_id_fkey FOREIGN KEY (document_id)
    REFERENCES public.documents (doc_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.document_change_alerts
    ADD CONSTRAINT document_change_alerts_repository_id_fkey FOREIGN KEY (repository_id)
    REFERENCES public.repositories (repository_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.document_change_policies
    ADD CONSTRAINT document_change_policies_repository_id_fkey FOREIGN KEY (repository_id)
    REFERENCES public.repositories (repository_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_change_policies_repository
    ON public.document_change_policies(repository_id);

ALTER TABLE IF EXISTS public.document_change_policies
    ADD CONSTRAINT document_change_policies_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.document_change_policies
    ADD CONSTRAINT document_change_policies_workspace_id_fkey FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces (workspace_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.document_template_versions
    ADD CONSTRAINT document_template_versions_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.document_template_versions
    ADD CONSTRAINT document_template_versions_template_id_fkey FOREIGN KEY (template_id)
    REFERENCES public.doc_templates (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.document_update_policies
    ADD CONSTRAINT document_update_policies_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.document_versions
    ADD CONSTRAINT document_versions_doc_id_fkey FOREIGN KEY (doc_id)
    REFERENCES public.documents (doc_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.documents
    ADD CONSTRAINT documents_collection_id_fkey FOREIGN KEY (collection_id)
    REFERENCES public.doc_collections (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.documents
    ADD CONSTRAINT documents_template_id_fkey FOREIGN KEY (template_id)
    REFERENCES public.doc_templates (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_template_id
    ON public.documents(template_id);

ALTER TABLE IF EXISTS public.external_integrations
    ADD CONSTRAINT external_integrations_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.external_integrations
    ADD CONSTRAINT external_integrations_workspace_id_fkey FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces (workspace_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.github_connections
    ADD CONSTRAINT fk_gh_conn_user FOREIGN KEY (user_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.github_connections
    ADD CONSTRAINT fk_gh_conn_workspace FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces (workspace_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_gh_conn_workspace
    ON public.github_connections(workspace_id);

ALTER TABLE IF EXISTS public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_document_id_fkey FOREIGN KEY (document_id)
    REFERENCES public.documents (doc_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_repository_id_fkey FOREIGN KEY (repository_id)
    REFERENCES public.repositories (repository_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_repository
    ON public.knowledge_chunks(repository_id);

ALTER TABLE IF EXISTS public.manager_approval_delegations
    ADD CONSTRAINT manager_approval_delegations_delegate_id_fkey FOREIGN KEY (delegate_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.manager_approval_delegations
    ADD CONSTRAINT manager_approval_delegations_delegator_id_fkey FOREIGN KEY (delegator_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.manager_approval_delegations
    ADD CONSTRAINT manager_approval_delegations_workspace_id_fkey FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces (workspace_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.manager_approval_policies
    ADD CONSTRAINT manager_approval_policies_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.manager_approval_policies
    ADD CONSTRAINT manager_approval_policies_workspace_id_fkey FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces (workspace_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.pull_requests
    ADD CONSTRAINT fk_pr_repository FOREIGN KEY (repository_id)
    REFERENCES public.repositories (repository_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.repositories
    ADD CONSTRAINT fk_repo_connection FOREIGN KEY (connection_id)
    REFERENCES public.github_connections (connection_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.repositories
    ADD CONSTRAINT fk_repo_workspace FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces (workspace_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_repo_workspace
    ON public.repositories(workspace_id);

ALTER TABLE IF EXISTS public.review_comments
    ADD CONSTRAINT review_comments_review_id_fkey FOREIGN KEY (review_id)
    REFERENCES public.reviews (review_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.reviews
    ADD CONSTRAINT reviews_doc_id_fkey FOREIGN KEY (doc_id)
    REFERENCES public.documents (doc_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.reviews
    ADD CONSTRAINT reviews_version_id_fkey FOREIGN KEY (version_id)
    REFERENCES public.document_versions (version_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.supported_languages
    ADD CONSTRAINT supported_languages_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_notification_preferences_pkey
    ON public.user_notification_preferences(user_id);

ALTER TABLE IF EXISTS public.workspace_members
    ADD CONSTRAINT fk_wm_role FOREIGN KEY (role_id)
    REFERENCES public.roles (role_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.workspace_members
    ADD CONSTRAINT fk_wm_user FOREIGN KEY (user_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.workspace_members
    ADD CONSTRAINT fk_wm_workspace FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces (workspace_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.workspaces
    ADD CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;

COMMIT;

