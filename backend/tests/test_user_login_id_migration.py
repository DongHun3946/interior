import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from backend.app.schema_compat import ensure_schema_compatibility


class UserLoginIdMigrationTest(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
