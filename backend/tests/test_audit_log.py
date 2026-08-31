import unittest

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.app.audit import add_audit_rows  # noqa: F401 - registers the listener
from backend.app.db import Base
from backend.app.models import AuditAction, AuditLog, CompanySettings, User, UserRole
from backend.app.request_context import RequestContext, bind_request_context


def context(request_id: str, method: str = "POST") -> RequestContext:
    return RequestContext(
        request_id=request_id,
        method=method,
        path="/api/v1/company-settings",
        client_ip="127.0.0.1",
        user_agent="test-client",
    )


class AuditLogTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def test_create_and_update_are_recorded_in_same_transaction(self):
        with Session(self.engine, expire_on_commit=False) as db:
            company = CompanySettings(business_name="Before")
            with bind_request_context(context("create-request")):
                db.add(company)
                db.commit()

            with bind_request_context(context("update-request", "PUT")):
                company.business_name = "After"
                db.commit()

            logs = db.scalars(select(AuditLog).order_by(AuditLog.created_at, AuditLog.request_id)).all()

        self.assertEqual(len(logs), 2)
        actions = {log.request_id: log.action for log in logs}
        self.assertEqual(actions["create-request"], AuditAction.CREATE)
        self.assertEqual(actions["update-request"], AuditAction.UPDATE)
        update = next(log for log in logs if log.request_id == "update-request")
        self.assertEqual(update.changes["business_name"], {"before": "Before", "after": "After"})

    def test_rollback_removes_business_change_and_audit_row(self):
        with Session(self.engine) as db:
            with bind_request_context(context("rolled-back")):
                db.add(CompanySettings(business_name="Never saved"))
                db.flush()
                db.rollback()

            self.assertEqual(db.scalar(select(AuditLog)), None)
            self.assertEqual(db.scalar(select(CompanySettings)), None)

    def test_sensitive_values_are_redacted(self):
        with Session(self.engine) as db:
            with bind_request_context(context("user-create")):
                db.add(
                    User(
                        login_id="audit-user",
                        password_hash="must-not-appear",
                        name="감사 사용자",
                        role=UserRole.ADMIN,
                    )
                )
                db.commit()
            log = db.scalar(select(AuditLog).where(AuditLog.entity_type == "USERS"))

        self.assertEqual(log.changes["password_hash"]["after"], "[REDACTED]")
        self.assertNotIn("must-not-appear", str(log.changes))


if __name__ == "__main__":
    unittest.main()
