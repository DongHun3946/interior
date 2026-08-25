import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from backend.app.schema_compat import ensure_schema_compatibility


class UserLoginIdMigrationTest(unittest.TestCase):
    def test_legacy_cost_items_table_is_dropped(self):
        with tempfile.TemporaryDirectory(prefix="interior-cost-migration-") as temp_dir:
            database_path = Path(temp_dir, "legacy.db").as_posix()
            engine = create_engine(f"sqlite:///{database_path}")
            try:
                with engine.begin() as connection:
                    connection.execute(
                        text(
                            "CREATE TABLE cost_items ("
                            "id VARCHAR(36) PRIMARY KEY, "
                            "name VARCHAR(200) NOT NULL"
                            ")"
                        )
                    )

                ensure_schema_compatibility(engine)

                self.assertNotIn("cost_items", inspect(engine).get_table_names())
            finally:
                engine.dispose()

    def test_email_column_is_migrated_to_login_id(self):
        with tempfile.TemporaryDirectory(prefix="interior-user-migration-") as temp_dir:
            database_path = Path(temp_dir, "legacy.db").as_posix()
            engine = create_engine(f"sqlite:///{database_path}")
            try:
                with engine.begin() as connection:
                    connection.execute(
                        text(
                            "CREATE TABLE users ("
                            "id VARCHAR(36) PRIMARY KEY, "
                            "email VARCHAR(255) NOT NULL UNIQUE"
                            ")"
                        )
                    )
                    connection.execute(
                        text(
                            "INSERT INTO users (id, email) "
                            "VALUES ('admin-id', 'admin@interior.local')"
                        )
                    )

                ensure_schema_compatibility(engine)

                columns = {
                    column["name"] for column in inspect(engine).get_columns("users")
                }
                self.assertIn("login_id", columns)
                self.assertNotIn("email", columns)
                with engine.connect() as connection:
                    login_id = connection.scalar(
                        text("SELECT login_id FROM users WHERE id = 'admin-id'")
                    )
                self.assertEqual(login_id, "admin")
            finally:
                engine.dispose()

    def test_project_image_classification_column_is_added(self):
        with tempfile.TemporaryDirectory(prefix="interior-image-migration-") as temp_dir:
            database_path = Path(temp_dir, "legacy.db").as_posix()
            engine = create_engine(f"sqlite:///{database_path}")
            try:
                with engine.begin() as connection:
                    connection.execute(
                        text(
                            "CREATE TABLE project_images ("
                            "id VARCHAR(36) PRIMARY KEY, "
                            "caption VARCHAR(300)"
                            ")"
                        )
                    )

                ensure_schema_compatibility(engine)

                columns = {
                    column["name"]
                    for column in inspect(engine).get_columns("project_images")
                }
                self.assertIn("classification", columns)
            finally:
                engine.dispose()

    def test_project_contract_estimate_column_is_added(self):
        with tempfile.TemporaryDirectory(prefix="interior-project-migration-") as temp_dir:
            database_path = Path(temp_dir, "legacy.db").as_posix()
            engine = create_engine(f"sqlite:///{database_path}")
            try:
                with engine.begin() as connection:
                    connection.execute(
                        text(
                            "CREATE TABLE projects ("
                            "id VARCHAR(36) PRIMARY KEY, "
                            "title VARCHAR(200) NOT NULL"
                            ")"
                        )
                    )

                ensure_schema_compatibility(engine)

                columns = {
                    column["name"]
                    for column in inspect(engine).get_columns("projects")
                }
                self.assertIn("contract_estimate_id", columns)
                self.assertIn("internal_memo", columns)
            finally:
                engine.dispose()

    def test_company_session_timeout_column_is_added(self):
        with tempfile.TemporaryDirectory(prefix="interior-company-migration-") as temp_dir:
            database_path = Path(temp_dir, "legacy.db").as_posix()
            engine = create_engine(f"sqlite:///{database_path}")
            try:
                with engine.begin() as connection:
                    connection.execute(
                        text(
                            "CREATE TABLE company_settings ("
                            "id VARCHAR(36) PRIMARY KEY, "
                            "business_name VARCHAR(200) NOT NULL"
                            ")"
                        )
                    )
                    connection.execute(
                        text(
                            "INSERT INTO company_settings (id, business_name) "
                            "VALUES ('company-id', '테스트 업체')"
                        )
                    )

                ensure_schema_compatibility(engine)

                columns = {
                    column["name"]
                    for column in inspect(engine).get_columns("company_settings")
                }
                self.assertIn("session_timeout_minutes", columns)
                with engine.connect() as connection:
                    timeout = connection.scalar(
                        text(
                            "SELECT session_timeout_minutes "
                            "FROM company_settings WHERE id = 'company-id'"
                        )
                    )
                self.assertEqual(timeout, 480)
            finally:
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
