import unittest
from unittest.mock import patch
from uuid import uuid4

import jwt

from backend.app.core.config import Settings


class PasswordSecurityTest(unittest.TestCase):
    def test_rejects_passwords_over_bcrypt_limit(self):
        from backend.app.security import hash_password, verify_password

        self.assertFalse(verify_password("x" * 73, "$2b$12$invalid"))
        with self.assertRaisesRegex(ValueError, "72"):
            hash_password("x" * 73)

    def test_malformed_hash_is_a_failed_login_not_an_exception(self):
        from backend.app.security import verify_password

        self.assertFalse(verify_password("password", "not-a-bcrypt-hash"))


class TokenSecurityTest(unittest.TestCase):
    def test_generated_token_has_required_claims(self):
        from backend.app.security import access_token_subject, create_access_token, settings

        user_id = uuid4()
        with patch.object(settings, "secret_key", "s" * 32):
            token = create_access_token(str(user_id))

            self.assertEqual(access_token_subject(token), user_id)

    def test_rejects_signed_token_without_expiry_and_identity_claims(self):
        from backend.app.security import access_token_subject, settings

        with patch.object(settings, "secret_key", "s" * 32):
            incomplete = jwt.encode(
                {"sub": str(uuid4())}, settings.secret_key, algorithm="HS256"
            )

            with self.assertRaises(ValueError):
                access_token_subject(incomplete)


class AttemptLimiterTest(unittest.TestCase):
    def test_blocks_at_eight_failures_and_can_be_reset(self):
        from backend.app.security import AttemptLimiter

        limiter = AttemptLimiter(max_attempts=8, window_seconds=10 * 60)

        for _ in range(7):
            self.assertEqual(limiter.record_failure("admin"), 0)
        self.assertGreater(limiter.record_failure("admin"), 0)
        self.assertGreater(limiter.retry_after("admin"), 0)

        limiter.reset("admin")
        self.assertEqual(limiter.retry_after("admin"), 0)


class ProductionConfigurationTest(unittest.TestCase):
    def test_rejects_insecure_production_defaults(self):
        insecure = Settings(
            environment="production",
            database_password="short-db-password",
            secret_key="CHANGE_ME",
            admin_password="short-admin",
            cors_origins="http://example.com",
            _env_file=None,
        )

        with self.assertRaisesRegex(RuntimeError, "SECRET_KEY"):
            insecure.validate_production_security()

    def test_accepts_secure_production_configuration(self):
        secure = Settings(
            environment="production",
            database_password="d" * 24,
            secret_key="s" * 32,
            admin_password="a" * 16,
            cors_origins="https://example.com",
            _env_file=None,
        )

        secure.validate_production_security()


if __name__ == "__main__":
    unittest.main()
