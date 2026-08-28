import unittest

from backend.app.models import InquiryStatus
from backend.app.schemas import InquiryCreate, InquiryUpdate


class InquiryStatusTest(unittest.TestCase):
    def test_consultation_completed_is_accepted_for_create_and_update(self):
        created = InquiryCreate(
            customer_name="상담 고객",
            customer_phone="010-1234-5678",
            status=InquiryStatus.CONSULTATION_COMPLETED,
        )
        updated = InquiryUpdate(status=InquiryStatus.CONSULTATION_COMPLETED)

        self.assertEqual(created.status, InquiryStatus.CONSULTATION_COMPLETED)
        self.assertEqual(updated.status, InquiryStatus.CONSULTATION_COMPLETED)


if __name__ == "__main__":
    unittest.main()
