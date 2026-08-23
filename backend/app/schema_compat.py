from sqlalchemy import Engine, inspect, text


REMOVED_COLUMNS = {
    "projects": {
        "public_title",
        "public_description",
        "public_area_name",
        "public_address",
        "public_latitude",
        "public_longitude",
    },
    "estimate_inquiries": {
        "customer_email",
        "source",
        "site_visit_date",
        "next_contact_date",
    },
    "estimate_documents": {"status", "valid_until"},
    "payments": {"status", "due_date"},
}


def _migrate_user_login_id(engine: Engine) -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "email" not in columns:
        return

    quote = engine.dialect.identifier_preparer.quote
    with engine.begin() as connection:
        if "login_id" not in columns:
            connection.execute(
                text(
                    f"ALTER TABLE {quote('users')} "
                    f"RENAME COLUMN {quote('email')} TO {quote('login_id')}"
                )
            )
        else:
            connection.execute(
                text(
                    f"UPDATE {quote('users')} SET {quote('login_id')} = {quote('email')} "
                    f"WHERE {quote('login_id')} IS NULL OR {quote('login_id')} = ''"
                )
            )
            for index in inspector.get_indexes("users"):
                if "email" in (index.get("column_names") or []):
                    connection.execute(text(f"DROP INDEX IF EXISTS {quote(index['name'])}"))
            connection.execute(
                text(
                    f"ALTER TABLE {quote('users')} "
                    f"DROP COLUMN {quote('email')}"
                )
            )

        connection.execute(
            text(
                f"UPDATE {quote('users')} SET {quote('login_id')} = :new_login_id "
                f"WHERE {quote('login_id')} = :legacy_login_id "
                f"AND NOT EXISTS ("
                f"SELECT 1 FROM {quote('users')} WHERE {quote('login_id')} = :new_login_id"
                f")"
            ),
            {"legacy_login_id": "admin@interior.local", "new_login_id": "admin"},
        )


def _drop_removed_columns(engine: Engine) -> None:
    quote = engine.dialect.identifier_preparer.quote
    with engine.begin() as connection:
        inspector = inspect(connection)
        tables = set(inspector.get_table_names())
        for table_name, removed_columns in REMOVED_COLUMNS.items():
            if table_name not in tables:
                continue
            existing_columns = {
                column["name"] for column in inspector.get_columns(table_name)
            }
            targets = existing_columns & removed_columns
            if not targets:
                continue
            for index in inspector.get_indexes(table_name):
                if targets.intersection(index.get("column_names") or []):
                    connection.execute(
                        text(f"DROP INDEX IF EXISTS {quote(index['name'])}")
                    )
            for column_name in sorted(targets):
                connection.execute(
                    text(
                        f"ALTER TABLE {quote(table_name)} "
                        f"DROP COLUMN {quote(column_name)}"
                    )
                )


def _migrate_payment_history(engine: Engine) -> None:
    inspector = inspect(engine)
    if "payments" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("payments")}
    if "status" not in columns:
        return
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE payments SET paid_at = COALESCE(paid_at, created_at) "
                "WHERE status = 'PAID'"
            )
        )
        connection.execute(
            text(
                "UPDATE payments SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP) "
                "WHERE status != 'PAID' OR status IS NULL"
            )
        )


def _migrate_company_session_timeout(engine: Engine) -> None:
    inspector = inspect(engine)
    if "company_settings" not in inspector.get_table_names():
        return
    columns = {
        column["name"] for column in inspector.get_columns("company_settings")
    }
    if "session_timeout_minutes" in columns:
        return
    quote = engine.dialect.identifier_preparer.quote
    with engine.begin() as connection:
        connection.execute(
            text(
                f"ALTER TABLE {quote('company_settings')} "
                f"ADD COLUMN {quote('session_timeout_minutes')} "
                "INTEGER NOT NULL DEFAULT 480"
            )
        )


