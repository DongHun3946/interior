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
}


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


def ensure_schema_compatibility(engine: Engine) -> None:
    """Apply the small in-place schema migrations used by the local application."""
    _drop_removed_columns(engine)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        if "cost_items" in tables:
            cost_columns = {column["name"] for column in inspector.get_columns("cost_items")}
            if "supply_amount" not in cost_columns:
                connection.execute(text("ALTER TABLE cost_items ADD COLUMN supply_amount BIGINT NOT NULL DEFAULT 0"))
                connection.execute(text("UPDATE cost_items SET supply_amount = amount"))
            if "vat_amount" not in cost_columns:
                connection.execute(text("ALTER TABLE cost_items ADD COLUMN vat_amount BIGINT NOT NULL DEFAULT 0"))
