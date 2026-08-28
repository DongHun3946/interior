import unittest
from datetime import date

from pydantic import ValidationError

from backend.app.schemas import InquiryConvert, ProjectCreate, ProjectUpdate


class DateRangeValidationTest(unittest.TestCase):
    def test_project_create_rejects_end_date_before_start_date(self):
        with self.assertRaisesRegex(ValidationError, "공사 종료일은 시작일보다 빠를 수 없습니다"):
            ProjectCreate(
                title="날짜 검증 현장",
                address="서울시 중구",
                planned_start_date=date(2026, 9, 10),
                planned_end_date=date(2026, 9, 9),
            )

    def test_project_update_rejects_invalid_complete_range(self):
        with self.assertRaisesRegex(ValidationError, "공사 종료일은 시작일보다 빠를 수 없습니다"):
            ProjectUpdate(
                planned_start_date=date(2026, 9, 10),
                planned_end_date=date(2026, 9, 9),
            )

    def test_inquiry_conversion_rejects_end_date_before_start_date(self):
        with self.assertRaisesRegex(ValidationError, "공사 종료일은 시작일보다 빠를 수 없습니다"):
            InquiryConvert(
                planned_start_date=date(2026, 9, 10),
                planned_end_date=date(2026, 9, 9),
            )

    def test_same_start_and_end_date_is_allowed(self):
        project = ProjectCreate(
            title="하루 공사",
            address="서울시 중구",
            planned_start_date=date(2026, 9, 10),
            planned_end_date=date(2026, 9, 10),
        )

        self.assertEqual(project.planned_start_date, project.planned_end_date)


if __name__ == "__main__":
    unittest.main()