def _migrate_project_contract_estimate(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "projects" not in tables:
        return
    project_columns = {
        column["name"] for column in inspector.get_columns("projects")
    }
    quote = engine.dialect.identifier_preparer.quote
    with engine.begin() as connection:
        if "contract_estimate_id" not in project_columns:
            column_type = "UUID" if engine.dialect.name == "postgresql" else "CHAR(32)"
            connection.execute(
                text(
                    f"ALTER TABLE {quote('projects')} "
                    f"ADD COLUMN {quote('contract_estimate_id')} {column_type}"
                )
            )
        connection.execute(
            text(
                f"CREATE INDEX IF NOT EXISTS {quote('ix_projects_contract_estimate_id')} "
                f"ON {quote('projects')} ({quote('contract_estimate_id')})"
            )
        )
        if {"estimate_inquiries", "estimate_documents"}.issubset(tables):
            connection.execute(
                text(
                    "UPDATE projects SET contract_estimate_id = ("
                    "SELECT estimate_documents.id FROM estimate_documents "
                    "JOIN estimate_inquiries "
                    "ON estimate_inquiries.id = estimate_documents.inquiry_id "
                    "WHERE estimate_inquiries.converted_project_id = projects.id "
                    "ORDER BY estimate_documents.version DESC LIMIT 1"
                    ") WHERE contract_estimate_id IS NULL AND EXISTS ("
                    "SELECT 1 FROM estimate_documents "
                    "JOIN estimate_inquiries "
                    "ON estimate_inquiries.id = estimate_documents.inquiry_id "
                    "WHERE estimate_inquiries.converted_project_id = projects.id"
                    ")"
                )
            )
        if engine.dialect.name == "postgresql":
            foreign_keys = inspect(connection).get_foreign_keys("projects")
            if not any(
                "contract_estimate_id" in (key.get("constrained_columns") or [])
                for key in foreign_keys
            ):
                connection.execute(
                    text(
                        "ALTER TABLE projects "
                        "ADD CONSTRAINT fk_projects_contract_estimate_id "
                        "FOREIGN KEY (contract_estimate_id) "
                        "REFERENCES estimate_documents(id) ON DELETE SET NULL"
                    )
                )


def _migrate_project_content_fields(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "projects" not in tables:
        return
    project_columns = {
        column["name"] for column in inspector.get_columns("projects")
    }
    if "internal_memo" in project_columns:
        return
    quote = engine.dialect.identifier_preparer.quote
    with engine.begin() as connection:
        connection.execute(
            text(
                f"ALTER TABLE {quote('projects')} "
                f"ADD COLUMN {quote('internal_memo')} TEXT"
            )
        )
        if not {"description", "work_scope"}.issubset(project_columns):
            return
        if "estimate_inquiries" in tables:
            connection.execute(
                text(
                    "UPDATE projects SET internal_memo = description, description = NULL "
                    "WHERE description IS NOT NULL AND description != '' AND EXISTS ("
                    "SELECT 1 FROM estimate_inquiries "
                    "WHERE estimate_inquiries.converted_project_id = projects.id"
                    ")"
                )
            )
        connection.execute(
            text(
                "UPDATE projects SET work_scope = description, description = NULL "
                "WHERE (work_scope IS NULL OR work_scope = '') "
                "AND description IS NOT NULL AND description != ''"
            )
        )


def ensure_schema_compatibility(engine: Engine) -> None:
    """Apply the small in-place schema migrations used by the local application."""
    _migrate_user_login_id(engine)
    _migrate_payment_history(engine)
    _migrate_company_session_timeout(engine)
    _migrate_project_contract_estimate(engine)
    _migrate_project_content_fields(engine)
    _drop_removed_columns(engine)
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TYPE paymentstage ADD VALUE IF NOT EXISTS 'LUMP_SUM'")
            )
            connection.execute(text("DROP TYPE IF EXISTS paymentstatus"))
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        if "estimate_lines" in tables:
            connection.execute(
                text(
                    "UPDATE estimate_lines SET quantity = 0 "
                    "WHERE unit = '-' AND quantity = 1"
                )
            )
            connection.execute(
                text("UPDATE estimate_lines SET unit = '' WHERE unit = '-'")
            )
        if "cost_items" in tables:
            cost_columns = {column["name"] for column in inspector.get_columns("cost_items")}
            if "supply_amount" not in cost_columns:
                connection.execute(text("ALTER TABLE cost_items ADD COLUMN supply_amount BIGINT NOT NULL DEFAULT 0"))
                connection.execute(text("UPDATE cost_items SET supply_amount = amount"))
            if "vat_amount" not in cost_columns:
                connection.execute(text("ALTER TABLE cost_items ADD COLUMN vat_amount BIGINT NOT NULL DEFAULT 0"))
            if "estimate_inquiries" in tables:
                connection.execute(
                    text(
                        "UPDATE cost_items SET item_type = :contract "
                        "WHERE item_type = :estimate AND EXISTS ("
                        "SELECT 1 FROM estimate_inquiries "
                        "WHERE estimate_inquiries.converted_project_id = cost_items.project_id"
                        ")"
                    ),
                    {"contract": "CONTRACT", "estimate": "ESTIMATE"},
                )
        if "project_images" in tables:
            image_columns = {
                column["name"]
                for column in inspector.get_columns("project_images")
            }
            if "classification" not in image_columns:
                connection.execute(
                    text(
                        "ALTER TABLE project_images "
                        "ADD COLUMN classification VARCHAR(100)"
                    )
                )
