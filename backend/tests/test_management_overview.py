import unittest
from datetime import date
from unittest.mock import Mock, patch

from fastapi import HTTPException

from backend.app.main import management_overview, settings
from backend.app.models import User, UserRole
from backend.app.schemas import ManagementOverviewAccess


class ManagementOverviewTest(unittest.TestCase):
    def setUp(self):
        self.user = User(
            login_id="admin",
            password_hash="unused-for-secondary-authentication",
            name="관리자",
            role=UserRole.ADMIN,
        )

    def test_wrong_password_does_not_query_sensitive_totals(self):
        db = Mock()

        with patch.object(
            settings,
            "management_overview_password",
            "correct-password",
        ):
            with self.assertRaises(HTTPException) as raised:
                management_overview(
                    ManagementOverviewAccess(password="wrong-password"),
                    self.user,
                    db,
                )

        self.assertEqual(raised.exception.status_code, 400)
        db.scalar.assert_not_called()

    def test_correct_password_returns_management_totals(self):
        db = Mock()
        db.scalar.side_effect = [125_000_000, 80_000_000, 3, 4, 7]

        with patch.object(
            settings,
            "management_overview_password",
            "correct-password",
        ):
            result = management_overview(
                ManagementOverviewAccess(password="correct-password"),
                self.user,
                db,
            )

        self.assertEqual(result.total_contract, 125_000_000)
        self.assertEqual(result.total_paid, 80_000_000)
        self.assertEqual(result.planning_projects, 3)
        self.assertEqual(result.in_progress_projects, 4)
        self.assertEqual(result.completed_projects, 7)
        self.assertEqual(db.scalar.call_count, 5)

    def test_missing_secondary_password_rejects_access(self):
        db = Mock()

        with patch.object(settings, "management_overview_password", ""):
            with self.assertRaises(HTTPException) as raised:
                management_overview(
                    ManagementOverviewAccess(password="any-password"),
                    self.user,
                    db,
                )

        self.assertEqual(raised.exception.status_code, 503)
        db.scalar.assert_not_called()

    def test_date_range_is_applied_without_changing_response_shape(self):
        db = Mock()
        db.get_bind.return_value.dialect.name = "sqlite"
        db.scalar.side_effect = [50_000_000, 20_000_000, 2, 1, 3]

        with patch.object(
            settings,
            "management_overview_password",
            "correct-password",
        ):
            result = management_overview(
                ManagementOverviewAccess(
                    password="correct-password",
                    date_from=date(2026, 8, 1),
                    date_to=date(2026, 8, 31),
                ),
                self.user,
                db,
            )

        self.assertEqual(result.total_contract, 50_000_000)
        self.assertEqual(result.total_paid, 20_000_000)
        self.assertEqual(result.planning_projects, 2)
        self.assertEqual(result.in_progress_projects, 1)
        self.assertEqual(result.completed_projects, 3)
        self.assertEqual(db.scalar.call_count, 5)


if __name__ == "__main__":
    unittest.main()
