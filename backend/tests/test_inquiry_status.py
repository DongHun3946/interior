import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, text

from backend.app.models import InquiryStatus
from backend.app.schema_compat import _migrate_new_inquiry_status
from backend.app.schemas import InquiryCreate, InquiryUpdate


class InquiryStatusTest(unittest.TestCase):
    def test_new_inquiry_defaults_to_consultation_completed(self):
        created = InquiryCreate(
            customer_name="상담 고객",
            customer_phone="010-1234-5678",
        )

        self.assertEqual(created.status, InquiryStatus.CONSULTATION_COMPLETED)

    def test_consultation_completed_is_accepted_for_create_and_update(self):
        created = InquiryCreate(
            customer_name="상담 고객",
            customer_phone="010-1234-5678",
            status=InquiryStatus.CONSULTATION_COMPLETED,
        )
        updated = InquiryUpdate(status=InquiryStatus.CONSULTATION_COMPLETED)

        self.assertEqual(created.status, InquiryStatus.CONSULTATION_COMPLETED)
        self.assertEqual(updated.status, InquiryStatus.CONSULTATION_COMPLETED)

    def test_legacy_new_status_is_migrated_to_consultation_completed(self):
        with tempfile.TemporaryDirectory(prefix="interior-inquiry-status-test-") as root:
            database = Path(root, "legacy.db").as_posix()
            engine = create_engine(f"sqlite:///{database}")
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "CREATE TABLE estimate_inquiries ("
                        "id INTEGER PRIMARY KEY, status VARCHAR(40) NOT NULL, "
                        "consultation_reserved_at DATETIME, "
                        "consultation_date DATETIME, created_at DATETIME NOT NULL)"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO estimate_inquiries "
                        "(id, status, consultation_date, created_at) VALUES "
                        "(1, 'NEW', '2026-09-01 14:00:00', '2026-09-01 10:00:00')"
                    )
                )

            _migrate_new_inquiry_status(engine)
            _migrate_new_inquiry_status(engine)

            with engine.connect() as connection:
                row = connection.execute(
                    text(
                        "SELECT status, consultation_reserved_at "
                        "FROM estimate_inquiries WHERE id = 1"
                    )
                ).one()

            self.assertEqual(row.status, "CONSULTATION_COMPLETED")
            self.assertIsNone(row.consultation_reserved_at)
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
