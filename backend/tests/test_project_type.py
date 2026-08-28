import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from backend.app.models import ProjectType
from backend.app.schema_compat import _migrate_project_type
from backend.app.schemas import ProjectCreate, ProjectUpdate


class ProjectTypeTest(unittest.TestCase):
    def test_project_schema_defaults_to_interior_and_accepts_repair(self):
        interior = ProjectCreate(title="기존 현장", address="서울시 중구")
        repair = ProjectCreate(
            title="보수 현장",
            address="서울시 종로구",
            project_type=ProjectType.REPAIR,
        )

        self.assertEqual(interior.project_type, ProjectType.INTERIOR)
        self.assertEqual(repair.project_type, ProjectType.REPAIR)
        self.assertEqual(
            ProjectUpdate(project_type=ProjectType.PARTIAL_INTERIOR).project_type,
            ProjectType.PARTIAL_INTERIOR,
        )

    def test_legacy_project_table_gets_project_type_column_and_default(self):
        with tempfile.TemporaryDirectory(prefix="interior-project-type-test-") as root:
            database = Path(root, "legacy.db").as_posix()
            engine = create_engine(f"sqlite:///{database}")
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "CREATE TABLE projects ("
                        "id INTEGER PRIMARY KEY, title VARCHAR(200) NOT NULL)"
                    )
                )
                connection.execute(
                    text("INSERT INTO projects (id, title) VALUES (1, '기존 현장')")
                )

            _migrate_project_type(engine)
            _migrate_project_type(engine)

            columns = {
                column["name"] for column in inspect(engine).get_columns("projects")
            }
            indexes = {
                index["name"] for index in inspect(engine).get_indexes("projects")
            }
            with engine.connect() as connection:
                project_type = connection.scalar(
                    text("SELECT project_type FROM projects WHERE id = 1")
                )

            self.assertIn("project_type", columns)
            self.assertIn("ix_projects_project_type", indexes)
            self.assertEqual(project_type, "INTERIOR")
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
